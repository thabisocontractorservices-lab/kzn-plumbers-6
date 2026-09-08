import type { VerificationState } from "@/lib/verification";

/** Explicit public DTO. Never spread a database plumber/account row into client props. */
export type PublicPlumber = {
  id: string;
  trading_name: string;
  slug: string | null;
  area: string;
  hourly_rate: number | null;
  specialties: string[];
  is_emergency: boolean;
  whatsapp_number: string | null;
  pirb_number: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  is_claimed: boolean;
  verification_state: VerificationState;
  credential_verified_at: string | null;
  verification_expires_at: string | null;
  taking_work: boolean;
  availability_checked_at: string | null;
  photos: Array<{ photo_url: string; is_profile_photo: boolean }>;
};

export type PublicDirectoryResult = {
  plumbers: PublicPlumber[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  notice: string | null;
};
