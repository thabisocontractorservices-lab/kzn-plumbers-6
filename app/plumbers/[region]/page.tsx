import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import { PlumberCard } from "@/components/PlumberCard";
import { getPublicPlumbers } from "@/lib/directory-data";
import { DIRECTORY_MAX_PAGE } from "@/lib/directory";
import { safeJsonLd } from "@/lib/json-ld";
import { getRegion, REGIONS } from "@/lib/regions";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return REGIONS.map((region) => ({ region: region.slug }));
}

function pageNumber(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? "1");
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, DIRECTORY_MAX_PAGE) : 1;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ region: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { region: slug } = await params;
  const region = getRegion(slug);
  if (!region) return {};
  const page = pageNumber((await searchParams).page);
  const suffix = page > 1 ? ` — Page ${page}` : "";
  const canonical = page > 1 ? `/plumbers/${slug}?page=${page}` : `/plumbers/${slug}`;

  return {
    title: `Plumbers in ${region.shortName}${suffix} | KZN Plumbers`,
    description: `${region.intro} Compare verification status, listed services, ratings and direct contact details.`,
    alternates: { canonical },
    openGraph: {
      title: `Plumbers in ${region.shortName}${suffix}`,
      description: region.intro,
      type: "website",
      url: absoluteUrl(canonical),
      siteName: SITE_NAME,
      locale: "en_ZA",
    },
  };
}

export default async function RegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { region: slug } = await params;
  const region = getRegion(slug);
  if (!region) notFound();

  const page = pageNumber((await searchParams).page);
  const limit = 12;
  const { plumbers, total } = await getPublicPlumbers({
    areas: region.queryAreas,
    limit,
    offset: (page - 1) * limit,
  });
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (page > totalPages) notFound();

  const canonical = page > 1 ? `/plumbers/${slug}?page=${page}` : `/plumbers/${slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "KZN plumber regions", item: absoluteUrl("/#regions") },
        { "@type": "ListItem", position: 3, name: region.name, item: absoluteUrl(canonical) },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `Plumbers in ${region.name}`,
      url: absoluteUrl(canonical),
      about: { "@type": "Service", name: "Plumbing services" },
      spatialCoverage: { "@type": "Place", name: `${region.name}, KwaZulu-Natal` },
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
    },
  ];

  return (
    <>
      {jsonLd.map((item, index) => (
        <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(item) }} />
      ))}

      <section className="bg-slate-950 px-4 py-12 text-white sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-300">
            <Link href="/" className="hover:text-white">Home</Link>
            <span aria-hidden="true">/</span>
            <span>{region.name}</span>
          </nav>
          <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-300">KwaZulu-Natal regional directory</p>
              <h1 className="mt-3 max-w-4xl font-display text-4xl font-bold leading-tight sm:text-5xl">
                Plumbers in {region.name}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-200">{region.intro}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/8 px-5 py-4">
              <div className="font-display text-3xl font-bold">{total.toLocaleString()}</div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-300">matching directory records</div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <section aria-labelledby="providers-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Local inventory first</p>
              <h2 id="providers-heading" className="mt-2 font-display text-3xl font-bold text-slate-950">
                Records labelled {region.queryAreas.join(", ")}
              </h2>
            </div>
            <Link href={`/trust`} className="inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> How verification works
            </Link>
          </div>

          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">{region.coverageNote}</p>

          {plumbers.length ? (
            <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {plumbers.map((plumber, index) => (
                <PlumberCard
                  key={plumber.id}
                  plumber={plumber}
                  sourcePage={`region_${region.slug}`}
                  rankPosition={(page - 1) * limit + index + 1}
                />
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <h2 className="font-display text-xl font-bold text-slate-950">No matching records are published yet</h2>
              <p className="mt-2 text-sm text-slate-600">This is not evidence that no plumbers serve the area. The directory has no published records with this exact area label. Use the full KZN directory and confirm coverage directly.</p>
              <Link href="/" className="btn-primary mt-5">Browse all KZN plumbers</Link>
            </div>
          )}

          {totalPages > 1 && (
            <nav aria-label="Directory pages" className="mt-9 flex items-center justify-between border-t border-slate-200 pt-6">
              {page > 1 ? (
                <Link href={page === 2 ? `/plumbers/${slug}` : `/plumbers/${slug}?page=${page - 1}`} className="btn-secondary">
                  <ArrowLeft className="h-4 w-4" /> Previous
                </Link>
              ) : <span />}
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              {page < totalPages ? (
                <Link href={`/plumbers/${slug}?page=${page + 1}`} className="btn-secondary">
                  Next <ArrowRight className="h-4 w-4" />
                </Link>
              ) : <span />}
            </nav>
          )}
        </section>

        <section className="mt-14 grid gap-6 border-t border-slate-200 pt-10 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Before you book</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-slate-950">Useful questions for {region.shortName}</h2>
            <ul className="mt-5 space-y-3">
              {region.localNotes.map((note) => (
                <li key={note} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                  {note}
                </li>
              ))}
            </ul>
          </div>
          <aside className="rounded-2xl bg-slate-100 p-6">
            <MapPin className="h-5 w-5 text-brand" aria-hidden="true" />
            <h2 className="mt-3 font-display text-xl font-bold text-slate-950">Nearby places to ask about</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {region.nearby.map((area) => (
                <span key={area} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">{area}</span>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-600">A nearby-area label does not guarantee coverage. Confirm the exact address and call-out before booking.</p>
          </aside>
        </section>
      </main>
    </>
  );
}
