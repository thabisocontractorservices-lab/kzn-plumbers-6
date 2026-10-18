import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const activity: Record<string, unknown>[] = [];
const lead = {
  id: "11111111-1111-4111-8111-111111111111", ref: "KZN-1024", status: "sent", lead_type: "marketplace",
  first_name: "Thandi", last_name: "M", phone: "082 123 4567", whatsapp: null, email: "t@example.com",
  suburb: "Umhlanga", area_label: "Durban", service_label: "Geyser repair", urgency: "emergency",
  description: "No hot water", estimate_low: 850, estimate_high: 2500, consent_share: true, consent_marketing: false,
  created_at: "2026-10-18T00:00:00Z", quality_tags: [],
};
const assignments = [{ id: "a1", plumber_id: "p1", status: "accepted", plumbers: { trading_name: "Sipho Plumbing", slug: "sipho-plumbing", whatsapp_number: "0731234567" } }];
const updates: Record<string, unknown>[] = [];

function chain(result: unknown) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "order", "in", "limit"]) c[m] = () => c;
  c.maybeSingle = async () => result;
  c.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
  c.update = (patch: Record<string, unknown>) => { updates.push(patch); return { eq: async () => ({ error: null }) }; };
  return c;
}
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: (t: string) => t === "leads" ? chain({ data: lead, error: null }) : chain({ data: assignments, error: null }) }),
}));
vi.mock("@/lib/leads-server", () => ({
  leadAccessToken: () => "tok",
  logLeadActivity: async (e: Record<string, unknown>) => { activity.push(e); },
  plumberContactEmail: async () => ({ email: "sipho@example.com", name: "Sipho Plumbing" }),
  sendEmail: async () => true,
  LEADS_ADMIN_EMAIL: "admin@example.com",
}));

const { buildGhlPayload, checkGhlSecret, intlPhone, parseGhlInbound, sendLeadToGhl, ghlMode } = await import("../lib/ghl");
const { resetGhlCaches, stageFor } = await import("../lib/ghl-api");

beforeEach(() => { activity.length = 0; updates.length = 0; resetGhlCaches(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("GoHighLevel outbound", () => {
  it("formats SA numbers internationally", () => {
    expect(intlPhone("082 123 4567")).toBe("+27821234567");
    expect(intlPhone("+27 31 123 4567")).toBe("+27311234567");
    expect(intlPhone("12")).toBe("");
  });

  it("builds a flat payload with homeowner and plumber details", () => {
    const p = buildGhlPayload("lead_created", lead, [{ id: "p1", name: "Sipho Plumbing", phone: "+27731234567", email: "s@x.co", profile_url: "https://x/plumber/s", status: "accepted" }]);
    expect(p).toMatchObject({ event: "lead_created", lead_ref: "KZN-1024", phone: "+27821234567", whatsapp: "+27821234567", is_emergency: true, plumber_name: "Sipho Plumbing", plumber_1_phone: "+27731234567", plumber_count: 1 });
    expect(p.estimate_text).toBe("R850 – R2 500");
    expect(Object.values(p).every((v) => ["string", "number", "boolean"].includes(typeof v))).toBe(true);
  });

  it("does nothing when GoHighLevel is not configured", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    expect(await sendLeadToGhl(lead.id, "lead_created")).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("posts to the webhook and logs the result", async () => {
    vi.stubEnv("GHL_LEAD_WEBHOOK_URL", "https://services.leadconnectorhq.com/hooks/abc/webhook-trigger/xyz");
    const f = vi.fn(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", f);
    expect(await sendLeadToGhl(lead.id, "plumber_accepted", { plumberId: "p1" })).toBe(true);
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ event: "plumber_accepted", plumber_name: "Sipho Plumbing", plumber_email: "sipho@example.com", plumber_phone: "+27731234567" });
    expect(activity.at(-1)).toMatchObject({ event: "ghl_sent" });
  });

  it("never throws when GoHighLevel is down", async () => {
    vi.stubEnv("GHL_LEAD_WEBHOOK_URL", "https://example.com/hook");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await sendLeadToGhl(lead.id, "lead_created")).toBe(false);
    expect(activity.at(-1)).toMatchObject({ event: "ghl_failed" });
  });
});

describe("GoHighLevel inbound", () => {
  it("requires the shared secret", () => {
    vi.stubEnv("GHL_INBOUND_SECRET", "s3cret-s3cret-s3cret");
    expect(checkGhlSecret("s3cret-s3cret-s3cret")).toBe(true);
    expect(checkGhlSecret("Bearer s3cret-s3cret-s3cret")).toBe(true);
    expect(checkGhlSecret("wrong")).toBe(false);
    expect(checkGhlSecret(null)).toBe(false);
    vi.stubEnv("GHL_INBOUND_SECRET", "short");
    expect(checkGhlSecret("short")).toBe(false);
  });

  it("reads flat and GHL customData bodies", () => {
    expect(parseGhlInbound({ lead_ref: "kzn-1024", outcome: "completed" })).toEqual({ ref: "KZN-1024", outcome: "completed", note: "" });
    expect(parseGhlInbound({ contact_id: "x", customData: { lead_ref: "KZN-1024", outcome: "Not yet", note: "still leaking" } })).toEqual({ ref: "KZN-1024", outcome: "not_done", note: "still leaking" });
    expect(parseGhlInbound({ lead_ref: "KZN-1024", outcome: "maybe" })).toBeNull();
    expect(parseGhlInbound({ lead_ref: "1024", outcome: "completed" })).toBeNull();
  });

  it("route rejects bad secrets and updates the lead on a valid answer", async () => {
    vi.stubEnv("GHL_INBOUND_SECRET", "s3cret-s3cret-s3cret");
    const { POST } = await import("../app/api/integrations/ghl/route");
    const { NextRequest } = await import("next/server");
    const req = (secret: string, body: unknown) => new NextRequest("https://x/api/integrations/ghl", { method: "POST", headers: { "x-kzn-secret": secret, "content-type": "application/json" }, body: JSON.stringify(body) });
    expect((await POST(req("nope", {}) as never)).status).toBe(401);
    const ok = await POST(req("s3cret-s3cret-s3cret", { lead_ref: "KZN-1024", outcome: "completed" }) as never);
    expect(ok.status).toBe(200);
    expect(updates.at(-1)).toMatchObject({ status: "completed", quality_tags: ["job_completed_confirmed"] });
    expect(activity.at(-1)).toMatchObject({ event: "ghl_completed", actor: "homeowner" });
    const viaQuery = await POST(new NextRequest("https://x/api/integrations/ghl?key=s3cret-s3cret-s3cret", { method: "POST", body: JSON.stringify({ customData: { lead_ref: "KZN-1024", outcome: "not_contacted" } }) }) as never);
    expect(viaQuery.status).toBe(200);
  });
});

describe("GoHighLevel API mode", () => {
  function fakeGhl(opts: { pipeline?: boolean; existingFields?: string[] } = {}) {
    const calls: { method: string; path: string; body: Record<string, unknown> | undefined; auth: string | null }[] = [];
    const f = vi.fn(async (url: string, init: RequestInit) => {
      const u = new URL(url); const method = init.method ?? "GET";
      const body = init.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ method, path: u.pathname, body, auth: new Headers(init.headers).get("authorization") });
      const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (method === "GET" && u.pathname.endsWith("/customFields")) return ok({ customFields: (opts.existingFields ?? []).map((name, i) => ({ id: `cf${i}`, name })) });
      if (method === "POST" && u.pathname.endsWith("/customFields")) return ok({ customField: { id: `new-${body.name}` } });
      if (u.pathname === "/contacts/upsert") return ok({ new: true, contact: { id: "c1" } });
      if (u.pathname.endsWith("/tags")) return ok({ tags: [] });
      if (u.pathname === "/opportunities/pipelines") return ok({ pipelines: opts.pipeline ? [{ id: "pl1", name: "KZN Leads", stages: [{ id: "s-new", name: "New" }, { id: "s-acc", name: "Accepted" }, { id: "s-done", name: "Completed" }] }] : [] });
      if (method === "POST" && u.pathname === "/opportunities/") return ok({ opportunity: { id: "op1" } });
      if (method === "PUT") return ok({});
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", f);
    return calls;
  }

  it("prefers the API over the webhook when both are configured", () => {
    vi.stubEnv("GHL_LEAD_WEBHOOK_URL", "https://example.com/hook");
    expect(ghlMode()).toBe("webhook");
    vi.stubEnv("GHL_API_TOKEN", "pit-123"); vi.stubEnv("GHL_LOCATION_ID", "loc1");
    expect(ghlMode()).toBe("api");
  });

  it("creates missing fields, upserts the contact, tags it and opens a pipeline card", async () => {
    vi.stubEnv("GHL_API_TOKEN", "pit-123"); vi.stubEnv("GHL_LOCATION_ID", "loc1");
    const calls = fakeGhl({ pipeline: true, existingFields: ["KZN Lead Ref"] });
    expect(await sendLeadToGhl(lead.id, "lead_created")).toBe(true);
    expect(calls.every((c) => c.auth === "Bearer pit-123")).toBe(true);
    const created = calls.filter((c) => c.method === "POST" && c.path.endsWith("/customFields"));
    expect(created.length).toBe(15); // 16 fields, 1 already existed
    const upsert = calls.find((c) => c.path === "/contacts/upsert")!;
    expect(upsert.body).toMatchObject({ locationId: "loc1", firstName: "Thandi", phone: "+27821234567", source: "KZN Plumbers" });
    const fields = upsert.body!.customFields as { id: string; field_value: string }[];
    expect(fields).toContainEqual({ id: "cf0", field_value: "KZN-1024" });
    const addTags = calls.find((c) => c.method === "POST" && c.path === "/contacts/c1/tags")!;
    expect(addTags.body!.tags).toEqual(["kzn-lead", "kzn-new-request", "kzn-emergency"]);
    expect(calls.find((c) => c.method === "DELETE")?.body).toEqual({ tags: ["kzn-new-request"] });
    const opp = calls.find((c) => c.method === "POST" && c.path === "/opportunities/")!;
    expect(opp.body).toMatchObject({ pipelineId: "pl1", contactId: "c1", status: "open", monetaryValue: 850 });
    expect(activity.at(-1)).toMatchObject({ event: "ghl_sent", detail: { mode: "api", contact_id: "c1", opportunity_id: "op1" } });
  });

  it("still syncs the contact when there is no KZN Leads pipeline", async () => {
    vi.stubEnv("GHL_API_TOKEN", "pit-123"); vi.stubEnv("GHL_LOCATION_ID", "loc1");
    const calls = fakeGhl({ pipeline: false });
    expect(await sendLeadToGhl(lead.id, "plumber_viewed")).toBe(true);
    expect(calls.some((c) => c.path === "/opportunities/")).toBe(false);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false); // no workflow tag for this event
    expect(activity.at(-1)).toMatchObject({ detail: { note: "no_pipeline" } });
  });

  it("logs the GHL error and never throws", async () => {
    vi.stubEnv("GHL_API_TOKEN", "bad"); vi.stubEnv("GHL_LOCATION_ID", "loc1");
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"message":"Invalid JWT"}', { status: 401 })));
    expect(await sendLeadToGhl(lead.id, "lead_created")).toBe(false);
    expect(String((activity.at(-1)!.detail as Record<string, unknown>).error)).toContain("401");
  });

  it("maps lead statuses to pipeline stages", () => {
    expect(stageFor("sent")).toEqual({ stage: "new", status: "open" });
    expect(stageFor("won")).toEqual({ stage: "job won", status: "open" });
    expect(stageFor("completed")).toEqual({ stage: "completed", status: "won" });
    expect(stageFor("lost").status).toBe("lost");
    expect(stageFor("duplicate").status).toBe("abandoned");
  });
});
