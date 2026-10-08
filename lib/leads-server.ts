import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AccessError } from "@/lib/server-access";
import { SITE_URL } from "@/lib/site";
import {
  doesService,
  formatEstimate,
  getLeadUrgency,
  plumberScore,
  servesArea,
  type RankablePlumber,
} from "@/lib/leads";

export const LEAD_PHOTO_BUCKET = "lead-photos";

function secret(): string {
  const value = process.env.LEAD_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Lead token secret is unavailable");
  return value;
}

/** Token the homeowner's browser gets back so only they can see their confirmation page. */
export function leadAccessToken(leadId: string): string {
  return createHmac("sha256", secret()).update(`lead-view.v1.${leadId}`).digest("base64url").slice(0, 32);
}

export function verifyLeadAccessToken(leadId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const a = Buffer.from(leadAccessToken(leadId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hashIp(request: Request): string | null {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "";
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10); // rotates daily — not a permanent identifier
  return createHash("sha256").update(`${secret()}.${day}.${ip}`).digest("hex").slice(0, 32);
}

export function isLeadSchemaMissing(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error && (["42P01", "PGRST205", "PGRST204", "42703"].includes(error.code || "") || /leads|lead_assignments|estimate_rules|leads_enabled/.test(error.message || "") && /does not exist|schema cache/.test(error.message || "")));
}

export function leadSchemaError(): AccessError {
  return new AccessError("The quote request system is being set up. Please WhatsApp us in the meantime.", 503);
}

// ── Eligible plumbers ───────────────────────────────────────────────────────

export type LeadPlumberCard = {
  id: string;
  trading_name: string;
  slug: string | null;
  area: string;
  photo_url: string | null;
  rating: number | null;
  review_count: number;
  verified: boolean;
  emergency: boolean;
  services: string[];
  score: number;
};

type PlumberRow = {
  id: string; trading_name: string; slug: string | null; area: string; service_areas: string[] | null;
  specialties: string[] | null; google_rating: number | null; google_review_count: number | null;
  verification_state: string | null; is_emergency: boolean | null; accepts_new_work: boolean | null;
  profile_id: string | null; leads_enabled?: boolean;
};

const PLUMBER_FIELDS = "id, trading_name, slug, area, service_areas, specialties, google_rating, google_review_count, verification_state, is_emergency, accepts_new_work, profile_id, leads_enabled";

/** Claimed + published + lead-enabled. Unclaimed listings never receive leads. */
function eligibleQuery(admin: SupabaseClient) {
  return admin.from("plumbers").select(PLUMBER_FIELDS)
    .eq("is_verified", true).eq("record_status", "published")
    .not("profile_id", "is", null).eq("leads_enabled", true);
}

async function decorate(admin: SupabaseClient, rows: PlumberRow[], serviceKey: string, urgency: string): Promise<LeadPlumberCard[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [photos, reviews] = await Promise.all([
    admin.from("photos").select("plumber_id, photo_url, is_profile_photo").in("plumber_id", ids),
    admin.from("reviews").select("plumber_id, rating").in("plumber_id", ids),
  ]);
  const photoMap = new Map<string, { profile: string | null; count: number; first: string | null }>();
  for (const p of (photos.data ?? []) as { plumber_id: string; photo_url: string; is_profile_photo: boolean }[]) {
    const e = photoMap.get(p.plumber_id) ?? { profile: null, count: 0, first: null };
    e.count++;
    if (p.is_profile_photo) e.profile = p.photo_url;
    if (!e.first) e.first = p.photo_url;
    photoMap.set(p.plumber_id, e);
  }
  const reviewMap = new Map<string, { sum: number; count: number }>();
  for (const r of (reviews.data ?? []) as { plumber_id: string; rating: number }[]) {
    const e = reviewMap.get(r.plumber_id) ?? { sum: 0, count: 0 };
    e.sum += r.rating; e.count++;
    reviewMap.set(r.plumber_id, e);
  }
  return rows.map((r) => {
    const ph = photoMap.get(r.id);
    const rv = reviewMap.get(r.id);
    const rankable: RankablePlumber = {
      ...r, has_photo: Boolean(ph?.profile), photo_count: ph?.count ?? 0,
      internal_rating: rv ? rv.sum / rv.count : null, internal_review_count: rv?.count ?? 0,
    };
    const gCount = r.google_review_count || 0;
    const iCount = rv?.count ?? 0;
    const total = gCount + iCount;
    const rating = total
      ? ((Number(r.google_rating) || 0) * (r.google_rating ? gCount : 0) + (rv ? rv.sum : 0)) / ((r.google_rating ? gCount : 0) + iCount || 1)
      : null;
    return {
      id: r.id, trading_name: r.trading_name, slug: r.slug, area: r.area,
      photo_url: ph?.profile ?? ph?.first ?? null,
      rating: rating ? Math.round(rating * 10) / 10 : null, review_count: total,
      verified: r.verification_state === "credential_verified", emergency: Boolean(r.is_emergency),
      services: (r.specialties || []).slice(0, 4),
      score: plumberScore(rankable, serviceKey, urgency),
    };
  });
}

/** Best claimed plumbers for an area + service. Falls back to area-only if nobody lists the service. */
export async function findEligiblePlumbers(areaKey: string, serviceKey: string, urgency: string, suburb = "", limit = 6) {
  const admin = getSupabaseAdmin();
  const { data, error } = await eligibleQuery(admin).limit(1000);
  if (error) {
    if (isLeadSchemaMissing(error)) throw leadSchemaError();
    throw new AccessError("Could not load plumbers right now. Please try again.", 503);
  }
  const rows = (data ?? []) as PlumberRow[];
  const inArea = rows.filter((r) => servesArea(r, areaKey, suburb));
  const withService = inArea.filter((r) => doesService(r, serviceKey));
  const pool = withService.length ? withService : inArea;
  const cards = await decorate(admin, pool, serviceKey, urgency);
  cards.sort((a, b) => b.score - a.score || a.trading_name.localeCompare(b.trading_name));
  return { plumbers: cards.slice(0, limit), serviceMatched: withService.length > 0 };
}

export async function getEligiblePlumber(id: string, serviceKey = "other", urgency = "planning"): Promise<LeadPlumberCard | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await eligibleQuery(admin).eq("id", id).maybeSingle();
  if (error) {
    if (isLeadSchemaMissing(error)) throw leadSchemaError();
    throw new AccessError("Could not check this plumber right now.", 503);
  }
  if (!data) return null;
  const [card] = await decorate(admin, [data as PlumberRow], serviceKey, urgency);
  return card ?? null;
}

// ── Activity log ────────────────────────────────────────────────────────────

export async function logLeadActivity(entry: {
  lead_id: string; event: string; actor: "system" | "homeowner" | "plumber" | "admin";
  actor_id?: string | null; plumber_id?: string | null; assignment_id?: string | null; detail?: Record<string, unknown>;
}) {
  const { error } = await getSupabaseAdmin().from("lead_activity").insert({ detail: {}, ...entry });
  if (error) console.error("[leads] activity log failed", error.message);
}

// ── Email notifications ─────────────────────────────────────────────────────

const RESEND_API = "https://api.resend.com/emails";
const FROM_EMAIL = process.env.FROM_EMAIL || "KZN Plumbers <admin@kznplumbers.co.za>";
export const LEADS_ADMIN_EMAIL = process.env.LEADS_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@kznplumbers.co.za";

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function sendEmail(to: string[], subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const recipients = to.filter((e) => /^\S+@\S+\.\S+$/.test(e));
  if (!apiKey || !recipients.length) {
    if (!apiKey) console.warn("[leads] RESEND_API_KEY not set — email skipped:", subject);
    return false;
  }
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: recipients, subject, html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.error("[leads] Resend error", res.status, await res.text()); return false; }
    return true;
  } catch (error) {
    console.error("[leads] email failed", error);
    return false;
  }
}

type LeadSummary = {
  ref: string; service_label: string; suburb: string; area_label: string; urgency: string;
  description?: string | null; photo_paths?: string[]; estimate_low?: number | null; estimate_high?: number | null;
  lead_type?: string;
};

function shell(title: string, body: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <div style="background:#1A5FBE;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;font-weight:bold;font-size:18px">${esc(title)}</div>
  <div style="border:1px solid #e5e7eb;border-top:0;padding:20px;border-radius:0 0 10px 10px">${body}</div>
  <p style="font-size:11px;color:#9ca3af;text-align:center">KZNPlumbers · kznplumbers.co.za</p></div>`;
}

function jobTable(l: LeadSummary) {
  const rows: [string, string][] = [
    ["Job", l.ref], ["Service", l.service_label], ["Location", `${l.suburb}, ${l.area_label}`],
    ["Required", getLeadUrgency(l.urgency)?.label ?? l.urgency], ["Photos", l.photo_paths?.length ? `${l.photo_paths.length} available` : "None"],
  ];
  const est = formatEstimate(l.estimate_low, l.estimate_high);
  if (est) rows.push(["Estimate shown", est]);
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#6b7280;width:130px">${esc(k)}</td><td style="padding:6px 0;font-weight:bold">${esc(v)}</td></tr>`).join("")}</table>`;
}

const button = (href: string, label: string, color = "#16a34a") =>
  `<p style="margin:22px 0 6px"><a href="${esc(href)}" style="background:${color};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">${esc(label)}</a></p>`;

export function plumberJobEmail(l: LeadSummary, assignmentId: string, plumberName: string) {
  const link = `${SITE_URL}/dashboard/leads/${assignmentId}`;
  const requested = l.lead_type === "requested_plumber";
  return {
    subject: `NEW KZNPLUMBERS JOB ${l.ref} — ${l.service_label} in ${l.suburb}`,
    html: shell("New KZNPlumbers job", `<p>Hi ${esc(plumberName)},</p>
      <p>${requested ? "A homeowner asked for <b>you specifically</b> on KZNPlumbers." : "A homeowner chose you for this job on KZNPlumbers."}</p>
      ${jobTable(l)}
      ${l.description ? `<p style="background:#f9fafb;padding:12px;border-radius:8px;font-size:14px">${esc(l.description).slice(0, 400)}</p>` : ""}
      ${button(link, "View / Accept Job")}
      <p style="font-size:12px;color:#6b7280">The customer's phone number appears once you accept. Please respond quickly — homeowners usually hire the first plumber who calls.</p>`),
  };
}

export function adminLeadEmail(l: LeadSummary & { first_name: string; plumbers: string[]; source?: string | null }) {
  return {
    subject: `New lead ${l.ref}: ${l.service_label} · ${l.suburb} · ${getLeadUrgency(l.urgency)?.label ?? l.urgency}`,
    html: shell(`New lead ${l.ref}`, `${jobTable(l)}
      <p style="font-size:14px"><b>Customer:</b> ${esc(l.first_name)}<br/><b>Source:</b> ${esc(l.source || "direct")}<br/>
      <b>Sent to:</b> ${l.plumbers.length ? esc(l.plumbers.join(", ")) : "<span style='color:#b91c1c'>Nobody yet — please assign a plumber</span>"}</p>
      ${button(`${SITE_URL}/admin/leads?lead=${encodeURIComponent(l.ref)}`, "Open in admin", "#1A5FBE")}`),
  };
}

export function homeownerConfirmationEmail(l: LeadSummary & { first_name: string; viewUrl: string }) {
  const est = formatEstimate(l.estimate_low, l.estimate_high);
  return {
    subject: `We've received your plumbing request (${l.ref})`,
    html: shell("Your request has been received", `<p>Hi ${esc(l.first_name)},</p>
      <p>We've received your KZNPlumbers request for <b>${esc(l.service_label)}</b> in <b>${esc(l.suburb)}</b>. Your reference is <b>${esc(l.ref)}</b>.</p>
      ${est ? `<p>Estimated cost: <b>${esc(est)}</b><br/><span style="font-size:12px;color:#6b7280">This is an indicative estimate. Final pricing may change after the plumber assesses the job.</span></p>` : ""}
      <p>We're connecting you with suitable plumbers and will keep you updated.</p>
      ${button(l.viewUrl, "View my request", "#1A5FBE")}`),
  };
}

export async function plumberContactEmail(plumberId: string): Promise<{ email: string | null; name: string }> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("plumbers").select("trading_name, profile_id").eq("id", plumberId).maybeSingle();
  if (!data?.profile_id) return { email: null, name: data?.trading_name ?? "there" };
  const { data: profile } = await admin.from("profiles").select("email").eq("id", data.profile_id).maybeSingle();
  return { email: profile?.email ?? null, name: data.trading_name };
}

/** Email one assignment and mark it notified. Returns whether the email went out. */
export async function notifyAssignment(lead: LeadSummary & { id: string }, assignmentId: string, plumberId: string, actor: "system" | "admin" = "system") {
  const { email, name } = await plumberContactEmail(plumberId);
  const message = plumberJobEmail(lead, assignmentId, name);
  const sent = email ? await sendEmail([email], message.subject, message.html) : false;
  const admin = getSupabaseAdmin();
  if (sent) {
    await admin.from("lead_assignments").update({ status: "notified", notified_at: new Date().toISOString() })
      .eq("id", assignmentId).eq("status", "offered");
  }
  await logLeadActivity({
    lead_id: lead.id, assignment_id: assignmentId, plumber_id: plumberId, actor,
    event: sent ? "plumber_notified" : "plumber_notification_failed",
    detail: { channel: "email", reason: sent ? undefined : email ? "send_failed" : "no_email_on_account", plumber: name },
  });
  return sent;
}

export async function signedPhotoUrls(paths: string[] | null | undefined): Promise<string[]> {
  if (!paths?.length) return [];
  const { data } = await getSupabaseAdmin().storage.from(LEAD_PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  return (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
}
