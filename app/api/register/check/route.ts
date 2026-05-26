import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/register/check
 * Body: { email: string }
 *
 * Checks if an auth user already exists for this email.
 * Used by the registration form to avoid calling signUp() again
 * (which would send duplicate confirmation emails).
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ exists: false });
    }

    // Check profiles table first (fast)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (profile) {
      return NextResponse.json({ exists: true, hasProfile: true });
    }

    // Fallback: check auth users
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    const match = usersData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );

    return NextResponse.json({
      exists: !!match,
      hasProfile: false,
    });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
