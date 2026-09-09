"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Clock3, Loader2, MapPin, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { DIRECTORY_AREAS, DIRECTORY_SERVICES, DIRECTORY_PAGE_SIZE, directorySearchParams, getAreaConfig, parseDirectorySearch, type DirectorySearchState, type DirectoryFilter, type DirectorySort } from "@/lib/directory";
import { clearDirectoryJobFilters, directoryAreaCookie, INVALID_DIRECTORY_AREA_MESSAGE, isSupportedDirectoryArea, type DirectoryAreaSource } from "@/lib/directory-location";
import { trackEvent } from "@/lib/analytics";
import { PlumberCard } from "@/components/PlumberCard";
import type { PublicDirectoryResult } from "@/lib/directory-public-types";

function rememberArea(area: string) {
  const cookie = directoryAreaCookie(area, window.location.protocol === "https:");
  if (cookie) {
    try { document.cookie = cookie; } catch { /* Searches still work when browser storage is blocked. */ }
  }
}

export function DirectorySearch({ initialResult, initialSearch, initialAreaSource, initialError = null }: {
  initialResult: PublicDirectoryResult | null;
  initialSearch: DirectorySearchState;
  initialAreaSource: DirectoryAreaSource;
  initialError?: string | null;
}) {
  const pathname = usePathname();
  const [search, setSearch] = useState(initialSearch);
  const [query, setQuery] = useState(initialSearch.q);
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const pendingKey = useRef<string | null>(null);
  const initialHistoryReady = useRef(false);
  const loadedKey = useRef<string | null>(initialResult ? directorySearchParams(initialSearch).toString() : null);
  const { area, service, filter, sort, page } = search;
  const areaConfig = getAreaConfig(area);
  const invalidArea = !isSupportedDirectoryArea(area);
  const urgency = search.emergency ? "emergency" : "routine";
  const plumbers = result?.plumbers ?? [];
  const total = result?.total ?? null;
  const hasMore = result?.hasMore ?? false;

  const fetchResults = useCallback(async (next: DirectorySearchState, history: "push" | "none" = "push", force = false) => {
    const params = directorySearchParams(next);
    const key = params.toString();
    const href = `${pathname}?${key}${window.location.hash}`;
    // Native history updates the URL without a second RSC/router request.
    if (history === "push" && `${window.location.pathname}${window.location.search}${window.location.hash}` !== href) {
      window.history.pushState(null, "", href);
    }
    setSearch(next);
    setQuery(next.q);
    if (!isSupportedDirectoryArea(next.area)) {
      controller.current?.abort();
      sequence.current += 1;
      pendingKey.current = null;
      loadedKey.current = null;
      setLoading(false);
      setResult(null);
      setError(INVALID_DIRECTORY_AREA_MESSAGE);
      return;
    }
    if (!force && (loadedKey.current === key || pendingKey.current === key)) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const requestId = ++sequence.current;
    pendingKey.current = key;
    loadedKey.current = null;
    setLoading(true);
    setResult(null);
    setError(null);
    params.set("limit", String(DIRECTORY_PAGE_SIZE));
    try {
      const response = await fetch(`/api/plumbers?${params.toString()}`, { signal: abort.signal });
      if (!response.ok) throw new Error("Directory read failed");
      const data = await response.json() as PublicDirectoryResult;
      if (abort.signal.aborted || requestId !== sequence.current) return;
      setResult(data);
      loadedKey.current = key;
    } catch {
      if (abort.signal.aborted || requestId !== sequence.current) return;
      setError("The directory could not load these results. This is a read error, not zero matches. Please try again shortly.");
    } finally {
      if (requestId === sequence.current) {
        pendingKey.current = null;
        setLoading(false);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (!initialHistoryReady.current) {
      initialHistoryReady.current = true;
      // Pin the SSR area (even All KZN) to this history entry. Back/Forward must
      // restore that entry, not consult a cookie changed by a later selection.
      const url = new URL(window.location.href);
      if (!url.searchParams.has("area")) {
        url.searchParams.set("area", initialSearch.area);
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
      if (initialAreaSource === "url") rememberArea(initialSearch.area);
    }
    function restoreHistory() {
      const params = new URLSearchParams(window.location.search);
      const input: Record<string, string> = {};
      // Match SSR's first-value rule for repeated URL parameters.
      params.forEach((value, key) => { if (!(key in input)) input[key] = value; });
      const next = parseDirectorySearch(input);
      if (params.has("area")) rememberArea(next.area);
      void fetchResults(next, "none");
    }
    window.addEventListener("popstate", restoreHistory);
    return () => {
      window.removeEventListener("popstate", restoreHistory);
      controller.current?.abort();
      sequence.current += 1;
    };
  }, [fetchResults, initialAreaSource, initialSearch.area]);

  function applyFilter(changes: Partial<DirectorySearchState>) {
    if (changes.area !== undefined) rememberArea(changes.area);
    void fetchResults({ ...search, q: query.trim().slice(0, 80), ...changes, page: 1 });
  }

  function browseAllKzn() {
    rememberArea("");
    void fetchResults({ ...clearDirectoryJobFilters(search), area: "" });
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    trackEvent("search_submit", { area: area || "all-kzn", service: service || "any", urgency, query_match: query.trim() || "structured-search" });
    applyFilter({});
    document.getElementById("directory-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
                <select value={area} onChange={(event) => applyFilter({ area: event.target.value })} aria-describedby="directory-area-help" className="input pl-9">
                  {invalidArea && <option value={area} disabled>Unrecognised area — choose below</option>}
                  <option value="">All KwaZulu-Natal</option>
                  {DIRECTORY_AREAS.map((option) => (
                    <option value={option.key} key={option.key}>{option.label}</option>
                  ))}
                </select>
              </span>
            </label>

            <label className="space-y-1.5 text-sm font-semibold text-slate-800">
              Job type
              <select value={service} onChange={(event) => applyFilter({ service: event.target.value })} className="input">
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
                    onClick={() => applyFilter({ emergency: option.key === "emergency" })}
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

          <p id="directory-area-help" className="mt-3 text-sm text-slate-600" aria-live="polite">
            {invalidArea ? "That area is not recognised. Choose a listed area; no wider search has been run." : areaConfig
              ? `Showing records in ${areaConfig.label}. We remember your chosen area on this browser for 30 days if cookies are enabled.`
              : "Choose your area for local matches — currently all KZN. We do not detect your location."}
            {area === "ballito" && " North Coast currently matches records stored as Ballito only, not every North Coast suburb. Durban North is a separate area; confirm service coverage directly."}
          </p>

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
                {invalidArea ? "Choose a listed area" : total !== null ? `${total.toLocaleString()} plumber${total === 1 ? "" : "s"} match` : loading ? "Loading matches" : "Directory unavailable"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Within your selected area, the default is claimed profiles first, then unclaimed records, A–Z in each group. Highest rated uses Google rating, then review count; Name A–Z ignores claim status. Publication is not an endorsement. Taking work requires recent business opt-in.
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
                    applyFilter({ filter: option.key as DirectoryFilter });
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
                onChange={(event) => applyFilter({ sort: event.target.value as DirectorySort })}
                aria-label="Sort plumbers"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="recommended">Claimed profiles first</option>
                <option value="rated">Highest Google rated</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
              {invalidArea
                ? <button type="button" className="ml-3 font-bold underline" onClick={browseAllKzn}>Browse all KZN</button>
                : <button type="button" className="ml-3 font-bold underline" onClick={() => void fetchResults(search, "none", true)}>Retry</button>}
            </div>
          )}

          {result?.notice && <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{result.notice}</p>}

          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-slate-600">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" /> Loading directory results
            </div>
          ) : error ? null : plumbers.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <h3 className="font-display text-xl font-bold text-slate-950">{page > 1 ? "No records on this page" : "No exact match yet"}</h3>
              <p className="mt-2 text-sm text-slate-600">{page > 1 ? "The result set may have changed. Return to its first page." : "Clear job filters to try again in the same area. We never expand your area automatically."}</p>
              {page > 1 && <button type="button" className="btn-primary mt-4 mr-3" onClick={() => void fetchResults({ ...search, page: 1 })}>First result page</button>}
              <button
                type="button"
                className="btn-secondary mt-4"
                onClick={() => void fetchResults(clearDirectoryJobFilters(search))}
              >
                Clear job filters
              </button>
              <button type="button" className="btn-secondary ml-3 mt-4" onClick={browseAllKzn}>Browse all KZN</button>
            </div>
          ) : (
            <>
              <div className={`mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
                {plumbers.map((plumber, index) => (
                  <PlumberCard
                    key={plumber.id}
                    plumber={plumber}
                    sourcePage="homepage_directory"
                    rankPosition={(page - 1) * DIRECTORY_PAGE_SIZE + index + 1}
                  />
                ))}
              </div>
              {(page > 1 || hasMore) && (
                <nav aria-label="Directory pages" className="mt-8 flex items-center justify-between gap-3">
                  <button type="button" disabled={loading || page <= 1}
                    onClick={() => void fetchResults({ ...search, page: page - 1 })} className="btn-secondary disabled:opacity-40">Previous</button>
                  <span className="text-sm text-slate-600">Page {page} of {Math.max(1, Math.ceil((total ?? 0) / DIRECTORY_PAGE_SIZE))}</span>
                  <button type="button" disabled={loading || !hasMore}
                    onClick={() => void fetchResults({ ...search, page: page + 1 })} className="btn-secondary disabled:opacity-40">Next 12</button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
