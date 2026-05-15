import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyNewClaim } from "@/lib/email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/claim
 * Body: { plumber_id: string, phone: string }
 * Auth: Bearer token (Supabase access token)
 *
 * If the normalised phone matches the plumber's whatsapp_number:
 *   → auto-approve (set profile_id, mark claim auto_approved)
 * Otherwise:
 *   → create pending claim for admin review
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the user
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const { plumber_id, phone } = body;

    if (!plumber_id || !phone) {
      return NextResponse.json(
        { error: "plumber_id and phone are required" },
        { status: 400 },
      );
    }

    // 3. Fetch the plumber
    const { data: plumber, error: plumberError } = await supabaseAdmin
      .from("plumbers")
      .select("id, profile_id, whatsapp_number, trading_name")
      .eq("id", plumber_id)
      .single();

    if (plumberError || !plumber) {
      return NextResponse.json(
        { error: "Plumber not found" },
        { status: 404 },
      );
    }

    // 4. Check not already claimed
    if (plumber.profile_id) {
      return NextResponse.json(
        { error: "This listing has already been claimed" },
        { status: 409 },
      );
    }

    // 5. Check for existing pending claim from this user
    const { data: existingClaim } = await supabaseAdmin
      .from("claims")
      .select("id, status")
      .eq("plumber_id", plumber_id)
      .eq("claimant_id", user.id)
      .in("status", ["pending", "auto_approved"])
      .maybeSingle();

    if (existingClaim) {
      return NextResponse.json(
        { error: "You already have a claim for this listing", status: existingClaim.status },
        { status: 409 },
      );
    }

    // 6. Normalise & compare phone numbers
    const normInput = normalisePhone(phone);
    const normListing = normalisePhone(plumber.whatsapp_number);
    const phoneMatch = normInput === normListing && normInput.length >= 9;

    // 7. Insert claim record
    const { error: claimInsertError } = await supabaseAdmin
      .from("claims")
      .insert({
        plumber_id,
        claimant_id: user.id,
        phone_entered: phone,
        status: phoneMatch ? "auto_approved" : "pending",
        resolved_at: phoneMatch ? new Date().toISOString() : null,
      });

    if (claimInsertError) {
      console.error("Claim insert error:", claimInsertError);
      return NextResponse.json(
        { error: "Failed to submit claim" },
        { status: 500 },
      );
    }

    // 8. If phone matches → auto-link the plumber to the user profile
    if (phoneMatch) {
      // Update plumber profile_id
      const { error: linkError } = await supabaseAdmin
        .from("plumbers")
        .update({ profile_id: user.id })
        .eq("id", plumber_id);

      if (linkError) {
        console.error("Link error:", linkError);
        return NextResponse.json(
          { error: "Phone matched but failed to link listing" },
          { status: 500 },
        );
      }

      // Update user profile role to 'plumber' if not already
      await supabaseAdmin
        .from("profiles")
        .update({ role: "plumber", whatsapp_number: phone })
        .eq("id", user.id);

      // Notify admin (fire-and-forget)
      notifyNewClaim({
        tradingName: plumber.trading_name,
        claimantEmail: user.email || "unknown",
        phoneEntered: phone,
        phoneMatch: true,
        status: "auto_approved",
      }).catch(() => {});

      return NextResponse.json({
        status: "auto_approved",
        message: `${plumber.trading_name} is now linked to your account.`,
      });
    }

    // 9. Pending → admin will review — notify admin
    notifyNewClaim({
      tradingName: plumber.trading_name,
      claimantEmail: user.email || "unknown",
      phoneEntered: phone,
      phoneMatch: false,
      status: "pending",
    }).catch(() => {});

    return NextResponse.json({
      status: "pending",
      message:
        "Your claim has been submitted for manual review. We'll email you once approved.",
    });
  } catch (err) {
    console.error("Claim error:", err);
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
