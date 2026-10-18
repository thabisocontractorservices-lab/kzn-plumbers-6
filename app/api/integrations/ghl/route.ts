import { NextRequest, NextResponse, after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkGhlSecret, ghlMode, OUTCOME_EFFECT, parseGhlInbound, sendLeadToGhl } from "@/lib/ghl";
import { LEADS_ADMIN_EMAIL, logLeadActivity, sendEmail } from "@/lib/leads-server";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/**
 * GoHighLevel → website. A GHL workflow "Webhook" action posts the homeowner's answer here.
 * Header:  x-kzn-secret: <GHL_INBOUND_SECRET>   (or Authorization: Bearer <secret>, or ?key=<secret>)
 * Body:    { "lead_ref": "KZN-1024", "outcome": "completed", "note": "optional" }
 * Outcomes: contacted | not_contacted | completed | not_done | cancelled
 */
export async function POST(request: NextRequest) {
  // Secret in a header (preferred) or ?key= on the URL (for GHL webhook actions that cannot set headers).
  const provided = request.headers.get("x-kzn-secret") ?? request.headers.get("authorization") ?? request.nextUrl.searchParams.get("key");
  if (!checkGhlSecret(provided)) {
    return json({ error: "Unauthorised" }, 401);
  }
  const text = await request.text();
  if (text.length > 64_000) return json({ error: "Body too large" }, 413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return json({ error: "Body must be JSON" }, 400); }
  const input = parseGhlInbound(body);
  if (!input) return json({ error: "Send lead_ref (e.g. KZN-1024) and outcome: contacted, not_contacted, completed, not_done or cancelled" }, 400);

  const admin = getSupabaseAdmin();
  const { data: lead, error } = await admin.from("leads").select("id, ref, status, quality_tags").eq("ref", input.ref).maybeSingle();
  if (error) return json({ error: "Could not load the lead" }, 503);
  if (!lead) return json({ error: "Lead not found" }, 404);

  const effect = OUTCOME_EFFECT[input.outcome];
  const patch: Record<string, unknown> = {};
  const tags = new Set<string>((lead.quality_tags as string[] | null) ?? []);
  tags.add(effect.tag);
  patch.quality_tags = [...tags];
  if (effect.status && effect.onlyFrom?.includes(lead.status)) patch.status = effect.status;
  const upd = await admin.from("leads").update(patch).eq("id", lead.id);
  if (upd.error) return json({ error: "Could not update the lead" }, 503);

  await logLeadActivity({ lead_id: lead.id, actor: "homeowner", event: `ghl_${input.outcome}`, detail: { via: "gohighlevel", note: input.note || undefined, from: lead.status, to: patch.status ?? lead.status } });

  // Keep GHL in step (pipeline stage, KZN Lead Status). API mode only: free, and no loop because answers add no workflow tags.
  if (patch.status && ghlMode() === "api") after(() => sendLeadToGhl(lead.id, "homeowner_update"));

  if (effect.alertAdmin) {
    await sendEmail([LEADS_ADMIN_EMAIL], `${lead.ref}: ${effect.label}`,
      `<p><b>${esc(effect.label)}</b> (lead ${esc(lead.ref)}).</p>${input.note ? `<p>Their message: “${esc(input.note)}”</p>` : ""}<p><a href="${SITE_URL}/admin/leads?lead=${encodeURIComponent(lead.ref)}">Open the lead in admin</a> to follow up or assign another plumber.</p>`);
  }
  return json({ ok: true, lead_ref: lead.ref, status: patch.status ?? lead.status });
}

export async function GET() {
  return json({ ok: true, info: "POST homeowner outcomes here from GoHighLevel." });
}
