"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, MessageCircle, Users } from "lucide-react";
import { formatEstimate, getLeadUrgency, leadWhatsAppMessage, leadWhatsAppUrl } from "@/lib/leads";

type Received = {
  ref: string; first_name: string; service_label: string; suburb: string; area_label: string; urgency: string;
  estimate_low: number | null; estimate_high: number | null; estimate_note: string | null;
  lead_type: string; plumbers: { name: string; accepted: boolean }[];
};

export function LeadReceived() {
  const search = useSearchParams();
  const ref = search.get("ref") || "";
  const token = search.get("t") || "";
  const duplicate = search.get("dup") === "1";
  const [lead, setLead] = useState<Received | null>(null);
  const [error, setError] = useState<string | null>(null);
  const viewed = useRef(false);

  useEffect(() => {
    if (!ref || !token) { setError("We couldn't find that request."); return; }
    fetch(`/api/leads/${encodeURIComponent(ref)}?t=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "We couldn't load your request."); return b.lead as Received; })
      .then((l) => {
        setLead(l);
        if (!viewed.current) {
          viewed.current = true;
          track("confirmation_viewed");
        }
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, token]);

  function track(event: "whatsapp_cta_clicked" | "confirmation_viewed") {
    const body = JSON.stringify({ t: token, event });
    // keepalive lets the request finish even though WhatsApp opens immediately.
    fetch(`/api/leads/${encodeURIComponent(ref)}/event`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xl">
        <p className="text-gray-700">{error}</p>
        <Link href="/get-estimate" className="btn-primary mt-4 inline-flex">Start a new request</Link>
      </div>
    );
  }
  if (!lead) return <div className="flex h-96 items-center justify-center rounded-2xl bg-white shadow-xl"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  const estimate = formatEstimate(lead.estimate_low, lead.estimate_high);
  const waUrl = leadWhatsAppUrl(leadWhatsAppMessage(lead));

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
      <div className="bg-brand px-6 py-8 text-center text-white sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/80">Your estimated cost</p>
        {estimate ? (
          <p className="mt-2 font-display text-4xl font-bold sm:text-5xl">{estimate}</p>
        ) : (
          <p className="mt-2 font-display text-2xl font-bold">The plumber will quote after seeing the job</p>
        )}
        <p className="mt-2 text-sm text-white/80">
          For {lead.service_label.toLowerCase()} in {lead.suburb} · {getLeadUrgency(lead.urgency)?.label}
        </p>
        {lead.estimate_note && estimate && <p className="mx-auto mt-3 max-w-md text-xs text-white/70">{lead.estimate_note}</p>}
      </div>

      <div className="space-y-6 px-6 py-7 sm:px-10">
        <div className="flex gap-3">
          <CheckCircle2 className="h-7 w-7 shrink-0 text-green-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{duplicate ? "We already have your request" : "Your request has been received"}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {duplicate
                ? "You sent us this job recently, so we've kept your original request instead of creating a new one."
                : "We've received your plumbing request and are reviewing it so we can connect you with a suitable plumber."}
            </p>
            <p className="mt-3 inline-block rounded-lg bg-gray-100 px-3 py-1.5 text-sm">Reference: <strong className="font-mono">{lead.ref}</strong></p>
          </div>
        </div>

        {lead.plumbers.length > 0 && (
          <div className="flex gap-3 rounded-xl bg-gray-50 p-4">
            <Users className="h-5 w-5 shrink-0 text-brand" />
            <div className="text-sm text-gray-700">
              <p className="font-semibold text-gray-900">Sent to {lead.plumbers.length === 1 ? "your chosen plumber" : `your ${lead.plumbers.length} chosen plumbers`}</p>
              <ul className="mt-1 space-y-0.5">
                {lead.plumbers.map((p) => <li key={p.name}>{p.name}{p.accepted && <span className="ml-2 font-semibold text-green-700">✓ accepted</span>}</li>)}
              </ul>
              <p className="mt-1 text-xs text-gray-500">They&apos;ll contact you once they accept the job.</p>
            </div>
          </div>
        )}

        <div className="rounded-xl border-2 border-whatsapp/40 bg-green-50 p-5">
          <h2 className="font-bold text-gray-900">Want to speak to us directly?</h2>
          <p className="mt-1 text-sm text-gray-700">Send us a WhatsApp message and we&apos;ll know exactly which request you&apos;re referring to.</p>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("whatsapp_cta_clicked")}
            className="btn-whatsapp mt-4 w-full py-3.5 text-base"
          >
            <MessageCircle className="h-5 w-5" /> Message KZNPlumbers About My Request
          </a>
          <p className="mt-3 text-center text-xs text-gray-600">You don&apos;t need to fill in your details again — we&apos;ve already received your request.</p>
        </div>

        <p className="text-xs italic leading-relaxed text-gray-500">
          This is an indicative estimate. Final pricing may change after the plumber assesses the job.
        </p>
        <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-5 text-sm">
          <Link href="/" className="font-semibold text-brand hover:underline">Back to the directory</Link>
          <span className="text-gray-300">·</span>
          <Link href="/get-estimate" className="font-semibold text-brand hover:underline">Request another job</Link>
        </div>
      </div>
    </div>
  );
}
