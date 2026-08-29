import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";

const EventSchema = z.object({
  event_name: z.enum([
    "whatsapp_click",
    "call_click",
    "booking_complete",
    "claim_complete",
  ]),
  source_path: z.string().max(300),
  source_query: z.string().max(500).optional().default(""),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().default({}),
});

const SAFE_METADATA_KEYS = new Set([
  "plumber_id",
  "area",
  "service",
  "urgency",
  "source_page",
  "rank_position",
  "verification_state",
  "query_match",
]);

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && process.env.NODE_ENV === "production") {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get("host");
    if (originHost !== requestHost && originHost !== new URL(SITE_URL).host) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }
  }
  if (Number(request.headers.get("content-length") || 0) > 8192) {
    return NextResponse.json({ error: "Event payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const metadata = Object.fromEntries(
    Object.entries(parsed.data.metadata)
      .filter(([key]) => SAFE_METADATA_KEYS.has(key))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 160) : value]),
  );

  const plumberId = typeof metadata.plumber_id === "string" ? metadata.plumber_id : null;

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("lead_events").insert({
      event_name: parsed.data.event_name,
      plumber_id: plumberId,
      source_path: parsed.data.source_path,
      source_query: parsed.data.source_query || null,
      metadata,
    });

    if (error) {
      console.warn("[api/events] Event table unavailable:", error.message);
      return NextResponse.json({ accepted: true, stored: false }, { status: 202 });
    }

    return NextResponse.json({ accepted: true, stored: true }, { status: 202 });
  } catch (error) {
    console.warn("[api/events] Analytics storage skipped:", error);
    return NextResponse.json({ accepted: true, stored: false }, { status: 202 });
  }
}
