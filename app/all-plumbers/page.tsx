import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { PlumberCard } from "@/components/PlumberCard";
import { getAreaConfig, normaliseAreaKey, DIRECTORY_MAX_PAGE } from "@/lib/directory";
import { getPublicPlumbers } from "@/lib/directory-data";
import { safeJsonLd } from "@/lib/json-ld";
import { REGIONS } from "@/lib/regions";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const revalidate = 300;

type Search = Promise<Record<string, string | string[] | undefined>>;

function value(input: string | string[] | undefined): string {
  return Array.isArray(input) ? input[0] ?? "" : input ?? "";
}

function pageNumber(input: string | string[] | undefined): number {
  const parsed = Number(value(input) || "1");
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, DIRECTORY_MAX_PAGE) : 1;
}

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const search = await searchParams;
  const page = pageNumber(search.page);
  const area = normaliseAreaKey(value(search.area));
  const canonical = pageHref(page, area);
  return {
    title: `All KZN Plumber Directory Records${page > 1 ? ` — Page ${page}` : ""} | KZN Plumbers`,
    description: "Browse published plumbing business records across KwaZulu-Natal, with transparent verification labels and direct contact options.",
    alternates: { canonical },
    robots: area ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { title: "All KZN plumber directory records", description: "Browse KZN plumbing businesses by area and verification state.", url: absoluteUrl(canonical), type: "website", siteName: SITE_NAME },
  };
}

export default async function AllPlumbersPage({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const page = pageNumber(search.page);
  const areaKey = normaliseAreaKey(value(search.area));
  const area = getAreaConfig(areaKey);
  const limit = 24;
  const { plumbers, total } = await getPublicPlumbers({ areas: area?.dbAreas, limit, offset: (page - 1) * limit });
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (page > totalPages) notFound();

  const itemList = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: area ? `Plumber directory records in ${area.label}` : "KwaZulu-Natal plumber directory records",
    url: absoluteUrl(pageHref(page, areaKey)),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: plumbers.length,
      itemListElement: plumbers.map((plumber, index) => ({
        "@type": "ListItem",
        position: (page - 1) * limit + index + 1,
        name: plumber.trading_name,
        url: absoluteUrl(`/plumber/${plumber.slug ?? plumber.id}`),
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemList) }} />
      <section className="bg-slate-950 px-4 py-12 text-white sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-300">Published records</p>
          <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">
            {area ? `Plumber records in ${area.label}` : "All KwaZulu-Natal plumber records"}
          </h1>
          <p className="mt-4 max-w-3xl text-slate-200">Browse in manageable pages instead of downloading the entire database. Each label explains whether a credential was checked, a business claimed the listing, or the profile remains an unclaimed public record.</p>
          <div className="mt-5 inline-flex rounded-lg border border-white/15 bg-white/8 px-4 py-3 text-sm font-bold">{total.toLocaleString()} matching records</div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-brand" aria-hidden="true" /><h2 className="font-display text-xl font-bold text-slate-950">Browse curated regional pages</h2></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/all-plumbers" className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-700 hover:border-brand hover:text-brand">All KZN</Link>
            {REGIONS.map((region) => (
              <Link key={region.slug} href={`/plumbers/${region.slug}`} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-700 hover:border-brand hover:text-brand">{region.shortName}</Link>
            ))}
          </div>
        </section>

        {plumbers.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {plumbers.map((plumber, index) => (
              <PlumberCard key={plumber.id} plumber={plumber} sourcePage="all_plumbers" rankPosition={(page - 1) * limit + index + 1} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">No records match this page.</div>
        )}

        {totalPages > 1 && (
          <nav aria-label="Directory pages" className="mt-10 flex items-center justify-between border-t border-slate-200 pt-6">
            {page > 1 ? (
              <Link href={pageHref(page - 1, areaKey)} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Previous</Link>
            ) : <span />}
            <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
            {page < totalPages ? (
              <Link href={pageHref(page + 1, areaKey)} className="btn-secondary">Next <ArrowRight className="h-4 w-4" /></Link>
            ) : <span />}
          </nav>
        )}
      </main>
    </>
  );
}

function pageHref(page: number, area: string): string {
  const params = new URLSearchParams();
  if (area) params.set("area", area);
  if (page > 1) params.set("page", String(page));
  return params.size ? `/all-plumbers?${params.toString()}` : "/all-plumbers";
}
