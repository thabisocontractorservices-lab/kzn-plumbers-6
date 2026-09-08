import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Corrections and Listing Updates | KZN Plumbers",
  description: "Request a correction to a KZN Plumbers directory record, including contact details, credentials, duplicates or closure information.",
  alternates: { canonical: "/corrections" },
};

export default function CorrectionsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <FileCheck2 className="h-7 w-7 text-brand" aria-hidden="true" />
      <h1 className="mt-4 font-display text-4xl font-bold text-slate-950">Corrections and listing updates</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-700">Accurate records matter. A business owner, customer or member of the public can report information that is wrong, duplicated, outdated or unsupported.</p>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold text-slate-950">What to include</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
          <li>The full KZN Plumbers profile URL.</li>
          <li>The exact field that should change.</li>
          <li>A reliable source or document supporting the correction.</li>
          <li>Your relationship to the business, if relevant.</li>
        </ul>
      </section>

      <section className="mt-9 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-xl font-bold text-slate-950">How we review a request</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">We compare the request with existing provenance and authoritative sources where available. Clear factual corrections can be applied quickly. Ownership, credential and duplicate-entity disputes may require additional evidence. A disputed credential can be removed or downgraded while it is reviewed.</p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/contact" className="btn-primary">Submit a correction</Link>
        <Link href="/trust" className="btn-secondary">Read the verification method</Link>
      </div>
      <p className="mt-5 text-xs leading-relaxed text-slate-500">Do not send passwords, full identity numbers, banking details or unredacted private documents through the general contact form.</p>
    </main>
  );
}
