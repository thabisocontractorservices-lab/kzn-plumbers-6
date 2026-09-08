import "server-only";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { notifyNewRegistration } from "@/lib/email";
import { KZN_AREAS, SPECIALTIES, formatWhatsApp, isValidSAPhone } from "@/lib/utils";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AccessError, privateJson, requireSameOrigin, requireUser } from "@/lib/server-access";
import { authFlowFailure as accessFailure, missingAuthFlowColumn, readAuthFlowJson } from "@/lib/auth-flow-input";
import { ensureAuthFlowProfile } from "@/lib/auth-flow-records";

const BusinessSchema = z.object({
  trading_name: z.string().trim().min(2).max(160),
  area: z.enum(KZN_AREAS),
  hourly_rate: z.coerce.number().int().min(0).max(100000).nullable().optional(),
  specialties: z.array(z.enum(SPECIALTIES)).min(1).max(SPECIALTIES.length),
  is_emergency: z.boolean().default(false),
  google_calendar_url: z.string().trim().max(500).refine((value) => {
    if (!value) return true;
    try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "calendar.google.com" && !url.username && !url.password; } catch { return false; }
  }, "Use a Google Calendar HTTPS booking URL.").optional(),
  google_place_id: z.string().trim().max(250).optional(),
  pirb_number: z.string().trim().max(80).optional(),
});

const Schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).regex(/^[+\d\s()-]+$/).refine(isValidSAPhone, "Invalid South African cellphone number"),
  whatsapp: z.string().trim().max(30).regex(/^[+\d\s()-]+$/).refine(isValidSAPhone, "Invalid South African WhatsApp number"),
  business: BusinessSchema,
});

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    // Signup happens through the cookie-aware browser client, then email confirmation.
    // This endpoint only creates a business for the verified, signed-in identity.
    const user = await requireUser(request);
    const parsed = Schema.safeParse(await readAuthFlowJson(request, 16384));
    if (!parsed.success) return privateJson({ error: "Check the registration details.", issues: parsed.error.flatten().fieldErrors }, 400);
    const input = parsed.data;
    if (!user.email || input.email.toLowerCase() !== user.email.toLowerCase()) {
      return privateJson({ error: "Use the email address for your signed-in account." }, 400);
    }
    const admin = getSupabaseAdmin();
    const existing = await admin.from("plumbers").select("id").eq("profile_id", user.id).limit(1);
    if (existing.error) throw new AccessError("Cannot check your business application right now.", 503);
    if (existing.data?.length) return privateJson({ error: "This account already has a business profile. Continue from your dashboard.", plumberId: existing.data[0].id }, 409);

    await ensureAuthFlowProfile(user, input.full_name, "plumber");
    // No role appears in an UPDATE: existing homeowner/plumber/admin roles survive,
    // including a concurrent administrator promotion. Only this verified id is changed.
    const profilePayload: Record<string, unknown> = {
      full_name: input.full_name, email: user.email.toLowerCase(),
      phone_number: formatWhatsApp(input.phone), whatsapp_number: formatWhatsApp(input.whatsapp),
    };
    let profileResult = await admin.from("profiles").update(profilePayload).eq("id", user.id);
    if (missingAuthFlowColumn(profileResult.error, "profiles", ["phone_number"])) {
      delete profilePayload.phone_number;
      profilePayload.phone = formatWhatsApp(input.phone);
      profileResult = await admin.from("profiles").update(profilePayload).eq("id", user.id);
    }
    if (profileResult.error) throw new AccessError("Your contact details could not be saved. The business application has not been submitted.", 503);

    const id = randomUUID();
    const businessPayload: Record<string, unknown> = {
      id, profile_id: user.id,
      trading_name: input.business.trading_name,
      // Random suffix avoids same-name slug races without a new index or schema.
      slug: `${input.business.trading_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 130) || "business"}-${id.slice(0, 8)}`,
      area: input.business.area,
      hourly_rate: input.business.hourly_rate || null,
      specialties: [...new Set(input.business.specialties)],
      is_emergency: input.business.is_emergency,
      google_calendar_url: input.business.google_calendar_url || null,
      google_place_id: input.business.google_place_id || null,
      pirb_number: input.business.pirb_number || null,
      whatsapp_number: formatWhatsApp(input.whatsapp),
      is_certified: false, is_verified: false, record_status: "pending",
      verification_state: "business_claimed", accepts_new_work: true,
      availability_status: "available",
    };
    const optional = ["record_status", "verification_state", "accepts_new_work"];
    let inserted = await admin.from("plumbers").insert(businessPayload).select("id").single();
    for (let attempt = 0; inserted.error && attempt < optional.length; attempt++) {
      const missing = missingAuthFlowColumn(inserted.error, "plumbers", optional);
      if (!missing || !(missing in businessPayload)) break;
      delete businessPayload[missing];
      inserted = await admin.from("plumbers").insert(businessPayload).select("id").single();
    }
    if (inserted.error?.code === "23505") {
      const raced = await admin.from("plumbers").select("id").eq("profile_id", user.id).limit(1);
      if (!raced.error && raced.data?.length) return privateJson({ error: "This account already has a business profile. Continue from your dashboard.", plumberId: raced.data[0].id }, 409);
    }
    if (inserted.error || !inserted.data) throw new AccessError("Contact details were saved, but the business application could not be confirmed. Check your dashboard before retrying.", 503);

    void notifyNewRegistration({ tradingName: input.business.trading_name, area: input.business.area, email: user.email, phone: input.phone, specialties: input.business.specialties }).catch(() => {});
    return privateJson({ success: true, plumberId: inserted.data.id, status: "pending", message: "Application saved for review. Files are uploaded separately." }, 201);
  } catch (error) { return accessFailure(error); }
}
