import type { MetadataRoute } from "next";
import { supabase } from "@/src/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// Auto-generated sitemap.xml at /sitemap.xml
//
// Includes:
//   • Homepage (/)
//   • Register page (/register)
//   • All published SEO content pages (from seo_pages table)
//   • All verified plumber profiles (from plumbers table)
//
// Refreshes every hour. Excludes admin, dashboard, and auth routes.
// ─────────────────────────────────────────────────────────────────────────────

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kznplumbers.co.za";

export const revalidate = 3600; // refresh hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Fetch SEO content pages — fall through to empty array if Supabase unreachable
  let seoPages: Array<{ slug: string }> = [];
  try {
    const { data } = await supabase
      .from("seo_pages")
      .select("slug")
      .eq("published", true);
    seoPages = data ?? [];
  } catch (err) {
    console.error("[sitemap] Failed to fetch seo_pages:", err);
  }

  // Fetch verified plumber profiles
  let plumbers: Array<{
    slug: string | null;
    id: string;
    updated_at: string | null;
  }> = [];
  try {
    const { data } = await supabase
      .from("plumbers")
      .select("slug, id, updated_at")
      .eq("is_verified", true);
    plumbers = data ?? [];
  } catch (err) {
    console.error("[sitemap] Failed to fetch plumbers:", err);
  }

  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/all-plumbers`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/register`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  // SEO content pages — high priority since these target search traffic
  for (const page of seoPages) {
    entries.push({
      url: `${SITE_URL}/${page.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Plumber profiles
  for (const p of plumbers) {
    const slug = p.slug ?? p.id;
    entries.push({
      url: `${SITE_URL}/plumber/${slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return entries;
}
