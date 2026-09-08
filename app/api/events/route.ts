import { NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { accessFailure, privateJson, requireSameOrigin } from "@/lib/server-access";
import { readAuthFlowJson } from "@/lib/auth-flow-input";
import { analyticsSourcePath, sanitiseAnalyticsParameters } from "@/lib/analytics";

export const dynamic = "force-dynamic";
const EventSchema = z.object({
  consent: z.literal("granted"),
  event_name: z.enum(["whatsapp_click", "call_click", "booking_complete", "claim_complete"]),
  source_path: z.string().max(300),
  metadata: z.record(z.union([z.string().max(160), z.number().finite(), z.boolean(), z.null()])).default({}),
});

// Client components cannot read server-only VERCEL_ENV. This contains no secrets
// and fails closed in previews, local builds and non-Vercel environments.
export async function GET() {
  const production = process.env.VERCEL_ENV === "production";
  return privateJson({
    enabled: production,
    // GA's remotely configured Enhanced Measurement can read search text, form data
    // and WhatsApp URLs. Keep GA off until automatic collection is disabled in the
    // existing stream and the operator explicitly confirms that configuration.
    gaEnabled: production && process.env.GA_AUTOMATIC_MEASUREMENT_DISABLED === "true",
  });
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    if (process.env.VERCEL_ENV !== "production") return privateJson({ error: "Optional metrics are disabled in this environment.", code: "metrics_unavailable" }, 503);
    const parsed = EventSchema.safeParse(await readAuthFlowJson(request, 8192));
    if (!parsed.success) return privateJson({ error: "Invalid or non-consenting event." }, 400);
    const metadata = sanitiseAnalyticsParameters(parsed.data.metadata);
    const plumberId = typeof metadata.plumber_id === "string" ? metadata.plumber_id : null;
    if (!plumberId) return privateJson({ error: "A valid public business id is required." }, 400);
    try {
      const result = await getSupabaseAdmin().from("lead_events").insert({
        event_name: parsed.data.event_name, plumber_id: plumberId,
        source_path: analyticsSourcePath(parsed.data.source_path),
        // No source_query, search terms, referrer, request headers or free-text values.
        metadata,
      });
      if (result.error) return privateJson({ error: "Optional metrics could not be recorded.", code: "metrics_unavailable" }, 503);
      return privateJson({ recorded: true }, 201);
    } catch {
      return privateJson({ error: "Optional metrics storage is unavailable.", code: "metrics_unavailable" }, 503);
    }
  } catch (error) { return accessFailure(error); }
}
