import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const getPage = vi.fn();
const getProviders = vi.fn(async () => ({ plumbers: [], total: 0 }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement("a", { href }, children) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not found"); } }));
vi.mock("@/lib/directory-editorial", () => ({ getSeoPage: getPage, editorialIndexable: () => true, approvedEditorialDisposition: () => null }));
vi.mock("@/lib/directory-data", () => ({ getPublicPlumbers: getProviders }));
vi.mock("@/lib/redirects", () => ({ redirectIfMoved: vi.fn() }));
vi.mock("@/components/PlumberCard", () => ({ PlumberCard: () => React.createElement("span", null, "Card") }));

const page = {
  slug: "leak-newcastle", group_name: "Landing Pages", city_focus: "Newcastle",
  h1: "Leak Detection in Newcastle", meta_title: "Leak Detection in Newcastle — Verified Plumbers",
  meta_description: "Every plumber is verified", updated_at: "2026-05-13T00:00:00Z",
  body_html: "<p>Every plumber listed for Newcastle is registered.</p><p>Most Newcastle plumbers can pinpoint a leak in under an hour.</p>",
};

describe("legacy landing page rendering", () => {
  it("uses safe metadata, service matching and empty state instead of the old claims", async () => {
    getPage.mockResolvedValue(page);
    const { default: renderPage, generateMetadata } = await import("../app/[slug]/page");
    const params = Promise.resolve({ slug: page.slug });
    const metadata = await generateMetadata({ params });
    expect(metadata.title).toBe("Leak detection in Newcastle | KZN Plumbers");
    expect(metadata.description).not.toContain("verified");
    expect(metadata.alternates?.canonical).toBe("/leak-newcastle");
    const html = renderToStaticMarkup(await renderPage({ params: Promise.resolve({ slug: page.slug }) }));
    expect(html).toContain("Leak detection in Newcastle");
    expect(html).toContain("No matching directory records were found");
    expect(html).not.toContain("Most Newcastle plumbers can pinpoint");
    expect(html).not.toContain("Every plumber listed for");
    expect(getProviders).toHaveBeenCalledWith(expect.objectContaining({ areas: ["Newcastle"], specialty: "Leak detection" }));
  });
  it("preserves an individually edited page without the legacy signature", async () => {
    getPage.mockResolvedValue({ ...page, body_html: "<p>Individually reviewed guide content.</p>", meta_title: "Reviewed guide" });
    const { default: renderPage, generateMetadata } = await import("../app/[slug]/page");
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: page.slug }) });
    expect(metadata.title).toBe("Reviewed guide");
    const html = renderToStaticMarkup(await renderPage({ params: Promise.resolve({ slug: page.slug }) }));
    expect(html).toContain("Individually reviewed guide content.");
  });
});
