import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyNewRegistration } from "@/lib/email";

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
 * Uses the service-role client to bypass RLS.
 *
 * Body: {
 *   email: string,
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
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }
    if (!business?.trading_name || !business?.area || !business?.specialties?.length) {
      return NextResponse.json(
        { error: "Missing required business fields (trading name, area, specialties)" },
        { status: 400 },
      );
    }

    // ── 1. Find the auth user by email ────────────────────────────────────
    // Use profiles table (auto-created by trigger) instead of listUsers()
    // which only returns the first page (50 users).
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    // Fallback: if profile not found (trigger may not have fired yet or
    // email casing differs), search auth users directly.
    let userId: string | null = profile?.id ?? null;

    if (!userId) {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000,
      });
      const match = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
      );
      userId = match?.id ?? null;
    }

    if (!userId) {
      console.error(`[register] User not found for email: ${email}`);
      return NextResponse.json(
        { error: "Account not found. Please try registering again, or log in if you already have an account." },
        { status: 404 },
      );
    }

    // ── 2. Update the profile with phone numbers ──────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        phone_number: phone || null,
        whatsapp_number: whatsapp || null,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[register] Profile update error:", updateError);
      // Non-fatal — continue to insert plumber row
    }

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
        plumberId: existing.id,
      });
    }

    // ── 4. Insert the plumbers row (bypasses RLS via service role) ─────────
    const { data: newPlumber, error: plumberError } = await supabaseAdmin
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
      })
      .select("id")
      .single();

    if (plumberError) {
      console.error("[register] Plumber insert error:", plumberError);
      return NextResponse.json(
        { error: `Failed to create business profile: ${plumberError.message}` },
        { status: 500 },
      );
    }

    // ── 5. Notify admin (fire-and-forget) ─────────────────────────────────
    notifyNewRegistration({
      tradingName: business.trading_name,
      area: business.area,
      email,
      phone: phone || whatsapp || "—",
      specialties: business.specialties,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Registration complete. Your application is under review.",
      plumberId: newPlumber.id,
    });
  } catch (err) {
    console.error("[register] Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again or contact support." },
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
