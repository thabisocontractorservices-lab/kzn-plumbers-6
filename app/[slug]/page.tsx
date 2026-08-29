import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRight, CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { PlumberCard } from "@/components/PlumberCard";
import { safeJsonLd, safeStoredJsonLd } from "@/lib/json-ld";
import { getPublicPlumbers } from "@/lib/directory-data";
import { REGIONS } from "@/lib/regions";
import { sanitizeEditorialHtml } from "@/lib/sanitize";
import { SERVICE_GUIDES } from "@/lib/services";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getPublicSupabase } from "@/lib/supabase/public";

const OFF_SCOPE_SLUGS = new Set([
  "gas-cape-town",
  "drain-durbanville",
  "general-durbanville",
  "geyser-durbanville",
]);

type SeoPage = {
  slug: string;
  h1: string;
  meta_title: string;
  meta_description: string;
  body_html: string;
  faq_schema: string | Record<string, unknown> | null;
  group_name: string | null;
  city_focus: string | null;
  updated_at?: string | null;
  index_status?: "keep" | "rebuild" | "merge" | "redirect" | "noindex" | "remove" | null;
  redirect_target?: string | null;
  canonical_target?: string | null;
};

export const revalidate = 3600;

async function getPage(slug: string): Promise<SeoPage | null> {
  const supabase = getPublicSupabase();
  if (!supabase || OFF_SCOPE_SLUGS.has(slug)) return null;

  const rich = await supabase
    .from("seo_pages")
    .select("slug, h1, meta_title, meta_description, body_html, faq_schema, group_name, city_focus, updated_at, index_status, redirect_target, canonical_target")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!rich.error) return rich.data as SeoPage | null;

  const fallback = await supabase
    .from("seo_pages")
    .select("slug, h1, meta_title, meta_description, body_html, faq_schema, group_name, city_focus")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  return fallback.data as SeoPage | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return { title: "Page not found | KZN Plumbers", robots: { index: false, follow: true } };

  const nonIndexable = ["merge", "redirect", "noindex", "remove"].includes(page.index_status ?? "keep");
  const canonical = page.canonical_target || `/${slug}`;
  return {
    title: page.meta_title,
    description: page.meta_description,
    alternates: { canonical },
    robots: nonIndexable ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: page.meta_title,
      description: page.meta_description,
      type: "article",
      url: absoluteUrl(canonical),
      siteName: SITE_NAME,
      locale: "en_ZA",
    },
  };
}

export async function generateStaticParams() {
  const supabase = getPublicSupabase();
  if (!supabase) return [];
  const rich = await supabase.from("seo_pages").select("slug").eq("published", true).in("index_status", ["keep", "rebuild"]);
  const data = rich.error
    ? (await supabase.from("seo_pages").select("slug").eq("published", true)).data
    : rich.data;
  return (data ?? []).filter((page) => !OFF_SCOPE_SLUGS.has(page.slug)).map((page) => ({ slug: page.slug }));
}

export default async function SeoContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  if (["merge", "redirect"].includes(page.index_status ?? "keep") && page.redirect_target) {
    permanentRedirect(normaliseTarget(page.redirect_target));
  }
  if (page.index_status === "remove") notFound();

  const region = findRegion(page.city_focus);
  const service = findService(page.group_name, page.h1);
  const { plumbers } = await getPublicPlumbers({
    areas: region?.queryAreas,
    specialty: service?.specialty,
    limit: 6,
  });
  const updated = page.updated_at ? new Date(page.updated_at) : null;
  const body = sanitizeEditorialHtml(page.body_html);
  const canonical = page.canonical_target || `/${slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.h1,
    description: page.meta_description,
    mainEntityOfPage: absoluteUrl(canonical),
    publisher: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
    ...(updated && !Number.isNaN(updated.getTime()) ? { dateModified: updated.toISOString() } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      {page.faq_schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeStoredJsonLd(page.faq_schema),
          }}
        />
      )}

      <article>
        <header className="bg-slate-950 px-4 py-12 text-white sm:px-6 sm:py-16">
          <div className="mx-auto max-w-5xl">
            <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-slate-300">
              <Link href="/" className="hover:text-white">Home</Link><span aria-hidden="true">/</span>
              {region && <><Link href={`/plumbers/${region.slug}`} className="hover:text-white">{region.shortName}</Link><span aria-hidden="true">/</span></>}
              <span>{page.group_name || "Plumbing guide"}</span>
            </nav>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-sky-300">KZN homeowner guide</p>
            <h1 className="mt-3 max-w-4xl font-display text-4xl font-bold leading-tight sm:text-5xl">{page.h1}</h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-200">{page.meta_description}</p>
            {updated && !Number.isNaN(updated.getTime()) && (
              <p className="mt-4 flex items-center gap-2 text-xs text-slate-400"><CalendarDays className="h-4 w-4" /> Updated {updated.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}</p>
            )}
          </div>
        </header>

        {plumbers.length > 0 && (
          <section className="border-b border-slate-200 bg-slate-50 px-4 py-10 sm:px-6" aria-labelledby="relevant-providers">
            <div className="mx-auto max-w-7xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Relevant directory inventory</p>
                  <h2 id="relevant-providers" className="mt-2 font-display text-3xl font-bold text-slate-950">
                    Providers matching this guide
                  </h2>
                </div>
                <Link href="/trust" className="inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline"><ShieldCheck className="h-4 w-4" /> How verification works</Link>
              </div>
              <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {plumbers.map((plumber, index) => (
                  <PlumberCard key={plumber.id} plumber={plumber} sourcePage={`guide_${slug}`} rankPosition={index + 1} />
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="seo-content" dangerouslySetInnerHTML={{ __html: body }} />
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {(region || service) && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <MapPin className="h-5 w-5 text-brand" aria-hidden="true" />
                <h2 className="mt-3 font-display text-lg font-bold text-slate-950">Continue with live listings</h2>
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

function findRegion(cityFocus: string | null) {
  if (!cityFocus) return null;
  const value = cityFocus.toLowerCase();
  return REGIONS.find((region) =>
    region.name.toLowerCase().includes(value) ||
    region.shortName.toLowerCase().includes(value) ||
    region.queryAreas.some((area) => area.toLowerCase() === value),
  ) ?? null;
}

function findService(groupName: string | null, heading: string) {
  const value = `${groupName ?? ""} ${heading}`.toLowerCase();
  return SERVICE_GUIDES.find((service) => {
    const terms = [service.name, service.specialty, service.slug.replace(/-/g, " ")];
    return terms.some((term) => value.includes(term.toLowerCase()));
  }) ?? null;
}

function normaliseTarget(target: string): string {
  if (target.startsWith("http")) {
    try {
      return new URL(target).pathname || "/";
    } catch {
      return "/";
    }
  }
  return target.startsWith("/") ? target : `/${target}`;
}
