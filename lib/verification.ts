export type VerificationState =
  | "credential_verified"
  | "business_claimed"
  | "directory_record";

export type VerificationInput = {
  verification_state?: VerificationState | null;
  credential_verified_at?: string | null;
  verification_expires_at?: string | null;
  profile_id?: string | null;
  is_certified?: boolean | null;
  pirb_number?: string | null;
};

export function getVerificationState(plumber: VerificationInput): VerificationState {
  if (plumber.verification_state) return plumber.verification_state;
  if (plumber.profile_id) return "business_claimed";
  return "directory_record";
}

export function verificationLabel(state: VerificationState): string {
  if (state === "credential_verified") return "Credential verified";
  if (state === "business_claimed") return "Business claimed";
  return "Directory record";
}

export function verificationDescription(state: VerificationState): string {
  if (state === "credential_verified") {
    return "Registration evidence was checked by KZN Plumbers and has a recorded review date.";
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
