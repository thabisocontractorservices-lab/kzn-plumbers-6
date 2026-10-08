import type { NextRequest } from "next/server";
import { z } from "zod";
import { AccessError, accessFailure, privateJson, requireAdmin, requireSameOrigin } from "@/lib/server-access";
import { readAuthFlowJson } from "@/lib/auth-flow-input";
import { LEAD_STATUSES } from "@/lib/leads";
import { logLeadActivity, notifyAssignment, signedPhotoUrls } from "@/lib/leads-server";

export const dynamic = "force-dynamic";
const Id = z.string().uuid();

async function loadLead(admin: Awaited<ReturnType<typeof requireAdmin>>["admin"], id: string) {
  const { data, error } = await admin.from("leads").select("*").eq("id", id).maybeSingle();
  if (error) throw new AccessError("Could not load this lead.", 503);
  if (!data) throw new AccessError("Lead not found.", 404);
  return data as Record<string, unknown> & { id: string; ref: string; status: string; photo_paths: string[]; quality_tags: string[]; admin_notes: string | null };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireAdmin(request);
    const { id: raw } = await params;
    // Accept either the uuid or the KZN-#### reference (used by admin email links).
    let id = raw;
    if (!Id.safeParse(raw).success) {
      if (!/^KZN-\d{3,8}$/.test(raw)) return privateJson({ error: "Lead not found." }, 404);
      const r = await admin.from("leads").select("id").eq("ref", raw).maybeSingle();
      if (!r.data) return privateJson({ error: "Lead not found." }, 404);
      id = r.data.id;
    }
    const lead = await loadLead(admin, id);
    const [assignments, activity, photos, preferred] = await Promise.all([
      admin.from("lead_assignments").select("id, plumber_id, chosen_by, status, notified_at, viewed_at, accepted_at, declined_at, contacted_at, quoted_at, closed_at, job_value, decline_reason, created_at, plumbers!lead_assignments_plumber_id_fkey(trading_name, slug, whatsapp_number)").eq("lead_id", id).order("created_at"),
      admin.from("lead_activity").select("id, actor, event, detail, created_at, plumber_id").eq("lead_id", id).order("created_at", { ascending: false }).limit(200),
      signedPhotoUrls(lead.photo_paths),
      lead.preferred_plumber_id ? admin.from("plumbers").select("trading_name").eq("id", lead.preferred_plumber_id as string).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    return privateJson({
      lead: { ...lead, ip_hash: undefined, photos, preferred_plumber: preferred.data?.trading_name ?? null },
      assignments: assignments.data ?? [], activity: activity.data ?? [],
    });
  } catch (error) { return accessFailure(error); }
}

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), plumber_id: z.string().uuid(), notify: z.boolean().default(true) }),
  z.object({ action: z.literal("remove_assignment"), assignment_id: z.string().uuid() }),
  z.object({ action: z.literal("resend"), assignment_id: z.string().uuid() }),
  z.object({ action: z.literal("set_status"), status: z.enum(LEAD_STATUSES) }),
  z.object({ action: z.literal("set_assignment_status"), assignment_id: z.string().uuid(), status: z.enum(["offered", "notified", "viewed", "accepted", "declined", "expired", "contacted", "quoted", "won", "lost"]), job_value: z.number().min(0).optional() }),
  z.object({ action: z.literal("note"), note: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal("toggle_tag"), tag: z.enum(["customer_confirmed", "whatsapp_opened", "high_value", "spam_suspected", "called_by_admin"]) }),
  z.object({ action: z.literal("edit"), fields: z.object({
    first_name: z.string().trim().min(1).max(60).optional(), last_name: z.string().trim().max(60).optional(),
    suburb: z.string().trim().min(2).max(80).optional(), description: z.string().trim().max(1500).optional(),
    estimate_low: z.number().int().min(0).nullable().optional(), estimate_high: z.number().int().min(0).nullable().optional(),
    email: z.union([z.literal(""), z.string().email()]).optional(),
  }) }),
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const { admin, user } = await requireAdmin(request);
    const { id } = await params;
    if (!Id.safeParse(id).success) return privateJson({ error: "Lead not found." }, 404);
    const parsed = Action.safeParse(await readAuthFlowJson(request, 8192));
    if (!parsed.success) return privateJson({ error: "Check the action fields." }, 400);
    const input = parsed.data;
    const lead = await loadLead(admin, id);
    const log = (event: string, detail: Record<string, unknown> = {}, extra: { plumber_id?: string; assignment_id?: string } = {}) =>
      logLeadActivity({ lead_id: id, actor: "admin", actor_id: user.id, event, detail, ...extra });
    const summary = {
      id, ref: lead.ref, service_label: String(lead.service_label), suburb: String(lead.suburb), area_label: String(lead.area_label),
      urgency: String(lead.urgency), description: lead.description as string | null, photo_paths: lead.photo_paths,
      estimate_low: lead.estimate_low as number | null, estimate_high: lead.estimate_high as number | null, lead_type: String(lead.lead_type),
    };

    switch (input.action) {
      case "assign": {
        const p = await admin.from("plumbers").select("id, trading_name, profile_id").eq("id", input.plumber_id).maybeSingle();
        if (!p.data) throw new AccessError("Plumber not found.", 404);
        if (!p.data.profile_id) throw new AccessError("Only claimed plumbers can receive leads.", 409);
        const existing = await admin.from("lead_assignments").select("id, status").eq("lead_id", id).eq("plumber_id", input.plumber_id).maybeSingle();
        let assignmentId = existing.data?.id as string | undefined;
        if (existing.data) {
          const up = await admin.from("lead_assignments").update({ status: "offered", chosen_by: "admin" }).eq("id", existing.data.id);
          if (up.error) throw new AccessError(up.error.message.includes("at most 3") ? "This lead already has 3 plumbers. Remove one first." : "Could not assign.", 409);
        } else {
          const ins = await admin.from("lead_assignments").insert({ lead_id: id, plumber_id: input.plumber_id, chosen_by: "admin" }).select("id").single();
          if (ins.error || !ins.data) throw new AccessError(ins.error?.message.includes("at most 3") ? "This lead already has 3 plumbers. Remove one first." : "Could not assign.", 409);
          assignmentId = ins.data.id;
        }
        if (["new", "qualified", "matched", "no_plumber", "expired"].includes(lead.status)) await admin.from("leads").update({ status: "sent" }).eq("id", id);
        await log("plumber_assigned", { plumber: p.data.trading_name }, { plumber_id: input.plumber_id, assignment_id: assignmentId });
        const sent = input.notify ? await notifyAssignment(summary, assignmentId!, input.plumber_id, "admin") : false;
        return privateJson({ ok: true, message: `${p.data.trading_name} assigned${input.notify ? (sent ? " and emailed." : " — email could not be sent (no email on their account or email not set up). Send them the job link manually.") : "."}` });
      }
      case "remove_assignment": {
        await admin.from("lead_assignments").update({ status: "removed" }).eq("id", input.assignment_id).eq("lead_id", id);
        await log("plumber_removed", {}, { assignment_id: input.assignment_id });
        return privateJson({ ok: true, message: "Plumber removed from this lead." });
      }
      case "resend": {
        const a = await admin.from("lead_assignments").select("id, plumber_id").eq("id", input.assignment_id).eq("lead_id", id).maybeSingle();
        if (!a.data) throw new AccessError("Assignment not found.", 404);
        const sent = await notifyAssignment(summary, a.data.id, a.data.plumber_id, "admin");
        return privateJson({ ok: true, message: sent ? "Job alert re-sent." : "Email could not be sent. Copy the job link and WhatsApp it to the plumber." });
      }
      case "set_status": {
        await admin.from("leads").update({ status: input.status }).eq("id", id);
        await log(input.status === "new" && ["invalid", "duplicate", "lost", "expired"].includes(lead.status) ? "lead_reopened" : "status_changed", { from: lead.status, to: input.status });
        return privateJson({ ok: true, message: "Status updated." });
      }
      case "set_assignment_status": {
        const patch: Record<string, unknown> = { status: input.status };
        if (input.job_value != null) patch.job_value = input.job_value;
        await admin.from("lead_assignments").update(patch).eq("id", input.assignment_id).eq("lead_id", id);
        await log("assignment_status_changed", { to: input.status, job_value: input.job_value }, { assignment_id: input.assignment_id });
        return privateJson({ ok: true, message: "Plumber status updated." });
      }
      case "note": {
        const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
        const notes = [lead.admin_notes, `${stamp}: ${input.note}`].filter(Boolean).join("\n");
        await admin.from("leads").update({ admin_notes: notes }).eq("id", id);
        await log("admin_note", { note: input.note });
        return privateJson({ ok: true, message: "Note added." });
      }
      case "toggle_tag": {
        const tags = new Set(lead.quality_tags ?? []);
        const on = !tags.has(input.tag);
        if (on) tags.add(input.tag); else tags.delete(input.tag);
        await admin.from("leads").update({ quality_tags: [...tags] }).eq("id", id);
        await log(on ? "tag_added" : "tag_removed", { tag: input.tag });
        return privateJson({ ok: true, message: on ? "Tag added." : "Tag removed." });
      }
      case "edit": {
        const f = { ...input.fields } as Record<string, unknown>;
        if (f.email === "") f.email = null;
        await admin.from("leads").update(f).eq("id", id);
        await log("lead_edited", { fields: Object.keys(f) });
        return privateJson({ ok: true, message: "Lead updated." });
      }
    }
  } catch (error) { return accessFailure(error); }
}
