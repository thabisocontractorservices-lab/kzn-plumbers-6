import "server-only";
import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AccessError } from "@/lib/server-access";
import { missingAuthFlowColumn } from "@/lib/auth-flow-input";

type PublicTarget = {
  id: string;
  profile_id: string | null;
  trading_name: string;
  whatsapp_number: string;
};

/** Service-role operations must explicitly apply the public-listing boundary. */
export async function authFlowPublishedBusiness(id: string): Promise<PublicTarget> {
  const admin = getSupabaseAdmin();
  const fields = "id, profile_id, trading_name, whatsapp_number";
  let result = await admin.from("plumbers").select(fields).eq("id", id)
    .eq("is_verified", true).eq("record_status", "published").maybeSingle();
  if (missingAuthFlowColumn(result.error, "plumbers", ["record_status"])) {
    // Legacy schema publishes with is_verified only; absence, not an error, enables this fallback.
    result = await admin.from("plumbers").select(fields).eq("id", id).eq("is_verified", true).maybeSingle();
  }
  if (result.error) throw new AccessError("Cannot check this listing right now. Please try again.", 503);
  if (!result.data) throw new AccessError("Published listing not found.", 404);
  return result.data as PublicTarget;
}

/** Create only a missing profile for this verified auth id. Never upsert roles or match by email. */
export async function ensureAuthFlowProfile(user: User, fullName?: string, defaultRole: "plumber" | "homeowner" = "homeowner") {
  if (!user.email || !user.email_confirmed_at) throw new AccessError("Confirm your account email first.", 403);
  const admin = getSupabaseAdmin();
  const existing = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (existing.error) throw new AccessError("Cannot check your account profile right now.", 503);
  if (existing.data) return;
  const name = (fullName || String(user.user_metadata?.full_name || "")).trim().slice(0, 120) || "Directory member";
  const inserted = await admin.from("profiles").insert({ id: user.id, full_name: name, email: user.email.toLowerCase(), role: defaultRole });
  if (!inserted.error) return;
  if (inserted.error.code === "23505") {
    // A signup trigger or another request may have won. Only accept the same auth id.
    const raced = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (!raced.error && raced.data) return;
    throw new AccessError("Your account profile could not be linked. Contact support; no other account was changed.", 409);
  }
  throw new AccessError("Your account profile could not be prepared. Please try again.", 503);
}
