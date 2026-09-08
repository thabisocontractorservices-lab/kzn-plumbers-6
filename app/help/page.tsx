import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, CircleHelp, Search, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Help Centre | KZN Plumbers Directory",
  description: "Help for KZN homeowners and plumbing businesses using the directory, including search, quotes, claims, reviews and safety guidance.",
  alternates: { canonical: "/help" },
};

export default function HelpPage() {
  return (
    <>
      <section className="bg-slate-950 px-4 py-14 text-white sm:px-6 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <CircleHelp className="h-7 w-7 text-sky-300" aria-hidden="true" />
          <h1 className="mt-4 font-display text-4xl font-bold sm:text-5xl">Help centre</h1>
          <p className="mt-4 max-w-2xl text-slate-200">Straight answers for homeowners comparing providers and plumbers managing a listing.</p>
        </div>
      </section>

      <main className="mx-auto max-w-4xl space-y-10 px-4 py-12 sm:px-6 sm:py-16">
        <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-950">
          <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5" aria-hidden="true" /> This directory is not an emergency service</div>
          <p className="mt-2 text-sm leading-relaxed">For flooding, isolate water or electricity only when safe. For immediate danger, fire or electrical risk, contact the appropriate emergency service. A “24-hour” label is supplied by the business and should be confirmed directly.</p>
        </section>

        <HelpSection icon={Search} title="Finding and comparing a plumber">
          <p>Choose the area, job type and urgency on the homepage. Read the verification label, check recent visible reviews, ask for a written and itemised quote, and confirm who will issue any required certificate.</p>
          <p>A directory record is not an endorsement. Contact two or three suitable providers for non-emergency work and compare the full scope rather than the lowest headline price.</p>
          <Link href="/" className="text-brand font-bold hover:underline">Search the directory</Link>
        </HelpSection>

        <HelpSection icon={ShieldCheck} title="Understanding verification">
          <p>Credential verified, business claimed and directory record are separate states. They describe evidence held by the platform; none is a workmanship guarantee.</p>
          <Link href="/trust" className="text-brand font-bold hover:underline">Read the full verification method</Link>
        </HelpSection>

        <HelpSection icon={Building2} title="Managing a plumbing business listing">
          <p>Business owners can list a new company or claim an existing record. Claims are reviewed before ownership is transferred. Keep service areas, contact details, listed services and availability current.</p>
          <div className="flex flex-wrap gap-3"><Link href="/register" className="btn-primary">List a business</Link><Link href="/all-plumbers" className="btn-secondary">Find an existing record</Link></div>
        </HelpSection>

        <section className="rounded-2xl bg-slate-100 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold text-slate-950">Need account or listing help?</h2>
          <p className="mt-3 text-sm text-slate-700">Use the contact form for login problems, ownership evidence, corrections, privacy requests or removal requests. Include the profile URL but do not send passwords or banking details.</p>
          <Link href="/contact" className="btn-primary mt-5">Contact KZN Plumbers</Link>
        </section>
      </main>
    </>
  );
}

function HelpSection({ icon: Icon, title, children }: { icon: typeof Search; title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-slate-200 pb-9">
      <div className="flex items-center gap-3"><Icon className="h-6 w-6 text-brand" aria-hidden="true" /><h2 className="font-display text-2xl font-bold text-slate-950">{title}</h2></div>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}
