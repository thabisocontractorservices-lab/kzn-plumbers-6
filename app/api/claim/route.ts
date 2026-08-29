import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { notifyNewClaim } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";

const Schema = z.object({
  plumber_id: z.string().uuid(),
  phone: z.string().trim().min(7).max(30),
});

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin && process.env.NODE_ENV === "production") {
      const originHost = new URL(origin).host;
      const requestHost = request.headers.get("host");
      if (originHost !== requestHost && originHost !== new URL(SITE_URL).host) {
        return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
      }
    }
    if (Number(request.headers.get("content-length") || 0) > 4096) {
      return NextResponse.json({ error: "Ownership request is too large" }, { status: 413 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Sign in before requesting ownership" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const parsed = Schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Check the claim details" }, { status: 400 });

    const { data: plumber } = await admin
      .from("plumbers")
      .select("id, profile_id, whatsapp_number, trading_name, slug")
      .eq("id", parsed.data.plumber_id)
      .maybeSingle();
    if (!plumber) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    if (plumber.profile_id) return NextResponse.json({ error: "This listing has already been claimed" }, { status: 409 });

    const { data: existing } = await admin
      .from("claims")
      .select("id, status")
      .eq("plumber_id", plumber.id)
      .eq("claimant_id", user.id)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "You already have a pending ownership request", status: existing.status }, { status: 409 });

    const phoneMatchObserved = normalisePhone(parsed.data.phone) === normalisePhone(plumber.whatsapp_number);
    const enriched = {
      plumber_id: plumber.id,
      claimant_id: user.id,
      phone_entered: parsed.data.phone,
      status: "pending",
      phone_match_observed: phoneMatchObserved,
      review_reason: phoneMatchObserved ? "Phone matched public record; ownership evidence still required" : "Phone differs from public record; manual evidence required",
    };
    let insert = await admin.from("claims").insert(enriched);
    if (insert.error && /column|schema cache/i.test(insert.error.message)) {
      insert = await admin.from("claims").insert({
        plumber_id: plumber.id,
        claimant_id: user.id,
        phone_entered: parsed.data.phone,
        status: "pending",
      });
    }
    if (insert.error) {
      console.error("[claim] Insert failed:", insert.error.message);
      return NextResponse.json({ error: "Ownership request could not be saved" }, { status: 503 });
    }

    void notifyNewClaim({
      tradingName: plumber.trading_name,
      claimantEmail: user.email || "unknown",
      phoneEntered: parsed.data.phone,
      phoneMatch: phoneMatchObserved,
      status: "pending",
    }).catch(() => {});

    return NextResponse.json({
      status: "pending",
      message: "Your ownership request is pending review. We may ask for additional evidence before transferring the listing.",
    }, { status: 201 });
  } catch (error) {
    console.error("[claim] Unexpected error:", error);
    return NextResponse.json({ error: "Ownership request could not be processed" }, { status: 500 });
  }
}

function normalisePhone(phone: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `27${digits.slice(1)}`;
  if (!digits.startsWith("27") && digits.length === 9) digits = `27${digits}`;
  return digits;
}
