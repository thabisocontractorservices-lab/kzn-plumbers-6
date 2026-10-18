import "server-only";

/**
 * GoHighLevel API v2 (LeadConnector) client. Free to call, unlike the Inbound Webhook trigger.
 * Auth: a sub-account "Private Integration" token (GHL_API_TOKEN) + the sub-account Location ID (GHL_LOCATION_ID).
 * Required scopes: contacts.readonly, contacts.write, locations/customFields.readonly,
 * locations/customFields.write, opportunities.readonly, opportunities.write.
 */

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

export function ghlApiConfigured() {
  return Boolean(process.env.GHL_API_TOKEN && process.env.GHL_LOCATION_ID);
}

export class GhlApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function ghlRequest<T = Record<string, unknown>>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
      Version: VERSION,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 1) {
    await new Promise((r) => setTimeout(r, 800));
    return ghlRequest<T>(method, path, body, attempt + 1);
  }
  const text = await res.text();
  if (!res.ok) throw new GhlApiError(`GHL ${method} ${path.split("?")[0]} → ${res.status}: ${text.slice(0, 200)}`, res.status);
  return (text ? JSON.parse(text) : {}) as T;
}

const loc = () => process.env.GHL_LOCATION_ID as string;

// ── Custom fields (created automatically the first time) ───────────────────

/** Contact custom fields the website keeps up to date. Name → payload key. */
export const KZN_FIELDS: Record<string, string> = {
  "KZN Lead Ref": "lead_ref",
  "KZN Lead Status": "lead_status",
  "KZN Last Event": "event",
  "KZN Service": "service",
  "KZN Suburb": "suburb",
  "KZN Area": "area",
  "KZN Urgency": "urgency_label",
  "KZN Estimate": "estimate_text",
  "KZN Job Description": "description",
  "KZN Plumber Name": "plumber_name",
  "KZN Plumber Phone": "plumber_phone",
  "KZN Plumber Email": "plumber_email",
  "KZN Plumber Profile": "plumber_profile_url",
  "KZN All Plumbers": "plumber_names",
  "KZN Homeowner Link": "homeowner_link",
  "KZN Admin Link": "admin_link",
};

type FieldCache = { at: number; ids: Record<string, string> };
let fieldCache: FieldCache | null = null;

export function resetGhlCaches() { fieldCache = null; pipelineCache = null; }

export async function ensureCustomFields(): Promise<Record<string, string>> {
  if (fieldCache && Date.now() - fieldCache.at < 10 * 60_000) return fieldCache.ids;
  const list = await ghlRequest<{ customFields?: { id: string; name: string }[] }>("GET", `/locations/${loc()}/customFields?model=contact`);
  const byName = new Map((list.customFields ?? []).map((f) => [f.name.trim().toLowerCase(), f.id]));
  const ids: Record<string, string> = {};
  for (const name of Object.keys(KZN_FIELDS)) {
    let id = byName.get(name.toLowerCase());
    if (!id) {
      const created = await ghlRequest<{ customField?: { id: string } }>("POST", `/locations/${loc()}/customFields`, { name, dataType: name === "KZN Job Description" ? "LARGE_TEXT" : "TEXT", model: "contact" });
      id = created.customField?.id;
    }
    if (id) ids[name] = id;
  }
  fieldCache = { at: Date.now(), ids };
  return ids;
}

// ── Pipeline (optional: "KZN Leads") ───────────────────────────────────────

export const PIPELINE_NAME = () => process.env.GHL_PIPELINE_NAME || "KZN Leads";
type Pipeline = { id: string; stages: Record<string, string> };
let pipelineCache: { at: number; value: Pipeline | null } | null = null;

export async function findPipeline(): Promise<Pipeline | null> {
  if (pipelineCache && Date.now() - pipelineCache.at < 10 * 60_000) return pipelineCache.value;
  const res = await ghlRequest<{ pipelines?: { id: string; name: string; stages?: { id: string; name: string }[] }[] }>("GET", `/opportunities/pipelines?locationId=${encodeURIComponent(loc())}`);
  const p = (res.pipelines ?? []).find((x) => x.name.trim().toLowerCase() === PIPELINE_NAME().toLowerCase());
  const value = p ? { id: p.id, stages: Object.fromEntries((p.stages ?? []).map((s) => [s.name.trim().toLowerCase(), s.id])) } : null;
  pipelineCache = { at: Date.now(), value };
  return value;
}

/** Lead status → pipeline stage name + opportunity status. */
export function stageFor(leadStatus: string): { stage: string; status: "open" | "won" | "lost" | "abandoned" } {
  switch (leadStatus) {
    case "accepted": return { stage: "accepted", status: "open" };
    case "contacted": return { stage: "contacted", status: "open" };
    case "quoted": return { stage: "quoted", status: "open" };
    case "won": return { stage: "job won", status: "open" };
    case "completed": return { stage: "completed", status: "won" };
    case "lost": case "expired": case "no_plumber": return { stage: "", status: "lost" };
    case "invalid": case "duplicate": return { stage: "", status: "abandoned" };
    default: return { stage: "new", status: "open" };
  }
}

/** Events that start a GHL follow-up workflow (via the free "Contact Tag added" trigger). */
export const EVENT_TAGS: Record<string, string> = {
  lead_created: "kzn-new-request",
  plumber_accepted: "kzn-plumber-accepted",
  plumber_declined: "kzn-plumber-declined",
  job_won: "kzn-job-won",
};

// ── Sync one lead ──────────────────────────────────────────────────────────

export async function syncLeadViaApi(payload: Record<string, string | number | boolean>, opts: { opportunityId?: string | null; monetaryValue?: number }) {
  const fieldIds = await ensureCustomFields();
  const customFields = Object.entries(KZN_FIELDS)
    .filter(([name]) => fieldIds[name])
    .map(([name, key]) => ({ id: fieldIds[name], field_value: String(payload[key] ?? "") }));

  const contactBody: Record<string, unknown> = {
    locationId: loc(),
    firstName: payload.first_name || undefined,
    lastName: payload.last_name || undefined,
    phone: payload.phone || undefined,
    email: payload.email || undefined,
    source: "KZN Plumbers",
    customFields,
  };
  const up = await ghlRequest<{ contact?: { id: string } }>("POST", "/contacts/upsert", contactBody);
  const contactId = up.contact?.id;
  if (!contactId) throw new GhlApiError("GHL did not return a contact id", 502);

  // Tags: always kzn-lead; event tags are removed then re-added so a repeat customer's workflow fires again.
  const eventTag = EVENT_TAGS[String(payload.event)];
  if (eventTag) await ghlRequest("DELETE", `/contacts/${contactId}/tags`, { tags: [eventTag] }).catch(() => undefined);
  await ghlRequest("POST", `/contacts/${contactId}/tags`, { tags: ["kzn-lead", ...(eventTag ? [eventTag] : []), ...(payload.is_emergency ? ["kzn-emergency"] : [])] });

  // Opportunity in the "KZN Leads" pipeline, if that pipeline exists.
  let opportunityId = opts.opportunityId ?? null;
  let pipelineNote = "";
  const pipeline = await findPipeline();
  if (!pipeline) pipelineNote = "no_pipeline";
  else {
    const { stage, status } = stageFor(String(payload.lead_status));
    const stageId = (stage && pipeline.stages[stage]) || undefined;
    const name = [payload.lead_ref, payload.service, payload.suburb].filter(Boolean).join(" · ");
    const body: Record<string, unknown> = { name, status, ...(stageId ? { pipelineStageId: stageId } : {}), ...(opts.monetaryValue != null ? { monetaryValue: opts.monetaryValue } : {}) };
    if (opportunityId) {
      try { await ghlRequest("PUT", `/opportunities/${opportunityId}`, body); }
      catch (e) { if (e instanceof GhlApiError && (e.status === 404 || e.status === 400)) opportunityId = null; else throw e; }
    }
    if (!opportunityId) {
      const firstStage = stageId ?? pipeline.stages["new"] ?? Object.values(pipeline.stages)[0];
      const created = await ghlRequest<{ opportunity?: { id: string } }>("POST", "/opportunities/", { ...body, pipelineId: pipeline.id, locationId: loc(), contactId, pipelineStageId: firstStage });
      opportunityId = created.opportunity?.id ?? null;
    }
  }
  return { contactId, opportunityId, pipelineNote };
}
