import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileCheck2, Waves } from "lucide-react";

export const metadata: Metadata = {
  title: "KZN Plumbing Resources | KZN Plumbers",
  description: "Sourced, practical resources for KwaZulu-Natal homeowners covering plumbing certificates, leaks, outages and hiring checks.",
  alternates: { canonical: "/resources" },
};

export default function ResourcesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Evidence-led homeowner resources</p>
      <h1 className="mt-3 font-display text-4xl font-bold text-slate-950 sm:text-5xl">Practical KZN plumbing tools</h1>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-700">Fewer articles, more utility. Each resource names its sources, review date and limitations.</p>
      <div className="mt-9 grid gap-5 sm:grid-cols-2">
        <ResourceCard href="/resources/plumbing-coc-kzn" icon={FileCheck2} title="Plumbing CoC checklist" text="What PIRB says about when a Certificate of Compliance is required, who can issue one, and what to ask before work starts." />
        <ResourceCard href="/resources/water-leak-or-outage-kzn" icon={Waves} title="Leak or municipal outage?" text="A Durban and eThekwini decision guide that separates private-property repairs from municipal fault reporting." />
      </div>
    </main>
  );
}

function ResourceCard({ href, icon: Icon, title, text }: { href: string; icon: typeof FileCheck2; title: string; text: string }) {
  return <Link href={href} className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-brand hover:shadow-md"><Icon className="h-6 w-6 text-brand" /><h2 className="mt-4 font-display text-2xl font-bold text-slate-950 group-hover:text-brand">{title}</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">{text}</p><span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-brand">Open resource <ArrowRight className="h-4 w-4" /></span></Link>;
}
