import Link from "next/link";
import { supabase } from "@/src/supabaseClient";
import { DirectoryClient } from "@/components/DirectoryClient";
import type { Plumber } from "@/types/database";

export const revalidate = 60; // ISR: refresh every minute

type PopularGuide = {
  slug: string;
  h1: string;
  meta_description: string;
  city_focus: string | null;
  group_name: string | null;
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; area?: string; filter?: string }>;
}) {
  const params = await searchParams;

  // Pull verified plumbers + their combined ratings
  const { data: plumbers, error } = await supabase
    .from("plumbers")
    .select(
      `
      *,
      profile:profiles(full_name, email),
      photos(photo_url, is_profile_photo),
      certifications(id, cert_name)
    `,
    )
    .eq("is_verified", true)
    .order("google_rating", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Failed to load plumbers:", error);
  }

  // Pull a balanced selection of popular SEO pages for the "Popular guides" section.
  // Prefer high-commercial-intent slugs targeting the major cities.
  const { data: popularGuidesData } = await supabase
    .from("seo_pages")
    .select("slug, h1, meta_description, city_focus, group_name")
    .eq("published", true)
    .in("city_focus", ["Durban", "Pietermaritzburg", "Umhlanga", "Ballito", "Pinetown", "Richards Bay"])
    .limit(12);
  const popularGuides: PopularGuide[] = (popularGuidesData ?? []) as PopularGuide[];

  // Compute REAL hero stats from the actual database — no hardcoded numbers
  const all = plumbers ?? [];
  const totalCount = all.length;
  const regionsCount = new Set(all.map((p) => p.area)).size;
  const ratedPlumbers = all.filter(
    (p) => typeof p.google_rating === "number" && p.google_rating > 0,
  );
  const avgRating =
    ratedPlumbers.length > 0
      ? ratedPlumbers.reduce((sum, p) => sum + (p.google_rating ?? 0), 0) /
        ratedPlumbers.length
      : null;
  const emergencyCount = all.filter((p) => p.is_emergency).length;

  return (
    <>
      <Hero
        totalCount={totalCount}
        regionsCount={regionsCount}
        avgRating={avgRating}
        emergencyCount={emergencyCount}
      />
      <DirectoryClient
        initialPlumbers={(plumbers ?? []) as unknown as Plumber[]}
        initialQuery={params.q ?? ""}
      />
      {popularGuides.length > 0 && <PopularGuides guides={popularGuides} />}
    </>
  );
}

function PopularGuides({ guides }: { guides: PopularGuide[] }) {
  return (
    <section className="bg-white border-t border-gray-200 py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-extrabold text-gray-900">
              Popular plumbing guides
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Real answers to KZN's most-searched plumbing questions — from emergency repairs to compliance certificates.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guides.map((g) => (
            <Link
              key={g.slug}
              href={`/${g.slug}`}
              className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-brand hover:shadow-md transition-all group"
            >
              {g.city_focus && (
                <div className="text-[11px] font-semibold uppercase tracking-wider text-brand mb-2">
                  📍 {g.city_focus}
                </div>
              )}
              <h3 className="font-display text-lg font-bold text-gray-900 mb-2 group-hover:text-brand transition-colors leading-snug">
                {g.h1}
              </h3>
              <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                {g.meta_description}
              </p>
              <div className="text-sm text-brand mt-3 font-semibold group-hover:underline">
                Read guide →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Hero({
  totalCount,
  regionsCount,
  avgRating,
  emergencyCount,
}: {
  totalCount: number;
  regionsCount: number;
  avgRating: number | null;
  emergencyCount: number;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand to-brand-dark text-white py-12 sm:py-20 px-4 sm:px-6 text-center">
      <div className="relative z-10 max-w-3xl mx-auto">
        <h1 className="font-display text-2xl sm:text-4xl md:text-5xl font-extrabold mb-3 leading-tight">
          Verified plumbers across <span className="text-sky-300 italic">KwaZulu-Natal</span>
        </h1>
        <p className="text-sm sm:text-lg opacity-90 mb-6 sm:mb-10 max-w-xl mx-auto px-2">
          PIRB-registered tradespeople, real Google reviews, and instant WhatsApp booking — from Durban North to Richards Bay.
        </p>
        <form
          action="/"
          className="flex max-w-xl mx-auto bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl"
        >
          <input
            name="q"
            placeholder="Search by name, area, or specialty"
            className="flex-1 px-4 sm:px-5 py-3 sm:py-4 text-sm sm:text-base text-gray-800 outline-none min-w-0"
          />
          <button className="px-4 sm:px-7 py-3 sm:py-4 bg-brand text-white font-semibold hover:bg-brand-dark text-sm sm:text-base shrink-0">
            Search
          </button>
        </form>
        <div className="grid grid-cols-2 sm:flex sm:justify-center gap-4 sm:gap-10 mt-8 sm:mt-10">
          {[
            { num: totalCount.toLocaleString(), label: "Verified Plumbers" },
            { num: regionsCount.toString(), label: "KZN Regions" },
            { num: avgRating ? `${avgRating.toFixed(1)}★` : "—", label: "Avg. Rating" },
            { num: emergencyCount.toLocaleString(), label: "24/7 Emergency" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-display text-xl sm:text-2xl font-bold">{s.num}</div>
              <div className="text-[10px] sm:text-xs uppercase tracking-wider opacity-80">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
