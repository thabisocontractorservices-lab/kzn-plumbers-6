import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { notifyNewClaim } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AccessError, privateJson, requireSameOrigin, requireUser } from "@/lib/server-access";
import { authFlowPublishedBusiness, ensureAuthFlowProfile } from "@/lib/auth-flow-records";
import { authFlowFailure as accessFailure, missingAuthFlowColumn, readAuthFlowJson } from "@/lib/auth-flow-input";
import { formatWhatsApp } from "@/lib/utils";

const Schema = z.object({
  plumber_id: z.string().uuid(),
  phone: z.string().trim().max(30).regex(/^[+\d\s()-]+$/)
    .refine((value) => /^27[1-8]\d{8}$/.test(formatWhatsApp(value)), "Enter a South African business number."),
});

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const user = await requireUser(request);
    const parsed = Schema.safeParse(await readAuthFlowJson(request, 4096));
    if (!parsed.success) return privateJson({ error: "Check the claim details." }, 400);
    const plumber = await authFlowPublishedBusiness(parsed.data.plumber_id);
    if (plumber.profile_id) return privateJson({ error: "This listing is already linked to an account." }, 409);
    const admin = getSupabaseAdmin();
    const owned = await admin.from("plumbers").select("id").eq("profile_id", user.id).limit(1);
    if (owned.error) throw new AccessError("Cannot check your existing business profile right now.", 503);
    if (owned.data?.length) return privateJson({ error: "This account already has a business profile. Contact support about a different listing." }, 409);
    const existing = await admin.from("claims").select("id, status")
      .eq("plumber_id", plumber.id).eq("claimant_id", user.id).eq("status", "pending").limit(1);
    if (existing.error) throw new AccessError("Ownership requests are temporarily unavailable.", 503);
    if (existing.data?.length) return privateJson({ error: "You already have a pending ownership request.", status: "pending" }, 409);
    await ensureAuthFlowProfile(user);

    // Comparing a public phone number is context for the reviewer, never proof of ownership.
    const phoneMatchObserved = formatWhatsApp(parsed.data.phone) === formatWhatsApp(plumber.whatsapp_number);
    const reason = phoneMatchObserved ? "Public phone matched; independent ownership evidence still required." : "Public phone differs; independent ownership evidence required.";
    const payload: Record<string, unknown> = {
      plumber_id: plumber.id, claimant_id: user.id, phone_entered: formatWhatsApp(parsed.data.phone),
      status: "pending", admin_notes: `[request context] ${reason}`,
      phone_match_observed: phoneMatchObserved, review_reason: reason,
    };
    const optional = ["phone_match_observed", "review_reason"];
    let inserted = await admin.from("claims").insert(payload);
    for (let attempt = 0; inserted.error && attempt < optional.length; attempt++) {
      const missing = missingAuthFlowColumn(inserted.error, "claims", optional);
      if (!missing || !(missing in payload)) break;
      delete payload[missing];
      inserted = await admin.from("claims").insert(payload);
    }
    if (inserted.error) throw new AccessError("Ownership request could not be confirmed as saved. Check before submitting again.", 503);

    // The request is saved independently of optional notification delivery.
    void notifyNewClaim({ tradingName: plumber.trading_name, claimantEmail: user.email!, phoneEntered: parsed.data.phone, phoneMatch: phoneMatchObserved, status: "pending" }).catch(() => {});
    return privateJson({ status: "pending", message: "Request saved for manual review. No ownership access has been transferred." }, 201);
  } catch (error) { return accessFailure(error); }
}
