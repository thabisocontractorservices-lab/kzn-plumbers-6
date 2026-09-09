import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DIRECTORY_AREAS, DEFAULT_DIRECTORY_SEARCH, directorySearchParams, getAreaConfig, normaliseAreaKey, parseDirectorySearch } from "../lib/directory";
import { clearDirectoryJobFilters, DIRECTORY_ALL_AREAS, DIRECTORY_AREA_COOKIE, directoryAreaCookie, isSupportedDirectoryArea, resolveHomepageDirectorySearch, sanitiseDirectoryAreaCookie } from "../lib/directory-location";

const server = vi.hoisted(() => ({ cookies: vi.fn(), directory: vi.fn(), stats: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: server.cookies }));
vi.mock("../lib/directory-data", () => ({ searchPublicPlumbers: server.directory, getPublicDirectoryStats: server.stats }));
vi.mock("../components/DirectorySearch", () => ({ DirectorySearch: () => null }));
import HomePage from "../app/page";
import { GET } from "../app/api/plumbers/route";

const resolve = resolveHomepageDirectorySearch;

describe("coarse directory area preferences", () => {
  it("uses a known preference only when the URL has no area", () => {
    expect(resolve({}, "durban")).toMatchObject({ search: { area: "durban" }, areaSource: "cookie", invalidArea: false });
    expect(resolve({ area: "north-coast", sort: "rated" }, "pietermaritzburg")).toMatchObject({
      search: { area: "ballito", sort: "rated" }, areaSource: "url", invalidArea: false,
    });
    expect(resolve({ area: "PMB" }, "durban").search.area).toBe("pietermaritzburg");
  });

  it("treats an explicit empty URL area as All KZN, ahead of the cookie", () => {
    for (const area of ["", ["", "pietermaritzburg"], undefined]) {
      expect(resolve({ area }, "durban")).toMatchObject({ search: { area: "" }, areaSource: "url", invalidArea: false });
    }
    expect(resolve({ area: ["durban-north", "PMB"] }, "ballito").search.area).toBe("durban-north");
  });

  it("distinguishes an explicit all sentinel from no preference", () => {
    expect(resolve({}, DIRECTORY_ALL_AREAS)).toMatchObject({ search: { area: "" }, areaSource: "cookie" });
    expect(resolve({})).toMatchObject({ search: { area: "" }, areaSource: "unset" });
    expect(resolve({}, "not-a-place")).toMatchObject({ search: { area: "" }, areaSource: "unset" });
  });

  it("accepts only exact coarse keys or the all sentinel in cookies", () => {
    for (const { key } of DIRECTORY_AREAS) expect(sanitiseDirectoryAreaCookie(key)).toBe(key);
    expect(sanitiseDirectoryAreaCookie(DIRECTORY_ALL_AREAS)).toBe(DIRECTORY_ALL_AREAS);
    for (const value of [undefined, null, "", "Durban", " durban ", "north-coast", "PMB", "%64urban", "durban; Path=/", "-29.85,31.02", "<script>"]) {
      expect(sanitiseDirectoryAreaCookie(value)).toBeNull();
    }
  });

  it("writes a 30-day path-wide SameSite cookie, secure only over HTTPS", () => {
    expect(DIRECTORY_AREA_COOKIE).toBe("kzn_directory_area");
    expect(directoryAreaCookie("ballito", true)).toBe("kzn_directory_area=ballito; Max-Age=2592000; Path=/; SameSite=Lax; Secure");
    expect(directoryAreaCookie("", false)).toBe("kzn_directory_area=all-kzn; Max-Age=2592000; Path=/; SameSite=Lax");
    for (const value of ["North Coast", "unknown", "durban; Secure", DIRECTORY_ALL_AREAS]) expect(directoryAreaCookie(value, true)).toBeNull();
  });

  it("never broadens an unsupported explicit location, even with a valid cookie", () => {
    for (const area of ["Umhlanga", "north-coast-suburbs", "durban-north-coast", "all-kzn", " "]) {
      const result = resolve({ area }, "pietermaritzburg");
      expect(result).toMatchObject({ search: { area }, areaSource: "url", invalidArea: true });
      expect(isSupportedDirectoryArea(result.search.area)).toBe(false);
      expect(directorySearchParams(result.search).get("area")).toBe(area);
      expect(normaliseAreaKey(area)).toBe(""); // API's existing validator still rejects unknown aliases.
    }
  });

  it("maps only the safe North Coast aliases to the existing Ballito bucket", () => {
    for (const alias of ["North Coast", "north-coast", "ballito-north-coast", " BALLITO "]) {
      const key = normaliseAreaKey(alias);
      expect(key).toBe("ballito");
      expect(getAreaConfig(key)?.dbAreas).toEqual(["Ballito"]);
    }
    expect(getAreaConfig("ballito")?.label).toBe("Ballito / North Coast");
  });

  it("keeps Durban North and PMB distinct with no PMB crossover into coastal areas", () => {
    expect(normaliseAreaKey("Durban North")).toBe("durban-north");
    expect(getAreaConfig("durban-north")?.dbAreas).toEqual(["Durban North"]);
    expect(getAreaConfig(normaliseAreaKey("PMB"))?.dbAreas).toEqual(["PMB"]);
    for (const key of ["durban", "durban-north", "durban-south", "ballito"]) {
      expect(getAreaConfig(key)?.dbAreas).not.toContain("PMB");
    }
  });

  it("round-trips history URLs including All KZN without inheriting a later cookie", () => {
    for (const area of ["", "durban", "ballito", "pietermaritzburg"]) {
      const search = parseDirectorySearch({ area, q: "drain", service: "blocked-drains", sort: "rated", emergency: "1", page: "2" });
      const params = directorySearchParams(search);
      expect(params.has("area")).toBe(true);
      const restored = resolve(Object.fromEntries(params), area === "pietermaritzburg" ? "durban" : "pietermaritzburg");
      expect(restored.search).toEqual(search);
    }
  });

  it("clears job filters but preserves area and the chosen rating or name sort", () => {
    for (const sort of ["recommended", "rated", "name"] as const) {
      const search = parseDirectorySearch({ area: "durban-north", sort, q: "leak", service: "blocked-drains", filter: "claimed", emergency: "1", page: "4" });
      expect(clearDirectoryJobFilters(search)).toEqual({ ...DEFAULT_DIRECTORY_SEARCH, area: "durban-north", sort });
    }
  });
});

describe("homepage SSR and URL-only API boundary (mocked, no network)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.cookies.mockResolvedValue({ get: (name: string) => name === DIRECTORY_AREA_COOKIE ? { value: "durban" } : undefined });
    server.directory.mockResolvedValue({ plumbers: [], total: 0, page: 1, limit: 12, hasMore: false, notice: null });
    server.stats.mockResolvedValue({ records: 0, claimed: 0 });
  });

  it("waits for the cookie before running the first listing fetch", async () => {
    let release!: (store: { get: () => { value: string } }) => void;
    server.cookies.mockReturnValueOnce(new Promise((resolveCookie) => { release = resolveCookie; }));
    const page = HomePage({ searchParams: Promise.resolve({ sort: "name" }) });
    expect(server.directory).not.toHaveBeenCalled();
    release({ get: () => ({ value: "ballito" }) });
    await page;
    expect(server.directory).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ area: "ballito", sort: "name" }));
  });

  it("fetches explicit All KZN but does not fetch listings for an unknown URL area", async () => {
    await HomePage({ searchParams: Promise.resolve({ area: "" }) });
    expect(server.directory).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ area: "" }));
    server.directory.mockClear();
    await HomePage({ searchParams: Promise.resolve({ area: "not-a-real-area" }) });
    expect(server.directory).not.toHaveBeenCalled();
  });

  it("ignores the preference cookie in API searches and retains invalid-area validation", async () => {
    const request = (query: string) => new NextRequest(`https://directory.test/api/plumbers${query}`, { headers: { cookie: `${DIRECTORY_AREA_COOKIE}=pietermaritzburg` } });
    expect((await GET(request(""))).status).toBe(200);
    expect(server.directory).toHaveBeenLastCalledWith(expect.objectContaining({ area: "" }), 12);
    expect((await GET(request("?area=north-coast&sort=rated"))).status).toBe(200);
    expect(server.directory).toHaveBeenLastCalledWith(expect.objectContaining({ area: "ballito", sort: "rated" }), 12);
    server.directory.mockClear();
    expect((await GET(request("?area=unknown-alias"))).status).toBe(400);
    expect(server.directory).not.toHaveBeenCalled();
    expect(server.cookies).not.toHaveBeenCalled();
  });
});
