"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Lock, Mail, MessageCircle, Phone, Siren, Trophy, X } from "lucide-react";
import { useAuthGate } from "@/lib/useAuthGate";
import { DashboardLoading } from "@/components/DashboardLoading";
import { DashboardNav } from "@/components/DashboardNav";
import { JOB_STATUS, formatEstimate, getLeadUrgency } from "@/lib/leads";
import { formatInvoiceDate } from "@/lib/invoice";
import { formatWhatsApp } from "@/lib/utils";

type Job = {
  ref: string; lead_type: string; status: string; service_label: string; area_label: string; suburb: string; postcode: string | null;
  urgency: string; description: string | null; estimate_low: number | null; estimate_high: number | null; first_name: string; created_at: string;
  last_name?: string | null; phone?: string; whatsapp?: string | null; email?: string | null; photos: string[];
};
type Assignment = { id: string; status: string; job_value: number | null };

export default function PlumberLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, authChecking } = useAuthGate();
  const [job, setJob] = useState<Job | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [jobValue, setJobValue] = useState("");
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    fetch(`/api/dashboard/leads/${id}`, { cache: "no-store" })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "Could not load this job."); setJob(b.job); setAssignment(b.assignment); })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { if (user) load(); }, [user, load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setError(null);
    try {
      const r = await fetch(`/api/dashboard/leads/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "That didn't work. Please try again.");
      setDeclineOpen(false);
      load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  if (authChecking || (user && !job && !error)) return <DashboardLoading />;
  if (!user) return null;

  const status = assignment?.status ?? "";
  const isOpen = ["offered", "notified", "viewed"].includes(status);
  const accepted = ["accepted", "contacted", "quoted", "won", "lost"].includes(status);
  const st = JOB_STATUS[status];
  const estimate = job ? formatEstimate(job.estimate_low, job.estimate_high) : null;
  const wa = job?.whatsapp || job?.phone;
  const waText = job ? `Hi ${job.first_name}, I am a plumber from KZNPlumbers contacting you about your ${job.service_label.toLowerCase()} request (${job.ref}) in ${job.suburb}. When is a good time to come and look?` : "";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid lg:grid-cols-[240px_1fr] gap-6">
      <DashboardNav />
      <div className="min-w-0 max-w-3xl">
        <Link href="/dashboard/leads" className="mb-2 inline-flex items-center gap-1 text-sm text-brand hover:underline"><ArrowLeft className="h-4 w-4" /> All job leads</Link>
        {error && !job && <div className="panel text-sm text-red-600">{error}</div>}
        {job && (
          <>
            <div className="panel mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl sm:text-3xl">{job.service_label}</h1>
                {st && <span className={`badge ${st.style}`}>{st.label}</span>}
                {(job.urgency === "emergency" || job.urgency === "today") && <span className="badge bg-emergency-light text-emergency"><Siren className="h-3 w-3" /> {getLeadUrgency(job.urgency)?.label}</span>}
              </div>
              <p className="mt-1 text-sm text-gray-600">{job.ref} · received {formatInvoiceDate(job.created_at)}{job.lead_type === "requested_plumber" ? " · the homeowner asked for you specifically" : ""}</p>

              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <Item k="Location" v={`${job.suburb}, ${job.area_label}${job.postcode ? ` ${job.postcode}` : ""}`} />
                <Item k="Required" v={getLeadUrgency(job.urgency)?.label ?? job.urgency} />
                <Item k="Customer" v={accepted ? [job.first_name, job.last_name].filter(Boolean).join(" ") : job.first_name} />
                <Item k="Estimate shown to customer" v={estimate ?? "None — quote required"} />
                <Item k="Photos" v={job.photos.length ? `${job.photos.length}` : "None"} />
              </dl>
              {job.description && <p className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-800">{job.description}</p>}
              {job.photos.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {job.photos.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-lg border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                      <img src={url} alt={`Job photo ${i + 1}`} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {isOpen && (
              <div className="panel mb-4 border-green-300 bg-green-50">
                <div className="flex items-start gap-3">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Accept to see the customer&apos;s phone number</p>
                    <p className="text-sm text-gray-600">Only accept if you can contact {job.first_name} soon. Leads are free while KZNPlumbers is in its launch phase.</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => act("accept")} disabled={!!busy} className="btn flex-1 bg-green-600 px-6 py-3 text-base text-white hover:bg-green-700 sm:flex-none">
                    {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-5 w-5" />} Accept job
                  </button>
                  <button onClick={() => setDeclineOpen((v) => !v)} disabled={!!busy} className="btn-secondary py-3"><X className="h-4 w-4" /> Can&apos;t take it</button>
                </div>
                {declineOpen && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
                      <option value="">Reason (optional)</option>
                      <option>Fully booked</option><option>Too far away</option><option>Not a job I do</option><option>Job too small</option><option>Other</option>
                    </select>
                    <button onClick={() => act("decline", { reason })} disabled={!!busy} className="btn bg-gray-800 text-white hover:bg-gray-900">{busy === "decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Decline job</button>
                  </div>
                )}
              </div>
            )}

            {accepted && job.phone && (
              <div className="panel mb-4">
                <h2 className="font-semibold text-gray-900">Contact {job.first_name}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={`tel:+${job.phone}`} className="btn-primary py-3"><Phone className="h-4 w-4" /> Call +{job.phone}</a>
                  {wa && <a href={`https://wa.me/${formatWhatsApp(wa)}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer" className="btn-whatsapp py-3"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
                  {job.email && <a href={`mailto:${job.email}?subject=${encodeURIComponent(`Your plumbing request ${job.ref}`)}`} className="btn-secondary py-3"><Mail className="h-4 w-4" /> Email</a>}
                </div>
              </div>
            )}

            {accepted && (
              <div className="panel mb-4">
                <h2 className="font-semibold text-gray-900">How is this job going?</h2>
                <p className="text-sm text-gray-500">One tap keeps KZNPlumbers sending you the right jobs.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Step done={["contacted", "quoted", "won", "lost"].includes(status)} disabled={status !== "accepted" || !!busy} onClick={() => act("contacted")} label="I contacted the customer" busy={busy === "contacted"} />
                  <Step done={["quoted", "won"].includes(status)} disabled={!["accepted", "contacted"].includes(status) || !!busy} onClick={() => act("quoted")} label="I sent a quote" busy={busy === "quoted"} />
                </div>
                <div className="mt-4 rounded-lg bg-gray-50 p-3">
                  <p className="text-sm font-semibold text-gray-800">Did you win the job?</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-sm text-gray-600">R
                      <input className="input w-32 py-2" inputMode="decimal" placeholder="Job value" value={jobValue} onChange={(e) => setJobValue(e.target.value.replace(/[^\d.]/g, ""))} />
                    </label>
                    <button onClick={() => act("won", jobValue ? { job_value: Number(jobValue) } : {})} disabled={!!busy || status === "won"} className="btn bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                      {busy === "won" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />} {status === "won" ? "Won ✓" : "Yes, I won it"}
                    </button>
                    <button onClick={() => act("lost")} disabled={!!busy || status === "lost"} className="btn-secondary disabled:opacity-50">{status === "lost" ? "Marked lost" : "No, lost it"}</button>
                  </div>
                  {assignment?.job_value ? <p className="mt-2 text-xs text-gray-500">Recorded job value: R{assignment.job_value}</p> : null}
                </div>
                <Link href="/dashboard/invoices/new" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">Create an invoice for this job →</Link>
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{k}</dt><dd className="font-medium text-gray-900">{v}</dd></div>;
}

function Step({ done, disabled, onClick, label, busy }: { done: boolean; disabled: boolean; onClick: () => void; label: string; busy: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`btn ${done ? "bg-teal-light text-teal" : "btn-secondary"} disabled:cursor-default`}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : null}{label}
    </button>
  );
}
