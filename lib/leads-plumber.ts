import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AccessError, requireUser } from "@/lib/server-access";
import { isLeadSchemaMissing, leadSchemaError } from "@/lib/leads-server";

export const OPEN_ASSIGNMENT = ["offered", "notified", "viewed"];
export const ACCEPTED_ASSIGNMENT = ["accepted", "contacted", "quoted", "won", "lost"];

export async function requireLeadPlumber(request: Request) {
  const user = await requireUser(request);
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("plumbers").select("id, trading_name").eq("profile_id", user.id).maybeSingle();
  if (error) throw new AccessError("Could not load your business. Please try again.", 503);
  if (!data) throw new AccessError("Only plumbers with a claimed business can see job leads.", 403);
  return { user, plumber: data as { id: string; trading_name: string }, admin };
}

const LEAD_PUBLIC = "id, ref, lead_type, status, service_label, area_label, suburb, postcode, urgency, description, photo_paths, estimate_low, estimate_high, first_name, created_at";
const LEAD_CONTACT = "last_name, phone, whatsapp, email";

/** Job details for a plumber. Contact details only once THIS plumber has accepted. */
export async function loadPlumberAssignment(assignmentId: string, plumberId: string) {
  const admin = getSupabaseAdmin();
  const { data: a, error } = await admin.from("lead_assignments").select("*").eq("id", assignmentId).eq("plumber_id", plumberId).maybeSingle();
  if (error) { if (isLeadSchemaMissing(error)) throw leadSchemaError(); throw new AccessError("Could not load this job.", 503); }
  if (!a || a.status === "removed") throw new AccessError("Job not found.", 404);
  const accepted = ACCEPTED_ASSIGNMENT.includes(a.status);
  const { data: lead } = await admin.from("leads").select(accepted ? `${LEAD_PUBLIC}, ${LEAD_CONTACT}` : LEAD_PUBLIC).eq("id", a.lead_id).maybeSingle();
  if (!lead) throw new AccessError("Job not found.", 404);
  return { assignment: a, lead: lead as unknown as Record<string, unknown> & { id: string; ref: string; status: string; photo_paths: string[] }, accepted };
}
