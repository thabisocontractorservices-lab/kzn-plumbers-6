import { NextRequest } from "next/server";
import { accessFailure, privateJson } from "@/lib/server-access";
import { requireLeadPlumber } from "@/lib/leads-plumber";
import { isLeadSchemaMissing, leadSchemaError } from "@/lib/leads-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { plumber, admin } = await requireLeadPlumber(request);
    const { data, error } = await admin.from("lead_assignments")
      .select("id, status, created_at, accepted_at, job_value, leads!lead_assignments_lead_id_fkey(ref, service_label, suburb, area_label, urgency, first_name, estimate_low, estimate_high, photo_paths, created_at, lead_type)")
      .eq("plumber_id", plumber.id).neq("status", "removed").order("created_at", { ascending: false }).limit(200);
    if (error) { if (isLeadSchemaMissing(error)) throw leadSchemaError(); throw error; }
    const jobs = (data ?? []).map((row) => {
      const l = (Array.isArray(row.leads) ? row.leads[0] : row.leads) as Record<string, unknown> | null;
      return {
        id: row.id, status: row.status, created_at: row.created_at, job_value: row.job_value,
        ref: l?.ref, service_label: l?.service_label, suburb: l?.suburb, area_label: l?.area_label, urgency: l?.urgency,
        first_name: l?.first_name, estimate_low: l?.estimate_low, estimate_high: l?.estimate_high,
        photos: Array.isArray(l?.photo_paths) ? (l?.photo_paths as string[]).length : 0, lead_type: l?.lead_type,
      };
    });
    return privateJson({ jobs, business: plumber.trading_name });
  } catch (error) { return accessFailure(error); }
}
