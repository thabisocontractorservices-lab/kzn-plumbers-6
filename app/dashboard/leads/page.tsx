"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, ChevronRight, Siren } from "lucide-react";
import { useAuthGate } from "@/lib/useAuthGate";
import { DashboardLoading } from "@/components/DashboardLoading";
import { DashboardNav } from "@/components/DashboardNav";
import { JOB_STATUS, formatEstimate, getLeadUrgency } from "@/lib/leads";
import { formatInvoiceDate } from "@/lib/invoice";

type Job = {
  id: string; status: string; created_at: string; ref: string; service_label: string; suburb: string; area_label: string;
  urgency: string; first_name: string; estimate_low: number | null; estimate_high: number | null; photos: number; lead_type: string; job_value: number | null;
};


export default function PlumberLeadsPage() {
  const { user, authChecking } = useAuthGate();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/dashboard/leads", { cache: "no-store" })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "Could not load your jobs."); setJobs(b.jobs); })
      .catch((e) => { setError(e.message); setJobs([]); });
  }, [user]);

  if (authChecking || (user && jobs === null)) return <DashboardLoading />;
  if (!user) return null;

  const open = (jobs ?? []).filter((j) => ["offered", "notified", "viewed"].includes(j.status));
  const active = (jobs ?? []).filter((j) => ["accepted", "contacted", "quoted"].includes(j.status));
  const closed = (jobs ?? []).filter((j) => ["won", "lost", "declined", "expired"].includes(j.status));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid lg:grid-cols-[240px_1fr] gap-6">
      <DashboardNav />
      <div className="min-w-0">
        <h1 className="font-display text-3xl">Job leads</h1>
        <p className="text-sm text-gray-500 mb-6">Homeowners who chose you on KZNPlumbers. Accept quickly — the first plumber to call usually gets the job.</p>
        {error && <p className="panel mb-4 text-sm text-red-600">{error}</p>}
        {!error && jobs?.length === 0 && (
          <div className="panel py-12 text-center">
            <div className="text-4xl mb-2">🔔</div>
            <p className="font-semibold">No job leads yet</p>
            <p className="mt-1 text-sm text-gray-500">When a homeowner picks you for a job, it appears here and we email you. Keep your profile photos, services and reviews up to date to be chosen more often.</p>
            <Link href="/dashboard/profile" className="btn-primary mt-4 inline-flex">Improve my profile</Link>
          </div>
        )}
        <Section title="New jobs — respond now" jobs={open} highlight />
        <Section title="In progress" jobs={active} />
        <Section title="Finished" jobs={closed} />
      </div>
    </div>
  );
}

function Section({ title, jobs, highlight }: { title: string; jobs: Job[]; highlight?: boolean }) {
  if (!jobs.length) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">{title} ({jobs.length})</h2>
      <ul className="space-y-2">
        {jobs.map((j) => {
          const st = JOB_STATUS[j.status] ?? { label: j.status, style: "bg-gray-100" };
          const urgent = j.urgency === "emergency" || j.urgency === "today";
          return (
            <li key={j.id}>
              <Link href={`/dashboard/leads/${j.id}`} className={`flex items-center gap-4 rounded-xl border bg-white p-4 hover:border-brand ${highlight ? "border-green-300 shadow-sm" : "border-gray-200"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-gray-900">{j.service_label}</span>
                    <span className={`badge ${st.style}`}>{st.label}</span>
                    {urgent && <span className="badge bg-emergency-light text-emergency"><Siren className="h-3 w-3" />{getLeadUrgency(j.urgency)?.label}</span>}
                    {j.lead_type === "requested_plumber" && <span className="badge bg-brand-light text-brand">Asked for you</span>}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-600">{j.suburb}, {j.area_label} · {j.ref} · {formatInvoiceDate(j.created_at)}</p>
                  <p className="text-xs text-gray-400">{formatEstimate(j.estimate_low, j.estimate_high) ? `Estimate shown: ${formatEstimate(j.estimate_low, j.estimate_high)}` : "No estimate shown"}{j.photos ? <> · <Camera className="inline h-3 w-3" /> {j.photos}</> : null}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
