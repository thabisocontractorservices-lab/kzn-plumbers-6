import type { NextRequest } from "next/server";
import { z } from "zod";
import { accessFailure, privateJson, requireAdmin, requireSameOrigin } from "@/lib/server-access";
import { readAuthFlowJson } from "@/lib/auth-flow-input";
import { isLeadSchemaMissing, leadSchemaError } from "@/lib/leads-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request);
    const { data, error } = await admin.from("estimate_rules").select("*").order("sort_order");
    if (error) { if (isLeadSchemaMissing(error)) throw leadSchemaError(); throw error; }
    return privateJson({ rules: data ?? [] });
  } catch (error) { return accessFailure(error); }
}

const Rule = z.object({
  service_key: z.string().max(40),
  low: z.number().int().min(0).max(1_000_000).nullable(),
  high: z.number().int().min(0).max(1_000_000).nullable(),
  note: z.string().trim().max(300).nullable().optional(),
  active: z.boolean().optional(),
}).refine((r) => (r.low == null) === (r.high == null) && (r.low == null || r.high! >= r.low), "High must be at least the low price (or leave both blank).");

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const { admin } = await requireAdmin(request);
    const parsed = Rule.safeParse(await readAuthFlowJson(request, 2048));
    if (!parsed.success) return privateJson({ error: parsed.error.issues[0]?.message || "Check the prices." }, 400);
    const { service_key, ...patch } = parsed.data;
    const { error } = await admin.from("estimate_rules").update({ ...patch, updated_at: new Date().toISOString() }).eq("service_key", service_key);
    if (error) return privateJson({ error: "Could not save this price." }, 503);
    return privateJson({ ok: true });
  } catch (error) { return accessFailure(error); }
}
