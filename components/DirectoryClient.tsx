"use client";

import { useMemo, useState } from "react";
import { PlumberCard } from "./PlumberCard";
import type { Plumber } from "@/types/database";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "certified", label: "✓ Certified Only" },
  { key: "available", label: "● Available Now" },
  { key: "emergency", label: "🚨 24/7 Emergency" },
] as const;

const AREAS = [
  { key: "durban", label: "Durban", match: ["Durban North", "Durban South", "Pinetown"] },
  { key: "pmb", label: "PMB", match: ["PMB"] },
  { key: "ballito", label: "Ballito / North Coast", match: ["Ballito"] },
  { key: "richardsbay", label: "Richards Bay", match: ["Richards Bay"] },
  { key: "newcastle", label: "Newcastle", match: ["Newcastle"] },
  { key: "southcoast", label: "South Coast", match: ["South Coast"] },
  { key: "other", label: "Other KZN", match: ["Other KZN"] },
] as const;

type SortKey = "rated" | "price" | "name";

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

    // Always prioritise plumbers who claimed/created their account (profile_id set)
    // within each sort order. This rewards engaged plumbers.
    const claimed = (p: Plumber) => (p.profile_id ? 1 : 0);

    if (sort === "rated") {
      r.sort((a, b) => claimed(b) - claimed(a) || (b.google_rating ?? 0) - (a.google_rating ?? 0));
    } else if (sort === "price") {
      r.sort((a, b) => {
        const c = claimed(b) - claimed(a);
        if (c !== 0) return c;
        const ar = a.hourly_rate ?? Number.POSITIVE_INFINITY;
        const br = b.hourly_rate ?? Number.POSITIVE_INFINITY;
        return ar - br;
      });
    } else if (sort === "name") {
      r.sort((a, b) => claimed(b) - claimed(a) || a.trading_name.localeCompare(b.trading_name));
    }

    return r;
  }, [initialPlumbers, filter, areaFilter, query, sort]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
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
              onClick={() => setAreaFilter(areaFilter === a.key ? null : a.key)}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <PlumberCard key={p.id} plumber={p} />
          ))}
        </div>
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
