"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock3, Loader2, MapPin, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { DIRECTORY_AREAS, DIRECTORY_SERVICES, normaliseAreaKey, normaliseServiceKey } from "@/lib/directory";
import { trackEvent } from "@/lib/analytics";
import { PlumberCard } from "@/components/PlumberCard";
import type { Plumber } from "@/types/database";

type DirectoryPlumber = Plumber & {
  verification_state?: "credential_verified" | "business_claimed" | "directory_record" | null;
  credential_verified_at?: string | null;
  verification_expires_at?: string | null;
  last_checked_at?: string | null;
  response_time_minutes?: number | null;
  accepts_new_work?: boolean | null;
};

type DirectoryResponse = {
  plumbers: DirectoryPlumber[];
  total: number;
  page: number;
  hasMore: boolean;
};

type FilterKey = "all" | "credential" | "claimed" | "available" | "emergency";
type SortKey = "recommended" | "rated" | "name";

export function DirectorySearch({
  initialPlumbers,
  initialTotal,
  initialQuery = "",
  initialArea = "",
  initialService = "",
  initialFilter = "all",
}: {
  initialPlumbers: DirectoryPlumber[];
  initialTotal: number;
  initialQuery?: string;
  initialArea?: string;
  initialService?: string;
  initialFilter?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const firstRender = useRef(true);
  const [query, setQuery] = useState(initialQuery);
  const [area, setArea] = useState(normaliseAreaKey(initialArea));
  const [service, setService] = useState(normaliseServiceKey(initialService));
  const [urgency, setUrgency] = useState(initialFilter === "emergency" ? "emergency" : "routine");
  const [filter, setFilter] = useState<FilterKey>(
    ["credential", "claimed", "available", "emergency"].includes(initialFilter)
      ? (initialFilter as FilterKey)
      : "all",
  );
  const [sort, setSort] = useState<SortKey>("recommended");
  const [plumbers, setPlumbers] = useState<DirectoryPlumber[]>(initialPlumbers);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialPlumbers.length < initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchResults(nextPage = 1, append = false) {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (area) params.set("area", area);
    if (service) params.set("service", service);
    const effectiveFilter = urgency === "emergency" ? "emergency" : filter;
    if (effectiveFilter !== "all") params.set("filter", effectiveFilter);
    if (sort !== "recommended") params.set("sort", sort);
    params.set("page", String(nextPage));
    params.set("limit", "12");

    try {
      const response = await fetch(`/api/plumbers?${params.toString()}`);
      if (!response.ok) throw new Error("Search unavailable");
      const data = (await response.json()) as DirectoryResponse;
      setPlumbers((current) => (append ? [...current, ...data.plumbers] : data.plumbers));
      setTotal(data.total);
      setPage(data.page);
      setHasMore(data.hasMore);
    } catch {
      setError("The directory could not refresh. Please try again, or contact a listed plumber directly.");
    } finally {
      setLoading(false);
    }
  }

  function syncSearchUrl() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (area) params.set("area", area);
    if (service) params.set("service", service);
    const effectiveFilter = urgency === "emergency" ? "emergency" : filter;
    if (effectiveFilter !== "all") params.set("filter", effectiveFilter);
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  function submitSearch(event?: React.FormEvent) {
    event?.preventDefault();
    syncSearchUrl();
    trackEvent("search_submit", {
      area: area || "all-kzn",
      service: service || "any",
      urgency,
      query_match: query.trim() || "structured-search",
    });
    void fetchResults(1, false);
    document.getElementById("directory-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timeout = window.setTimeout(() => void fetchResults(1, false), 150);
    return () => window.clearTimeout(timeout);
    // query is submitted explicitly to avoid a request on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, service, urgency, filter, sort]);

  return (
    <section className="relative z-10 -mt-8 px-4 sm:px-6 pb-14" aria-labelledby="directory-heading">
      <div className="mx-auto max-w-7xl">
        <form
          onSubmit={submitSearch}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/8 sm:p-6"
        >
          <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Fast local match</p>
              <h2 id="directory-heading" className="font-display text-2xl font-bold text-slate-950 sm:text-3xl">
                What needs fixing, and where?
              </h2>
            </div>
            <p className="max-w-md text-sm text-slate-600">
              Compare providers yourself. KZN Plumbers does not send your details to a list of contractors.
            </p>
          </div>

          <div className="grid gap-3 pt-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
            <label className="space-y-1.5 text-sm font-semibold text-slate-800">
              Area
              <span className="relative block">
                <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                <select value={area} onChange={(event) => setArea(event.target.value)} className="input pl-9">
                  <option value="">All KwaZulu-Natal</option>
                  {DIRECTORY_AREAS.map((option) => (
                    <option value={option.key} key={option.key}>{option.label}</option>
                  ))}
                </select>
              </span>
            </label>

            <label className="space-y-1.5 text-sm font-semibold text-slate-800">
              Job type
              <select value={service} onChange={(event) => setService(event.target.value)} className="input">
                <option value="">Any plumbing service</option>
                {DIRECTORY_SERVICES.map((option) => (
                  <option value={option.key} key={option.key}>{option.label}</option>
                ))}
              </select>
            </label>

            <fieldset className="space-y-1.5">
              <legend className="text-sm font-semibold text-slate-800">Urgency</legend>
              <div className="grid grid-cols-2 rounded-lg border border-slate-300 bg-slate-50 p-1">
                {[
                  { key: "routine", label: "Planned" },
                  { key: "emergency", label: "Emergency" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setUrgency(option.key)}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                      urgency === option.key ? "bg-white text-brand shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                    aria-pressed={urgency === option.key}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <button type="submit" className="btn-primary mt-auto min-h-11 px-6">
              <Search className="h-4 w-4" aria-hidden="true" />
              Find matches
            </button>
          </div>

          <label className="relative mt-3 block">
            <span className="sr-only">Search by business name, suburb, or plumbing problem</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Optional: business name, suburb, or problem"
              className="input pl-9"
            />
          </label>
        </form>

        <div id="directory-results" className="scroll-mt-24 pt-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Current directory results</p>
              <h2 className="font-display text-2xl font-bold text-slate-950 sm:text-3xl">
                {total.toLocaleString()} plumber{total === 1 ? "" : "s"} match
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Verification labels describe what was checked; they are not paid rankings.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden="true" />
              {[
                { key: "all", label: "All records" },
                { key: "credential", label: "Credential checked", icon: ShieldCheck },
                { key: "claimed", label: "Claimed" },
                { key: "available", label: "Taking work", icon: Clock3 },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setFilter(option.key as FilterKey);
                    trackEvent("filter_apply", { area: area || "all-kzn", service: service || "any", filter: option.key });
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                    filter === option.key
                      ? "border-brand bg-brand text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-brand hover:text-brand"
                  }`}
                  aria-pressed={filter === option.key}
                >
                  {option.label}
                </button>
              ))}
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                aria-label="Sort plumbers"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="recommended">Recommended</option>
                <option value="rated">Highest rated</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {loading && plumbers.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-slate-600">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" /> Loading directory results
            </div>
          ) : plumbers.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <h3 className="font-display text-xl font-bold text-slate-950">No exact match yet</h3>
              <p className="mt-2 text-sm text-slate-600">Broaden the area or job type, or browse all KZN records.</p>
              <button
                type="button"
                className="btn-secondary mt-4"
                onClick={() => {
                  setQuery("");
                  setArea("");
                  setService("");
                  setUrgency("routine");
                  setFilter("all");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className={`mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
                {plumbers.map((plumber, index) => (
                  <PlumberCard
                    key={plumber.id}
                    plumber={plumber}
                    sourcePage="homepage_directory"
                    rankPosition={index + 1}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void fetchResults(page + 1, true)}
                    className="btn-secondary min-w-48"
                  >
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : "Show 12 more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
