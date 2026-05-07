import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPlaceDetails, PlacesAPIError } from "@/lib/google/places";

/**
 * Vercel Cron: GET /api/cron/refresh-google
 * Runs daily (see vercel.json) to refresh Google rating + reviews for all
 * plumbers with a google_place_id.
 *
 * Authentication: Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically.
 *
 * NOTE: This route creates its own admin Supabase client (service role key)
 * inline because the cron job needs to bypass RLS. The shared
 * src/supabaseClient.js uses the public/anon key and is RLS-bound.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: plumbers, error } = await admin
    .from("plumbers")
    .select("id, google_place_id")
    .not("google_place_id", "is", null)
    .eq("is_verified", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const p of plumbers ?? []) {
    if (!p.google_place_id) continue;
    try {
      const details = await getPlaceDetails(p.google_place_id);

      await admin
        .from("plumbers")
        .update({
          google_rating: details.rating ?? null,
          google_review_count: details.userRatingCount ?? 0,
          google_reviews_synced_at: new Date().toISOString(),
        })
        .eq("id", p.id);

      if (details.reviews?.length) {
        await admin.from("google_reviews").delete().eq("plumber_id", p.id);
        await admin.from("google_reviews").insert(
          details.reviews.slice(0, 5).map((r) => ({
            plumber_id: p.id,
            reviewer_name: r.authorAttribution.displayName,
            rating: r.rating,
            text: r.text?.text ?? r.originalText?.text ?? null,
            google_author_url: r.authorAttribution.uri ?? null,
            profile_photo_url: r.authorAttribution.photoUri ?? null,
            review_time: r.publishTime,
          })),
        );
      }

      results.push({ id: p.id, ok: true });
    } catch (err) {
      results.push({
        id: p.id,
        ok: false,
        error: err instanceof PlacesAPIError ? err.message : (err as Error).message,
      });
    }
  }

  return NextResponse.json({
    refreshed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
