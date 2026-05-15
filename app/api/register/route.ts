import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/register
 *
 * Step 2 of registration — called AFTER the client-side signUp() which
 * creates the auth user and sends the confirmation email.
 *
 * This route uses the service-role client to:
 * 1. Look up the user by email (verify they exist)
 * 2. Update their profile with phone numbers
 * 3. Insert the plumbers row (bypasses RLS)
 *
 * Body: {
 *   email: string,           // Used to look up the auth user
 *   phone: string,
 *   whatsapp: string,
 *   business: { trading_name, area, hourly_rate, specialties, is_emergency,
 *               google_calendar_url?, google_place_id?, pirb_number? }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, phone, whatsapp, business } = body;

    // ── Validate ──────────────────────────────────────────────────────────
    if (!email) {
      return NextResponse.json(
        { error: "Missing email" },
        { status: 400 },
      );
    }
    if (!business?.trading_name || !business?.area || !business?.specialties?.length) {
      return NextResponse.json(
        { error: "Missing required business fields" },
        { status: 400 },
      );
    }

    // ── 1. Look up the auth user by email ─────────────────────────────────
    // The client already called signUp() which created the user + sent
    // the confirmation email. We just need to find them.
    const { data: usersData, error: listError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error("List users error:", listError);
      return NextResponse.json(
        { error: "Failed to verify account" },
        { status: 500 },
      );
    }

    const user = usersData.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );

    if (!user) {
      return NextResponse.json(
        { error: "Account not found. Please try registering again." },
        { status: 404 },
      );
    }

    const userId = user.id;

    // ── 2. Update the profile with phone numbers ──────────────────────────
    await supabaseAdmin
      .from("profiles")
      .update({
        phone: phone || null,
        whatsapp_number: whatsapp || null,
      })
      .eq("id", userId);

    // ── 3. Check if plumber row already exists (idempotent) ───────────────
    const { data: existing } = await supabaseAdmin
      .from("plumbers")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "Business profile already exists.",
        userId,
      });
    }

    // ── 4. Insert the plumbers row (bypasses RLS via service role) ─────────
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
        whatsapp_number: normalisePhone(whatsapp),
        is_certified: !!business.pirb_number,
        is_verified: false,
        availability_status: "available",
      });

    if (plumberError) {
      console.error("Plumber insert error:", plumberError);
      return NextResponse.json(
        {
          error: `Account created but business profile failed: ${plumberError.message}. Contact support with email ${email}.`,
          partial: true,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Registration complete. Please confirm your email to log in.",
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
