"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Camera, Copy, ExternalLink, Loader2, MessageCircle, Phone, RefreshCw, Search, X } from "lucide-react";
import {
  LEAD_AREAS, LEAD_SERVICES, LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_STATUS_STYLES, JOB_STATUS,
  formatEstimate, formatRandWhole, getLeadUrgency, type LeadStatus,
} from "@/lib/leads";

type ListLead = {
  id: string; ref: string; status: LeadStatus; lead_type: string; plumber_choice: string; name: string; phone: string;
  area_label: string; suburb: string; service_label: string; urgency: string; estimate_low: number | null; estimate_high: number | null;
  source: string | null; campaign: string | null; quality_tags: string[]; created_at: string; plumbers: { name: string; status: string }[];
};
type Stats = {
  total: number; invalid: number; sent: number; accepted: number; contacted: number; quoted: number; won: number; lost: number;
  unclaimed: number; wonValue: number; whatsappOpened: number;
  byService: { label: string; n: number }[]; byArea: { label: string; n: number }[]; bySource: { label: string; n: number }[];
};

const fmtDate = (v: string) => new Date(v).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

export function AdminLeads() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"leads" | "prices" | "plumbers">("leads");
  const [filters, setFilters] = useState({ status: "", area: "", service: "", q: "", days: "90" });
  const [data, setData] = useState<{ leads: ListLead[]; total: number; stats: Stats } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(params.get("lead"));
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (tab !== "leads") return;
    const ctrl = new AbortController();
    setLoading(true);
    const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    fetch(`/api/admin/leads?${q}`, { cache: "no-store", signal: ctrl.signal })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "Could not load leads."); setData(b); setError(""); })
      .catch((e) => { if (!ctrl.signal.aborted) setError(e.message); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [filters, refresh, tab]);

  const s = data?.stats;
  const set = (k: keyof typeof filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-brand hover:underline">← Admin workspace</Link>
          <h1 className="font-display text-3xl">Leads</h1>
          <p className="text-sm text-gray-500">Every quote request from the website, who it went to and what happened.</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
          {([["leads", "Leads"], ["plumbers", "Lead plumbers"], ["prices", "Estimate prices"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 font-semibold ${tab === k ? "bg-white shadow-sm text-gray-900" : "text-gray-600"}`}>{l}</button>
          ))}
        </div>
      </div>

      {tab === "prices" && <PriceEditor />}
      {tab === "plumbers" && <LeadPlumbers />}

      {tab === "leads" && (
        <>
          {s && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                <Stat label="Leads" value={s.total} hint={`${s.invalid} invalid/dup`} />
                <Stat label="Need a plumber" value={s.unclaimed} tone={s.unclaimed ? "text-red-600" : ""} onClick={() => set("status", "unclaimed")} />
                <Stat label="Sent" value={s.sent} hint={pct(s.sent, s.total)} />
                <Stat label="Accepted" value={s.accepted} hint={`${pct(s.accepted, s.sent)} of sent`} />
                <Stat label="Contacted" value={s.contacted} hint={pct(s.contacted, s.accepted)} />
                <Stat label="Quoted" value={s.quoted} hint={pct(s.quoted, s.contacted)} />
                <Stat label="Won" value={s.won} hint={`${pct(s.won, s.total)} close rate`} tone="text-green-700" />
                <Stat label="Won value" value={formatRandWhole(s.wonValue)} hint={`${s.whatsappOpened} opened WhatsApp`} />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Breakdown title="By service" rows={s.byService} />
                <Breakdown title="By area" rows={s.byArea} />
                <Breakdown title="By source / campaign" rows={s.bySource} />
              </div>
            </>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <label className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" placeholder="Search ref, name, phone, suburb…" value={filters.q} onChange={(e) => set("q", e.target.value)} />
            </label>
            <select className="input w-auto" value={filters.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">All statuses</option>
              <option value="needs_plumber">⚠ No plumber on it</option>
              <option value="unclaimed">⚠ Not accepted yet</option>
              {LEAD_STATUSES.map((st) => <option key={st} value={st}>{LEAD_STATUS_LABELS[st]}</option>)}
            </select>
            <select className="input w-auto" value={filters.service} onChange={(e) => set("service", e.target.value)}>
              <option value="">All services</option>{LEAD_SERVICES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select>
            <select className="input w-auto" value={filters.area} onChange={(e) => set("area", e.target.value)}>
              <option value="">All areas</option>{LEAD_AREAS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select>
            <select className="input w-auto" value={filters.days} onChange={(e) => set("days", e.target.value)}>
              <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option>
            </select>
            <button onClick={() => setRefresh((v) => v + 1)} className="btn-secondary" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
          </div>

          {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead><tr className="bg-gray-600 text-left text-xs text-white">
                <th className="px-3 py-2.5">Lead</th><th className="px-3 py-2.5">Job</th><th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5">Plumbers</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Source</th>
              </tr></thead>
              <tbody>
                {data?.leads.map((l) => (
                  <tr key={l.id} onClick={() => setOpenId(l.id)} className="cursor-pointer border-b border-gray-100 align-top hover:bg-brand-light/40">
                    <td className="px-3 py-3"><p className="font-mono font-bold text-brand">{l.ref}</p><p className="text-xs text-gray-500">{fmtDate(l.created_at)}</p></td>
                    <td className="px-3 py-3"><p className="font-semibold">{l.service_label}</p><p className="text-xs text-gray-500">{l.suburb}, {l.area_label}</p>
                      <p className={`text-xs ${l.urgency === "emergency" || l.urgency === "today" ? "font-semibold text-emergency" : "text-gray-500"}`}>{getLeadUrgency(l.urgency)?.label}</p></td>
                    <td className="px-3 py-3"><p>{l.name}</p><p className="text-xs text-gray-500">+{l.phone}</p>
                      <div className="mt-1 flex flex-wrap gap-1">{l.quality_tags?.map((t) => <span key={t} className="badge bg-gray-100 text-gray-600">{t.replace(/_/g, " ")}</span>)}</div></td>
                    <td className="px-3 py-3">{l.plumbers.length ? l.plumbers.map((p) => <p key={p.name} className="text-xs"><span className="font-medium">{p.name}</span> · <span className="text-gray-500">{JOB_STATUS[p.status]?.label ?? p.status}</span></p>)
                      : <span className="badge bg-red-100 text-red-700">{l.plumber_choice === "kzn" ? "KZN to choose" : "None"}</span>}</td>
                    <td className="px-3 py-3"><span className={`badge ${LEAD_STATUS_STYLES[l.status]}`}>{LEAD_STATUS_LABELS[l.status]}</span>
                      {l.lead_type === "requested_plumber" && <p className="mt-1 text-[11px] text-gray-500">Requested plumber</p>}</td>
                    <td className="px-3 py-3 text-xs text-gray-600">{l.source || "direct"}{l.campaign ? <p className="text-gray-400">{l.campaign}</p> : null}</td>
                  </tr>
                ))}
                {data && !data.leads.length && <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No leads match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          {data && data.total > data.leads.length && <p className="mt-2 text-xs text-gray-500">Showing {data.leads.length} of {data.total}. Narrow the filters to see older leads.</p>}
        </>
      )}

      {openId && <LeadDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => setRefresh((v) => v + 1)} />}
    </div>
  );
}

function Stat({ label, value, hint, tone = "", onClick }: { label: string; value: string | number; hint?: string; tone?: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </Tag>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      {rows.length ? rows.map((r) => (
        <div key={r.label} className="mb-1 flex items-center gap-2 text-xs">
          <span className="w-32 truncate text-gray-700">{r.label}</span>
          <span className="h-2 rounded bg-brand/70" style={{ width: `${(r.n / max) * 100}%`, minWidth: 4 }} />
          <span className="ml-auto font-semibold">{r.n}</span>
        </div>
      )) : <p className="text-xs text-gray-400">No data yet</p>}
    </div>
  );
}

type Detail = {
  lead: Record<string, unknown> & {
    id: string; ref: string; status: LeadStatus; first_name: string; last_name: string | null; phone: string; whatsapp: string | null; email: string | null;
    area_key: string; area_label: string; suburb: string; postcode: string | null; service_key: string; service_label: string; urgency: string;
    description: string | null; photos: string[]; estimate_low: number | null; estimate_high: number | null; lead_type: string;
    preferred_plumber: string | null; fallback_allowed: boolean; attribution: Record<string, string>; source: string | null; medium: string | null;
    campaign: string | null; quality_tags: string[]; admin_notes: string | null; consent_marketing: boolean; created_at: string;
  };
  assignments: { id: string; plumber_id: string; chosen_by: string; status: string; job_value: number | null; decline_reason: string | null; created_at: string; accepted_at: string | null; plumbers: { trading_name: string; slug: string | null; whatsapp_number: string | null } | null }[];
  activity: { id: string; actor: string; event: string; detail: Record<string, unknown>; created_at: string }[];
};

function LeadDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [picker, setPicker] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/admin/leads/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "Could not load lead."); setD(b); })
      .catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function act(body: Record<string, unknown>) {
    if (!d) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch(`/api/admin/leads/${d.lead.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Action failed.");
      setMsg(b.message || "Done."); load(); onChanged();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  const l = d?.lead;
  const jobLink = (aid: string) => `${window.location.origin}/dashboard/leads/${aid}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-3">
          <div>
            <p className="font-mono text-lg font-bold text-brand">{l?.ref ?? "…"}</p>
            {l && <p className="text-xs text-gray-500">{fmtDate(l.created_at)} · {l.lead_type === "requested_plumber" ? `Requested ${l.preferred_plumber ?? "plumber"}` : "Marketplace"}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {!d && !err && <div className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>}
        {err && <p className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        {msg && <p className="m-5 mb-0 rounded-lg bg-teal-light p-3 text-sm text-teal">{msg}</p>}
        {l && d && (
          <div className="space-y-5 p-5">
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">Customer</p>
                <p className="text-lg font-bold">{[l.first_name, l.last_name].filter(Boolean).join(" ")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={`tel:+${l.phone}`} className="btn-secondary px-3 py-1.5 text-xs"><Phone className="h-3.5 w-3.5" /> +{l.phone}</a>
                  <a href={`https://wa.me/${l.whatsapp || l.phone}?text=${encodeURIComponent(`Hi ${l.first_name}, this is KZNPlumbers about your request ${l.ref}. Are you available for a plumber to call you now?`)}`} target="_blank" rel="noopener noreferrer" className="btn-whatsapp px-3 py-1.5 text-xs"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
                </div>
                {l.email && <p className="mt-2 text-sm text-gray-600">{l.email}</p>}
                <p className="mt-1 text-xs text-gray-400">Marketing opt-in: {l.consent_marketing ? "yes" : "no"}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">Job</p>
                <p className="text-lg font-bold">{l.service_label}</p>
                <p className="text-sm text-gray-700">{l.suburb}, {l.area_label} {l.postcode}</p>
                <p className="text-sm font-semibold text-emergency">{getLeadUrgency(l.urgency)?.label}</p>
                <p className="mt-1 text-sm">Estimate: <b>{formatEstimate(l.estimate_low, l.estimate_high) ?? "none"}</b></p>
              </div>
            </section>
            {l.description && <p className="whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm">{l.description}</p>}
            {l.photos?.length > 0 && <div className="flex flex-wrap gap-2">{l.photos.map((u, i) => (
              <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="h-20 w-20 overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed URL */}
                <img src={u} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              </a>))}<span className="self-center text-xs text-gray-400"><Camera className="inline h-3 w-3" /> {l.photos.length}</span></div>}

            <section>
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Plumbers ({d.assignments.filter((a) => a.status !== "removed").length}/3)</h3>
                <button onClick={() => setPicker((v) => !v)} className="btn-primary px-3 py-1.5 text-xs">+ Assign plumber</button>
              </div>
              {picker && <PlumberPicker lead={l} onPick={(pid) => { setPicker(false); act({ action: "assign", plumber_id: pid }); }} />}
              <ul className="mt-2 space-y-2">
                {d.assignments.filter((a) => a.status !== "removed").map((a) => (
                  <li key={a.id} className="rounded-xl border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{a.plumbers?.trading_name}</span>
                      <span className={`badge ${JOB_STATUS[a.status]?.style ?? "bg-gray-100"}`}>{JOB_STATUS[a.status]?.label ?? a.status}</span>
                      <span className="text-xs text-gray-400">chosen by {a.chosen_by}</span>
                      {a.job_value ? <span className="text-xs font-semibold text-green-700">R{a.job_value}</span> : null}
                    </div>
                    {a.decline_reason && <p className="text-xs text-gray-500">Declined: {a.decline_reason}</p>}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <button disabled={busy} onClick={() => act({ action: "resend", assignment_id: a.id })} className="btn-secondary px-2.5 py-1 text-xs">Resend email</button>
                      <button onClick={() => navigator.clipboard.writeText(jobLink(a.id))} className="btn-secondary px-2.5 py-1 text-xs"><Copy className="h-3 w-3" /> Copy job link</button>
                      {a.plumbers?.whatsapp_number && <a target="_blank" rel="noopener noreferrer" href={`https://wa.me/${a.plumbers.whatsapp_number.replace(/\D/g, "").replace(/^0/, "27")}?text=${encodeURIComponent(`NEW KZNPLUMBERS JOB\nJob: ${l.ref}\nLocation: ${l.suburb}\nService: ${l.service_label}\nRequired: ${getLeadUrgency(l.urgency)?.label}\nPhotos: ${l.photos?.length ? "Available" : "None"}\n\nView / Claim Job: ${jobLink(a.id)}`)}`} className="btn-whatsapp px-2.5 py-1 text-xs"><MessageCircle className="h-3 w-3" /> WhatsApp alert</a>}
                      <select className="rounded border px-1 py-1" value="" onChange={(e) => e.target.value && act({ action: "set_assignment_status", assignment_id: a.id, status: e.target.value })}>
                        <option value="">Set status…</option>{Object.keys(JOB_STATUS).filter((k) => k !== "offered").map((k) => <option key={k} value={k}>{JOB_STATUS[k].label}</option>)}
                      </select>
                      <button disabled={busy} onClick={() => act({ action: "remove_assignment", assignment_id: a.id })} className="text-red-600 hover:underline">Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-1 font-bold">Lead status</h3>
                <select className="input" value={l.status} disabled={busy} onChange={(e) => act({ action: "set_status", status: e.target.value })}>
                  {LEAD_STATUSES.map((st) => <option key={st} value={st}>{LEAD_STATUS_LABELS[st]}</option>)}
                </select>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button disabled={busy} onClick={() => act({ action: "set_status", status: "invalid" })} className="btn-secondary px-2.5 py-1 text-xs">Mark invalid</button>
                  <button disabled={busy} onClick={() => act({ action: "set_status", status: "new" })} className="btn-secondary px-2.5 py-1 text-xs">Reopen</button>
                </div>
              </div>
              <div>
                <h3 className="mb-1 font-bold">Quality tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {["customer_confirmed", "whatsapp_opened", "called_by_admin", "high_value", "spam_suspected"].map((t) => (
                    <button key={t} disabled={busy} onClick={() => act({ action: "toggle_tag", tag: t })}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${l.quality_tags?.includes(t) ? "border-brand bg-brand text-white" : "border-gray-300 text-gray-600"}`}>{t.replace(/_/g, " ")}</button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-gray-400">“whatsapp opened” means they tapped the button — not proof they sent a message. Add “customer confirmed” after chatting.</p>
              </div>
            </section>

            <section>
              <h3 className="mb-1 font-bold">Notes</h3>
              {l.admin_notes && <pre className="mb-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 font-sans text-sm">{l.admin_notes}</pre>}
              <div className="flex gap-2">
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Called customer — available after 3pm" />
                <button disabled={busy || !note.trim()} onClick={() => { act({ action: "note", note }); setNote(""); }} className="btn-primary">Add</button>
              </div>
            </section>

            <section className="text-xs text-gray-600">
              <h3 className="mb-1 text-sm font-bold text-gray-900">Where they came from</h3>
              <p>{[l.source, l.medium, l.campaign].filter(Boolean).join(" / ") || "direct"}</p>
              <div className="mt-1 grid grid-cols-2 gap-x-4">{Object.entries(l.attribution || {}).map(([k, v]) => <p key={k} className="truncate"><span className="text-gray-400">{k}:</span> {v}</p>)}</div>
            </section>

            <section>
              <h3 className="mb-2 font-bold">History</h3>
              <ol className="space-y-1.5 border-l-2 border-gray-200 pl-4 text-xs">
                {d.activity.map((ev) => (
                  <li key={ev.id}><span className="text-gray-400">{fmtDate(ev.created_at)}</span> · <b>{ev.event.replace(/_/g, " ")}</b> <span className="text-gray-500">({ev.actor})</span>
                    {Object.keys(ev.detail || {}).length > 0 && <span className="text-gray-500"> — {Object.entries(ev.detail).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ")}</span>}</li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

function PlumberPicker({ lead, onPick }: { lead: Detail["lead"]; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<{ id: string; trading_name: string; area: string; area_match: boolean; service_match: boolean; leads_enabled: boolean; published: boolean }[] | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams({ area: lead.area_key, service: lead.service_key, suburb: lead.suburb, q });
      fetch(`/api/admin/leads/plumbers?${p}`, { cache: "no-store" }).then((r) => r.json()).then((b) => setRows(b.plumbers ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [q, lead.area_key, lead.service_key, lead.suburb]);
  return (
    <div className="mt-2 rounded-xl border bg-gray-50 p-3">
      <input className="input" autoFocus placeholder="Search claimed plumbers…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="mt-2 max-h-64 overflow-y-auto">
        {rows === null && <li className="p-2 text-xs text-gray-500">Loading…</li>}
        {rows?.length === 0 && <li className="p-2 text-xs text-gray-500">No claimed plumbers found. Only claimed businesses can receive leads.</li>}
        {rows?.map((r) => (
          <li key={r.id}>
            <button onClick={() => onPick(r.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-white">
              <span className="font-medium">{r.trading_name}</span><span className="text-xs text-gray-500">{r.area}</span>
              {r.area_match && <span className="badge bg-teal-light text-teal">area</span>}
              {r.service_match && <span className="badge bg-teal-light text-teal">service</span>}
              {!r.leads_enabled && <span className="badge bg-gray-200 text-gray-600">leads off</span>}
              {!r.published && <span className="badge bg-amber-light text-amber">unpublished</span>}
              <ExternalLink className="ml-auto h-3.5 w-3.5 text-gray-300" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PriceEditor() {
  const [rules, setRules] = useState<{ service_key: string; service_label: string; low: number | null; high: number | null; note: string | null; active: boolean }[] | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { fetch("/api/admin/estimates", { cache: "no-store" }).then((r) => r.json()).then((b) => { if (b.error) setMsg(b.error); setRules(b.rules ?? []); }); }, []);
  async function save(i: number) {
    const r = rules![i];
    const res = await fetch("/api/admin/estimates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service_key: r.service_key, low: r.low, high: r.high, note: r.note, active: r.active }) });
    const b = await res.json();
    setMsg(res.ok ? `Saved ${r.service_label}.` : b.error);
  }
  const upd = (i: number, patch: Partial<NonNullable<typeof rules>[number]>) => setRules((rs) => rs!.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v.replace(/\D/g, "")))));
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-600">Base price ranges shown to homeowners (in Rand). Emergency jobs are shown 35% higher and same-day jobs 15% higher. Leave both blank to show “the plumber will quote”.</p>
      {msg && <p className="mt-2 text-sm font-semibold text-teal">{msg}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead><tr className="text-left text-xs text-gray-500"><th className="py-2">Service</th><th>Low (R)</th><th>High (R)</th><th>Note shown to homeowner</th><th /></tr></thead>
          <tbody>{rules?.map((r, i) => (
            <tr key={r.service_key} className="border-t">
              <td className="py-2 font-medium">{r.service_label}</td>
              <td><input className="input w-24 py-1.5" inputMode="numeric" value={r.low ?? ""} onChange={(e) => upd(i, { low: num(e.target.value) })} /></td>
              <td><input className="input w-24 py-1.5" inputMode="numeric" value={r.high ?? ""} onChange={(e) => upd(i, { high: num(e.target.value) })} /></td>
              <td><input className="input py-1.5" value={r.note ?? ""} onChange={(e) => upd(i, { note: e.target.value })} /></td>
              <td className="pl-2"><button onClick={() => save(i)} className="btn-primary px-3 py-1.5 text-xs">Save</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function LeadPlumbers() {
  const [rows, setRows] = useState<{ id: string; trading_name: string; area: string; specialties: string[] | null; leads_enabled: boolean; published: boolean }[] | null>(null);
  const [totals, setTotals] = useState<{ claimedTotal: number; leadEnabledTotal: number } | null>(null);
  const [q, setQ] = useState("");
  const load = useCallback(() => {
    fetch(`/api/admin/leads/plumbers?q=${encodeURIComponent(q)}`, { cache: "no-store" }).then((r) => r.json()).then((b) => { setRows(b.plumbers ?? []); setTotals(b); });
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  async function toggle(id: string, on: boolean) {
    await fetch("/api/admin/leads/plumbers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plumber_id: id, leads_enabled: on }) });
    load();
  }
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-600">Only <b>claimed</b> plumbers can appear in the homeowner&apos;s plumber choice and receive leads. Switch leads off for anyone who doesn&apos;t respond.</p>
      {totals && <p className="mt-2 text-sm"><b>{totals.leadEnabledTotal}</b> plumbers can receive leads (of {totals.claimedTotal} claimed).{totals.leadEnabledTotal < 10 && <span className="text-red-600"> Recruit more claimed plumbers before running ads.</span>}</p>}
      <input className="input mt-3" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="mt-2 divide-y">
        {rows?.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
            <div className="flex-1"><p className="font-medium">{r.trading_name}</p><p className="text-xs text-gray-500">{r.area} · {(r.specialties || []).join(", ") || "no services listed"}{!r.published && " · unpublished"}</p></div>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={r.leads_enabled} onChange={(e) => toggle(r.id, e.target.checked)} /> Leads on
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
