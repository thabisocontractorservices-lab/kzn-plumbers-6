import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { isIndexableProfile } from "@/lib/content-quality";
import { OFF_SCOPE_CONTENT, editorialIndexable, getEditorialSchema, type EditorialDisposition } from "@/lib/directory-editorial";
import { assertPublicRead, hasPublicColumns, requirePublicSupabase } from "@/lib/directory-read";
import { realPastDate } from "@/lib/directory-seo";
import { REGIONS } from "@/lib/regions";
import { SERVICE_GUIDES } from "@/lib/services";
import { SITE_URL } from "@/lib/site";

export type SitemapType = "core" | "regions" | "services" | "profiles" | "content" | "blog";
export type SitemapEntry = { loc: string; lastmod?: string | null };
export const SITEMAP_URLS_PER_FILE = 40_000;
const BATCH_SIZE = 500;

type InventoryRow = EditorialDisposition & {
  id?: string; slug?: string | null; updated_at?: string | null; publish_date?: string | null;
  record_status?: string | null; index_reviewed_at?: string | null;
};

/** Keyset pagination also works when the existing Supabase response cap is below 500. */
const readInventory = cache(unstable_cache(async (type: "profiles" | "content" | "blog"): Promise<SitemapEntry[]> => {
  const client = requirePublicSupabase();
  const table = type === "profiles" ? "plumbers" : type === "content" ? "seo_pages" : "articles";
  const cursorColumn = type === "content" ? "slug" : "id";
  const editorial = type === "profiles" ? null : await getEditorialSchema(type === "content" ? "seo_pages" : "articles");
  const [recordStatus, profileDisposition, profileUpdated] = type === "profiles" ? await Promise.all([
    hasPublicColumns("plumbers", "record_status"), hasPublicColumns("plumbers", "index_status,index_reviewed_at"),
    hasPublicColumns("plumbers", "updated_at"),
  ]) : [false, false, false];
  const selected = [type === "content" ? "slug" : "id,slug",
    (editorial?.updated || profileUpdated) ? "updated_at" : "",
    type === "blog" ? "publish_date" : "",
    editorial?.disposition ? "index_status,reviewed_at" : "",
    profileDisposition ? "index_status,index_reviewed_at" : "",
    recordStatus ? "record_status" : "",
  ].filter(Boolean).join(",");
  const entries: SitemapEntry[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  // A stable timestamp throughout this traversal avoids moving future-publication boundaries.
  const publishedBefore = new Date().toISOString();
  for (;;) {
    let query = client.from(table).select(selected).order(cursorColumn, { ascending: true }).limit(BATCH_SIZE);
    if (type === "profiles") {
      query = query.eq("is_verified", true);
      if (recordStatus) query = query.eq("record_status", "published");
    } else {
      if (editorial?.published) query = query.eq("published", true);
      if (editorial?.status) query = query.or("status.eq.published,status.is.null");
      if (editorial?.publishDate) query = type === "content"
        ? query.or(`publish_date.is.null,publish_date.lte.${publishedBefore}`)
        : query.lte("publish_date", publishedBefore);
    }
    if (cursor) query = query.gt(cursorColumn, cursor);
    const result = await query;
    assertPublicRead(`${type} sitemap inventory read failed`, result.error);
    const rows = result.data as unknown as InventoryRow[] ?? [];
    if (!rows.length) break;
    for (const row of rows) {
      if (row.slug && OFF_SCOPE_CONTENT.has(row.slug) && type !== "profiles") continue;
      if (type === "profiles" ? !isIndexableProfile(row) : !editorialIndexable(row)) continue;
      const path = type === "profiles" ? `/plumber/${row.slug || row.id}` : type === "blog" ? `/blog/${row.slug}` : `/${row.slug}`;
      if (seen.has(path)) continue;
      seen.add(path);
      entries.push({ loc: `${SITE_URL}${path}`, lastmod: realPastDate(row.updated_at) ?? (type === "blog" ? realPastDate(row.publish_date) : null) });
    }
    const nextCursor: string | undefined | null = rows[rows.length - 1][cursorColumn];
    if (!nextCursor || nextCursor === cursor) throw new Error(`Non-advancing ${type} sitemap cursor`);
    cursor = nextCursor;
  }
  if (type === "blog") entries.unshift({ loc: `${SITE_URL}/blog`, lastmod: newestEntryDate(entries) });
  return entries;
}, ["public-sitemap-inventory-v3"], { revalidate: 300, tags: ["public-directory"] }));

export async function getSitemapEntries(type: SitemapType): Promise<SitemapEntry[]> {
  // Omit lastmod for code-authored pages without a trustworthy content-change date.
  if (type === "core") return ["/", "/all-plumbers", "/about", "/contact", "/trust", "/help", "/corrections", "/complaints", "/privacy", "/terms", "/resources", "/resources/plumbing-coc-kzn", "/resources/water-leak-or-outage-kzn"]
    .map((path) => ({ loc: `${SITE_URL}${path === "/" ? "" : path}` }));
  if (type === "regions") return REGIONS.map((region) => ({ loc: `${SITE_URL}/plumbers/${region.slug}` }));
  if (type === "services") return SERVICE_GUIDES.map((service) => ({ loc: `${SITE_URL}/services/${service.slug}` }));
  return readInventory(type);
}

export function sitemapPath(type: SitemapType, page = 1): string {
  return `/sitemaps/${type}${page > 1 ? `-${page}` : ""}.xml`;
}

export function newestEntryDate(entries: SitemapEntry[]): string | null {
  return entries.reduce<string | null>((newest, entry) => {
    const date = realPastDate(entry.lastmod);
    return date && (!newest || date > newest) ? date : newest;
  }, null);
}
