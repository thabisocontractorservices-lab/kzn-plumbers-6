import type { NextRequest } from "next/server";
import { accessFailure, privateJson, requireAdmin } from "@/lib/server-access";
import { isLeadSchemaMissing, leadSchemaError } from "@/lib/leads-server";
import { LEAD_STATUSES } from "@/lib/leads";

export const dynamic = "force-dynamic";

type Row = {
  id: string; ref: string; status: string; lead_type: string; plumber_choice: string; first_name: string; last_name: string | null; phone: string;
  area_key: string; area_label: string; suburb: string; service_key: string; service_label: string; urgency: string;
  estimate_low: number | null; estimate_high: number | null; source: string | null; medium: string | null; campaign: string | null;
  quality_tags: string[]; created_at: string;
  lead_assignments: { status: string; job_value: number | null; plumbers: { trading_name: string } | null }[];
};

const ACCEPTED = ["accepted", "contacted", "quoted", "won", "lost"];

/** Admin lead list + funnel stats. Filters: status, q, area, service, source, days. */
export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request);
    const p = request.nextUrl.searchParams;
    const days = Math.min(Math.max(Number(p.get("days")) || 90, 1), 730);
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const { data, error } = await admin.from("leads")
      .select("id, ref, status, lead_type, plumber_choice, first_name, last_name, phone, area_key, area_label, suburb, service_key, service_label, urgency, estimate_low, estimate_high, source, medium, campaign, quality_tags, created_at, lead_assignments!lead_assignments_lead_id_fkey(status, job_value, plumbers!lead_assignments_plumber_id_fkey(trading_name))")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(3000);
    if (error) { if (isLeadSchemaMissing(error)) throw leadSchemaError(); throw error; }
    const all = (data ?? []) as unknown as Row[];

    // Funnel stats over the whole period (before filters)
    const count = (fn: (r: Row) => boolean) => all.filter(fn).length;
    const live = all.filter((r) => !["invalid", "duplicate"].includes(r.status));
    const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, count((r) => r.status === s)]));
    const anyAssign = (r: Row, st: string[]) => r.lead_assignments.some((a) => st.includes(a.status));
    const sent = live.filter((r) => r.lead_assignments.some((a) => a.status !== "removed")).length;
    const accepted = live.filter((r) => anyAssign(r, ACCEPTED)).length;
    const contacted = live.filter((r) => anyAssign(r, ["contacted", "quoted", "won"])).length;
    const quoted = live.filter((r) => anyAssign(r, ["quoted", "won"])).length;
    const won = live.filter((r) => anyAssign(r, ["won"]) || ["won", "completed"].includes(r.status)).length;
    const lost = live.filter((r) => r.status === "lost").length;
    const wonValue = live.reduce((s, r) => s + r.lead_assignments.reduce((x, a) => x + (a.status === "won" ? Number(a.job_value) || 0 : 0), 0), 0);
    const unclaimed = live.filter((r) => !anyAssign(r, ACCEPTED) && !["lost", "expired", "no_plumber", "won", "completed"].includes(r.status)).length;
    const group = (key: (r: Row) => string) => {
      const m = new Map<string, number>();
      for (const r of live) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, n]) => ({ label, n }));
    };
    const stats = {
      total: live.length, invalid: byStatus.invalid + byStatus.duplicate, byStatus,
      sent, accepted, contacted, quoted, won, lost, unclaimed, wonValue,
      whatsappOpened: live.filter((r) => r.quality_tags?.includes("whatsapp_opened")).length,
      byService: group((r) => r.service_label), byArea: group((r) => r.area_label),
      bySource: group((r) => [r.source || "direct", r.campaign].filter(Boolean).join(" · ")),
    };

    // Filters
    const q = (p.get("q") || "").trim().toLowerCase();
    const status = p.get("status") || "";
    const area = p.get("area") || "";
    const service = p.get("service") || "";
    const source = p.get("source") || "";
    let rows = all;
    if (status === "unclaimed") rows = rows.filter((r) => !anyAssign(r, ACCEPTED) && !["invalid", "duplicate", "lost", "expired", "no_plumber", "won", "completed"].includes(r.status));
    else if (status === "needs_plumber") rows = rows.filter((r) => !r.lead_assignments.some((a) => !["removed", "declined", "expired"].includes(a.status)) && !["invalid", "duplicate", "lost", "won", "completed"].includes(r.status));
    else if (status) rows = rows.filter((r) => r.status === status);
    if (area) rows = rows.filter((r) => r.area_key === area);
    if (service) rows = rows.filter((r) => r.service_key === service);
    if (source) rows = rows.filter((r) => (r.source || "direct") === source);
    if (q) rows = rows.filter((r) => [r.ref, r.first_name, r.last_name, r.phone, r.suburb, r.service_label].filter(Boolean).join(" ").toLowerCase().includes(q));

    const page = Math.max(Number(p.get("page")) || 1, 1);
    const pageSize = 50;
    const leads = rows.slice((page - 1) * pageSize, page * pageSize).map((r) => ({
      id: r.id, ref: r.ref, status: r.status, lead_type: r.lead_type, plumber_choice: r.plumber_choice,
      name: [r.first_name, r.last_name].filter(Boolean).join(" "), phone: r.phone,
      area_label: r.area_label, suburb: r.suburb, service_label: r.service_label, urgency: r.urgency,
      estimate_low: r.estimate_low, estimate_high: r.estimate_high, source: r.source, campaign: r.campaign,
      quality_tags: r.quality_tags, created_at: r.created_at,
      plumbers: r.lead_assignments.filter((a) => a.status !== "removed").map((a) => ({ name: a.plumbers?.trading_name ?? "?", status: a.status })),
    }));
    return privateJson({ leads, total: rows.length, page, pageSize, stats, days });
  } catch (error) { return accessFailure(error); }
}
