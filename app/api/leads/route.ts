import "server-only";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AccessError, accessFailure, privateJson, requireSameOrigin } from "@/lib/server-access";
import { readAuthFlowFormData } from "@/lib/auth-flow-input";
import { formatWhatsApp, isValidSAPhone } from "@/lib/utils";
import { SITE_URL } from "@/lib/site";
import {
  CONSENT_TEXT,
  MAX_PLUMBERS_PER_LEAD,
  cleanAttribution,
  deriveSource,
  estimateRange,
  getLeadArea,
  getLeadService,
  type EstimateRule,
} from "@/lib/leads";
import {
  LEAD_PHOTO_BUCKET,
  LEADS_ADMIN_EMAIL,
  adminLeadEmail,
  getEligiblePlumber,
  hashIp,
  homeownerConfirmationEmail,
  isLeadSchemaMissing,
  leadAccessToken,
  leadSchemaError,
  logLeadActivity,
  notifyAssignment,
  sendEmail,
} from "@/lib/leads-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 2.5 * 1024 * 1024; // browser shrinks photos first; whole request stays under Vercel's 4.5 MB
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const Schema = z.object({
  area_key: z.string().max(40),
  suburb: z.string().trim().min(2, "Enter your suburb").max(80),
  postcode: z.string().trim().max(10).optional().default(""),
  service_key: z.string().max(40),
  urgency: z.enum(["emergency", "today", "few_days", "this_week", "planning"]),
  description: z.string().trim().max(1500).optional().default(""),
  plumber_ids: z.array(z.string().uuid()).max(MAX_PLUMBERS_PER_LEAD).default([]),
  preferred_plumber_id: z.string().uuid().nullable().optional(),
  fallback_allowed: z.boolean().default(false),
  first_name: z.string().trim().min(2, "Enter your first name").max(60),
  last_name: z.string().trim().max(60).optional().default(""),
  phone: z.string().trim().max(30).refine(isValidSAPhone, "Enter a valid SA cellphone number"),
  whatsapp: z.string().trim().max(30).optional().default(""),
  email: z.union([z.literal(""), z.string().trim().email("Check your email address").max(200)]).optional().default(""),
  consent_share: z.literal(true, { errorMap: () => ({ message: "Please tick the box so we can share your request with plumbers" }) }),
  consent_marketing: z.boolean().default(false),
  attribution: z.unknown().optional(),
  website: z.string().max(0).optional().default(""), // honeypot: real people never fill this in
  started_at: z.number().optional(),
});

function safeHeader(value: string | null, max = 200) {
  return value ? value.slice(0, max) : null;
}

function matchesImage(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mime === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const form = await readAuthFlowFormData(request, 4_400_000);
    let raw: unknown;
    try { raw = JSON.parse(String(form.get("data") || "{}")); } catch { throw new AccessError("Invalid request.", 400); }
    const parsed = Schema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.flatten().fieldErrors;
      const first = Object.values(issues).flat()[0];
      return privateJson({ error: first || "Please check your details and try again.", issues }, 400);
    }
    const input = parsed.data;

    // Bots: honeypot filled, or the whole form completed in under 4 seconds.
    if (input.website || (input.started_at && Date.now() - input.started_at < 4000)) {
      return privateJson({ error: "Please try again." }, 400);
    }

    const area = getLeadArea(input.area_key);
    const service = getLeadService(input.service_key);
    if (!area) return privateJson({ error: "Choose your area." }, 400);
    if (!service) return privateJson({ error: "Choose the plumbing job." }, 400);

    const admin = getSupabaseAdmin();
    const ipHash = hashIp(request);
    const phone = formatWhatsApp(input.phone);
    const whatsapp = input.whatsapp && isValidSAPhone(input.whatsapp) ? formatWhatsApp(input.whatsapp) : phone;

    // Rate limit: max 6 requests per network per hour.
    if (ipHash) {
      const since = new Date(Date.now() - 3600_000).toISOString();
      const recent = await admin.from("leads").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
      if (recent.error && isLeadSchemaMissing(recent.error)) throw leadSchemaError();
      if ((recent.count ?? 0) >= 6) return privateJson({ error: "Too many requests from this connection. Please WhatsApp us instead." }, 429);
    }

    // Duplicate: same phone + same job in the last 24 hours → return the existing request.
    const dupSince = new Date(Date.now() - 86400_000).toISOString();
    const dup = await admin.from("leads").select("id, ref").eq("phone", phone).eq("service_key", service.key)
      .gte("created_at", dupSince).not("status", "in", "(invalid,duplicate)").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (dup.error && isLeadSchemaMissing(dup.error)) throw leadSchemaError();
    if (dup.data) {
      await logLeadActivity({ lead_id: dup.data.id, actor: "homeowner", event: "duplicate_submission_blocked", detail: { suburb: input.suburb } });
      return privateJson({ ref: dup.data.ref, token: leadAccessToken(dup.data.id), duplicate: true }, 200);
    }

    // Requested plumber (from a profile page) and homeowner-chosen plumbers — re-checked on the server.
    const requestedIds = Array.from(new Set([input.preferred_plumber_id, ...input.plumber_ids].filter(Boolean) as string[])).slice(0, MAX_PLUMBERS_PER_LEAD);
    const chosen = (await Promise.all(requestedIds.map((id) => getEligiblePlumber(id, service.key, input.urgency)))).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getEligiblePlumber>>>[];
    const preferred = input.preferred_plumber_id ? chosen.find((p) => p.id === input.preferred_plumber_id) ?? null : null;
    const leadType = preferred ? "requested_plumber" : "marketplace";

    // Estimate
    const ruleRes = await admin.from("estimate_rules").select("service_key, low, high, note").eq("service_key", service.key).eq("active", true).maybeSingle();
    const estimate = estimateRange(ruleRes.data as EstimateRule | null, input.urgency);

    const attribution = cleanAttribution(input.attribution);
    const src = deriveSource(attribution);

    const insert = await admin.from("leads").insert({
      lead_type: leadType,
      status: chosen.length ? "sent" : "new",
      plumber_choice: chosen.length ? "homeowner" : "kzn",
      preferred_plumber_id: preferred?.id ?? null,
      fallback_allowed: preferred ? input.fallback_allowed : true,
      first_name: input.first_name, last_name: input.last_name || null,
      phone, whatsapp, email: input.email ? input.email.toLowerCase() : null,
      area_key: area.key, area_label: area.label, suburb: input.suburb, postcode: input.postcode || null,
      service_key: service.key, service_label: service.label, urgency: input.urgency,
      description: input.description || null,
      estimate_low: estimate?.low ?? null, estimate_high: estimate?.high ?? null,
      consent_share: true, consent_marketing: input.consent_marketing, consent_text: CONSENT_TEXT, consent_at: new Date().toISOString(),
      source: src.source, medium: src.medium, campaign: src.campaign, attribution,
      ip_hash: ipHash, user_agent: safeHeader(request.headers.get("user-agent")),
    }).select("id, ref").single();
    if (insert.error || !insert.data) {
      if (isLeadSchemaMissing(insert.error)) throw leadSchemaError();
      console.error("[leads] insert failed", insert.error);
      throw new AccessError("Your request could not be saved. Please try again or WhatsApp us.", 503);
    }
    const lead = insert.data as { id: string; ref: string };
    await logLeadActivity({ lead_id: lead.id, actor: "homeowner", event: "lead_created", detail: { lead_type: leadType, source: src.source, campaign: src.campaign, chosen: chosen.map((c) => c.trading_name) } });

    // Photos — saved after the lead so a photo problem never loses the request.
    const photoPaths: string[] = [];
    const files = form.getAll("photos").filter((f): f is File => f instanceof File).slice(0, MAX_PHOTOS);
    for (const file of files) {
      if (!PHOTO_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_PHOTO_BYTES) continue;
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!matchesImage(bytes, file.type)) continue;
      const path = `${lead.id}/${randomUUID()}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"}`;
      const up = await admin.storage.from(LEAD_PHOTO_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
      if (!up.error) photoPaths.push(path);
    }
    if (photoPaths.length) await admin.from("leads").update({ photo_paths: photoPaths }).eq("id", lead.id);

    // Assign + notify the plumbers the homeowner chose.
    const summary = {
      id: lead.id, ref: lead.ref, service_label: service.label, suburb: input.suburb, area_label: area.label,
      urgency: input.urgency, description: input.description, photo_paths: photoPaths,
      estimate_low: estimate?.low ?? null, estimate_high: estimate?.high ?? null, lead_type: leadType,
    };
    const autoNotify = process.env.LEADS_AUTO_NOTIFY !== "false";
    for (const plumber of chosen) {
      const a = await admin.from("lead_assignments").insert({
        lead_id: lead.id, plumber_id: plumber.id, chosen_by: plumber.id === preferred?.id ? "preferred" : "homeowner",
      }).select("id").single();
      if (a.error || !a.data) { console.error("[leads] assignment failed", a.error?.message); continue; }
      await logLeadActivity({ lead_id: lead.id, assignment_id: a.data.id, plumber_id: plumber.id, actor: "homeowner", event: "plumber_chosen", detail: { plumber: plumber.trading_name } });
      if (autoNotify) await notifyAssignment(summary, a.data.id, plumber.id);
    }

    const token = leadAccessToken(lead.id);
    const viewUrl = `${SITE_URL}/get-estimate/received?ref=${encodeURIComponent(lead.ref)}&t=${token}`;
    const adminMail = adminLeadEmail({ ...summary, first_name: input.first_name, plumbers: chosen.map((c) => c.trading_name), source: [src.source, src.medium, src.campaign].filter(Boolean).join(" / ") });
    const jobs: Promise<unknown>[] = [sendEmail([LEADS_ADMIN_EMAIL], adminMail.subject, adminMail.html)];
    if (input.email) {
      const mail = homeownerConfirmationEmail({ ...summary, first_name: input.first_name, viewUrl });
      jobs.push(sendEmail([input.email], mail.subject, mail.html));
    }
    await Promise.allSettled(jobs);

    return privateJson({ ref: lead.ref, token }, 201);
  } catch (error) { return accessFailure(error); }
}
