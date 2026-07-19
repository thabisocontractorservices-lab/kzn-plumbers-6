"use client";

import { useEffect, useMemo, useState } from "react";
import { PlumberCard } from "./PlumberCard";
import type { Plumber } from "@/types/database";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "certified", label: "✓ Certified Only" },
  { key: "available", label: "● Available Now" },
  { key: "emergency", label: "🚨 24/7 Emergency" },
] as const;

const AREAS = [
  { key: "durban", label: "Durban", match: ["Durban North", "Durban South", "Pinetown"], lat: -29.8587, lng: 31.0218 },
  { key: "pmb", label: "PMB", match: ["PMB"], lat: -29.6006, lng: 30.3794 },
  { key: "ballito", label: "Ballito / North Coast", match: ["Ballito"], lat: -29.5390, lng: 31.2140 },
  { key: "richardsbay", label: "Richards Bay", match: ["Richards Bay"], lat: -28.7830, lng: 32.0377 },
  { key: "newcastle", label: "Newcastle", match: ["Newcastle"], lat: -27.7580, lng: 29.9318 },
  { key: "estcourt", label: "Estcourt", match: ["Estcourt"], lat: -29.0047, lng: 29.8788 },
  { key: "southcoast", label: "South Coast", match: ["South Coast"], lat: -30.7554, lng: 30.4541 },
  { key: "other", label: "Other KZN", match: ["Other KZN"], lat: -29.0, lng: 30.5 },
] as const;

type SortKey = "rated" | "price" | "name";

/** Simple seeded random for daily rotation — same seed = same order for one day */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Get a daily seed so the shuffle changes once per day */
function getDailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** Shuffle array using seeded random — deterministic for the same day */
function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  const rand = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Find nearest area based on lat/lng */
function findNearestArea(lat: number, lng: number): string | null {
  let nearest = "";
  let minDist = Infinity;

  for (const area of AREAS) {
    if (area.key === "other") continue;
    const dLat = lat - area.lat;
    const dLng = lng - area.lng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < minDist) {
      minDist = dist;
      nearest = area.key;
    }
  }

  // Only auto-filter if within reasonable distance (~100km ≈ ~0.9 degrees)
  return minDist < 1.0 ? nearest : null;
}

export function DirectoryClient({
  initialPlumbers,
  initialQuery,
}: {
  initialPlumbers: Plumber[];
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("rated");
  const [locationName, setLocationName] = useState<string | null>(null);
  const [locationDismissed, setLocationDismissed] = useState(false);

  // Detect visitor location and auto-filter
  useEffect(() => {
    if (locationDismissed || areaFilter) return; // don't override manual selection

    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nearest = findNearestArea(pos.coords.latitude, pos.coords.longitude);
        if (nearest) {
          setAreaFilter(nearest);
          const areaObj = AREAS.find((a) => a.key === nearest);
          setLocationName(areaObj?.label ?? null);
        }
      },
      () => {
        // User denied or error — do nothing, no filter applied
      },
      { timeout: 5000, maximumAge: 300000 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let r = [...initialPlumbers];

    if (filter === "certified") r = r.filter((p) => p.is_certified && p.is_verified);
    if (filter === "available") r = r.filter((p) => p.availability_status === "available");
    if (filter === "emergency") r = r.filter((p) => p.is_emergency);

    if (areaFilter) {
      const a = AREAS.find((x) => x.key === areaFilter);
      if (a) r = r.filter((p) => a.match.includes(p.area as never));
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter(
        (p) =>
          p.trading_name.toLowerCase().includes(q) ||
          p.area.toLowerCase().includes(q) ||
          p.specialties.some((s) => s.toLowerCase().includes(q)),
      );
    }

    // Score each plumber to determine sort priority
    const engagementScore = (p: Plumber) => {
      let score = 0;
      if (p.profile_id) score += 3;
      if (p.photos && p.photos.length > 0) score += 2;
      if (p.certifications && p.certifications.length > 0) score += 1;
      if (p.reviews && p.reviews.length > 0) score += 1;
      return score;
    };

    // Sort by engagement score first, then by the selected sort within each tier
    if (sort === "rated") {
      r.sort((a, b) => engagementScore(b) - engagementScore(a) || (b.google_rating ?? 0) - (a.google_rating ?? 0));
    } else if (sort === "price") {
      r.sort((a, b) => {
        const e = engagementScore(b) - engagementScore(a);
        if (e !== 0) return e;
        const ar = a.hourly_rate ?? Number.POSITIVE_INFINITY;
        const br = b.hourly_rate ?? Number.POSITIVE_INFINITY;
        return ar - br;
      });
    } else if (sort === "name") {
      r.sort((a, b) => engagementScore(b) - engagementScore(a) || a.trading_name.localeCompare(b.trading_name));
    }

    // Daily rotation: shuffle within each engagement-score tier
    // so different plumbers appear in the top 3 each day
    const seed = getDailySeed();
    const grouped = new Map<number, Plumber[]>();
    for (const p of r) {
      const score = engagementScore(p);
      if (!grouped.has(score)) grouped.set(score, []);
      grouped.get(score)!.push(p);
    }
    // Rebuild array: highest score first, shuffled within each tier
    const result: Plumber[] = [];
    const scores = [...grouped.keys()].sort((a, b) => b - a);
    for (const score of scores) {
      result.push(...shuffleWithSeed(grouped.get(score)!, seed + score));
    }

    return result;
  }, [initialPlumbers, filter, areaFilter, query, sort]);

  const INITIAL_COUNT = 3;
  const LOAD_MORE_COUNT = 6;
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(INITIAL_COUNT);
  }, [filter, areaFilter, query, sort]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Location banner */}
      {locationName && !locationDismissed && (
        <div className="mb-4 rounded-xl border border-brand/20 bg-brand-light px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-brand font-medium">
            📍 Showing plumbers near <strong>{locationName}</strong>
          </span>
          <button
            onClick={() => {
              setLocationDismissed(true);
              setAreaFilter(null);
              setLocationName(null);
            }}
            className="text-brand/60 hover:text-brand text-lg leading-none ml-3"
          >
            ✕
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5 mb-5 sm:mb-6 shadow-sm flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1 w-full sm:w-auto">
            Filter
          </span>
          {FILTERS.map((f) => (
            <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </Chip>
          ))}
          <span className="text-gray-300 mx-1">|</span>
          {AREAS.map((a) => (
            <Chip
              key={a.key}
              active={areaFilter === a.key}
              onClick={() => {
                setAreaFilter(areaFilter === a.key ? null : a.key);
                setLocationDismissed(true); // manual selection overrides location
                setLocationName(null);
              }}
            >
              {a.label}
            </Chip>
          ))}
        </div>
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex gap-2 items-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 bg-white"
            >
              <option value="rated">Top Rated</option>
              <option value="price">Lowest Price</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
          <input
            placeholder="Refine search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input max-w-xs"
          />
        </div>
      </div>

      <div className="flex justify-between items-center mb-5 text-sm text-gray-600">
        <div>
          Showing <strong className="text-gray-900">{filtered.length}</strong>{" "}
          verified plumbers
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <div className="font-display text-xl font-bold mb-1">No plumbers match your filters</div>
          <div className="text-sm text-gray-500">Try clearing some filters or broadening your search.</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filtered.slice(0, visibleCount).map((p) => (
              <PlumberCard key={p.id} plumber={p} />
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div className="text-center mt-6 sm:mt-8">
              <button
                onClick={() => setVisibleCount((prev) => prev + LOAD_MORE_COUNT)}
                className="btn-secondary px-8 py-3 text-sm font-semibold"
              >
                Show more plumbers ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
          {visibleCount >= filtered.length && filtered.length > INITIAL_COUNT && (
            <div className="text-center mt-6 sm:mt-8">
              <button
                onClick={() => setVisibleCount(INITIAL_COUNT)}
                className="text-sm text-gray-500 hover:text-brand transition-colors"
              >
                Show less ↑
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full border text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap ${
        active
          ? "bg-brand text-white border-brand"
          : "bg-white text-gray-700 border-gray-200 hover:border-brand hover:text-brand"
      }`}
    >
      {children}
    </button>
  );
}
