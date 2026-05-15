import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/register
 *
 * Server-side registration that works whether email confirmation is ON or OFF.
 * Uses the service-role client to bypass RLS for the plumbers insert.
 *
 * Body: {
 *   account: { full_name, email, phone, whatsapp, password },
 *   business: { trading_name, area, hourly_rate, specialties, is_emergency,
 *               google_calendar_url?, google_place_id?, pirb_number? }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { account, business } = body;

    // ── Validate ──────────────────────────────────────────────────────────
    if (!account?.email || !account?.password || !account?.full_name) {
      return NextResponse.json(
        { error: "Missing required account fields" },
        { status: 400 },
      );
    }
    if (!business?.trading_name || !business?.area || !business?.specialties?.length) {
      return NextResponse.json(
        { error: "Missing required business fields" },
        { status: 400 },
      );
    }

    // ── 1. Create auth user ───────────────────────────────────────────────
    // Using admin API so email confirmation doesn't block us.
    // The handle_new_user trigger will create the profiles row automatically.
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: false, // Let Supabase send the confirmation email
        user_metadata: {
          full_name: account.full_name,
          role: "plumber",
        },
      });

    if (authError) {
      // Duplicate email
      if (authError.message?.includes("already been registered")) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please log in instead." },
          { status: 409 },
        );
      }
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: `Registration failed: ${authError.message}` },
        { status: 500 },
      );
    }

    const userId = authData.user.id;

    // ── 2. Update the profile with phone numbers ──────────────────────────
    // The trigger creates the profile, but phone/whatsapp aren't in metadata.
    await supabaseAdmin
      .from("profiles")
      .update({
        phone: account.phone,
        whatsapp_number: account.whatsapp,
      })
      .eq("id", userId);

    // ── 3. Insert the plumbers row (bypasses RLS via service role) ─────────
    const { error: plumberError } = await supabaseAdmin
      .from("plumbers")
      .insert({
        profile_id: userId,
        trading_name: business.trading_name,
        area: business.area,
        hourly_rate: business.hourly_rate || null,
        specialties: business.specialties,
        is_emergency: business.is_emergency ?? false,
        google_calendar_url: business.google_calendar_url || null,
        google_place_id: business.google_place_id || null,
        pirb_number: business.pirb_number || null,
        whatsapp_number: normalisePhone(account.whatsapp),
        is_certified: !!business.pirb_number,
        is_verified: false,
        availability_status: "available",
      });

    if (plumberError) {
      console.error("Plumber insert error:", plumberError);
      // Auth user was created — don't leave them orphaned.
      // Return partial success so they know account exists.
      return NextResponse.json(
        {
          error: `Account created but business profile failed: ${plumberError.message}. Contact support with email ${account.email}.`,
          partial: true,
        },
        { status: 500 },
      );
    }

    // ── 4. Send confirmation email ────────────────────────────────────────
    // admin.createUser with email_confirm: false triggers Supabase to send
    // the confirmation email automatically (if enabled in Auth settings).

    return NextResponse.json({
      success: true,
      message: "Registration complete. Please check your email to confirm your account.",
      userId,
    });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/** Strip non-digits, normalise to 27XXXXXXXXX format */
function normalisePhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "27" + digits.slice(1);
  if (!digits.startsWith("27") && digits.length === 9) digits = "27" + digits;
  return digits;
}
