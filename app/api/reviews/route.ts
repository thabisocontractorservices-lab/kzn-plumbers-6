import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AccessError, privateJson, requireSameOrigin, requireUser } from "@/lib/server-access";
import { authFlowPublishedBusiness, ensureAuthFlowProfile } from "@/lib/auth-flow-records";
import { authFlowFailure as accessFailure, readAuthFlowJson } from "@/lib/auth-flow-input";

const Schema = z.object({
  plumber_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).default(""),
});

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const user = await requireUser(request);
    const parsed = Schema.safeParse(await readAuthFlowJson(request, 12288));
    if (!parsed.success) return privateJson({ error: "Choose a rating from 1 to 5 and keep your review within 2,000 characters." }, 400);
    const business = await authFlowPublishedBusiness(parsed.data.plumber_id);
    if (business.profile_id === user.id) return privateJson({ error: "You cannot review your own business." }, 403);
    const admin = getSupabaseAdmin();
    // Application-level guard only. Without an existing database unique constraint,
    // simultaneous requests on different instances can still race. Never upsert or delete history.
    const existing = await admin.from("reviews").select("id").eq("plumber_id", business.id).eq("reviewer_id", user.id).limit(1);
    if (existing.error) throw new AccessError("Reviews are temporarily unavailable. Nothing has been submitted.", 503);
    if (existing.data?.length) return privateJson({ error: "You have already reviewed this business. Your existing review has not been changed." }, 409);
    await ensureAuthFlowProfile(user);
    const profile = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    if (profile.error) throw new AccessError("Cannot check your public reviewer name right now.", 503);
    const suppliedName = typeof profile.data?.full_name === "string" ? profile.data.full_name.trim() : "";
    // Do not publish the auth email (legacy signup triggers used it as a fallback name).
    const reviewerName = suppliedName && !/@|\b\d[\d\s()+-]{6,}\d\b/.test(suppliedName)
      ? suppliedName.slice(0, 120) : "Directory member";
    const inserted = await admin.from("reviews").insert({
      plumber_id: business.id, reviewer_id: user.id, reviewer_name: reviewerName,
      rating: parsed.data.rating, comment: parsed.data.comment || null,
    }).select("id").single();
    if (inserted.error?.code === "23505") return privateJson({ error: "You have already reviewed this business. Your existing review has not been changed." }, 409);
    if (inserted.error || !inserted.data) throw new AccessError("Your review could not be confirmed as saved. Refresh the profile before retrying.", 503);
    return privateJson({ review: { id: inserted.data.id }, status: "created" }, 201);
  } catch (error) { return accessFailure(error); }
}
