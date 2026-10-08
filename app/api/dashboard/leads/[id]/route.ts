import { NextRequest } from "next/server";
import { z } from "zod";
import { accessFailure, privateJson, requireSameOrigin } from "@/lib/server-access";
import { readAuthFlowJson } from "@/lib/auth-flow-input";
import { ACCEPTED_ASSIGNMENT, OPEN_ASSIGNMENT, loadPlumberAssignment, requireLeadPlumber } from "@/lib/leads-plumber";
import { LEADS_ADMIN_EMAIL, logLeadActivity, sendEmail, signedPhotoUrls } from "@/lib/leads-server";
import { rollUpLeadStatus, type LeadStatus } from "@/lib/leads";

export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!IdSchema.safeParse(id).success) return privateJson({ error: "Job not found." }, 404);
    const { plumber, admin, user } = await requireLeadPlumber(request);
    const { assignment, lead, accepted } = await loadPlumberAssignment(id, plumber.id);
    if (["offered", "notified"].includes(assignment.status)) {
      await admin.from("lead_assignments").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", id);
      await logLeadActivity({ lead_id: lead.id, assignment_id: id, plumber_id: plumber.id, actor: "plumber", actor_id: user.id, event: "plumber_viewed", detail: { plumber: plumber.trading_name } });
      assignment.status = "viewed";
    }
    const photos = await signedPhotoUrls(lead.photo_paths);
    const { id: _leadId, photo_paths: _p, ...safe } = lead;
    void _leadId; void _p;
    return privateJson({ job: { ...safe, photos }, assignment: { id: assignment.id, status: assignment.status, job_value: assignment.job_value, accepted_at: assignment.accepted_at }, accepted });
  } catch (error) { return accessFailure(error); }
}

const ActionSchema = z.object({
  action: z.enum(["accept", "decline", "contacted", "quoted", "won", "lost"]),
  job_value: z.number().min(0).max(10_000_000).optional(),
  reason: z.string().trim().max(300).optional(),
});

const ALLOWED_FROM: Record<string, string[]> = {
  accept: OPEN_ASSIGNMENT,
  decline: OPEN_ASSIGNMENT,
  contacted: ["accepted", "contacted"],
  quoted: ["accepted", "contacted", "quoted"],
  won: ["accepted", "contacted", "quoted", "lost"],
  lost: ["accepted", "contacted", "quoted", "won"],
};
const NEXT_STATUS: Record<string, string> = { accept: "accepted", decline: "declined", contacted: "contacted", quoted: "quoted", won: "won", lost: "lost" };
const STAMP: Record<string, string> = { accept: "accepted_at", decline: "declined_at", contacted: "contacted_at", quoted: "quoted_at", won: "closed_at", lost: "closed_at" };
const EVENT: Record<string, string> = { accept: "plumber_accepted", decline: "plumber_declined", contacted: "customer_contacted", quoted: "quote_sent", won: "job_won", lost: "job_lost" };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const { id } = await params;
    if (!IdSchema.safeParse(id).success) return privateJson({ error: "Job not found." }, 404);
    const parsed = ActionSchema.safeParse(await readAuthFlowJson(request, 2048));
    if (!parsed.success) return privateJson({ error: "Invalid action." }, 400);
    const { action, job_value, reason } = parsed.data;
    const { plumber, admin, user } = await requireLeadPlumber(request);
    const { assignment, lead } = await loadPlumberAssignment(id, plumber.id);
    if (!ALLOWED_FROM[action].includes(assignment.status)) {
      return privateJson({ error: assignment.status === "declined" ? "You declined this job." : assignment.status === "expired" ? "This job has expired." : "That update isn't available for this job any more. Refresh the page." }, 409);
    }
    if (["invalid", "duplicate"].includes(lead.status)) return privateJson({ error: "This request was closed by KZNPlumbers." }, 409);

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: NEXT_STATUS[action], [STAMP[action]]: now };
    if (action === "won" && job_value != null) patch.job_value = job_value;
    if (action === "decline" && reason) patch.decline_reason = reason;
    // Optimistic check: only update if still in the status we just read (no double accepts).
    const upd = await admin.from("lead_assignments").update(patch).eq("id", id).eq("status", assignment.status).select("id").maybeSingle();
    if (upd.error || !upd.data) return privateJson({ error: "This job changed — please refresh the page." }, 409);

    const nextLead = rollUpLeadStatus(lead.status as LeadStatus, NEXT_STATUS[action]);
    if (nextLead !== lead.status) await admin.from("leads").update({ status: nextLead }).eq("id", lead.id);
    await logLeadActivity({ lead_id: lead.id, assignment_id: id, plumber_id: plumber.id, actor: "plumber", actor_id: user.id, event: EVENT[action], detail: { plumber: plumber.trading_name, job_value, reason } });

    // Declines: tell admin so the homeowner isn't left waiting.
    if (action === "decline") {
      const { count } = await admin.from("lead_assignments").select("id", { count: "exact", head: true }).eq("lead_id", lead.id).in("status", [...OPEN_ASSIGNMENT, ...ACCEPTED_ASSIGNMENT]);
      await sendEmail([LEADS_ADMIN_EMAIL], `${lead.ref}: ${plumber.trading_name} declined${count ? "" : " — nobody left on this job"}`,
        `<p>${plumber.trading_name} declined lead <b>${lead.ref}</b>${reason ? ` (“${reason.replace(/</g, "&lt;")}”)` : ""}.</p><p>${count ? `${count} other plumber(s) still on the job.` : "<b>No plumbers are left on this job. Please assign another.</b>"}</p>`);
    }
    return privateJson({ ok: true, status: NEXT_STATUS[action] });
  } catch (error) { return accessFailure(error); }
}
