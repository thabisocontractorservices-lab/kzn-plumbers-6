import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/utils/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/admin/plumbers
 *
 * Returns ALL plumbers (bypasses RLS) for admin dashboard viewing.
 * Only accessible to admin users.
 */
export async function GET(req: NextRequest) {
  try {
    // Verify caller is admin
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

    // Fetch ALL plumbers using service role (bypasses RLS)
    const { data: plumbers, error } = await supabaseAdmin
      .from("plumbers")
      .select("id, trading_name, slug, profile_id, is_verified, area")
      .order("trading_name")
      .limit(500);

    if (error) {
      console.error("[admin/plumbers] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ plumbers: plumbers ?? [] });
  } catch (err) {
    console.error("[admin/plumbers] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
