import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink, Gauge, House, Waves } from "lucide-react";

export const metadata: Metadata = {
  title: "Water Leak or Municipal Outage? eThekwini Homeowner Guide",
  description: "A source-linked decision guide for Durban and eThekwini residents deciding whether to report a municipal fault or call a private-property plumber.",
  alternates: { canonical: "/resources/water-leak-or-outage-kzn" },
};

const REPORT_URL = "https://www.durban.gov.za/pages/faults/report-a-problem";
const WATER_GUIDE = "https://www.durban.gov.za/pages/residents/water-and-sanitation-services";

export default function WaterResourcePage() {
  return (
    <>
      <header className="bg-slate-950 px-4 py-14 text-white sm:px-6 sm:py-20"><div className="mx-auto max-w-4xl"><Waves className="h-7 w-7 text-sky-300" /><p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-sky-300">eThekwini water decision guide</p><h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Is it a municipal fault or a leak on the property?</h1><p className="mt-5 max-w-3xl text-slate-200">Use the boundary, nearby supply and water meter to decide the next call. Source check: 16 August 2026.</p></div></header>

      <main className="mx-auto max-w-4xl space-y-12 px-4 py-12 sm:px-6 sm:py-16">
        <section className="grid gap-5 sm:grid-cols-2">
          <DecisionCard icon={Waves} title="Street, council property or neighbours also affected" text="Use the official eThekwini fault channel for a suspected municipal leak or outage. Give the street, area and closest address or landmark." action={<a href={REPORT_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-brand hover:underline">Open the official fault page <ExternalLink className="inline h-4 w-4" /></a>} />
          <DecisionCard icon={House} title="Inside the property boundary" text="The eThekwini resident guide says leaks inside the property boundary may be the homeowner’s responsibility, or the landlord’s for a rented property. Isolate the supply if safe and arrange a plumber." action={<Link href="/?service=leak-detection&area=durban" className="text-sm font-bold text-brand hover:underline">Find Durban leak specialists <ArrowRight className="inline h-4 w-4" /></Link>} />
        </section>

        <section>
          <div className="flex items-center gap-3"><Gauge className="h-6 w-6 text-brand" /><h2 className="font-display text-3xl font-bold text-slate-950">A quick meter check</h2></div>
          <ol className="mt-5 space-y-3 text-sm leading-relaxed text-slate-700"><li><strong>1.</strong> Turn off taps and appliances that use water.</li><li><strong>2.</strong> Find the property water meter and note the reading.</li><li><strong>3.</strong> If the meter continues moving while nothing should be using water, there may be a leak on the property.</li><li><strong>4.</strong> Isolate the supply if safe and contact the owner, landlord or plumber as appropriate.</li></ol>
          <a href={WATER_GUIDE} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline">Read eThekwini Water and Sanitation guidance <ExternalLink className="h-4 w-4" /></a>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><h2 className="font-display text-2xl font-bold text-slate-950">Tell the plumber what you know</h2><ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700"><li>Exact suburb, street or estate.</li><li>Whether neighbours have water.</li><li>Whether the water meter moves with fixtures off.</li><li>Where water is visible and when it started.</li><li>Whether water is near ceilings, electrical points or appliances.</li></ul><Link href="/?service=burst-pipes&area=durban&filter=emergency" className="btn-primary mt-6">Find emergency-listed Durban plumbers</Link></section>

        <p className="text-xs leading-relaxed text-slate-500">This resource currently covers eThekwini because it links to the municipality’s official reporting pages. Other KZN municipalities use different fault channels; check your municipality before relying on the Durban process.</p>
      </main>
    </>
  );
}

function DecisionCard({ icon: Icon, title, text, action }: { icon: typeof Waves; title: string; text: string; action: React.ReactNode }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-6"><Icon className="h-6 w-6 text-brand" /><h2 className="mt-4 font-display text-xl font-bold text-slate-950">{title}</h2><p className="mt-3 text-sm leading-relaxed text-slate-700">{text}</p><div className="mt-5">{action}</div></article>;
}
