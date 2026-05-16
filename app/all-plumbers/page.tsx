import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/src/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// /all-plumbers — HTML sitemap page listing every verified plumber, grouped
// by area, alphabetically within each area.
//
// PURPOSE (SEO): Google has ~95 plumber profile URLs sitting in the
// "Discovered - currently not indexed" queue. This page gives Google's
// crawler a single landing point where every profile is one click away,
// dramatically improving crawl efficiency and helping the unindexed bucket
// shrink faster.
//
// This is *also* user-friendly — a homeowner who wants to browse all
// plumbers in their area gets a fast, scannable view.
// ─────────────────────────────────────────────────────────────────────────────

export const revalidate = 86400; // refresh daily

export const metadata: Metadata = {
  title:
    "All Verified Plumbers in KwaZulu-Natal | KZN Plumbers Directory",
  description:
    "Browse every PIRB-verified plumber on KZN Plumbers — 1,200+ businesses across Durban, Pietermaritzburg, Ballito, South Coast and the rest of KwaZulu-Natal. Sorted by area for easy browsing.",
  alternates: {
    canonical: "https://www.kznplumbers.co.za/all-plumbers",
  },
  openGraph: {
    title: "All Verified Plumbers in KwaZulu-Natal",
    description:
      "Complete directory of every PIRB-verified plumber across KZN — grouped by area for easy browsing.",
    url: "https://www.kznplumbers.co.za/all-plumbers",
    siteName: "KZN Plumbers",
    type: "website",
    locale: "en_ZA",
  },
};

type PlumberLite = {
  id: string;
  slug: string | null;
  trading_name: string;
  area: string;
  is_certified: boolean;
  is_emergency: boolean;
};

export default async function AllPlumbersPage() {
  const { data: plumbers, error } = await supabase
    .from("plumbers")
    .select("id, slug, trading_name, area, is_certified, is_emergency")
    .eq("is_verified", true)
    .order("area", { ascending: true })
    .order("trading_name", { ascending: true });

  if (error || !plumbers || plumbers.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-display text-3xl mb-4">Directory unavailable</h1>
        <p>
          We couldn&apos;t load the plumber directory right now. Please try
          again shortly.
        </p>
      </div>
    );
  }

  // Group by area
  const byArea: Record<string, PlumberLite[]> = {};
  for (const p of plumbers as PlumberLite[]) {
    const area = p.area?.trim() || "Other KZN";
    if (!byArea[area]) byArea[area] = [];
    byArea[area].push(p);
  }
  const sortedAreas = Object.keys(byArea).sort();

  const totalPlumbers = plumbers.length;
  const totalAreas = sortedAreas.length;

  return (
    <main className="bg-white min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-light to-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <nav className="text-sm text-gray-500 mb-3">
            <Link href="/" className="hover:text-brand">
              Home
            </Link>
            <span className="mx-2">›</span>
            <span>All Plumbers</span>
          </nav>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-gray-900 mb-3 leading-tight">
            All Verified Plumbers in KwaZulu-Natal
          </h1>

          <p className="text-gray-600 text-base sm:text-lg max-w-3xl leading-relaxed">
            Every PIRB-verified plumber on our directory —{" "}
            <strong>{totalPlumbers.toLocaleString()}</strong> businesses
            across <strong>{totalAreas}</strong> areas of KZN. Tap an area to
            jump to it, or click any plumber to view their profile, contact
            details, and reviews.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Table of contents */}
        <div className="bg-brand-light/40 border border-brand-light rounded-xl p-4 sm:p-5 mb-10">
          <h2 className="font-display text-lg text-gray-900 mb-3">
            Jump to area
          </h2>
          <div className="flex flex-wrap gap-2">
            {sortedAreas.map((area) => (
              <a
                key={area}
                href={`#area-${slugifyForAnchor(area)}`}
                className="text-sm px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:border-brand hover:text-brand transition-colors"
              >
                {area}
                <span className="text-gray-400 ml-1">
                  ({byArea[area].length})
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Areas with plumber lists */}
        <div className="space-y-12">
          {sortedAreas.map((area) => (
            <section
              key={area}
              id={`area-${slugifyForAnchor(area)}`}
              className="scroll-mt-24"
            >
              <h2 className="font-display text-2xl sm:text-3xl text-gray-900 mb-1">
                Plumbers in {area}
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                {byArea[area].length} verified plumber
                {byArea[area].length === 1 ? "" : "s"}
              </p>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {byArea[area].map((p) => (
                  <Link
                    key={p.id}
                    href={`/plumber/${p.slug ?? p.id}`}
                    prefetch={false}
                    className="block p-3 bg-white border border-gray-200 rounded-lg hover:border-brand hover:shadow-card transition-all"
                  >
                    <div className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">
                      {p.trading_name}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {p.is_certified && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-light text-teal font-semibold uppercase tracking-wide">
                          ✓ PIRB
                        </span>
                      )}
                      {p.is_emergency && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emergency-light text-emergency font-semibold uppercase tracking-wide">
                          🚨 24/7
                        </span>
                      )}
                      {!p.is_certified && !p.is_emergency && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold uppercase tracking-wide">
                          Verified
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Bottom CTA */}
        <section className="mt-16 pt-10 border-t border-gray-200 text-center">
          <h2 className="font-display text-2xl text-gray-900 mb-2">
            Can&apos;t find what you need?
          </h2>
          <p className="text-gray-600 mb-5 max-w-xl mx-auto">
            Search by suburb or problem on the homepage — we&apos;ll match you
            with the right plumber for the job.
          </p>
          <Link href="/" className="btn-primary inline-flex">
            Back to homepage →
          </Link>
        </section>
      </div>
    </main>
  );
}

function slugifyForAnchor(area: string): string {
  return area
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
