import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: (...a: unknown[]) => unknown) => fn }));
const redirected: string[] = [];
vi.mock("next/navigation", () => ({ permanentRedirect: (to: string) => { redirected.push(to); throw new Error("NEXT_REDIRECT"); } }));
const rules = [
  { source_path: "/plumber/sipho-plumbing-solutions", destination_path: "/plumber/sipho-plumbing-solutions-1" },
  { source_path: "/plumber/a", destination_path: "/plumber/b" },
  { source_path: "/plumber/b", destination_path: "/plumber/c" },
  { source_path: "/plumber/loop", destination_path: "/plumber/loop" },
  { source_path: "/plumber/evil", destination_path: "//evil.example.com" },
];
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: rules, error: null }) }) }) }) }),
}));

describe("profile redirects", async () => {
  const { findRedirect, redirectIfMoved } = await import("../lib/redirects");
  beforeEach(() => { redirected.length = 0; });

  it("sends a renamed profile to its new address", async () => {
    expect(await findRedirect("/plumber/sipho-plumbing-solutions")).toBe("/plumber/sipho-plumbing-solutions-1");
    expect(await findRedirect("/plumber/Sipho-Plumbing-Solutions/")).toBe("/plumber/sipho-plumbing-solutions-1");
  });
  it("follows chains in one hop for visitors and Google", async () => {
    expect(await findRedirect("/plumber/a")).toBe("/plumber/c");
  });
  it("ignores loops, unknown pages and off-site targets", async () => {
    expect(await findRedirect("/plumber/loop")).toBeNull();
    expect(await findRedirect("/plumber/unknown")).toBeNull();
    expect(await findRedirect("/plumber/evil")).toBeNull();
  });
  it("redirects permanently only when a rule exists", async () => {
    await expect(redirectIfMoved("/plumber/sipho-plumbing-solutions")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirected).toEqual(["/plumber/sipho-plumbing-solutions-1"]);
    await expect(redirectIfMoved("/plumber/unknown")).resolves.toBeUndefined();
  });
});
