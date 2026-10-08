import type { NextRequest } from "next/server";
import { z } from "zod";
import { accessFailure, privateJson, requireAdmin, requireSameOrigin } from "@/lib/server-access";
import { readAuthFlowJson } from "@/lib/auth-flow-input";
import { doesService, servesArea } from "@/lib/leads";
import { isLeadSchemaMissing, leadSchemaError } from "@/lib/leads-server";

export const dynamic = "force-dynamic";

/** Claimed plumbers for manual assignment, best matches for the lead first. */
export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request);
    const p = request.nextUrl.searchParams;
    const { data, error } = await admin.from("plumbers")
      .select("id, trading_name, area, service_areas, specialties, leads_enabled, is_verified, record_status, google_rating, google_review_count")
      .not("profile_id", "is", null).order("trading_name").limit(2000);
    if (error) { if (isLeadSchemaMissing(error)) throw leadSchemaError(); throw error; }
    const area = p.get("area") || "", service = p.get("service") || "", suburb = p.get("suburb") || "", q = (p.get("q") || "").toLowerCase();
    const rows = (data ?? []).map((r) => ({
      ...r,
      area_match: area ? servesArea(r, area, suburb) : false,
      service_match: service ? doesService(r, service) : false,
      published: r.is_verified && r.record_status === "published",
    })).filter((r) => !q || r.trading_name.toLowerCase().includes(q) || r.area.toLowerCase().includes(q));
    rows.sort((a, b) => Number(b.area_match && b.service_match) - Number(a.area_match && a.service_match) || Number(b.area_match) - Number(a.area_match) || a.trading_name.localeCompare(b.trading_name));
    return privateJson({ plumbers: rows.slice(0, 100), claimedTotal: data?.length ?? 0, leadEnabledTotal: (data ?? []).filter((r) => r.leads_enabled && r.is_verified && r.record_status === "published").length });
  } catch (error) { return accessFailure(error); }
}

const Toggle = z.object({ plumber_id: z.string().uuid(), leads_enabled: z.boolean() });

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const { admin } = await requireAdmin(request);
    const parsed = Toggle.safeParse(await readAuthFlowJson(request, 1024));
    if (!parsed.success) return privateJson({ error: "Invalid request." }, 400);
    const { error } = await admin.from("plumbers").update({ leads_enabled: parsed.data.leads_enabled }).eq("id", parsed.data.plumber_id);
    if (error) return privateJson({ error: "Could not update this plumber." }, 503);
    return privateJson({ ok: true });
  } catch (error) { return accessFailure(error); }
}
