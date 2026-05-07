import { supabase } from "@/src/supabaseClient";
import { DirectoryClient } from "@/components/DirectoryClient";
import type { Plumber } from "@/types/database";

export const revalidate = 60; // ISR: refresh every minute

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
      profile:profiles(full_name, email)
    `,
    )
    .eq("is_verified", true)
    .order("google_rating", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Failed to load plumbers:", error);
  }

  return (
    <>
      <Hero />
      <DirectoryClient
        initialPlumbers={(plumbers ?? []) as unknown as Plumber[]}
        initialQuery={params.q ?? ""}
      />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand to-brand-dark text-white py-20 px-6 text-center">
      <div className="relative z-10 max-w-3xl mx-auto">
        <h1 className="font-display text-4xl md:text-5xl font-extrabold mb-3">
          Verified plumbers across <span className="text-sky-300 italic">KwaZulu-Natal</span>
        </h1>
        <p className="text-lg opacity-90 mb-10 max-w-xl mx-auto">
          PIRB-registered tradespeople, real Google reviews, and instant WhatsApp booking — from Durban North to Richards Bay.
        </p>
        <form
          action="/"
          className="flex max-w-xl mx-auto bg-white rounded-2xl overflow-hidden shadow-2xl"
        >
          <input
            name="q"
            placeholder="Search by name, area, or specialty (e.g. burst pipes, geyser repair)"
            className="flex-1 px-5 py-4 text-gray-800 outline-none"
          />
          <button className="px-7 py-4 bg-brand text-white font-semibold hover:bg-brand-dark">
            Search
          </button>
        </form>
        <div className="flex justify-center gap-10 mt-10 flex-wrap">
          {[
            { num: "112", label: "Verified Plumbers" },
            { num: "8", label: "KZN Regions" },
            { num: "4.7★", label: "Avg. Rating" },
            { num: "24/7", label: "Emergency Cover" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-display text-2xl font-bold">{s.num}</div>
              <div className="text-xs uppercase tracking-wider opacity-80">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
