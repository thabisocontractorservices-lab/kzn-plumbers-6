import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import { PlumberCard } from "@/components/PlumberCard";
import { DIRECTORY_AREAS, DIRECTORY_MAX_PAGE } from "@/lib/directory";
import { getPublicPlumbers } from "@/lib/directory-data";
import { safeJsonLd } from "@/lib/json-ld";
import { getServiceGuide, SERVICE_GUIDES } from "@/lib/services";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return SERVICE_GUIDES.map((service) => ({ service: service.slug }));
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
  params: Promise<{ service: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { service: slug } = await params;
  const guide = getServiceGuide(slug);
  if (!guide) return {};
  const page = pageNumber((await searchParams).page);
  const suffix = page > 1 ? ` — Page ${page}` : "";
  const canonical = page > 1 ? `/services/${slug}?page=${page}` : `/services/${slug}`;
  return {
    title: `${guide.name} Plumbers in KZN${suffix} | KZN Plumbers`,
    description: `${guide.intro} Compare transparent verification states, listed services and direct contact options.`,
    alternates: { canonical },
    openGraph: {
      title: `${guide.name} plumbers in KwaZulu-Natal${suffix}`,
      description: guide.intro,
      url: absoluteUrl(canonical),
      type: "website",
      siteName: SITE_NAME,
      locale: "en_ZA",
    },
  };
}

export default async function ServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ service: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { service: slug } = await params;
  const guide = getServiceGuide(slug);
  if (!guide) notFound();
  const page = pageNumber((await searchParams).page);
  const limit = 12;
  const { plumbers, total } = await getPublicPlumbers({
    specialty: guide.specialty,
    limit,
    offset: (page - 1) * limit,
  });
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (page > totalPages) notFound();
  const canonical = page > 1 ? `/services/${slug}?page=${page}` : `/services/${slug}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Plumbing services", item: absoluteUrl("/#services") },
        { "@type": "ListItem", position: 3, name: guide.name, item: absoluteUrl(canonical) },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${guide.name} plumbers in KwaZulu-Natal`,
      url: absoluteUrl(canonical),
      about: { "@type": "Service", name: guide.specialty, areaServed: "KwaZulu-Natal" },
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
          <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-sm text-slate-300">
            <Link href="/" className="hover:text-white">Home</Link>
            <span aria-hidden="true">/</span>
            <span>{guide.name}</span>
          </nav>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-300">KZN service collection</p>
          <h1 className="mt-3 max-w-4xl font-display text-4xl font-bold leading-tight sm:text-5xl">
            {guide.name} plumbers in KwaZulu-Natal
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-200">{guide.intro}</p>
          <div className="mt-6 inline-flex rounded-lg border border-white/15 bg-white/8 px-4 py-3 text-sm font-semibold">
            {total.toLocaleString()} matching directory record{total === 1 ? "" : "s"}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <section aria-labelledby="providers-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Listed capability</p>
              <h2 id="providers-heading" className="mt-2 font-display text-3xl font-bold text-slate-950">Compare providers</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">Confirm the exact scope, call-out and availability directly. A listed service is not a guarantee that a provider can take every job.</p>
            </div>
            <Link href="/trust" className="inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Verification method
            </Link>
          </div>

          {plumbers.length ? (
            <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {plumbers.map((plumber, index) => (
                <PlumberCard
                  key={plumber.id}
                  plumber={plumber}
                  sourcePage={`service_${guide.slug}`}
                  rankPosition={(page - 1) * limit + index + 1}
                />
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <h2 className="font-display text-xl font-bold text-slate-950">No matching providers are published yet</h2>
              <p className="mt-2 text-sm text-slate-600">Use the full directory and describe the job when contacting a plumber.</p>
              <Link href={`/?service=${guide.slug}`} className="btn-primary mt-5">Search the directory</Link>
            </div>
          )}

          {totalPages > 1 && (
            <nav aria-label="Directory pages" className="mt-9 flex items-center justify-between border-t border-slate-200 pt-6">
              {page > 1 ? (
                <Link href={page === 2 ? `/services/${slug}` : `/services/${slug}?page=${page - 1}`} className="btn-secondary">
                  <ArrowLeft className="h-4 w-4" /> Previous
                </Link>
              ) : <span />}
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              {page < totalPages ? (
                <Link href={`/services/${slug}?page=${page + 1}`} className="btn-secondary">
                  Next <ArrowRight className="h-4 w-4" />
                </Link>
              ) : <span />}
            </nav>
          )}
        </section>

        <section className="mt-14 grid gap-6 border-t border-slate-200 pt-10 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Quote checklist</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-slate-950">Ask before anyone starts</h2>
            <ul className="mt-5 space-y-3">
              {guide.questions.map((question) => (
                <li key={question} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                  {question}
                </li>
              ))}
            </ul>
          </div>
          <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <h2 className="mt-3 font-display text-xl font-bold">Safety note</h2>
            <p className="mt-2 text-sm leading-relaxed">{guide.urgentNote}</p>
            <p className="mt-4 text-xs leading-relaxed opacity-80">This is general guidance, not a diagnosis. Use emergency services where life or electrical safety is at risk.</p>
          </aside>
        </section>

        <section className="mt-12 rounded-2xl bg-slate-100 p-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-brand" aria-hidden="true" />
            <h2 className="font-display text-xl font-bold text-slate-950">Narrow by area</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {DIRECTORY_AREAS.map((area) => (
              <Link key={area.key} href={`/?area=${area.key}&service=${guide.slug}`} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-brand hover:text-brand">
                {area.label}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
