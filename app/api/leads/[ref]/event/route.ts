import { NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { accessFailure, privateJson, requireSameOrigin } from "@/lib/server-access";
import { readAuthFlowJson } from "@/lib/auth-flow-input";
import { logLeadActivity, verifyLeadAccessToken } from "@/lib/leads-server";

export const dynamic = "force-dynamic";

const Schema = z.object({ t: z.string().max(64), event: z.enum(["whatsapp_cta_clicked", "confirmation_viewed"]) });

/**
 * Records homeowner actions on the confirmation page.
 * NOTE: a click-to-chat link only proves WhatsApp was OPENED — not that a message was sent.
 * That is why the tag is "whatsapp_opened"; admin adds "customer_confirmed" by hand after chatting.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  try {
    requireSameOrigin(request);
    const { ref } = await params;
    const parsed = Schema.safeParse(await readAuthFlowJson(request, 2048));
    if (!parsed.success || !/^KZN-\d{3,8}$/.test(ref)) return privateJson({ error: "Invalid event." }, 400);
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("leads").select("id, quality_tags").eq("ref", ref).maybeSingle();
    if (!data || !verifyLeadAccessToken(data.id, parsed.data.t)) return privateJson({ error: "Request not found." }, 404);
    if (parsed.data.event === "whatsapp_cta_clicked") {
      const tags = Array.from(new Set([...(data.quality_tags ?? []), "whatsapp_opened"]));
      await admin.from("leads").update({ quality_tags: tags }).eq("id", data.id);
    }
    await logLeadActivity({ lead_id: data.id, actor: "homeowner", event: parsed.data.event });
    return privateJson({ recorded: true }, 201);
  } catch (error) { return accessFailure(error); }
}
