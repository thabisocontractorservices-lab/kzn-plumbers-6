import { DEFAULT_DIRECTORY_SEARCH, getAreaConfig, parseDirectorySearch, type AreaKey, type DirectorySearchState } from "./directory";

export const DIRECTORY_AREA_COOKIE = "kzn_directory_area";
export const DIRECTORY_AREA_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
export const DIRECTORY_ALL_AREAS = "all-kzn";
export const INVALID_DIRECTORY_AREA_MESSAGE = "That area is not recognised. Choose a listed area or explicitly browse all KZN; your search has not been expanded.";

export type DirectoryAreaPreference = AreaKey | typeof DIRECTORY_ALL_AREAS;
export type DirectoryAreaSource = "url" | "cookie" | "unset";
type SearchInput = Record<string, string | string[] | undefined>;

/** Cookies accept only canonical coarse keys, never arbitrary text or aliases. */
export function sanitiseDirectoryAreaCookie(value?: string | null): DirectoryAreaPreference | null {
  if (value === DIRECTORY_ALL_AREAS) return DIRECTORY_ALL_AREAS;
  return getAreaConfig(value)?.key ?? null;
}

export function isSupportedDirectoryArea(area: string): boolean {
  return area === "" || getAreaConfig(area) !== null;
}

/** Homepage SSR only: API searches must continue to depend on their URL alone. */
export function resolveHomepageDirectorySearch(input: SearchInput, cookieValue?: string | null) {
  const explicitArea = Object.prototype.hasOwnProperty.call(input, "area");
  const preference = sanitiseDirectoryAreaCookie(cookieValue);
  const areaSource: DirectoryAreaSource = explicitArea ? "url" : preference ? "cookie" : "unset";
  const search = parseDirectorySearch(explicitArea || preference === null ? input : {
    ...input,
    area: preference === DIRECTORY_ALL_AREAS ? "" : preference,
  });
  return { search, areaSource, invalidArea: !isSupportedDirectoryArea(search.area) };
}

/** Empty means a deliberate All KZN preference, not a missing preference. */
export function directoryAreaCookie(area: string, secure: boolean): string | null {
  const preference = area === "" ? DIRECTORY_ALL_AREAS : getAreaConfig(area)?.key;
  if (!preference) return null;
  return `${DIRECTORY_AREA_COOKIE}=${preference}; Max-Age=${DIRECTORY_AREA_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Reset job/trust filters without losing the local area or an explicit sort. */
export function clearDirectoryJobFilters(search: DirectorySearchState): DirectorySearchState {
  return { ...DEFAULT_DIRECTORY_SEARCH, area: search.area, sort: search.sort };
}
