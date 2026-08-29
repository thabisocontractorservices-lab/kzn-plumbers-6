import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export function GET() {
  const lastModified = new Date().toISOString();
  const types = ["core", "regions", "services", "profiles", "content", "blog"];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${types.map((type) => `  <sitemap><loc>${SITE_URL}/sitemaps/${type}.xml</loc><lastmod>${lastModified}</lastmod></sitemap>`).join("\n")}
</sitemapindex>`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
