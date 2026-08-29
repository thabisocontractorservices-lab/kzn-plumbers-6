import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { notifyNewRegistration } from "@/lib/email";
import { KZN_AREAS, SPECIALTIES, formatWhatsApp, isValidSAPhone } from "@/lib/utils";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createUploadToken } from "@/lib/upload-token";
import { SITE_URL } from "@/lib/site";

const BusinessSchema = z.object({
  trading_name: z.string().trim().min(2).max(160),
  area: z.enum(KZN_AREAS),
  hourly_rate: z.coerce.number().int().min(0).max(100000).nullable().optional(),
  specialties: z.array(z.enum(SPECIALTIES)).min(1).max(SPECIALTIES.length),
  is_emergency: z.boolean().default(false),
  google_calendar_url: z.string().trim().url().max(500).or(z.literal("")).optional(),
  google_place_id: z.string().trim().max(250).optional(),
  pirb_number: z.string().trim().max(80).optional(),
});

const Schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().refine(isValidSAPhone, "Invalid South African cellphone number"),
  whatsapp: z.string().trim().refine(isValidSAPhone, "Invalid South African WhatsApp number"),
  password: z.string().min(8).max(128).optional(),
  business: BusinessSchema,
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
    if (Number(request.headers.get("content-length") || 0) > 16384) {
      return NextResponse.json({ error: "Registration request is too large" }, { status: 413 });
    }

    const parsed = Schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Check the registration details", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const input = parsed.data;
    const authHeader = request.headers.get("authorization");
    let userId: string;
    let needsEmailConfirmation = false;

    if (authHeader?.startsWith("Bearer ")) {
      const { data: { user }, error } = await admin.auth.getUser(authHeader.slice(7));
      if (error || !user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
      userId = user.id;
      if (user.email && user.email.toLowerCase() !== input.email.toLowerCase()) {
        return NextResponse.json({ error: "Use the email address for your signed-in account" }, { status: 400 });
      }
    } else {
      if (!input.password) return NextResponse.json({ error: "Password is required" }, { status: 400 });
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !publishableKey) throw new Error("Supabase public credentials are unavailable");
      const authClient = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await authClient.auth.signUp({
        email: input.email.toLowerCase(),
        password: input.password,
        options: {
          emailRedirectTo: `${request.nextUrl.origin}/auth/callback?next=/dashboard`,
          data: { full_name: input.full_name, role: "plumber" },
        },
      });
      if (error) {
        const duplicate = /already|registered|exists/i.test(error.message);
        return NextResponse.json({ error: duplicate ? "An account with this email already exists. Sign in before adding a business." : "Account creation failed. Please try again." }, { status: duplicate ? 409 : 400 });
      }
      if (!data.user || data.user.identities?.length === 0) {
        return NextResponse.json({ error: "An account with this email already exists. Sign in before adding a business." }, { status: 409 });
      }
      userId = data.user.id;
      needsEmailConfirmation = !data.session;
    }

    const { data: existing } = await admin.from("plumbers").select("id").eq("profile_id", userId).maybeSingle();
    if (existing) return NextResponse.json({ error: "This account already has a business profile", plumberId: existing.id }, { status: 409 });

    const profilePayload = {
      id: userId,
      full_name: input.full_name,
      email: input.email.toLowerCase(),
      role: "plumber",
      phone_number: input.phone,
      whatsapp_number: input.whatsapp,
    };
    const profileResult = await admin.from("profiles").upsert(profilePayload, { onConflict: "id" });
    if (profileResult.error) {
      const fallbackProfile = { id: userId, full_name: input.full_name, email: input.email.toLowerCase(), role: "plumber", phone: input.phone, whatsapp_number: input.whatsapp };
      const fallback = await admin.from("profiles").upsert(fallbackProfile, { onConflict: "id" });
      if (fallback.error) throw fallback.error;
    }

    const baseBusiness = {
      profile_id: userId,
      trading_name: input.business.trading_name,
      area: input.business.area,
      hourly_rate: input.business.hourly_rate || null,
      specialties: input.business.specialties,
      is_emergency: input.business.is_emergency,
      google_calendar_url: input.business.google_calendar_url || null,
      google_place_id: input.business.google_place_id || null,
      pirb_number: input.business.pirb_number || null,
      whatsapp_number: formatWhatsApp(input.whatsapp),
      is_certified: false,
      is_verified: false,
      availability_status: "available",
    };
    const enrichedBusiness = { ...baseBusiness, verification_state: "business_claimed", accepts_new_work: true };
    let insert = await admin.from("plumbers").insert(enrichedBusiness).select("id").single();
    if (insert.error && /column|schema cache/i.test(insert.error.message)) {
      insert = await admin.from("plumbers").insert(baseBusiness).select("id").single();
    }
    if (insert.error || !insert.data) {
      console.error("[register] Business insert failed:", insert.error?.message);
      return NextResponse.json({ error: "The business profile could not be created" }, { status: 503 });
    }

    void notifyNewRegistration({
      tradingName: input.business.trading_name,
      area: input.business.area,
      email: input.email,
      phone: input.phone,
      specialties: input.business.specialties,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      plumberId: insert.data.id,
      uploadToken: createUploadToken(insert.data.id),
      needsEmailConfirmation,
      message: needsEmailConfirmation
        ? "Application received. Confirm your email before signing in."
        : "Application received for review.",
    }, { status: 201 });
  } catch (error) {
    console.error("[register] Unexpected error:", error);
    return NextResponse.json({ error: "Registration could not be completed" }, { status: 500 });
  }
}
