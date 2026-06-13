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
        {/* Hero icon */}
        <div className="flex justify-center mb-4 sm:mb-6">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-8 h-8 sm:w-10 sm:h-10 text-sky-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.18L18 8v2.5l-6 3.75L6 10.5V8l6-3.82zM6 12.5l6 3.75 6-3.75V16l-6 3.82L6 16v-3.5z"/>
            </svg>
          </div>
        </div>

        <h1 className="font-display text-2xl sm:text-4xl md:text-5xl font-extrabold mb-3 leading-tight">
          Verified Plumbers <span className="font-display italic">across</span>{" "}
          <span className="text-sky-300 font-display italic">KwaZulu-Natal</span>
        </h1>
        <p className="text-sm sm:text-lg opacity-90 mb-6 sm:mb-10 max-w-xl mx-auto px-2">
          PIRB-registered tradespeople, real Google reviews, and instant
          WhatsApp booking — from Durban North to Richards Bay.
        </p>
        <form
          action="/"
          className="flex max-w-xl mx-auto bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20"
        >
          <input
            name="q"
            placeholder="Search by name, area, or specialty..."
            className="flex-1 px-4 sm:px-5 py-3 sm:py-4 text-sm sm:text-base text-gray-800 outline-none min-w-0"
          />
          <button className="px-5 sm:px-8 py-3 sm:py-4 bg-brand text-white font-bold hover:bg-brand-dark text-sm sm:text-base shrink-0 transition-colors">
            Search
          </button>
        </form>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 mt-8 sm:mt-12 max-w-2xl mx-auto">
          {[
            { num: totalCount.toLocaleString(), label: "Verified & Available" },
            { num: totalCount.toLocaleString(), label: "Service Plumbers" },
            { num: totalCount.toLocaleString(), label: "Service Plumbers" },
            { num: totalCount.toLocaleString(), label: "Verified Plumbers" },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="font-display text-2xl sm:text-3xl font-bold">{s.num}</div>
              <div className="text-[10px] sm:text-xs uppercase tracking-wider opacity-70 mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
