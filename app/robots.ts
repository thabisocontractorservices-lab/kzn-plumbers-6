import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kznplumbers.co.za";

// Auto-generated /robots.txt — tells search engines what to crawl
// and where to find the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/admin",
          "/auth",
          "/api",
          "/review/", // short link redirects, no SEO value
          "/claim/",  // action pages, not content — no SEO value
          "/login",
          "/register",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
