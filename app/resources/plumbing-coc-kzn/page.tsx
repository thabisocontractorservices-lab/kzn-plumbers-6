import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ExternalLink, FileCheck2, Printer, TriangleAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "Plumbing Certificate of Compliance Checklist for KZN Homeowners",
  description: "A sourced checklist explaining PIRB plumbing Certificates of Compliance, when they are required and what KZN homeowners should confirm.",
  alternates: { canonical: "/resources/plumbing-coc-kzn" },
};

const PIRB_COC = "https://www.pirb.co.za/Support/when-must-i-issue-a-pirb-coc/";
const PIRB_TIMING = "https://www.pirb.co.za/Support/how-soon-after-completion-of-the-work-should-i-issue-a-coc/";
const IOPSA_GUIDE = "https://iopsa.org.za/choosing-the-right-plumber-may-be-easier-than-you-think/";

export default function CocResourcePage() {
  return (
    <>
      <header className="bg-slate-950 px-4 py-14 text-white sm:px-6 sm:py-20">
        <div className="mx-auto max-w-4xl"><FileCheck2 className="h-7 w-7 text-sky-300" /><p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-sky-300">Homeowner compliance checklist</p><h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Before the plumber starts: ask about the CoC</h1><p className="mt-5 max-w-3xl text-slate-200">A short, source-linked guide to the PIRB Certificate of Compliance process. Source check: 16 August 2026.</p></div>
      </header>

      <main className="mx-auto max-w-4xl space-y-12 px-4 py-12 sm:px-6 sm:py-16">
        <section>
          <h2 className="font-display text-3xl font-bold text-slate-950">When PIRB says a CoC is required</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-700">PIRB guidance says a Certificate of Compliance is required for most plumbing work when the total value, including materials, labour and VAT, exceeds R1,500. PIRB also lists categories where a CoC is required regardless of value, including work on electric, solar and heat-pump water-heating systems, and the construction, installation or alteration of sanitary drains.</p>
          <a href={PIRB_COC} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline">Read the current PIRB guidance <ExternalLink className="h-4 w-4" /></a>
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950"><TriangleAlert className="mb-2 h-5 w-5" />The threshold and rules can change. Confirm the current requirement for your exact job with PIRB and the plumber before accepting the quote.</div>
        </section>

        <section className="print-checklist rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Printable checklist</p><h2 className="mt-2 font-display text-3xl font-bold text-slate-950">Put these points in the written quote</h2></div><span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"><Printer className="h-4 w-4" /> Print from your browser</span></div>
          <ul className="mt-6 space-y-4">{[
            "The name and registration number of the person who will issue the CoC.",
            "Whether a CoC is required for this exact scope, and the reason.",
            "Whether the certificate cost is included in the quote.",
            "The materials, labour, call-out, VAT and certificate shown separately.",
            "Who receives the physical or digital certificate and when.",
            "How pre-existing non-compliance will be recorded and quoted.",
            "The product and workmanship warranties supplied after completion.",
          ].map((item) => <li key={item} className="flex gap-3 text-sm leading-relaxed text-slate-700"><span className="mt-0.5 h-5 w-5 shrink-0 rounded border-2 border-slate-400" aria-hidden="true" />{item}</li>)}</ul>
        </section>

        <section>
          <h2 className="font-display text-3xl font-bold text-slate-950">After the work</h2>
          <div className="mt-5 space-y-3">{[
            "Check that the business and installation details on the certificate match the job.",
            "Keep the quote, invoice, photos, product warranties and certificate together.",
            "PIRB says the CoC should be logged within five working days after completion; follow up if the agreed document has not arrived.",
          ].map((item) => <p key={item} className="flex gap-3 text-sm leading-relaxed text-slate-700"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />{item}</p>)}</div>
          <a href={PIRB_TIMING} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline">PIRB guidance on timing <ExternalLink className="h-4 w-4" /></a>
        </section>

        <section className="rounded-2xl bg-slate-100 p-6 sm:p-8"><h2 className="font-display text-2xl font-bold text-slate-950">Compare providers, then verify the person doing the work</h2><p className="mt-3 text-sm leading-relaxed text-slate-700">IOPSA publishes a directory and explains its membership requirements. KZN Plumbers can help you compare local records, but the final credential and certificate check belongs in the quote and job handover.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/?filter=credential" className="btn-primary">Browse credential-checked profiles</Link><a href={IOPSA_GUIDE} target="_blank" rel="noopener noreferrer" className="btn-secondary">Read the IOPSA guide</a></div></section>
      </main>
    </>
  );
}
