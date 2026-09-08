import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareWarning } from "lucide-react";

export const metadata: Metadata = {
  title: "Complaints and Safety Reports | KZN Plumbers",
  description: "Report a misleading KZN Plumbers listing, unsupported credential, impersonation concern or review issue.",
  alternates: { canonical: "/complaints" },
};

export default function ComplaintsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <MessageSquareWarning className="h-7 w-7 text-brand" aria-hidden="true" />
      <h1 className="mt-4 font-display text-4xl font-bold text-slate-950">Complaints and safety reports</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-700">Use this process for a misleading directory record, unsupported credential, impersonation, duplicate business, abusive review, privacy concern or a pattern of serious complaints.</p>

      <section className="mt-10 space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-950">What KZN Plumbers can do</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">We can investigate the directory record, request evidence, correct or suspend a listing, remove an unsupported trust label, preserve relevant records and refer you to an appropriate official body. We cannot decide a contractual dispute or guarantee a refund from an independent plumber.</p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-950">Send a useful report</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
            <li>Include the profile URL, business name and job date.</li>
            <li>Describe the factual concern and the outcome you are requesting.</li>
            <li>Attach only relevant evidence and redact identity or banking information.</li>
            <li>Say whether the issue has been raised with the business or an industry body.</li>
          </ul>
        </div>
      </section>

      <section className="mt-9 rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <h2 className="font-display text-xl font-bold">Immediate danger or suspected crime</h2>
        <p className="mt-2 text-sm leading-relaxed">Contact emergency services or the South African Police Service where appropriate. Do not wait for a directory review if someone is at risk.</p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/contact" className="btn-primary">Submit a complaint</Link>
        <Link href="/corrections" className="btn-secondary">Request a factual correction</Link>
      </div>
    </main>
  );
}
