const GENERATED_PROFILE_PATTERNS = [
  / serves homeowners and small businesses in .+kwaZulu-Natal, offering /i,
  /^operating across .+ and the surrounding KZN region, .+ specialises in /i,
  / is a (?:PIRB-certified|verified) plumbing business based in .+KwaZulu-Natal\. Services include /i,
  /^based in .+, .+ has been providing .+ to homes and businesses in KwaZulu-Natal\./i,
  /request a no-obligation quote any time\.?$/i,
];

export function isLikelyGeneratedProfileAbout(value?: string | null): boolean {
  if (!value) return false;
  const text = value.replace(/\s+/g, " ").trim();
  return GENERATED_PROFILE_PATTERNS.some((pattern) => pattern.test(text)) || /(?:offering|services include)\s*\./i.test(text);
}

export function usableProfileAbout(value?: string | null): string | null {
  if (!value) return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 60 || isLikelyGeneratedProfileAbout(text)) return null;
  return text;
}

export function isIndexableProfile(profile: {
  profile_id?: string | null;
  verification_state?: string | null;
  about?: string | null;
  google_review_count?: number | null;
  specialties?: string[] | null;
  photos?: Array<{ photo_url?: string | null }> | null;
  is_verified?: boolean | null;
  record_status?: string | null;
  index_status?: string | null;
  index_reviewed_at?: string | null;
}): boolean {
  if (profile.is_verified === false) return false;
  if (profile.record_status && profile.record_status !== "published") return false;
  const reviewed = Date.parse(profile.index_reviewed_at ?? "");
  if (Number.isFinite(reviewed) && reviewed <= Date.now() &&
      ["noindex", "remove", "merge", "redirect"].includes(profile.index_status ?? "")) return false;
  // Preserve historical publication/indexing. Description quality is a display
  // decision, not authority to deindex hundreds of already-published businesses.
  return true;
}
