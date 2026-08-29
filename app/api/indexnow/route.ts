import { NextResponse } from "next/server";
import { REGIONS } from "@/lib/regions";
import { isIndexableProfile } from "@/lib/content-quality";
import { SERVICE_GUIDES } from "@/lib/services";
import { SITE_URL } from "@/lib/site";
import { getPublicSupabase } from "@/lib/supabase/public";

const INDEXNOW_KEY = "001e7b24e19455300da367300ac77b65";
const OFF_SCOPE_CONTENT = new Set(["gas-cape-town", "drain-durbanville", "general-durbanville", "geyser-durbanville"]);
const SITE_HOST = new URL(SITE_URL).host;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!configuredSecret || authorization !== `Bearer ${configuredSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const urls = new Set<string>([
    SITE_URL,
    `${SITE_URL}/all-plumbers`,
    `${SITE_URL}/trust`,
    `${SITE_URL}/help`,
    ...REGIONS.map((region) => `${SITE_URL}/plumbers/${region.slug}`),
    ...SERVICE_GUIDES.map((service) => `${SITE_URL}/services/${service.slug}`),
  ]);
  const supabase = getPublicSupabase();

  if (supabase) {
    const content = await supabase
      .from("seo_pages")
      .select("slug, index_status")
      .eq("published", true)
      .in("index_status", ["keep", "rebuild"]);
    if (!content.error) {
      for (const page of content.data ?? []) if (!OFF_SCOPE_CONTENT.has(page.slug)) urls.add(`${SITE_URL}/${page.slug}`);
    } else {
      const fallback = await supabase.from("seo_pages").select("slug").eq("published", true);
      for (const page of fallback.data ?? []) if (!OFF_SCOPE_CONTENT.has(page.slug)) urls.add(`${SITE_URL}/${page.slug}`);
    }

    const profileRows: Array<{
      slug: string | null;
      id: string;
      profile_id: string | null;
      verification_state?: string | null;
      about: string | null;
      google_review_count: number | null;
      specialties: string[] | null;
      photos: Array<{ photo_url: string | null }> | null;
    }> = [];
    for (let from = 0; ; from += 1000) {
      let profiles = await supabase
        .from("plumbers")
        .select("slug, id, profile_id, verification_state, about, google_review_count, specialties, photos(photo_url)")
        .eq("is_verified", true)
        .range(from, from + 999);
      if (profiles.error) {
        profiles = await supabase
          .from("plumbers")
          .select("slug, id, profile_id, about, google_review_count, specialties, photos(photo_url)")
          .eq("is_verified", true)
          .range(from, from + 999) as typeof profiles;
      }
      if (profiles.error) break;
      profileRows.push(...((profiles.data ?? []) as typeof profileRows));
      if ((profiles.data?.length ?? 0) < 1000) break;
    }
    for (const plumber of profileRows.filter((item) => isIndexableProfile(item))) {
      urls.add(`${SITE_URL}/plumber/${plumber.slug ?? plumber.id}`);
    }

    const articles = await supabase.from("articles").select("slug");
    for (const article of articles.data ?? []) urls.add(`${SITE_URL}/blog/${article.slug}`);
  }

  const urlList = [...urls];
  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: SITE_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList,
    }),
  });

  return NextResponse.json({
    ok: response.ok,
    statusCode: response.status,
    submitted: urlList.length,
  }, { status: response.ok ? 200 : 502 });
}
