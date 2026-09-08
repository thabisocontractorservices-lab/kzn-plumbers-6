import { NextRequest, NextResponse } from "next/server";
import { getSitemapEntries, SITEMAP_URLS_PER_FILE, type SitemapType } from "@/lib/directory-sitemaps";
import { escapeSitemapXml, realPastDate } from "@/lib/directory-seo";

export const dynamic = "force-dynamic";
const VALID_TYPES = new Set(["core", "regions", "services", "profiles", "content", "blog"]);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type: rawType } = await params;
  const match = /^(core|regions|services|profiles|content|blog)(?:-([1-9]\d*))?(?:\.xml)?$/.exec(rawType);
  if (!match || !VALID_TYPES.has(match[1])) return new NextResponse("Not found", { status: 404 });
  const type = match[1] as SitemapType;
  const page = Number(match[2] ?? "1");
  if (!Number.isSafeInteger(page)) return new NextResponse("Not found", { status: 404 });
  try {
    const inventory = await getSitemapEntries(type);
    const pageCount = Math.max(1, Math.ceil(inventory.length / SITEMAP_URLS_PER_FILE));
    if (page > pageCount) return new NextResponse("Not found", { status: 404 });
    const entries = inventory.slice((page - 1) * SITEMAP_URLS_PER_FILE, page * SITEMAP_URLS_PER_FILE);
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((entry) => {
  const lastmod = realPastDate(entry.lastmod);
  return `  <url><loc>${escapeSitemapXml(entry.loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
}).join("\n")}
</urlset>`;
    return new NextResponse(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  } catch (error) {
    console.error(`[sitemap:${type}] Inventory unavailable`, error);
    // Never replace a failed read with an empty successful sitemap.
    return new NextResponse("Sitemap inventory is temporarily unavailable. Please retry.",
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "300" } });
  }
}
