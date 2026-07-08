import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/register/homeowner
 *
 * Creates a homeowner account instantly — no email confirmation required.
 * Uses the admin API to create a pre-confirmed user.
 *
 * Body: { name, email, area, password }
 */
export async function POST(req: NextRequest) {
  try {
    const { name, email, area, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }

    // Check if user already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in instead.", alreadyExists: true },
        { status: 409 },
      );
    }

    // Create user via admin API — auto-confirmed, no email sent
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true, // auto-confirm — no confirmation email
      user_metadata: {
        full_name: name,
        role: "homeowner",
      },
    });

    if (createError) {
      console.error("[homeowner signup] Create user error:", createError);

      if (createError.message?.includes("already been registered")) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please log in instead.", alreadyExists: true },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { error: createError.message },
        { status: 500 },
      );
    }

    if (!newUser?.user) {
      return NextResponse.json(
        { error: "Failed to create account" },
        { status: 500 },
      );
    }

    // Ensure profile exists with correct data
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", newUser.user.id)
      .maybeSingle();

    if (!profile) {
      await supabaseAdmin.from("profiles").insert({
        id: newUser.user.id,
        email: email.toLowerCase(),
        full_name: name,
        role: "homeowner",
      });
    } else {
      await supabaseAdmin.from("profiles").update({
        full_name: name,
        role: "homeowner",
      }).eq("id", newUser.user.id);
    }

    return NextResponse.json({
      success: true,
      userId: newUser.user.id,
      email: email.toLowerCase(),
      name,
    });
  } catch (err) {
    console.error("[homeowner signup] Error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
