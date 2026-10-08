// Shared lead-capture logic. Pure functions only — safe on client and server.
import { DIRECTORY_AREAS } from "@/lib/directory";

export const MAX_PLUMBERS_PER_LEAD = 3;
export const KZN_WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_KZN_WHATSAPP_NUMBER || "27609922848").replace(/\D/g, "");

// ── Services ────────────────────────────────────────────────────────────────
// `match` lists the plumber specialties (plumbers.specialties) that can do the job.
// An empty list means any general plumber can be offered the job.
export const LEAD_SERVICES = [
  { key: "blocked_drain", label: "Blocked drain", emoji: "🚿", match: ["Drain cleaning", "Pipe relining"] },
  { key: "burst_pipe", label: "Burst pipe", emoji: "💥", match: ["Burst pipes"] },
  { key: "leak", label: "Leak", emoji: "💧", match: ["Leak detection", "Burst pipes"] },
  { key: "geyser_repair", label: "Geyser repair", emoji: "🔧", match: ["Geyser repair"] },
  { key: "geyser_replacement", label: "Geyser replacement", emoji: "♨️", match: ["Geyser repair", "Solar geyser"] },
  { key: "toilet", label: "Toilet", emoji: "🚽", match: [] },
  { key: "tap", label: "Tap", emoji: "🚰", match: [] },
  { key: "bathroom", label: "Bathroom plumbing", emoji: "🛁", match: ["Bathroom fitting"] },
  { key: "kitchen", label: "Kitchen plumbing", emoji: "🍽️", match: [] },
  { key: "sewer", label: "Sewer issue", emoji: "⚠️", match: ["Drain cleaning", "Pipe relining"] },
  { key: "new_installation", label: "New installation", emoji: "🏗️", match: [] },
  { key: "maintenance", label: "Maintenance", emoji: "🧰", match: [] },
  { key: "solar_geyser", label: "Solar geyser", emoji: "☀️", match: ["Solar geyser"] },
  { key: "gas_fitting", label: "Gas fitting", emoji: "🔥", match: ["Gas fitting"] },
  { key: "other", label: "Other", emoji: "❓", match: [] },
] as const;
export type LeadServiceKey = (typeof LEAD_SERVICES)[number]["key"];
export const getLeadService = (key?: string | null) => LEAD_SERVICES.find((s) => s.key === key) ?? null;

// ── Urgency ─────────────────────────────────────────────────────────────────
export const LEAD_URGENCIES = [
  { key: "emergency", label: "Emergency / ASAP", hint: "Water is running or there's no water", multiplier: 1.35 },
  { key: "today", label: "Today", hint: "Needs attention today", multiplier: 1.15 },
  { key: "few_days", label: "Within 2–3 days", hint: "Soon, but not an emergency", multiplier: 1 },
  { key: "this_week", label: "This week", hint: "Any time this week", multiplier: 1 },
  { key: "planning", label: "Planning / quote only", hint: "Getting prices for later", multiplier: 1 },
] as const;
export type LeadUrgencyKey = (typeof LEAD_URGENCIES)[number]["key"];
export const getLeadUrgency = (key?: string | null) => LEAD_URGENCIES.find((u) => u.key === key) ?? null;

// ── Areas (re-uses the directory's areas so matching lines up with listings) ──
export const LEAD_AREAS = DIRECTORY_AREAS.filter((a) => a.key !== "durban");
export const getLeadArea = (key?: string | null) => DIRECTORY_AREAS.find((a) => a.key === key) ?? null;

// ── Statuses ────────────────────────────────────────────────────────────────
export const LEAD_STATUSES = [
  "new", "qualified", "matched", "sent", "accepted", "contacted", "quoted",
  "won", "completed", "lost", "invalid", "duplicate", "no_plumber", "expired",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New", qualified: "Qualified", matched: "Matched", sent: "Sent to plumber", accepted: "Accepted",
  contacted: "Customer contacted", quoted: "Quote sent", won: "Job won", completed: "Completed",
  lost: "Lost", invalid: "Invalid", duplicate: "Duplicate", no_plumber: "No plumber available", expired: "Expired",
};

export const LEAD_STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-800", qualified: "bg-blue-100 text-blue-800", matched: "bg-indigo-100 text-indigo-800",
  sent: "bg-indigo-100 text-indigo-800", accepted: "bg-teal-light text-teal", contacted: "bg-teal-light text-teal",
  quoted: "bg-amber-light text-amber", won: "bg-green-100 text-green-800", completed: "bg-green-100 text-green-800",
  lost: "bg-gray-100 text-gray-600", invalid: "bg-red-100 text-red-700", duplicate: "bg-gray-100 text-gray-600",
  no_plumber: "bg-red-100 text-red-700", expired: "bg-gray-100 text-gray-600",
};

/** Progress order used to roll plumber outcomes up to the lead. */
const PROGRESS: Partial<Record<string, number>> = { sent: 1, accepted: 2, contacted: 3, quoted: 4, won: 5 };
export const ASSIGNMENT_TO_LEAD: Record<string, LeadStatus | null> = {
  accepted: "accepted", contacted: "contacted", quoted: "quoted", won: "won",
};

/** Lead status after a plumber moves forward; never moves a lead backwards or out of a closed state. */
export function rollUpLeadStatus(current: LeadStatus, assignmentStatus: string): LeadStatus {
  const target = ASSIGNMENT_TO_LEAD[assignmentStatus];
  if (!target) return current;
  if (["completed", "invalid", "duplicate"].includes(current)) return current;
  if (current === "won") return current;
  return (PROGRESS[target] ?? 0) > (PROGRESS[current] ?? 0) ? target : current;
}

/** Plumber-facing labels for a lead assignment. */
export const JOB_STATUS: Record<string, { label: string; style: string }> = {
  offered: { label: "New", style: "bg-green-600 text-white" },
  notified: { label: "New", style: "bg-green-600 text-white" },
  viewed: { label: "Waiting for you", style: "bg-amber-light text-amber" },
  accepted: { label: "Accepted", style: "bg-teal-light text-teal" },
  contacted: { label: "Contacted", style: "bg-teal-light text-teal" },
  quoted: { label: "Quote sent", style: "bg-blue-100 text-blue-800" },
  won: { label: "Won", style: "bg-green-100 text-green-800" },
  lost: { label: "Lost", style: "bg-gray-100 text-gray-600" },
  declined: { label: "Declined", style: "bg-gray-100 text-gray-600" },
  expired: { label: "Expired", style: "bg-gray-100 text-gray-600" },
};

// ── Estimates ───────────────────────────────────────────────────────────────
export type EstimateRule = { service_key: string; low: number | null; high: number | null; note?: string | null };

/** Rounded indicative range. Emergency/today jobs carry the after-hours premium plumbers usually charge. */
export function estimateRange(rule: EstimateRule | null | undefined, urgency: string): { low: number; high: number } | null {
  if (!rule || rule.low == null || rule.high == null || rule.low <= 0 || rule.high < rule.low) return null;
  const m = getLeadUrgency(urgency)?.multiplier ?? 1;
  const round = (v: number) => Math.round(v / 50) * 50;
  return { low: round(rule.low * m), high: round(rule.high * m) };
}

export function formatRandWhole(value: number): string {
  return `R${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function formatEstimate(low?: number | null, high?: number | null): string | null {
  if (low == null || high == null) return null;
  return `${formatRandWhole(low)} – ${formatRandWhole(high)}`;
}

// ── Plumber ranking ─────────────────────────────────────────────────────────
export type RankablePlumber = {
  id: string;
  area: string;
  service_areas?: string[] | null;
  specialties?: string[] | null;
  google_rating?: number | null;
  google_review_count?: number | null;
  internal_rating?: number | null;
  internal_review_count?: number | null;
  has_photo?: boolean;
  photo_count?: number;
  verification_state?: string | null;
  is_emergency?: boolean | null;
  accepts_new_work?: boolean | null;
};

export function servesArea(p: Pick<RankablePlumber, "area" | "service_areas">, areaKey: string, suburb = ""): boolean {
  const area = getLeadArea(areaKey);
  if (!area) return false;
  const names = [...area.dbAreas, area.label, area.key].map((v) => v.toLowerCase());
  if (names.includes((p.area || "").toLowerCase())) return true;
  const extra = (p.service_areas || []).map((v) => v.toLowerCase().trim());
  const sub = suburb.toLowerCase().trim();
  return extra.some((v) => names.includes(v) || (sub.length > 2 && (v === sub || v.includes(sub))));
}

export function doesService(p: Pick<RankablePlumber, "specialties">, serviceKey: string): boolean {
  const svc = getLeadService(serviceKey);
  if (!svc || svc.match.length === 0) return true;
  const have = (p.specialties || []).map((s) => s.toLowerCase());
  return svc.match.some((m) => have.includes(m.toLowerCase()));
}

/** Higher = shown first. Favours real reviews, photos, credentials and readiness for the job. */
export function plumberScore(p: RankablePlumber, serviceKey: string, urgency: string): number {
  const reviews = (p.google_review_count || 0) + (p.internal_review_count || 0);
  const ratingPairs = [
    [p.google_rating, p.google_review_count],
    [p.internal_rating, p.internal_review_count],
  ].filter(([r, c]) => r && c) as [number, number][];
  const rating = ratingPairs.length
    ? ratingPairs.reduce((s, [r, c]) => s + r * c, 0) / ratingPairs.reduce((s, [, c]) => s + c, 0)
    : 0;
  let score = 0;
  score += rating ? (rating - 3) * 12 : 0;               // 5★ = +24, 4★ = +12
  score += Math.min(Math.log10(reviews + 1) * 10, 25);    // more reviews, diminishing
  score += p.has_photo ? 12 : 0;
  score += Math.min((p.photo_count || 0) * 2, 10);
  score += p.verification_state === "credential_verified" ? 15 : 0;
  score += p.accepts_new_work ? 6 : 0;
  score += doesService(p, serviceKey) && (getLeadService(serviceKey)?.match.length ?? 0) > 0 ? 10 : 0;
  score += (urgency === "emergency" || urgency === "today") && p.is_emergency ? 12 : 0;
  return Math.round(score * 10) / 10;
}

// ── Attribution ─────────────────────────────────────────────────────────────
export const ATTRIBUTION_KEYS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ad", "adset", "keyword",
] as const;

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>> & {
  landing_page?: string;
  referrer?: string;
  first_seen_at?: string;
  page?: string;
};

export function cleanAttribution(input: unknown): Attribution {
  const out: Attribution = {};
  if (!input || typeof input !== "object") return out;
  const src = input as Record<string, unknown>;
  for (const key of [...ATTRIBUTION_KEYS, "landing_page", "referrer", "first_seen_at", "page"] as const) {
    const v = src[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, key === "landing_page" || key === "referrer" || key === "page" ? 300 : 150);
  }
  return out;
}

/** Plain-English source for reporting: "facebook / paid", "google / organic", "directory" … */
export function deriveSource(a: Attribution): { source: string; medium: string; campaign: string | null } {
  const campaign = a.utm_campaign || null;
  if (a.utm_source) return { source: a.utm_source.toLowerCase(), medium: (a.utm_medium || "unknown").toLowerCase(), campaign };
  if (a.gclid || a.gbraid || a.wbraid) return { source: "google", medium: "cpc", campaign };
  if (a.fbclid) return { source: "facebook", medium: "paid_social", campaign };
  const ref = (a.referrer || "").toLowerCase();
  if (/google\./.test(ref)) return { source: "google", medium: "organic", campaign };
  if (/bing\./.test(ref)) return { source: "bing", medium: "organic", campaign };
  if (/facebook\.|fb\.|instagram\./.test(ref)) return { source: ref.includes("instagram") ? "instagram" : "facebook", medium: "social", campaign };
  if (/whatsapp|wa\.me/.test(ref)) return { source: "whatsapp", medium: "referral", campaign };
  if (ref && !/kznplumbers\.co\.za/.test(ref)) return { source: ref.replace(/^https?:\/\//, "").split("/")[0], medium: "referral", campaign };
  const page = a.page || "";
  if (/^\/plumber\//.test(page)) return { source: "directory", medium: "profile", campaign };
  if (page && page !== "/get-estimate") return { source: "directory", medium: "site", campaign };
  return { source: "direct", medium: "none", campaign };
}

// ── WhatsApp ────────────────────────────────────────────────────────────────
export function leadWhatsAppMessage(l: { ref: string; service_label: string; suburb: string; area_label: string; urgency: string }): string {
  const urgency = getLeadUrgency(l.urgency)?.label ?? l.urgency;
  return [
    "Hi KZNPlumbers 👋",
    "I've just submitted a plumbing request through your website.",
    "",
    `Reference: ${l.ref}`,
    `Service: ${l.service_label}`,
    `Area: ${l.suburb}, ${l.area_label}`,
    `Urgency: ${urgency}`,
    "",
    "I've received the estimated price range and I'd like help finding a plumber.",
  ].join("\n");
}

export function leadWhatsAppUrl(message: string, number = KZN_WHATSAPP_NUMBER): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export const CONSENT_TEXT =
  "I agree that KZNPlumbers may store my request and share my details with the plumbers I chose (or that KZNPlumbers selects for me) so they can contact me about this job. See the Privacy Policy.";
