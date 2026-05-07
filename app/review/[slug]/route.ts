import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/src/supabaseClient";
import { reviewUrl } from "@/lib/google/places";

/**
 * GET /review/{slug}
 * Branded short link → redirects to the plumber's Google review page.
 * Used in QR codes and shareable WhatsApp links.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Resolve by slug or UUID — same caveat as /plumber/[id]: can't use .or()
  // because UUID casting on the id column errors for non-UUID strings.
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = UUID_RE.test(slug);

  const baseQuery = supabase.from("plumbers").select("google_place_id");

  const { data: plumber } = await (
    isUuid ? baseQuery.eq("id", slug) : baseQuery.eq("slug", slug)
  ).single<{ google_place_id: string | null }>();

  if (!plumber?.google_place_id) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.redirect(reviewUrl(plumber.google_place_id));
}
