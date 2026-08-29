import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, MapPin, ShieldQuestion, Wrench } from "lucide-react";
import { DirectorySearch } from "@/components/DirectorySearch";
import { DIRECTORY_SERVICES, getAreaConfig, getServiceConfig } from "@/lib/directory";
import { REGIONS } from "@/lib/regions";
import { safeJsonLd } from "@/lib/json-ld";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/site";
import { getPublicSupabase } from "@/lib/supabase/public";
import type { Plumber } from "@/types/database";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Find Plumbers in KwaZulu-Natal | KZN Plumbers Directory",
  description:
    "Compare plumbers across KwaZulu-Natal by service area, job type, credential status and availability. Contact businesses directly by phone or WhatsApp.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Find Plumbers in KwaZulu-Natal",
    description:
      "A KZN-specific plumber directory with transparent verification labels, local service filters and direct contact.",
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_ZA",
  },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type DirectoryPlumber = Plumber & {
  verification_state?: "credential_verified" | "business_claimed" | "directory_record" | null;
  credential_verified_at?: string | null;
  verification_expires_at?: string | null;
  last_checked_at?: string | null;
  response_time_minutes?: number | null;
  accepts_new_work?: boolean | null;
};

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const q = firstParam(raw.q).slice(0, 80);
  const area = firstParam(raw.area);
  const service = firstParam(raw.service);
  const filter = firstParam(raw.filter) || "all";
  const areaConfig = getAreaConfig(area);
  const serviceConfig = getServiceConfig(service);
  const supabase = getPublicSupabase();

  let plumbers: DirectoryPlumber[] = [];
  let total = 0;
  let totalRecords = 0;
  let credentialChecked = 0;
  let claimedBusinesses = 0;

  if (supabase) {
    const richSelect = `
      id, profile_id, trading_name, slug, area, hourly_rate, specialties,
      is_emergency, is_certified, is_verified, availability_status,
      google_rating, google_review_count, whatsapp_number, pirb_number,
      verification_state, verification_rank, credential_verified_at, verification_expires_at,
      last_checked_at, response_time_minutes, accepts_new_work,
      photos(photo_url, is_profile_photo), certifications(id, cert_name)
    `;

    let query = supabase.from("plumbers").select(richSelect, { count: "exact" }).eq("is_verified", true);
    if (areaConfig) query = query.in("area", [...areaConfig.dbAreas]);
    if (serviceConfig) query = query.contains("specialties", [serviceConfig.dbValue]);
    if (filter === "credential") query = query.eq("verification_state", "credential_verified");
    if (filter === "claimed") query = query.not("profile_id", "is", null);
    if (filter === "available") query = query.eq("availability_status", "available").eq("accepts_new_work", true);
    if (filter === "emergency") query = query.eq("is_emergency", true);
    if (q.trim()) {
      const safe = q.replace(/[^a-zA-Z0-9\s&-]/g, " ").replace(/\s+/g, " ").trim();
      if (safe) query = query.or(`trading_name.ilike.%${safe}%,area.ilike.%${safe}%,about.ilike.%${safe}%`);
    }

    const [result, recordsResult, credentialResult, claimedResult] = await Promise.all([
      query
        .order("verification_rank", { ascending: true })
        .order("profile_id", { ascending: false, nullsFirst: false })
        .order("google_rating", { ascending: false, nullsFirst: false })
        .range(0, 11),
      supabase.from("plumbers").select("id", { count: "exact", head: true }).eq("is_verified", true),
      supabase.from("plumbers").select("id", { count: "exact", head: true }).eq("verification_state", "credential_verified").eq("is_verified", true),
      supabase.from("plumbers").select("id", { count: "exact", head: true }).not("profile_id", "is", null).eq("is_verified", true),
    ]);

    if (!result.error) {
      plumbers = (result.data ?? []) as unknown as DirectoryPlumber[];
      total = result.count ?? 0;
      totalRecords = recordsResult.count ?? total;
      credentialChecked = credentialResult.count ?? 0;
      claimedBusinesses = claimedResult.count ?? 0;
    } else {
      let fallback = supabase
        .from("plumbers")
        .select(
          "id, profile_id, trading_name, slug, area, hourly_rate, specialties, is_emergency, is_certified, is_verified, availability_status, google_rating, google_review_count, whatsapp_number, pirb_number, photos(photo_url, is_profile_photo), certifications(id, cert_name)",
          { count: "exact" },
        )
        .eq("is_verified", true);
      if (areaConfig) fallback = fallback.in("area", [...areaConfig.dbAreas]);
      if (serviceConfig) fallback = fallback.contains("specialties", [serviceConfig.dbValue]);
      if (filter === "credential") fallback = fallback.eq("is_certified", true).not("pirb_number", "is", null);
      if (filter === "claimed") fallback = fallback.not("profile_id", "is", null);
      if (filter === "available") fallback = fallback.eq("availability_status", "available");
      if (filter === "emergency") fallback = fallback.eq("is_emergency", true);
      if (q.trim()) {
        const safe = q.replace(/[^a-zA-Z0-9\s&-]/g, " ").replace(/\s+/g, " ").trim();
        if (safe) fallback = fallback.or(`trading_name.ilike.%${safe}%,area.ilike.%${safe}%`);
      }
      const retry = await fallback
        .order("profile_id", { ascending: false, nullsFirst: false })
        .order("google_rating", { ascending: false, nullsFirst: false })
        .range(0, 11);
      plumbers = (retry.data ?? []) as unknown as DirectoryPlumber[];
      total = retry.count ?? 0;
      totalRecords = recordsResult.count ?? total;
      claimedBusinesses = claimedResult.count ?? 0;
      credentialChecked = 0;
    }
  }

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: absoluteUrl("/logo.svg"),
      areaServed: { "@type": "AdministrativeArea", name: "KwaZulu-Natal, South Africa" },
      description: "A KwaZulu-Natal directory that helps homeowners compare and contact local plumbing businesses.",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];

  return (
    <>
      {structuredData.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(item) }}
        />
      ))}

      <section className="relative overflow-hidden bg-slate-950 px-4 pb-20 pt-14 text-white sm:px-6 sm:pb-24 sm:pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(56,189,248,0.22),transparent_30%),linear-gradient(135deg,#082f49_0%,#0f172a_54%,#020617_100%)]" />
        <div className="relative mx-auto max-w-7xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-sky-300">
            Built for KwaZulu-Natal homeowners
          </p>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] lg:items-end">
            <div>
              <h1 className="max-w-4xl font-display text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
                Find a plumber who actually serves your part of KZN.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-200 sm:text-lg">
                Search by job, area and urgency. See whether a credential was checked, a business claimed its profile, or a listing is an unclaimed directory record—before you make contact.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/15 bg-white/8 p-4 backdrop-blur">
              <HeroStat value={totalRecords ? totalRecords.toLocaleString() : "—"} label="Directory records" />
              <HeroStat value={credentialChecked ? credentialChecked.toLocaleString() : "New"} label="Credential state" />
              <HeroStat value={claimedBusinesses ? claimedBusinesses.toLocaleString() : "—"} label="Claimed profiles" />
            </div>
          </div>
        </div>
      </section>

      <DirectorySearch
        initialPlumbers={plumbers}
        initialTotal={total}
        initialQuery={q}
        initialArea={area}
        initialService={service}
        initialFilter={filter}
      />

      <section className="border-y border-slate-200 bg-white px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Read the label, not the marketing</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-slate-950">Three different trust states</h2>
            <p className="mt-3 text-slate-600">A claimed listing and a checked professional credential are not the same thing. The redesigned directory keeps them separate.</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <TrustCard icon={BadgeCheck} title="Credential verified" text="Registration evidence was checked and the profile carries a review date." tone="emerald" />
            <TrustCard icon={Building2} title="Business claimed" text="The business controls the profile, but its professional credential may still need checking." tone="blue" />
            <TrustCard icon={ShieldQuestion} title="Directory record" text="An unclaimed public record. Contact details and availability should be confirmed directly." tone="slate" />
          </div>
          <Link href="/trust" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline">
            Read the verification method <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section id="regions" className="scroll-mt-24 px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Regional collections</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-slate-950">Browse plumbers by KZN area</h2>
            </div>
            <p className="max-w-lg text-sm text-slate-600">These pages show local inventory first, then area-specific guidance—not interchangeable town-name articles.</p>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {REGIONS.map((region) => (
              <Link key={region.slug} href={`/plumbers/${region.slug}`} className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-brand hover:shadow-md">
                <MapPin className="h-5 w-5 text-brand" aria-hidden="true" />
                <h3 className="mt-3 font-display text-xl font-bold text-slate-950 group-hover:text-brand">{region.name}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">{region.intro}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand">View local plumbers <ArrowRight className="h-4 w-4" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="services" className="scroll-mt-24 bg-slate-900 px-4 py-14 text-white sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-300">Start with the problem</p>
              <h2 className="mt-2 font-display text-3xl font-bold">Find the right capability, not just the nearest number.</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">Service pages explain what to ask and show businesses that list the relevant capability.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {DIRECTORY_SERVICES.slice(0, 6).map((item) => (
                <Link key={item.key} href={`/services/${item.key}`} className="group flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-4 hover:border-sky-400 hover:bg-white/10">
                  <Wrench className="h-5 w-5 text-sky-300" aria-hidden="true" />
                  <span className="font-bold">{item.label}</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-400 group-hover:text-white" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold text-white sm:text-3xl">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">{label}</div>
    </div>
  );
}

function TrustCard({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: typeof BadgeCheck;
  title: string;
  text: string;
  tone: "emerald" | "blue" | "slate";
}) {
  const style = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    slate: "border-slate-200 bg-slate-50 text-slate-900",
  }[tone];
  return (
    <article className={`rounded-xl border p-5 ${style}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
      <h3 className="mt-3 font-display text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed opacity-85">{text}</p>
    </article>
  );
}
