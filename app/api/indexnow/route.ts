import { NextResponse } from "next/server";
import { supabase } from "@/src/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// IndexNow ping endpoint — submits all known URLs (homepage, register/login,
// SEO content pages, plumber profiles) to the IndexNow protocol in one request.
//
// IndexNow is a free protocol that notifies Bing, Yandex, Naver, Seznam (and
// signals Google indirectly) when URLs change or are ready for indexing. One
// POST submits to all participating engines.
//
// Trigger by hitting:  https://www.kznplumbers.co.za/api/indexnow
// (or with ?secret=... + CRON_SECRET to scope from Vercel cron later)
//
// Key verification file lives at:  /001e7b24e19455300da367300ac77b65.txt
//                                  (Next.js serves /public/* at site root)
//
// Docs: https://www.indexnow.org/documentation
// ─────────────────────────────────────────────────────────────────────────────

const INDEXNOW_KEY = "001e7b24e19455300da367300ac77b65";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kznplumbers.co.za";
const SITE_HOST = new URL(SITE_URL).host;

// Never cache — we want every hit to actually re-submit.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Optional: if CRON_SECRET is set and ?secret= matches, allow it. Otherwise
  // the endpoint is open (which is fine — it just submits public URLs we want
  // indexed anyway, and IndexNow has its own rate-limiting).
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (process.env.CRON_SECRET && secret && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Bad secret" }, { status: 401 });
  }

  // Build the URL list from our own data sources (mirrors app/sitemap.ts).
  const urls: string[] = [
    SITE_URL,
    `${SITE_URL}/all-plumbers`,
    `${SITE_URL}/register`,
    `${SITE_URL}/login`,
  ];

  // SEO content pages
  try {
    const { data: seoPages } = await supabase
      .from("seo_pages")
      .select("slug")
      .eq("published", true);
    for (const p of seoPages ?? []) {
      urls.push(`${SITE_URL}/${p.slug}`);
    }
  } catch (err) {
    console.error("[indexnow] Failed to fetch seo_pages:", err);
  }

  // Plumber profiles
  try {
    const { data: plumbers } = await supabase
      .from("plumbers")
      .select("slug, id")
      .eq("is_verified", true);
    for (const p of plumbers ?? []) {
      const slug = (p as { slug: string | null; id: string }).slug ?? (p as { id: string }).id;
      urls.push(`${SITE_URL}/plumber/${slug}`);
    }
  } catch (err) {
    console.error("[indexnow] Failed to fetch plumbers:", err);
  }

  if (urls.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No URLs to submit" },
      { status: 500 },
    );
  }

  // IndexNow accepts up to 10,000 URLs per request. We're under that ceiling
  // even with 1,217 plumbers + 547 SEO pages, but if you ever grow past it,
  // split into chunks of 10k.
  const body = {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };

  let indexNowRes: Response;
  try {
    indexNowRes = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to reach IndexNow API",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const responseText = await indexNowRes.text().catch(() => "");

  // IndexNow status codes:
  //   200 — URLs successfully submitted (most common)
  //   202 — URLs accepted, queued for processing
  //   400 — Bad request (malformed payload)
  //   403 — Forbidden (key not valid / mismatched)
  //   422 — Unprocessable (URLs don't belong to host, or invalid format)
  //   429 — Too many requests (rate limited)
  return NextResponse.json({
    ok: indexNowRes.ok,
    statusCode: indexNowRes.status,
    statusText: indexNowRes.statusText,
    submitted: urls.length,
    indexNowResponse: responseText || "(empty body — success usually returns nothing)",
    sampleUrls: urls.slice(0, 5),
    keyVerificationUrl: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    note: "Status 200 or 202 = success. IndexNow then notifies Bing, Yandex, and other participating engines.",
  });
}
