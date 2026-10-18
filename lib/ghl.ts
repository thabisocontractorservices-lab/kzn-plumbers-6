import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";
import { formatWhatsApp } from "@/lib/utils";
import { leadAccessToken, logLeadActivity, plumberContactEmail } from "@/lib/leads-server";
import { ghlApiConfigured, syncLeadViaApi } from "@/lib/ghl-api";

/**
 * GoHighLevel (GHL) connection.
 *  - Outbound (preferred, free): GHL API v2. Every new lead and status change upserts the homeowner contact,
 *    fills the KZN custom fields, adds a tag that starts a GHL workflow, and moves an opportunity in the
 *    "KZN Leads" pipeline. Env: GHL_API_TOKEN + GHL_LOCATION_ID.
 *  - Outbound (backup): POST to a workflow "Inbound Webhook" trigger (env GHL_LEAD_WEBHOOK_URL). GHL charges per run.
 *  - Inbound: GHL workflows POST homeowner answers back to /api/integrations/ghl (env GHL_INBOUND_SECRET).
 * When neither is set, nothing is sent and the site works exactly as before.
 * Failures never block a lead: they are logged on the lead and can be resent from Admin → Leads.
 */

export const GHL_EVENTS = [
  "lead_created", "plumber_assigned", "plumber_viewed", "plumber_accepted", "plumber_declined", "customer_contacted",
  "quote_sent", "job_won", "job_lost", "plumber_removed", "status_changed", "assignment_status_changed", "resend",
  "homeowner_update",
] as const;
export type GhlEvent = (typeof GHL_EVENTS)[number];

const URGENCY_LABEL: Record<string, string> = {
  emergency: "Emergency", today: "Today", few_days: "In the next few days", this_week: "This week", planning: "Planning ahead",
};

export function ghlMode(): "api" | "webhook" | "off" {
  if (ghlApiConfigured()) return "api";
  if (/^https:\/\//.test(process.env.GHL_LEAD_WEBHOOK_URL ?? "")) return "webhook";
  return "off";
}

export function ghlEnabled() {
  return ghlMode() !== "off";
}

export function intlPhone(value?: string | null): string {
  const digits = formatWhatsApp(value ?? "");
  return /^27\d{9}$/.test(digits) ? `+${digits}` : "";
}

function rands(n: unknown) {
  return typeof n === "number" ? `R${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}` : "";
}

type LeadRow = Record<string, unknown> & { id: string; ref: string; status: string };
type AssignmentRow = { id: string; plumber_id: string; status: string; job_value?: number | null; plumbers: { trading_name?: string; slug?: string; whatsapp_number?: string | null } | { trading_name?: string; slug?: string; whatsapp_number?: string | null }[] | null };

/** Flat key/value payload: easy to map in GHL ("Inbound Webhook" → Create/Update Contact). */
export function buildGhlPayload(
  event: GhlEvent,
  lead: LeadRow,
  plumbers: { name: string; phone: string; email: string; profile_url: string; status: string; id: string }[],
  focusPlumberId?: string | null,
  extra: Record<string, unknown> = {},
) {
  const focus = plumbers.find((p) => p.id === focusPlumberId) ?? (plumbers.length === 1 ? plumbers[0] : undefined);
  const payload: Record<string, string | number | boolean> = {
    event,
    event_id: randomUUID(),
    sent_at: new Date().toISOString(),
    source: "kznplumbers.co.za",
    lead_ref: lead.ref,
    lead_status: lead.status,
    lead_type: String(lead.lead_type ?? ""),
    first_name: String(lead.first_name ?? ""),
    last_name: String(lead.last_name ?? ""),
    phone: intlPhone(lead.phone as string),
    whatsapp: intlPhone((lead.whatsapp as string) || (lead.phone as string)),
    email: String(lead.email ?? ""),
    suburb: String(lead.suburb ?? ""),
    area: String(lead.area_label ?? ""),
    service: String(lead.service_label ?? ""),
    urgency: String(lead.urgency ?? ""),
    urgency_label: URGENCY_LABEL[String(lead.urgency)] ?? "",
    is_emergency: lead.urgency === "emergency",
    description: String(lead.description ?? "").slice(0, 1500),
    estimate_low: typeof lead.estimate_low === "number" ? lead.estimate_low : "",
    estimate_high: typeof lead.estimate_high === "number" ? lead.estimate_high : "",
    estimate_text: lead.estimate_low != null && lead.estimate_high != null ? `${rands(lead.estimate_low)} – ${rands(lead.estimate_high)}` : "",
    marketing_opt_in: Boolean(lead.consent_marketing),
    homeowner_link: `${SITE_URL}/get-estimate/received?ref=${encodeURIComponent(lead.ref)}&t=${leadAccessToken(lead.id)}`,
    admin_link: `${SITE_URL}/admin/leads?lead=${encodeURIComponent(lead.ref)}`,
    created_at: String(lead.created_at ?? ""),
    plumber_count: plumbers.length,
    plumber_names: plumbers.map((p) => p.name).join(", "),
    plumber_name: focus?.name ?? "",
    plumber_phone: focus?.phone ?? "",
    plumber_email: focus?.email ?? "",
    plumber_profile_url: focus?.profile_url ?? "",
    plumber_status: focus?.status ?? "",
  };
  plumbers.slice(0, 3).forEach((p, i) => {
    const n = i + 1;
    payload[`plumber_${n}_name`] = p.name;
    payload[`plumber_${n}_phone`] = p.phone;
    payload[`plumber_${n}_email`] = p.email;
    payload[`plumber_${n}_status`] = p.status;
    payload[`plumber_${n}_profile_url`] = p.profile_url;
  });
  for (const [k, v] of Object.entries(extra)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") payload[k] = v;
  }
  return payload;
}

/** Load the lead + its plumbers and send it to GHL. Never throws. Returns true when GHL accepted it. */
export async function sendLeadToGhl(leadId: string, event: GhlEvent, opts: { plumberId?: string | null; extra?: Record<string, unknown> } = {}): Promise<boolean> {
  if (!ghlEnabled()) return false;
  try {
    const admin = getSupabaseAdmin();
    const leadRes = await admin.from("leads").select("*").eq("id", leadId).maybeSingle();
    const lead = leadRes.data as LeadRow | null;
    if (!lead) return false;
    if (!lead.consent_share) return false; // only leads where the homeowner agreed to be contacted about the job
    const asg = await admin.from("lead_assignments")
      .select("id, plumber_id, status, job_value, plumbers!lead_assignments_plumber_id_fkey(trading_name, slug, whatsapp_number)")
      .eq("lead_id", leadId).neq("status", "removed").order("created_at");
    const rows = (asg.data ?? []) as AssignmentRow[];
    const plumbers = await Promise.all(rows.map(async (a) => {
      const p = Array.isArray(a.plumbers) ? a.plumbers[0] : a.plumbers;
      const contact = await plumberContactEmail(a.plumber_id).catch(() => ({ email: null, name: "" }));
      return {
        id: a.plumber_id, status: a.status, name: p?.trading_name ?? contact.name ?? "",
        phone: intlPhone(p?.whatsapp_number), email: contact.email ?? "",
        profile_url: p?.slug ? `${SITE_URL}/plumber/${p.slug}` : "",
      };
    }));
    const payload = buildGhlPayload(event, lead, plumbers, opts.plumberId, opts.extra);

    if (ghlMode() === "api") {
      // Reuse the opportunity created for this lead earlier (kept in the activity log; no DB change needed).
      const prev = await admin.from("lead_activity").select("detail").eq("lead_id", leadId).eq("event", "ghl_sent").order("created_at", { ascending: false }).limit(25);
      const opportunityId = ((prev.data ?? []) as { detail: Record<string, unknown> | null }[]).map((r) => r.detail?.opportunity_id).find((v): v is string => typeof v === "string") ?? null;
      const wonValue = rows.map((r) => r.job_value).find((v): v is number => typeof v === "number" && v > 0);
      const monetaryValue = wonValue ?? (typeof lead.estimate_low === "number" ? lead.estimate_low : undefined);
      const result = await syncLeadViaApi(payload, { opportunityId, monetaryValue });
      await logLeadActivity({ lead_id: leadId, actor: "system", event: "ghl_sent", plumber_id: opts.plumberId ?? null, detail: { ghl_event: event, mode: "api", contact_id: result.contactId, opportunity_id: result.opportunityId, note: result.pipelineNote || undefined } });
      return true;
    }

    const res = await fetch(process.env.GHL_LEAD_WEBHOOK_URL!, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(8000), cache: "no-store",
    });
    await logLeadActivity({ lead_id: leadId, actor: "system", event: res.ok ? "ghl_sent" : "ghl_failed", plumber_id: opts.plumberId ?? null, detail: { ghl_event: event, mode: "webhook", http: res.status } });
    return res.ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ghl] send failed", message);
    await logLeadActivity({ lead_id: leadId, actor: "system", event: "ghl_failed", detail: { ghl_event: event, mode: ghlMode(), error: message.slice(0, 300) } }).catch(() => {});
    return false;
  }
}

// ── Inbound (GHL → website) ────────────────────────────────────────────────

export const GHL_OUTCOMES = ["contacted", "not_contacted", "completed", "not_done", "cancelled"] as const;
export type GhlOutcome = (typeof GHL_OUTCOMES)[number];

export function checkGhlSecret(provided: string | null | undefined): boolean {
  const expected = process.env.GHL_INBOUND_SECRET ?? "";
  if (expected.length < 16 || !provided) return false;
  const a = Buffer.from(provided.replace(/^Bearer\s+/i, "").trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Accepts flat JSON or GHL's standard webhook body (customData / contact custom fields). */
export function parseGhlInbound(body: unknown): { ref: string; outcome: GhlOutcome; note: string } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const custom = (b.customData && typeof b.customData === "object" ? b.customData : {}) as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const k of keys) for (const src of [custom, b]) if (typeof src[k] === "string" && (src[k] as string).trim()) return (src[k] as string).trim();
    return "";
  };
  const ref = pick("lead_ref", "kzn_lead_ref", "ref").toUpperCase();
  const raw = pick("outcome", "kzn_outcome", "status").toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, GhlOutcome> = { done: "completed", complete: "completed", job_done: "completed", yes_contacted: "contacted", no_contact: "not_contacted", not_yet: "not_done", cancel: "cancelled", canceled: "cancelled" };
  const outcome = (GHL_OUTCOMES as readonly string[]).includes(raw) ? raw as GhlOutcome : aliases[raw];
  if (!/^KZN-\d{3,8}$/.test(ref) || !outcome) return null;
  return { ref, outcome, note: pick("note", "message", "reply").slice(0, 500) };
}

/** What a homeowner answer does to the lead. */
export const OUTCOME_EFFECT: Record<GhlOutcome, { status?: string; onlyFrom?: string[]; tag: string; alertAdmin: boolean; label: string }> = {
  contacted: { status: "contacted", onlyFrom: ["new", "qualified", "matched", "sent", "accepted"], tag: "customer_confirmed", alertAdmin: false, label: "Homeowner says a plumber contacted them" },
  not_contacted: { tag: "not_contacted", alertAdmin: true, label: "Homeowner says NO plumber has contacted them" },
  completed: { status: "completed", onlyFrom: ["sent", "accepted", "contacted", "quoted", "won"], tag: "job_completed_confirmed", alertAdmin: false, label: "Homeowner confirms the job was done" },
  not_done: { tag: "job_not_done", alertAdmin: true, label: "Homeowner says the job is NOT done yet" },
  cancelled: { status: "lost", onlyFrom: ["new", "qualified", "matched", "sent", "accepted", "contacted", "quoted"], tag: "homeowner_cancelled", alertAdmin: false, label: "Homeowner cancelled the request" },
};
