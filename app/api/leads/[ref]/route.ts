import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { accessFailure, privateJson } from "@/lib/server-access";
import { isLeadSchemaMissing, leadSchemaError, verifyLeadAccessToken } from "@/lib/leads-server";

export const dynamic = "force-dynamic";

/** Homeowner's confirmation page data. Needs the private token from the submission; never returns contact details. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  try {
    const { ref } = await params;
    const token = request.nextUrl.searchParams.get("t");
    if (!/^KZN-\d{3,8}$/.test(ref)) return privateJson({ error: "Request not found." }, 404);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("leads")
      .select("id, ref, first_name, service_label, suburb, area_label, urgency, estimate_low, estimate_high, lead_type, status, created_at, service_key")
      .eq("ref", ref).maybeSingle();
    if (error) { if (isLeadSchemaMissing(error)) throw leadSchemaError(); return privateJson({ error: "Could not load your request." }, 503); }
    if (!data || !verifyLeadAccessToken(data.id, token)) return privateJson({ error: "Request not found." }, 404);
    const [{ data: assignments }, { data: rule }] = await Promise.all([
      admin.from("lead_assignments").select("status, plumbers!lead_assignments_plumber_id_fkey(trading_name)").eq("lead_id", data.id).neq("status", "removed"),
      admin.from("estimate_rules").select("note").eq("service_key", data.service_key).maybeSingle(),
    ]);
    const { id: _id, service_key: _svc, ...lead } = data;
    void _id; void _svc;
    return privateJson({
      lead: {
        ...lead,
        estimate_note: rule?.note ?? null,
        plumbers: (assignments ?? []).map((a) => {
          const p = a.plumbers as unknown as { trading_name: string } | { trading_name: string }[] | null;
          return { name: Array.isArray(p) ? p[0]?.trading_name : p?.trading_name, accepted: ["accepted", "contacted", "quoted", "won"].includes(a.status) };
        }).filter((p) => p.name),
      },
    });
  } catch (error) { return accessFailure(error); }
}
