import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimedPageRanges } from "../lib/claimed-ordering";
import { DEFAULT_DIRECTORY_SEARCH, getAreaConfig, type DirectorySort } from "../lib/directory";
import { getPublicPlumbers, getRelatedPlumbers, searchPublicPlumbers, type DirectoryRow } from "../lib/directory-data";

type TestRow = DirectoryRow & { is_verified: boolean; record_status: string; about: string };
type Operation = { method: string; column: string; value: unknown };
type Ordering = { column: string; ascending: boolean; nullsFirst?: boolean };
type QueryTrace = { builderId: number; head: boolean; operations: Operation[]; orders: Ordering[]; range: [number, number] | null };
type QueryResult = { data: TestRow[] | null; count: number | null; error: { message: string } | null };

const database = vi.hoisted(() => ({
  rows: [] as TestRow[],
  queries: [] as QueryTrace[],
  nextBuilderId: 0,
  schema: { evidence: true, availability: true, recordStatus: true, dedicatedAvailability: true, photos: true },
  error: null as { message: string } | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: <T>(fn: T) => fn }));
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));
vi.mock("@/lib/directory-read", () => ({
  requirePublicSupabase: () => ({
    from: (table: string) => {
      if (table !== "plumbers") throw new Error(`Unexpected table: ${table}`);
      return new MemoryQuery();
    },
  }),
  hasPublicColumns: async (table: string, columns: string) => {
    if (table === "photos") return database.schema.photos;
    if (columns.startsWith("verification_state")) return database.schema.evidence;
    if (columns === "accepts_new_work,last_checked_at") return database.schema.availability;
    if (columns === "record_status") return database.schema.recordStatus;
    if (columns === "availability_confirmed_at") return database.schema.dedicatedAvailability;
    throw new Error(`Unexpected schema probe: ${columns}`);
  },
  assertPublicRead: (context: string, error: QueryResult["error"]) => {
    if (error) throw new Error(`${context}: ${error.message}`);
  },
}));

function valueOf(row: TestRow, column: string): unknown {
  return row[column as keyof TestRow];
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

/** Mutable like PostgREST: sharing a builder leaks filters, orders and ranges. No network. */
class MemoryQuery {
  private readonly builderId = database.nextBuilderId++;
  private readonly predicates: Array<(row: TestRow) => boolean> = [];
  private readonly operations: Operation[] = [];
  private readonly orders: Ordering[] = [];
  private head = false;
  private bounds: [number, number] | null = null;

  select(_columns: string, options: { head?: boolean } = {}) {
    this.head = options.head === true;
    return this;
  }

  private where(method: string, column: string, value: unknown, predicate: (row: TestRow) => boolean) {
    this.operations.push({ method, column, value });
    this.predicates.push(predicate);
    return this;
  }

  eq(column: string, value: unknown) {
    // Embedded photo filtering is a left relation, not a parent-record filter.
    return this.where("eq", column, value, (row) => column.startsWith("photos.") || valueOf(row, column) === value);
  }

  neq(column: string, value: unknown) {
    return this.where("neq", column, value, (row) => valueOf(row, column) !== value);
  }

  in(column: string, values: unknown[]) {
    return this.where("in", column, values, (row) => values.includes(valueOf(row, column)));
  }

  contains(column: string, values: unknown[]) {
    return this.where("contains", column, values, (row) => {
      const actual = valueOf(row, column);
      return Array.isArray(actual) && values.every((value) => actual.includes(value));
    });
  }

  is(column: string, value: null) {
    return this.where("is", column, value, (row) => valueOf(row, column) == null);
  }

  not(column: string, operator: string, value: null) {
    if (operator !== "is") throw new Error(`Unexpected operator: ${operator}`);
    return this.where("not", column, value, (row) => valueOf(row, column) != null);
  }

  gte(column: string, value: string) {
    return this.where("gte", column, value, (row) => valueOf(row, column) != null && compare(valueOf(row, column), value) >= 0);
  }

  lte(column: string, value: string) {
    return this.where("lte", column, value, (row) => valueOf(row, column) != null && compare(valueOf(row, column), value) <= 0);
  }

  gt(column: string, value: string) {
    return this.where("gt", column, value, (row) => valueOf(row, column) != null && compare(valueOf(row, column), value) > 0);
  }

  or(expression: string) {
    const alternatives = expression.split(",").map((term) => {
      const match = /^([a-z_]+)\.(ilike|like|cs)\.(.+)$/.exec(term);
      if (!match) throw new Error(`Unexpected OR filter: ${term}`);
      const [, column, operator, pattern] = match;
      return (row: TestRow) => {
        const value = valueOf(row, column);
        if (operator === "cs") return Array.isArray(value) && value.includes(pattern.slice(1, -1));
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
        return value != null && new RegExp(`^${escaped}$`, operator === "ilike" ? "i" : "").test(String(value));
      };
    });
    return this.where("or", "", expression, (row) => alternatives.some((predicate) => predicate(row)));
  }

  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }) {
    this.orders.push({ column, ...options });
    return this;
  }

  limit(count: number, options?: { referencedTable: string }) {
    if (!options?.referencedTable) this.bounds = [0, count - 1];
    return this;
  }

  range(from: number, to: number) {
    this.bounds = [from, to];
    return this;
  }

  private result(): QueryResult {
    database.queries.push({ builderId: this.builderId, head: this.head,
      operations: [...this.operations], orders: [...this.orders], range: this.bounds });
    if (database.error) return { data: null, count: null, error: database.error };
    const rows = database.rows.filter((row) => this.predicates.every((predicate) => predicate(row)));
    rows.sort((a, b) => {
      for (const order of this.orders) {
        const left = valueOf(a, order.column);
        const right = valueOf(b, order.column);
        if (left == null && right == null) continue;
        if (left == null) return order.nullsFirst ? -1 : 1;
        if (right == null) return order.nullsFirst ? 1 : -1;
        const result = compare(left, right);
        if (result) return order.ascending ? result : -result;
      }
      return 0;
    });
    return { data: this.head ? null : this.bounds ? rows.slice(this.bounds[0], this.bounds[1] + 1) : rows, count: rows.length, error: null };
  }

  then<T = QueryResult, E = never>(
    fulfilled?: ((value: QueryResult) => T | PromiseLike<T>) | null,
    rejected?: ((reason: unknown) => E | PromiseLike<E>) | null,
  ): Promise<T | E> {
    return Promise.resolve(this.result()).then(fulfilled, rejected);
  }
}

function record(id: string, trading_name: string, fields: Partial<TestRow> = {}): TestRow {
  return { id, trading_name, area: "Durban North", profile_id: null,
    is_verified: true, record_status: "published", about: "", specialties: ["Drain cleaning"],
    is_emergency: true, google_rating: 4, google_review_count: 10, ...fields };
}

const owner = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id);
const credential = {
  verification_state: "credential_verified" as const,
  credential_verified_at: "2026-09-01T12:00:00Z", verification_expires_at: "2026-10-01T12:00:00Z",
  verification_source_url: "https://evidence.example.test/check",
};

beforeEach(() => {
  database.rows = [];
  database.queries = [];
  database.nextBuilderId = 0;
  database.error = null;
  database.schema = { evidence: true, availability: true, recordStatus: true, dedicatedAvailability: true, photos: true };
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-09T12:00:00Z"));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network is forbidden in offline ranking tests"); }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("claimed partition pagination", () => {
  it("matches a complete claimed-then-unclaimed list at every small boundary", () => {
    for (let claimed = 0; claimed <= 8; claimed++) {
      for (let unclaimed = 0; unclaimed <= 8; unclaimed++) {
        const tiers = [Array.from({ length: claimed }, (_, i) => `c${i}`), Array.from({ length: unclaimed }, (_, i) => `u${i}`)];
        for (let offset = 0; offset <= claimed + unclaimed + 2; offset++) {
          for (let limit = 1; limit <= 5; limit++) {
            const actual = claimedPageRanges(claimed, unclaimed, offset, limit)
              .flatMap((range) => tiers[range.claimed ? 0 : 1].slice(range.from, range.to + 1));
            expect(actual).toEqual(tiers.flat().slice(offset, offset + limit));
          }
        }
      }
    }
  });

  it("keeps ALL claimed records before unclaimed across pages with exact totals and fresh builders", async () => {
    const claimed = Array.from({ length: 29 }, (_, i) => record(`c${String(i).padStart(2, "0")}`, `Zulu ${String(i).padStart(2, "0")}`, { profile_id: owner(100 - i) }));
    const unclaimed = Array.from({ length: 20 }, (_, i) => record(`u${String(i).padStart(2, "0")}`, `Alpha ${String(i).padStart(2, "0")}`));
    database.rows = [...unclaimed].reverse().concat([...claimed].reverse());
    const all = [...claimed, ...unclaimed];
    for (let page = 1; page <= 6; page++) {
      const offset = (page - 1) * 12;
      const result = await getPublicPlumbers({ areas: ["Durban North"], limit: 12, offset });
      expect(ids(result.plumbers)).toEqual(ids(all.slice(offset, offset + 12)));
      expect(result).toMatchObject({ total: 49, page, limit: 12, hasMore: offset + result.plumbers.length < 49 });
    }
    expect(new Set(database.queries.map((query) => query.builderId)).size).toBe(database.queries.length);
    for (const query of database.queries.filter((query) => !query.head)) {
      expect(query.orders).toEqual([{ column: "trading_name", ascending: true }, { column: "id", ascending: true }]);
    }
  });

  it("uses alphabetical names and listing-id ties inside BOTH tiers, never owner UUID order", async () => {
    database.rows = [
      record("c3", "Zulu", { profile_id: owner(1) }), record("u2", "Alpha"),
      record("c2", "Bravo", { profile_id: owner(2) }), record("u1", "Alpha"),
      record("c1", "Bravo", { profile_id: owner(3) }),
    ];
    expect(ids((await getPublicPlumbers()).plumbers)).toEqual(["c1", "c2", "c3", "u1", "u2"]);
  });

  it.each(["durban", "ballito"])("keeps local unclaimed records and excludes PMB claimed for %s", async (area) => {
    const areas = [...getAreaConfig(area)!.dbAreas];
    database.rows = [
      record("pmb", "AAA PMB", { area: "PMB", profile_id: owner(1), google_rating: 5 }),
      record("local", "Zulu local", { area: areas[0] }),
      record("wrong-service", "AAA local", { area: areas[0], profile_id: owner(2), specialties: ["Gas fitting"] }),
      record("not-urgent", "AAA local", { area: areas[0], profile_id: owner(3), is_emergency: false }),
      record("unpublished", "AAA local", { area: areas[0], profile_id: owner(4), record_status: "draft" }),
      record("not-public", "AAA local", { area: areas[0], profile_id: owner(5), is_verified: false }),
    ];
    const result = await searchPublicPlumbers({ ...DEFAULT_DIRECTORY_SEARCH, area, service: "blocked-drains", emergency: true });
    expect(ids(result.plumbers)).toEqual(["local"]);
    expect(result).toMatchObject({ total: 1, page: 1, hasMore: false });
    for (const query of database.queries) {
      expect(query.operations).toEqual(expect.arrayContaining([
        { method: "in", column: "area", value: areas },
        { method: "contains", column: "specialties", value: ["Drain cleaning"] },
        { method: "eq", column: "is_emergency", value: true },
      ]));
    }
  });

  it.each<DirectorySort>(["recommended", "name", "rated"])("does not widen empty area/service/search matches for %s", async (sort) => {
    database.rows = [record("pmb", "Claimed", { area: "PMB", profile_id: owner(1) }), record("durban", "Claimed", { profile_id: owner(2) })];
    for (const options of [{ areas: ["Ballito"] }, { areas: ["Durban North"], specialty: "Gas fitting" }, { areas: ["Durban North"], q: "No match" }]) {
      const result = await getPublicPlumbers({ ...options, sort });
      expect(result).toMatchObject({ plumbers: [], total: 0, page: 1, hasMore: false });
    }
  });

  it("retains claimed-only and fresh-availability filters across partitions", async () => {
    const available = { availability_status: "available", accepts_new_work: true, availability_confirmed_at: "2026-09-08T12:00:00Z" };
    database.rows = [
      record("claimed", "Zulu", { profile_id: owner(1), ...available }), record("unclaimed", "Alpha", available),
      record("stale", "AAA stale", { profile_id: owner(2), ...available, availability_confirmed_at: "2026-08-01T12:00:00Z" }),
    ];
    expect(ids((await getPublicPlumbers({ filter: "claimed" })).plumbers)).toEqual(["stale", "claimed"]);
    expect(ids((await getPublicPlumbers({ filter: "available" })).plumbers)).toEqual(["claimed", "unclaimed"]);
  });

  it("does not turn read errors into broader recommendations", async () => {
    database.error = { message: "offline simulated failure" };
    await expect(getPublicPlumbers({ areas: ["Durban North"] })).rejects.toThrow("Claimed directory count failed");
  });
});

describe("explicit name and Google-rating sorts", () => {
  it.each<{ sort: DirectorySort; expected: string[] }>([
    { sort: "name", expected: ["a1", "a2", "b", "d", "o", "z"] },
    { sort: "rated", expected: ["o", "a1", "a2", "b", "z", "d"] },
  ])("preserves $sort across claimed status, pages and the hard area filter", async ({ sort, expected }) => {
    database.rows = [
      record("z", "Zulu", { profile_id: owner(1), google_rating: 3.2, google_review_count: 100 }),
      record("a2", "Alpha", { google_rating: 4.9, google_review_count: 20 }),
      record("b", "Bravo", { profile_id: owner(2), google_rating: 4.7, google_review_count: 90 }),
      record("a1", "Alpha", { google_rating: 4.9, google_review_count: 20 }),
      record("o", "Omega", { google_rating: 4.9, google_review_count: 30 }),
      record("d", "Delta", { google_rating: null, google_review_count: null }),
      record("pmb", "AAA PMB", { area: "PMB", profile_id: owner(3), google_rating: 5, google_review_count: 999 }),
    ];
    for (let page = 1; page <= 3; page++) {
      const result = await getPublicPlumbers({ areas: ["Durban North"], sort, limit: 2, offset: (page - 1) * 2 });
      expect(ids(result.plumbers)).toEqual(expected.slice((page - 1) * 2, page * 2));
      expect(result).toMatchObject({ total: 6, page, limit: 2, hasMore: page < 3 });
    }
    expect(database.queries).toHaveLength(3);
    expect(database.queries.every((query) => !query.operations.some((operation) => operation.column === "profile_id"))).toBe(true);
  });
});

describe("credential candidate validation", () => {
  it("orders claimed first across 500-row batches, validates evidence, and counts only local matches", async () => {
    const claimed = Array.from({ length: 503 }, (_, i) => record(`c${String(i).padStart(3, "0")}`, `Zulu ${String(i).padStart(3, "0")}`, { ...credential, profile_id: owner(1000 - i) }));
    const unclaimed = Array.from({ length: 4 }, (_, i) => record(`u${i}`, `Alpha ${i}`, credential));
    database.rows = [...unclaimed, ...claimed].reverse().concat([
      record("invalid", "AAA invalid", { ...credential, profile_id: owner(1), verification_source_url: "https://user:password@evidence.example.test/check" }),
      record("expired", "AAA expired", { ...credential, profile_id: owner(2), verification_expires_at: "2026-09-08T12:00:00Z" }),
      record("future", "AAA future", { ...credential, credential_verified_at: "2026-09-10T12:00:00Z" }),
      record("pmb", "AAA PMB", { ...credential, area: "PMB", profile_id: owner(3) }),
    ]);
    const crossing = await getPublicPlumbers({ areas: ["Durban North"], filter: "credential", offset: 500, limit: 4 });
    expect(ids(crossing.plumbers)).toEqual(["c500", "c501", "c502", "u0"]);
    expect(crossing).toMatchObject({ total: 507, page: 126, limit: 4, hasMore: true });
    const end = await getPublicPlumbers({ areas: ["Durban North"], credentialOnly: true, offset: 504, limit: 4 });
    expect(ids(end.plumbers)).toEqual(["u1", "u2", "u3"]);
    expect(end).toMatchObject({ total: 507, page: 127, limit: 4, hasMore: false });
    expect(new Set(database.queries.map((query) => query.builderId)).size).toBe(database.queries.length);
    expect(database.queries.some((query) => query.range?.[0] === 500)).toBe(true);
  });

  it.each<DirectorySort>(["name", "rated"])("keeps explicit %s sorting while validating credential candidates", async (sort) => {
    database.rows = [
      record("claimed", "Zulu", { ...credential, profile_id: owner(1), google_rating: 3 }),
      record("unclaimed", "Alpha", { ...credential, google_rating: 5 }),
      record("invalid", "AAA invalid", { ...credential, verification_source_url: "https://user@evidence.example.test/check" }),
      record("pmb", "AAA PMB", { ...credential, area: "PMB", google_rating: 5 }),
    ];
    const result = await getPublicPlumbers({ areas: ["Durban North"], filter: "credential", sort, limit: 1 });
    expect(ids(result.plumbers)).toEqual(["unclaimed"]);
    expect(result).toMatchObject({ total: 2, page: 1, hasMore: true });
  });

  it("does not substitute legacy flags when optional evidence or availability fields are missing", async () => {
    database.schema.evidence = false;
    database.schema.availability = false;
    database.rows = [record("claimed", "Legacy", { profile_id: owner(1), is_certified: true, availability_status: "available" })];
    for (const filter of ["credential", "available"] as const) {
      const result = await getPublicPlumbers({ areas: ["Durban North"], filter });
      expect(result).toMatchObject({ plumbers: [], total: 0, hasMore: false });
      expect(result.notice).toBeTruthy();
    }
  });
});

describe("profile alternatives", () => {
  it("uses the EXACT stored area, excludes the current id BEFORE limiting, and caps at three", async () => {
    database.rows = [
      record("self", "AAA self", { profile_id: owner(1) }),
      record("c1", "Beta", { profile_id: owner(2) }), record("c2", "Zulu", { profile_id: owner(3) }),
      record("u1", "Alpha"), record("u2", "Bravo"), record("u3", "Charlie"),
      record("south", "AAA south", { area: "Durban South", profile_id: owner(4) }),
      record("pinetown", "AAA west", { area: "Pinetown", profile_id: owner(5) }),
      record("pmb", "AAA PMB", { area: "PMB", profile_id: owner(6) }),
    ];
    expect(ids(await getRelatedPlumbers("self", "Durban North"))).toEqual(["c1", "c2", "u1"]);
    for (const query of database.queries) {
      expect(query.operations).toEqual(expect.arrayContaining([
        { method: "neq", column: "id", value: "self" }, { method: "in", column: "area", value: ["Durban North"] },
      ]));
    }
  });

  it.each(["Other KZN", "Unknown", "Area not recorded", "", "Durban", "durban north", "Ballito and the North Coast"])("skips broad/unknown/non-stored area %j without querying", async (area) => {
    database.rows = [record("broad", "Claimed", { area, profile_id: owner(1) })];
    expect(await getRelatedPlumbers("self", area)).toEqual([]);
    expect(database.queries).toEqual([]);
  });

  it("keeps an empty specific area empty instead of filling it with cross-region records", async () => {
    database.rows = [record("self", "Ballito", { area: "Ballito", profile_id: owner(1) }), record("pmb", "PMB", { area: "PMB", profile_id: owner(2) })];
    expect(await getRelatedPlumbers("self", "Ballito")).toEqual([]);
    expect(database.queries.every((query) => query.operations.some((operation) => operation.method === "in" && JSON.stringify(operation.value) === '["Ballito"]'))).toBe(true);
  });
});
