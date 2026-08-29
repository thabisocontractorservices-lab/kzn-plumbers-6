import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/admin/plumber-detail?id=xxx
 *
 * Returns full plumber data including photos, certs, reviews, bookings.
 * Bypasses RLS so admin can view everything.
 * Read-only — no mutations.
 */
export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const plumberId = req.nextUrl.searchParams.get("id");
    if (!plumberId) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    // Fetch full plumber data with all related tables
    const { data: plumber, error: plumberError } = await supabaseAdmin
      .from("plumbers")
      .select("*")
      .eq("id", plumberId)
      .single();

    if (plumberError || !plumber) {
      return NextResponse.json({ error: "Plumber not found" }, { status: 404 });
    }

    // Fetch related data in parallel
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [photosRes, profilePhotoRes, certsRes, bookingsRes, leadEventsRes] = await Promise.all([
      supabaseAdmin
        .from("photos")
        .select("id", { count: "exact", head: true })
        .eq("plumber_id", plumberId),
      supabaseAdmin
        .from("photos")
        .select("id", { count: "exact", head: true })
        .eq("plumber_id", plumberId)
        .eq("is_profile_photo", true),
      supabaseAdmin
        .from("certifications")
        .select("id", { count: "exact", head: true })
        .eq("plumber_id", plumberId),
      supabaseAdmin
        .from("bookings")
        .select("*")
        .eq("plumber_id", plumberId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin
        .from("lead_events")
        .select("event_name")
        .eq("plumber_id", plumberId)
        .gte("created_at", thirtyDaysAgo),
    ]);

    const leadCounts = { whatsapp_click: 0, call_click: 0, booking_complete: 0 };
    for (const event of leadEventsRes.data ?? []) {
      if (event.event_name in leadCounts) leadCounts[event.event_name as keyof typeof leadCounts] += 1;
    }

    return NextResponse.json({
      plumber: {
        ...plumber,
        has_photos: (photosRes.count ?? 0) > 0,
        has_profile_photo: (profilePhotoRes.count ?? 0) > 0,
        has_certs: (certsRes.count ?? 0) > 0,
      },
      bookings: bookingsRes.data ?? [],
      lead_counts: leadCounts,
    });
  } catch (err) {
    console.error("[admin/plumber-detail] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
