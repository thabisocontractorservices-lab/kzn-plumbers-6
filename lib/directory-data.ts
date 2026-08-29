import { getPublicSupabase } from "@/lib/supabase/public";
import type { Plumber } from "@/types/database";

export type PublicPlumber = Plumber & {
  verification_state?: "credential_verified" | "business_claimed" | "directory_record" | null;
  credential_verified_at?: string | null;
  verification_expires_at?: string | null;
  last_checked_at?: string | null;
  response_time_minutes?: number | null;
  accepts_new_work?: boolean | null;
};

const RICH_SELECT = `
  id, profile_id, trading_name, slug, area, hourly_rate, specialties,
  is_emergency, is_certified, is_verified, availability_status,
  google_rating, google_review_count, whatsapp_number, pirb_number,
  verification_state, verification_rank, credential_verified_at, verification_expires_at,
  last_checked_at, response_time_minutes, accepts_new_work,
  photos(photo_url, is_profile_photo), certifications(id, cert_name)
`;

const BASIC_SELECT = `
  id, profile_id, trading_name, slug, area, hourly_rate, specialties,
  is_emergency, is_certified, is_verified, availability_status,
  google_rating, google_review_count, whatsapp_number, pirb_number,
  photos(photo_url, is_profile_photo), certifications(id, cert_name)
`;

export async function getPublicPlumbers({
  areas,
  specialty,
  credentialOnly = false,
  emergencyOnly = false,
  limit = 12,
  offset = 0,
}: {
  areas?: readonly string[];
  specialty?: string;
  credentialOnly?: boolean;
  emergencyOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ plumbers: PublicPlumber[]; total: number }> {
  const supabase = getPublicSupabase();
  if (!supabase) return { plumbers: [], total: 0 };

  let query = supabase.from("plumbers").select(RICH_SELECT, { count: "exact" }).eq("is_verified", true);
  if (areas?.length) query = query.in("area", [...areas]);
  if (specialty) query = query.contains("specialties", [specialty]);
  if (credentialOnly) query = query.eq("verification_state", "credential_verified");
  if (emergencyOnly) query = query.eq("is_emergency", true);

  const result = await query
    .order("verification_rank", { ascending: true })
    .order("profile_id", { ascending: false, nullsFirst: false })
    .order("google_rating", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (!result.error) {
    return {
      plumbers: (result.data ?? []) as unknown as PublicPlumber[],
      total: result.count ?? 0,
    };
  }

  let fallback = supabase.from("plumbers").select(BASIC_SELECT, { count: "exact" }).eq("is_verified", true);
  if (areas?.length) fallback = fallback.in("area", [...areas]);
  if (specialty) fallback = fallback.contains("specialties", [specialty]);
  if (credentialOnly) fallback = fallback.eq("is_certified", true).not("pirb_number", "is", null);
  if (emergencyOnly) fallback = fallback.eq("is_emergency", true);

  const retry = await fallback
    .order("profile_id", { ascending: false, nullsFirst: false })
    .order("google_rating", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (retry.error) {
    console.error("[directory-data] Public plumber query failed:", retry.error.message);
    return { plumbers: [], total: 0 };
  }

  return {
    plumbers: (retry.data ?? []) as unknown as PublicPlumber[],
    total: retry.count ?? 0,
  };
}
