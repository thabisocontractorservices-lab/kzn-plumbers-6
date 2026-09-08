import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";
import { getSitemapEntries, newestEntryDate, sitemapPath, SITEMAP_URLS_PER_FILE, type SitemapType } from "@/lib/directory-sitemaps";
import { escapeSitemapXml } from "@/lib/directory-seo";

export const dynamic = "force-dynamic";

export async function GET() {
  const types: SitemapType[] = ["core", "regions", "services", "profiles", "content", "blog"];
  try {
    const inventories = await Promise.all(types.map(async (type) => ({ type, entries: await getSitemapEntries(type) })));
    const children = inventories.flatMap(({ type, entries }) => {
      const pageCount = Math.max(1, Math.ceil(entries.length / SITEMAP_URLS_PER_FILE));
      return Array.from({ length: pageCount }, (_, index) => {
        const batch = entries.slice(index * SITEMAP_URLS_PER_FILE, (index + 1) * SITEMAP_URLS_PER_FILE);
        const lastmod = newestEntryDate(batch);
        return `  <sitemap><loc>${escapeSitemapXml(`${SITE_URL}${sitemapPath(type, index + 1)}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</sitemap>`;
      });
    });
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${children.join("\n")}
</sitemapindex>`;
    return new NextResponse(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  } catch (error) {
    console.error("[sitemap-index] Inventory unavailable", error);
    return new NextResponse("Sitemap inventory is temporarily unavailable. Please retry.",
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "300" } });
  }
}
