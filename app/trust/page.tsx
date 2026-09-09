import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Building2, CalendarCheck2, ListChecks, ShieldQuestion, TriangleAlert } from "lucide-react";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { safeJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "Trust, Safety and Verification | KZN Plumbers",
  description: "How KZN Plumbers labels directory records, claimed businesses and checked professional credentials, plus how to report a concern.",
  alternates: { canonical: "/trust" },
};

export default function TrustPage() {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Trust and verification", item: absoluteUrl("/trust") },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
      <section className="bg-slate-950 px-4 py-14 text-white sm:px-6 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-300">Trust is a method, not a badge</p>
          <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">How KZN Plumbers checks and labels listings</h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-200">
            {SITE_NAME} is a directory, not a plumbing company or regulator. We separate business ownership from professional credential checks so homeowners can see what evidence exists—and what still needs confirming.
          </p>
          <p className="mt-4 text-sm text-slate-400">Method last reviewed: 16 August 2026</p>
        </div>
      </section>

      <main className="mx-auto max-w-4xl space-y-12 px-4 py-12 sm:px-6 sm:py-16">
        <section id="states" className="scroll-mt-24">
          <h2 className="font-display text-3xl font-bold text-slate-950">The three public states</h2>
          <div className="mt-6 grid gap-4">
            <StateCard
              icon={BadgeCheck}
              title="Credential verified"
              tone="emerald"
              definition="KZN Plumbers recorded a registration identifier, an evidence source and a check date. The state expires and must be reviewed again."
              limits="This does not guarantee workmanship, price, insurance cover, response time or availability."
            />
            <StateCard
              icon={Building2}
              title="Business claimed"
              tone="blue"
              definition="The business owner or authorised representative controls the profile after an ownership review."
              limits="A claimed profile is not automatically PIRB-registered or credential verified."
            />
            <StateCard
              icon={ShieldQuestion}
              title="Directory record"
              tone="slate"
              definition="The listing was created from public or supplied business information and has not yet been claimed."
              limits="It is not an endorsement. Contact details, service areas and availability must be confirmed directly."
            />
          </div>
        </section>

        <section id="method" className="scroll-mt-24">
          <div className="flex items-center gap-3">
            <ListChecks className="h-6 w-6 text-brand" aria-hidden="true" />
            <h2 className="font-display text-3xl font-bold text-slate-950">Credential-check method</h2>
          </div>
          <ol className="mt-6 space-y-4 text-sm leading-relaxed text-slate-700">
            <li><strong className="text-slate-950">1. Identify the entity.</strong> We compare the trading name, phone, website, location and registration number to reduce duplicate or mismatched records.</li>
            <li><strong className="text-slate-950">2. Check an authoritative source.</strong> Where available, the registration identifier is checked against the relevant professional or industry source. A document upload alone is not treated as permanent proof.</li>
            <li><strong className="text-slate-950">3. Record provenance.</strong> The source, check date and expiry or review date are stored. Public pages show the state and most recent check date, not private documents.</li>
            <li><strong className="text-slate-950">4. Apply a human review.</strong> Uncertain names, duplicate entities, expired evidence and conflicting details are held for manual review rather than auto-published as verified.</li>
            <li><strong className="text-slate-950">5. Recheck.</strong> Credential states are time-limited. Stale or unconfirmed evidence is downgraded until reviewed.</li>
          </ol>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950">
            <TriangleAlert className="mb-2 h-5 w-5" aria-hidden="true" />
            Always ask the plumber to confirm the registration needed for your exact job and to issue the required certificate where applicable.
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3">
            <CalendarCheck2 className="h-6 w-6 text-brand" aria-hidden="true" />
            <h2 className="font-display text-3xl font-bold text-slate-950">How listings are ordered</h2>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-700">
            Your selected area, listed service and requested urgency filter the results before ordering. The default “Claimed profiles first” puts claimed businesses ahead of unclaimed directory records, with names A–Z inside each group. Claim status does not bring a business from another area into your local results. A claim is not a credential check, recommendation or workmanship guarantee.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            If you choose “Highest Google rated”, results are ordered by Google rating, then Google review count, then name. “Name A–Z” orders by name without claim priority. These explicit sorts replace the default; credential state and profile completeness do not add hidden ranking boosts. We do not sell verification and paid placement must never be labelled “top rated” or mixed into the normal order without clear sponsorship disclosure.
          </p>
        </section>

        <section className="rounded-2xl bg-slate-100 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold text-slate-950">See something wrong?</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">Report incorrect contact details, unsupported credentials, duplicate records, unsafe claims or a business that has closed. Include the profile URL and the evidence you can share.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/corrections" className="btn-primary">Request a correction</Link>
            <Link href="/complaints" className="btn-secondary">Make a complaint</Link>
          </div>
        </section>
      </main>
    </>
  );
}

function StateCard({
  icon: Icon,
  title,
  definition,
  limits,
  tone,
}: {
  icon: typeof BadgeCheck;
  title: string;
  definition: string;
  limits: string;
  tone: "emerald" | "blue" | "slate";
}) {
  const styles = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    slate: "border-slate-200 bg-slate-50 text-slate-950",
  }[tone];
  return (
    <article className={`rounded-xl border p-5 ${styles}`}>
      <div className="flex items-center gap-2"><Icon className="h-5 w-5" aria-hidden="true" /><h3 className="font-display text-xl font-bold">{title}</h3></div>
      <p className="mt-3 text-sm leading-relaxed"><strong>What it means:</strong> {definition}</p>
      <p className="mt-2 text-sm leading-relaxed opacity-85"><strong>What it does not mean:</strong> {limits}</p>
    </article>
  );
}
