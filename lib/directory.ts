export const DIRECTORY_AREAS = [
  { key: "durban", label: "Durban / eThekwini", dbAreas: ["Durban North", "Durban South", "Pinetown"] },
  { key: "durban-north", label: "Durban North", dbAreas: ["Durban North"] },
  { key: "durban-south", label: "Durban South", dbAreas: ["Durban South"] },
  { key: "pietermaritzburg", label: "Pietermaritzburg (PMB)", dbAreas: ["PMB"] },
  { key: "ballito", label: "Ballito / North Coast", dbAreas: ["Ballito"] },
  { key: "richards-bay", label: "Richards Bay", dbAreas: ["Richards Bay"] },
  { key: "newcastle", label: "Newcastle", dbAreas: ["Newcastle"] },
  { key: "pinetown", label: "Pinetown", dbAreas: ["Pinetown"] },
  { key: "estcourt", label: "Estcourt", dbAreas: ["Estcourt"] },
  { key: "south-coast", label: "KZN South Coast", dbAreas: ["South Coast"] },
  { key: "other-kzn", label: "Other KZN", dbAreas: ["Other KZN"] },
] as const;

export const DIRECTORY_SERVICES = [
  { key: "burst-pipes", label: "Burst pipe or leak", dbValue: "Burst pipes" },
  { key: "blocked-drains", label: "Blocked drain", dbValue: "Drain cleaning" },
  { key: "geyser-repair", label: "Geyser repair", dbValue: "Geyser repair" },
  { key: "leak-detection", label: "Leak detection", dbValue: "Leak detection" },
  { key: "bathroom-plumbing", label: "Bathroom plumbing", dbValue: "Bathroom fitting" },
  { key: "solar-geyser", label: "Solar geyser", dbValue: "Solar geyser" },
  { key: "gas-fitting", label: "Gas fitting", dbValue: "Gas fitting" },
  { key: "commercial", label: "Commercial plumbing", dbValue: "Commercial" },
] as const;

export const DIRECTORY_PAGE_SIZE = 12;
export const DIRECTORY_MAX_PAGE = 10_000;
export type DirectoryFilter = "all" | "credential" | "claimed" | "available" | "emergency";
export type DirectorySort = "recommended" | "rated" | "name";
export type DirectorySearchState = {
  q: string;
  area: string;
  service: string;
  filter: DirectoryFilter;
  emergency: boolean;
  sort: DirectorySort;
  page: number;
};

export const DEFAULT_DIRECTORY_SEARCH: DirectorySearchState = {
  q: "", area: "", service: "", filter: "all", emergency: false, sort: "recommended", page: 1,
};

export function firstSearchValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function parseDirectorySearch(input: Record<string, string | string[] | undefined>): DirectorySearchState {
  const filter = firstSearchValue(input.filter);
  const sort = firstSearchValue(input.sort);
  const page = Number(firstSearchValue(input.page) || "1");
  return {
    q: firstSearchValue(input.q).trim().slice(0, 80),
    // Keep unsupported explicit locations visible so callers can reject them,
    // rather than quietly turning a misspelled area into a province-wide search.
    area: normaliseAreaKey(firstSearchValue(input.area)) || firstSearchValue(input.area),
    service: normaliseServiceKey(firstSearchValue(input.service)),
    filter: ["credential", "claimed", "available"].includes(filter) ? filter as DirectoryFilter : "all",
    emergency: filter === "emergency" || ["1", "true"].includes(firstSearchValue(input.emergency)),
    sort: ["rated", "name"].includes(sort) ? sort as DirectorySort : "recommended",
    page: Number.isSafeInteger(page) && page >= 1 ? Math.min(page, DIRECTORY_MAX_PAGE) : 1,
  };
}

export function directorySearchParams(state: DirectorySearchState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  // An empty area is an explicit All KZN choice; omitting it would allow the
  // homepage's remembered area to override shared URLs or Back/Forward entries.
  params.set("area", state.area);
  if (state.service) params.set("service", state.service);
  if (state.filter !== "all") params.set("filter", state.filter);
  if (state.emergency && state.filter !== "emergency") params.set("emergency", "1");
  if (state.sort !== "recommended") params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  return params;
}

export type AreaKey = (typeof DIRECTORY_AREAS)[number]["key"];
export type ServiceKey = (typeof DIRECTORY_SERVICES)[number]["key"];

export function getAreaConfig(key?: string | null) {
  return DIRECTORY_AREAS.find((area) => area.key === key) ?? null;
}

export function getServiceConfig(key?: string | null) {
  return DIRECTORY_SERVICES.find((service) => service.key === key) ?? null;
}

export function normaliseAreaKey(value?: string | null): string {
  if (!value) return "";
  const normalised = value.trim().toLowerCase();
  const direct = getAreaConfig(normalised);
  if (direct) return direct.key;
  // These are names for the existing Ballito bucket, not wider suburb coverage.
  if (["north coast", "north-coast", "ballito-north-coast"].includes(normalised)) return "ballito";
  const matchingAreas = DIRECTORY_AREAS.filter((area) =>
    area.dbAreas.some((dbArea) => dbArea.toLowerCase() === normalised),
  );
  const match = matchingAreas.find((area) => area.dbAreas.length === 1) ?? matchingAreas[0];
  return match?.key ?? "";
}

export function normaliseServiceKey(value?: string | null): string {
  if (!value) return "";
  const direct = getServiceConfig(value);
  if (direct) return direct.key;
  const match = DIRECTORY_SERVICES.find(
    (service) => service.dbValue.toLowerCase() === value.toLowerCase(),
  );
  return match?.key ?? "";
}
