import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { assertPublicRead, hasPublicColumns, requirePublicSupabase } from "@/lib/directory-read";

export const OFF_SCOPE_CONTENT = new Set(["gas-cape-town", "drain-durbanville", "general-durbanville", "geyser-durbanville"]);
export type EditorialDisposition = { index_status?: string | null; reviewed_at?: string | null };
export type SeoPage = EditorialDisposition & {
  slug: string; h1: string; meta_title: string; meta_description: string; body_html: string;
  group_name: string | null; city_focus: string | null; updated_at?: string | null;
};
export type Article = EditorialDisposition & {
  id: string; title: string; slug: string; meta_title: string | null; meta_description: string | null;
  body: string; keywords: string[] | null; publish_date: string; word_count: number | null;
  updated_at?: string | null;
};

export function approvedEditorialDisposition(page: EditorialDisposition): string | null {
  const reviewed = Date.parse(page.reviewed_at ?? "");
  return Number.isFinite(reviewed) && reviewed <= Date.now() ? page.index_status ?? null : null;
}

export function editorialIndexable(page: EditorialDisposition): boolean {
  // Future/pending workflow states are deliberately excluded; historical completeness
  // alone is never a reason to change indexing. Other dispositions need a review date.
  if (["pending", "draft", "unreviewed"].includes(page.index_status ?? "")) return false;
  return !["noindex", "remove", "merge", "redirect"].includes(approvedEditorialDisposition(page) ?? "");
}

export const getEditorialSchema = cache(async (table: "articles" | "seo_pages") => {
  const [updated, disposition, published, status, publishDate] = await Promise.all([
    hasPublicColumns(table, "updated_at"), hasPublicColumns(table, "index_status,reviewed_at"),
    table === "seo_pages" ? Promise.resolve(true) : hasPublicColumns(table, "published"),
    hasPublicColumns(table, "status"),
    table === "articles" ? Promise.resolve(true) : hasPublicColumns(table, "publish_date"),
  ]);
  return { updated, disposition, published, status, publishDate };
});

export const getSeoPage = cache(unstable_cache(async (slug: string): Promise<SeoPage | null> => {
  if (!slug || slug.length > 200 || OFF_SCOPE_CONTENT.has(slug)) return null;
  const schema = await getEditorialSchema("seo_pages");
  const selected = ["slug,h1,meta_title,meta_description,body_html,group_name,city_focus",
    schema.updated ? "updated_at" : "", schema.disposition ? "index_status,reviewed_at" : "",
  ].filter(Boolean).join(",");
  let query = requirePublicSupabase().from("seo_pages").select(selected).eq("slug", slug).eq("published", true);
  if (schema.status) query = query.or("status.eq.published,status.is.null");
  if (schema.publishDate) query = query.or(`publish_date.is.null,publish_date.lte.${new Date().toISOString()}`);
  const result = await query.maybeSingle();
  assertPublicRead("Published guide query failed", result.error);
  return result.data as unknown as SeoPage | null;
}, ["public-editorial-guide-v2"], { revalidate: 300 }));

export const getArticle = cache(unstable_cache(async (slug: string): Promise<Article | null> => {
  if (!slug || slug.length > 200 || OFF_SCOPE_CONTENT.has(slug)) return null;
  const schema = await getEditorialSchema("articles");
  const selected = ["id,title,slug,meta_title,meta_description,body,keywords,publish_date,word_count",
    schema.updated ? "updated_at" : "", schema.disposition ? "index_status,reviewed_at" : "",
  ].filter(Boolean).join(",");
  let query = requirePublicSupabase().from("articles").select(selected).eq("slug", slug).lte("publish_date", new Date().toISOString());
  if (schema.published) query = query.eq("published", true);
  if (schema.status) query = query.or("status.eq.published,status.is.null");
  const result = await query.maybeSingle();
  assertPublicRead("Published article query failed", result.error);
  return result.data as unknown as Article | null;
}, ["public-editorial-article-v2"], { revalidate: 300 }));

export type ArticleSummary = Pick<Article, "id" | "title" | "slug" | "meta_description" | "keywords" | "publish_date" | "word_count">;
export const getArticleList = cache(unstable_cache(async (page = 1, limit = 12, excludeSlug = "") => {
  const schema = await getEditorialSchema("articles");
  const size = Math.max(1, Math.min(24, limit));
  const offset = (Math.max(1, Math.min(10_000, page)) - 1) * size;
  let query = requirePublicSupabase().from("articles").select("id,title,slug,meta_description,keywords,publish_date,word_count", { count: "exact" })
    .lte("publish_date", new Date().toISOString());
  if (schema.published) query = query.eq("published", true);
  if (schema.status) query = query.or("status.eq.published,status.is.null");
  if (excludeSlug) query = query.neq("slug", excludeSlug);
  for (const slug of OFF_SCOPE_CONTENT) query = query.neq("slug", slug);
  const result = await query.order("publish_date", { ascending: false }).order("id", { ascending: true }).range(offset, offset + size - 1);
  assertPublicRead("Published article listing query failed", result.error);
  return { articles: result.data as unknown as ArticleSummary[] ?? [], total: result.count ?? 0 };
}, ["public-article-list-v2"], { revalidate: 300 }));
