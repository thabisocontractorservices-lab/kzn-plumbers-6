import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { PlumberCard } from "@/components/PlumberCard";
import { safeJsonLd } from "@/lib/json-ld";
import { realPastDate } from "@/lib/directory-seo";
import { getPublicPlumbers } from "@/lib/directory-data";
import { guideAreaMatch } from "@/lib/regions";
import { sanitizeEditorialHtml } from "@/lib/sanitize";
import { SERVICE_GUIDES, getServiceGuide } from "@/lib/services";
import { safeLegacyLanding } from "@/lib/legacy-landing";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getSeoPage as getPage, editorialIndexable, approvedEditorialDisposition } from "@/lib/directory-editorial";
import { redirectIfMoved } from "@/lib/redirects";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return { title: "Page not found | KZN Plumbers", robots: { index: false, follow: true } };

  const nonIndexable = !editorialIndexable(page);
  const landing = safeLegacyLanding(page);
  const title = landing?.title ?? page.meta_title;
  const description = landing?.description ?? page.meta_description;
  const canonical = `/${slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: nonIndexable ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: "article",
      url: absoluteUrl(canonical),
      siteName: SITE_NAME,
      locale: "en_ZA",
    },
  };
}

// Generate historical URLs on demand. Builds do not need to crawl production content.
export function generateStaticParams() { return []; }

export default async function SeoContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) {
    // Only admin-approved rules in redirect_rules are followed (never unvalidated page fields).
    await redirectIfMoved(`/${slug}`);
    notFound();
  }

  // No automatic redirects from unvalidated database targets. Existing URLs remain stable.
  if (approvedEditorialDisposition(page) === "remove") notFound();
  const landing = safeLegacyLanding(page);
  const heading = landing?.heading ?? page.h1;
  const description = landing?.description ?? page.meta_description;
  const areaMatch = guideAreaMatch(page.city_focus);
  const region = areaMatch?.region ?? null;
  const service = landing ? (landing.serviceSlug ? getServiceGuide(landing.serviceSlug) : null) : findService(page.group_name, page.h1);
  const providerResult = areaMatch ? await getPublicPlumbers({
    areas: areaMatch.areas, specialty: service?.specialty, limit: 6,
  }) : null;
  const plumbers = providerResult?.plumbers ?? [];
  const changed = realPastDate(page.updated_at);
  const updated = changed ? new Date(changed) : null;
  const body = sanitizeEditorialHtml(page.body_html);
  const canonical = `/${slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: heading,
    description,
    mainEntityOfPage: absoluteUrl(canonical),
    publisher: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
    ...(updated && !landing && !Number.isNaN(updated.getTime()) ? { dateModified: updated.toISOString() } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <article>
        <header className="bg-slate-950 px-4 py-12 text-white sm:px-6 sm:py-16">
          <div className="mx-auto max-w-5xl">
            <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-slate-300">
              <Link href="/" className="hover:text-white">Home</Link><span aria-hidden="true">/</span>
              {region && <><Link href={`/plumbers/${region.slug}`} className="hover:text-white">{region.shortName}</Link><span aria-hidden="true">/</span></>}
              <span>{page.group_name || "Plumbing guide"}</span>
            </nav>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-sky-300">KZN homeowner guide</p>
            <h1 className="mt-3 max-w-4xl font-display text-4xl font-bold leading-tight sm:text-5xl">{heading}</h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-200">{description}</p>
            {!landing && updated && !Number.isNaN(updated.getTime()) && (
              <p className="mt-4 flex items-center gap-2 text-xs text-slate-400"><CalendarDays className="h-4 w-4" /> Updated {updated.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}</p>
            )}
          </div>
        </header>

        {plumbers.length > 0 && (
          <section className="border-b border-slate-200 bg-slate-50 px-4 py-10 sm:px-6" aria-labelledby="relevant-providers">
            <div className="mx-auto max-w-7xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Matching stored area labels</p>
                  <h2 id="relevant-providers" className="mt-2 font-display text-3xl font-bold text-slate-950">
                    Records labelled {areaMatch?.areas.join(", ")}
                  </h2>
                </div>
                <Link href="/trust" className="inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline"><ShieldCheck className="h-4 w-4" /> How verification works</Link>
              </div>
              <p className="mt-3 text-sm text-slate-600">{region?.coverageNote || "These are matching stored area labels, not confirmed service boundaries. Ask the business about your exact address."}</p>
              <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {plumbers.map((plumber, index) => (
                  <PlumberCard key={plumber.id} plumber={plumber} sourcePage={`guide_${slug}`} rankPosition={index + 1} />
                ))}
              </div>
            </div>
          </section>
        )}

        {areaMatch && plumbers.length === 0 && <p className="mx-auto max-w-5xl px-4 pt-8 text-sm text-slate-600 sm:px-6">No matching directory records were found for these criteria. <Link href="/" className="font-semibold text-brand underline">Browse the directory</Link> and confirm services and coverage directly with the business.</p>}

        {!areaMatch && <p className="mx-auto max-w-5xl px-4 pt-8 text-sm text-slate-600 sm:px-6">This guide does not have a town that can be matched narrowly to existing directory area labels. No broad KZN provider set is presented as local coverage. <Link href="/" className="font-semibold text-brand underline">Choose an area in the directory</Link>.</p>}

        <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_260px]">
          {landing ? (
            <div className="seo-content">
              <h2>How to compare your options</h2>
              <p>Directory records may be unclaimed, claimed by a business, or have a checked credential. Publication is not an endorsement or a guarantee of availability. Check each profile's label and confirm the details directly.</p>
              <ul>{landing.advice.map((item) => <li key={item}>{item}</li>)}</ul>
              <h2>Before arranging the work</h2>
              <p>Confirm that the business serves your address and handles your specific job. Ask about arrival times, call-out charges and any required registration or documentation. Reviews and contact methods are shown only where recorded.</p>
              <p><Link href="/trust">Read how verification works</Link> or <Link href="/get-estimate">request a free estimate</Link>.</p>
            </div>
          ) : <div className="seo-content" dangerouslySetInnerHTML={{ __html: body }} />}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {(region || service) && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <MapPin className="h-5 w-5 text-brand" aria-hidden="true" />
                <h2 className="mt-3 font-display text-lg font-bold text-slate-950">Browse directory records</h2>
                <div className="mt-4 space-y-2">
                  {region && <Link href={`/plumbers/${region.slug}`} className="flex items-center justify-between text-sm font-bold text-brand hover:underline">{region.shortName} plumbers <ArrowRight className="h-4 w-4" /></Link>}
                  {service && <Link href={`/services/${service.slug}`} className="flex items-center justify-between text-sm font-bold text-brand hover:underline">{service.name} providers <ArrowRight className="h-4 w-4" /></Link>}
                </div>
              </div>
            )}
            <div className="rounded-xl bg-slate-100 p-5 text-xs leading-relaxed text-slate-600">
              General information only. Confirm the diagnosis, scope, price and any required certificate with a suitably qualified professional.
            </div>
          </aside>
        </div>
      </article>
    </>
  );
}

function findService(groupName: string | null, heading: string) {
  const value = `${groupName ?? ""} ${heading}`.toLowerCase();
  return SERVICE_GUIDES.find((service) => {
    const terms = [service.name, service.specialty, service.slug.replace(/-/g, " ")];
    return terms.some((term) => value.includes(term.toLowerCase()));
  }) ?? null;
}
