import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/admin/users
 *
 * Returns all profiles with their plumber data (bypasses RLS).
 * Only accessible to admin users.
 */
export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
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

    // Fetch all profiles with plumber data using service role (bypasses RLS)
    const { data: users, error } = await supabaseAdmin
      .from("profiles")
      .select("*, plumber:plumbers(id, trading_name, area, is_verified, slug)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/users] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: users ?? [] });
  } catch (err) {
    console.error("[admin/users] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
