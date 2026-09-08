export type VerificationState =
  | "credential_verified"
  | "business_claimed"
  | "directory_record";

export type VerificationInput = {
  verification_state?: VerificationState | null;
  credential_verified_at?: string | null;
  verification_expires_at?: string | null;
  verification_source_url?: string | null;
  profile_id?: string | null;
  is_claimed?: boolean;
  is_certified?: boolean | null;
  pirb_number?: string | null;
};

export function hasCurrentCredentialEvidence(plumber: VerificationInput, now = Date.now()): boolean {
  const checked = Date.parse(plumber.credential_verified_at ?? "");
  const expires = Date.parse(plumber.verification_expires_at ?? "");
  let hasSource = false;
  try {
    const source = new URL(plumber.verification_source_url ?? "");
    hasSource = ["https:", "http:"].includes(source.protocol) && !source.username && !source.password;
  } catch { /* No usable evidence source. */ }
  return plumber.verification_state === "credential_verified" && hasSource &&
    Number.isFinite(checked) && checked <= now &&
    Number.isFinite(expires) && expires > now && expires > checked;
}

export function getVerificationState(plumber: VerificationInput, now = Date.now()): VerificationState {
  // Publication approval, an old is_certified flag or a typed registration number
  // is not evidence of a current independent credential check.
  if (hasCurrentCredentialEvidence(plumber, now)) return "credential_verified";
  if (plumber.profile_id || plumber.is_claimed === true) return "business_claimed";
  return "directory_record";
}

export const AVAILABILITY_FRESHNESS_DAYS = 7;
export type AvailabilityInput = {
  availability_status?: string | null;
  accepts_new_work?: boolean | null;
  availability_confirmed_at?: string | null;
  availability_updated_at?: string | null;
  last_checked_at?: string | null;
};

export function availabilityConfirmationDate(plumber: AvailabilityInput): string | null {
  // The existing opt-in UI writes last_checked_at together with accepts_new_work.
  // Prefer a dedicated confirmation timestamp if that column exists.
  if ("availability_confirmed_at" in plumber) return plumber.availability_confirmed_at ?? null;
  if ("availability_updated_at" in plumber) return plumber.availability_updated_at ?? null;
  return plumber.last_checked_at ?? null;
}

export function isTakingWork(plumber: AvailabilityInput, now = Date.now()): boolean {
  const checked = Date.parse(availabilityConfirmationDate(plumber) ?? "");
  return plumber.accepts_new_work === true && plumber.availability_status === "available" &&
    Number.isFinite(checked) && checked <= now &&
    checked >= now - AVAILABILITY_FRESHNESS_DAYS * 86_400_000;
}

export function verificationLabel(state: VerificationState): string {
  if (state === "credential_verified") return "Credential verified";
  if (state === "business_claimed") return "Business claimed";
  return "Directory record";
}

export function verificationDescription(state: VerificationState): string {
  if (state === "credential_verified") {
    return "A credential check has a recorded date, evidence source and unexpired review period. Confirm the qualification needed for your job; this is not a workmanship guarantee.";
  }
  if (state === "business_claimed") {
    return "The business controls this profile. Professional registration may still require a separate check.";
  }
  return "This public record has not yet been claimed. Contact details and availability may change.";
}

export function verificationTone(state: VerificationState): string {
  if (state === "credential_verified") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (state === "business_claimed") return "bg-blue-50 text-blue-800 border-blue-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function formattedVerificationDate(date?: string | null): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
