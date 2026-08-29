import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("technical SEO safeguards", () => {
  it("lets crawlers read page-level noindex on claim routes", () => {
    const robots = read("app/robots.ts");
    expect(robots).not.toContain('"/claim/"');
    expect(robots).not.toContain('"/review/"');
  });

  it("publishes split sitemaps for priority page types", () => {
    const index = read("app/sitemap.xml/route.ts");
    for (const type of ["core", "regions", "services", "profiles", "content", "blog"]) {
      expect(index).toContain(`"${type}"`);
    }
  });

  it("has all public trust routes", () => {
    for (const file of ["app/trust/page.tsx", "app/help/page.tsx", "app/corrections/page.tsx", "app/complaints/page.tsx"]) {
      expect(fs.existsSync(path.join(root, file))).toBe(true);
    }
  });

  it("keeps secrets and the previous hard-coded project out of the repository", () => {
    expect(fs.existsSync(path.join(root, ".env.local"))).toBe(false);
    const clientSource = read("src/supabaseClient.js");
    expect(clientSource).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(clientSource).not.toMatch(/https:\/\/[a-z0-9]{20}\.supabase\.co/);
    expect(clientSource).not.toMatch(/sb_publishable_[A-Za-z0-9_-]{20}/);
  });

  it("does not force Vercel preview URLs onto production", () => {
    const proxy = read("proxy.ts");
    expect(proxy).toContain('process.env.VERCEL_ENV === "production"');
  });

  it("keeps staging registration callbacks on the active preview host", () => {
    expect(read("app/api/register/route.ts")).toContain("request.nextUrl.origin");
  });

  it("bounds public result payloads", () => {
    expect(read("app/page.tsx")).toContain(".range(0, 11)");
    expect(read("app/api/plumbers/route.ts")).toContain(".max(24)");
    expect(read("app/all-plumbers/page.tsx")).toContain("const limit = 24");
  });
});
