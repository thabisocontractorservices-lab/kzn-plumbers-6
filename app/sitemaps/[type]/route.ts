import { NextRequest, NextResponse } from "next/server";
import { REGIONS } from "@/lib/regions";
import { isIndexableProfile } from "@/lib/content-quality";
import { SERVICE_GUIDES } from "@/lib/services";
import { SITE_URL } from "@/lib/site";
import { getPublicSupabase } from "@/lib/supabase/public";

export const revalidate = 3600;

const VALID_TYPES = new Set(["core", "regions", "services", "profiles", "content", "blog"]);
const OFF_SCOPE_CONTENT = new Set(["gas-cape-town", "drain-durbanville", "general-durbanville", "geyser-durbanville"]);

type UrlEntry = {
  loc: string;
  lastmod?: string | null;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type: rawType } = await params;
  const type = rawType.replace(/\.xml$/, "");
  if (!VALID_TYPES.has(type)) return new NextResponse("Not found", { status: 404 });

  const entries = await getEntries(type);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((entry) => {
  const lastmod = validDate(entry.lastmod);
  return `  <url><loc>${escapeXml(entry.loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : ""}</url>`;
}).join("\n")}
</urlset>`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

async function getEntries(type: string): Promise<UrlEntry[]> {
  const now = new Date().toISOString();
  if (type === "core") {
    return [
      "/", "/all-plumbers", "/about", "/contact", "/trust", "/help",
      "/corrections", "/complaints", "/privacy", "/terms", "/resources",
      "/resources/plumbing-coc-kzn", "/resources/water-leak-or-outage-kzn",
    ].map((path) => ({ loc: `${SITE_URL}${path === "/" ? "" : path}`, lastmod: now, changefreq: "monthly" as const }));
  }
  if (type === "regions") {
    return REGIONS.map((region) => ({ loc: `${SITE_URL}/plumbers/${region.slug}`, lastmod: now, changefreq: "daily" as const }));
  }
  if (type === "services") {
    return SERVICE_GUIDES.map((service) => ({ loc: `${SITE_URL}/services/${service.slug}`, lastmod: now, changefreq: "daily" as const }));
  }

  const supabase = getPublicSupabase();
  if (!supabase) return [];

  if (type === "profiles") {
    const plumbers: Array<{
      id: string;
      slug: string | null;
      updated_at: string | null;
      profile_id: string | null;
      verification_state?: string | null;
      about: string | null;
      google_review_count: number | null;
      specialties: string[] | null;
      photos: Array<{ photo_url: string | null }> | null;
    }> = [];
    for (let from = 0; ; from += 1000) {
      let result = await supabase
        .from("plumbers")
        .select("id, slug, updated_at, profile_id, verification_state, about, google_review_count, specialties, photos(photo_url)")
        .eq("is_verified", true)
        .order("updated_at", { ascending: false })
        .range(from, from + 999);
      if (result.error) {
        result = await supabase
          .from("plumbers")
          .select("id, slug, updated_at, profile_id, about, google_review_count, specialties, photos(photo_url)")
          .eq("is_verified", true)
          .order("updated_at", { ascending: false })
          .range(from, from + 999) as typeof result;
      }
      if (result.error) return [];
      plumbers.push(...((result.data ?? []) as typeof plumbers));
      if ((result.data?.length ?? 0) < 1000) break;
    }
    return plumbers.filter((plumber) => isIndexableProfile(plumber)).map((plumber) => ({
      loc: `${SITE_URL}/plumber/${plumber.slug ?? plumber.id}`,
      lastmod: plumber.updated_at,
      changefreq: "monthly" as const,
    }));
  }

  if (type === "blog") {
    const { data, error } = await supabase
      .from("articles")
      .select("slug, publish_date")
      .order("publish_date", { ascending: false });
    if (error) return [];
    return [
      { loc: `${SITE_URL}/blog`, lastmod: now, changefreq: "weekly" as const },
      ...(data ?? []).map((article) => ({
        loc: `${SITE_URL}/blog/${article.slug}`,
        lastmod: article.publish_date,
        changefreq: "monthly" as const,
      })),
    ];
  }

  const rich = await supabase
    .from("seo_pages")
    .select("slug, updated_at, index_status")
    .eq("published", true)
    .in("index_status", ["keep", "rebuild"])
    .order("updated_at", { ascending: false });

  if (!rich.error) {
    return (rich.data ?? []).filter((page) => !OFF_SCOPE_CONTENT.has(page.slug)).map((page) => ({
      loc: `${SITE_URL}/${page.slug}`,
      lastmod: page.updated_at,
      changefreq: "monthly" as const,
    }));
  }

  const fallback = await supabase.from("seo_pages").select("slug").eq("published", true);
  if (fallback.error) return [];
  return (fallback.data ?? []).filter((page) => !OFF_SCOPE_CONTENT.has(page.slug)).map((page) => ({ loc: `${SITE_URL}/${page.slug}`, lastmod: now, changefreq: "monthly" as const }));
}

function validDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
