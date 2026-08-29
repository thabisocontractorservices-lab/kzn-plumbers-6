import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAreaConfig, getServiceConfig } from "@/lib/directory";
import { getPublicSupabase } from "@/lib/supabase/public";

const QuerySchema = z.object({
  q: z.string().trim().max(80).optional().default(""),
  area: z.string().trim().max(40).optional().default(""),
  service: z.string().trim().max(40).optional().default(""),
  filter: z.enum(["all", "credential", "claimed", "available", "emergency"]).optional().default("all"),
  sort: z.enum(["recommended", "rated", "name"]).optional().default("recommended"),
  page: z.coerce.number().int().min(1).max(100).optional().default(1),
  limit: z.coerce.number().int().min(1).max(24).optional().default(12),
});

const SELECT = `
  id,
  profile_id,
  trading_name,
  slug,
  area,
  hourly_rate,
  specialties,
  is_emergency,
  is_certified,
  is_verified,
  availability_status,
  google_rating,
  google_review_count,
  whatsapp_number,
  pirb_number,
  verification_state,
  verification_rank,
  credential_verified_at,
  verification_expires_at,
  last_checked_at,
  response_time_minutes,
  accepts_new_work,
  photos(photo_url, is_profile_photo),
  certifications(id, cert_name)
`;

export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
  }

  const supabase = getPublicSupabase();
  if (!supabase) {
    return NextResponse.json(
      { plumbers: [], total: 0, page: 1, hasMore: false, unavailable: true },
      { status: 503 },
    );
  }

  const { q, area, service, filter, sort, page, limit } = parsed.data;
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const areaConfig = getAreaConfig(area);
  const serviceConfig = getServiceConfig(service);

  let query = supabase
    .from("plumbers")
    .select(SELECT, { count: "exact" })
    .eq("is_verified", true);

  if (areaConfig) query = query.in("area", [...areaConfig.dbAreas]);
  if (serviceConfig) query = query.contains("specialties", [serviceConfig.dbValue]);

  if (filter === "credential") {
    query = query.eq("verification_state", "credential_verified");
  } else if (filter === "claimed") {
    query = query.not("profile_id", "is", null);
  } else if (filter === "available") {
    query = query.eq("availability_status", "available").eq("accepts_new_work", true);
  } else if (filter === "emergency") {
    query = query.eq("is_emergency", true);
  }

  if (q) {
    const safe = q.replace(/[^a-zA-Z0-9\s&-]/g, " ").replace(/\s+/g, " ").trim();
    if (safe) {
      query = query.or(
        `trading_name.ilike.%${safe}%,area.ilike.%${safe}%,about.ilike.%${safe}%`,
      );
    }
  }

  if (sort === "name") {
    query = query.order("trading_name", { ascending: true });
  } else {
    query = query
      .order("verification_rank", { ascending: true })
      .order("profile_id", { ascending: false, nullsFirst: false })
      .order("google_rating", { ascending: false, nullsFirst: false })
      .order("google_review_count", { ascending: false, nullsFirst: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    // The public experience remains deployable before the optional growth migration.
    // Fall back to columns that exist in the original schema.
    let fallback = supabase
      .from("plumbers")
      .select(
        "id, profile_id, trading_name, slug, area, hourly_rate, specialties, is_emergency, is_certified, is_verified, availability_status, google_rating, google_review_count, whatsapp_number, pirb_number, photos(photo_url, is_profile_photo), certifications(id, cert_name)",
        { count: "exact" },
      )
      .eq("is_verified", true);

    if (areaConfig) fallback = fallback.in("area", [...areaConfig.dbAreas]);
    if (serviceConfig) fallback = fallback.contains("specialties", [serviceConfig.dbValue]);
    if (filter === "claimed") fallback = fallback.not("profile_id", "is", null);
    if (filter === "available") fallback = fallback.eq("availability_status", "available");
    if (filter === "emergency") fallback = fallback.eq("is_emergency", true);
    if (filter === "credential") fallback = fallback.eq("is_certified", true).not("pirb_number", "is", null);
    if (q) {
      const safe = q.replace(/[^a-zA-Z0-9\s&-]/g, " ").replace(/\s+/g, " ").trim();
      if (safe) fallback = fallback.or(`trading_name.ilike.%${safe}%,area.ilike.%${safe}%`);
    }

    fallback = sort === "name"
      ? fallback.order("trading_name", { ascending: true })
      : fallback
          .order("profile_id", { ascending: false, nullsFirst: false })
          .order("google_rating", { ascending: false, nullsFirst: false })
          .order("google_review_count", { ascending: false, nullsFirst: false });

    const retry = await fallback.range(from, to);
    if (retry.error) {
      console.error("[api/plumbers] Query failed:", retry.error.message);
      return NextResponse.json({ error: "Directory search is temporarily unavailable" }, { status: 503 });
    }

    return NextResponse.json(
      {
        plumbers: retry.data ?? [],
        total: retry.count ?? 0,
        page,
        hasMore: from + (retry.data?.length ?? 0) < (retry.count ?? 0),
        schemaFallback: true,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  }

  return NextResponse.json(
    {
      plumbers: data ?? [],
      total: count ?? 0,
      page,
      hasMore: from + (data?.length ?? 0) < (count ?? 0),
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
