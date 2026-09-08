import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getDirectorySchema, PUBLIC_BASE_COLUMNS, PUBLIC_EVIDENCE_COLUMNS, type DirectoryRow } from "@/lib/directory-data";
import { assertPublicRead, hasPublicColumns, requirePublicSupabase } from "@/lib/directory-read";
import { splitReviewHistory, ratingSummary, type ReviewRecord } from "@/lib/review-history";

export type PublicProfileRecord = DirectoryRow & {
  area: string;
  slug: string | null;
  specialties: string[];
  whatsapp_number: string | null;
  about: string | null;
  sessa_number?: string | null;
  lpgsa_number?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  google_place_id: string | null;
  google_calendar_url: string | null;
  google_reviews_synced_at: string | null;
  updated_at: string | null;
  record_status?: string | null;
  index_status?: string | null;
  index_reviewed_at?: string | null;
  photos: Array<{ id?: string; photo_url: string; is_profile_photo: boolean; caption?: string | null }>;
};

const EXTRA_LINKS = "website_url,facebook_url,instagram_url,tiktok_url";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Metadata and page rendering reuse one cookie-free, anonymous profile read.
export const getPublicProfile = cache(unstable_cache(async (id: string): Promise<PublicProfileRecord | null> => {
  if (!id || id.length > 200) return null;
  const [schema, links, otherCredentials, indexDisposition] = await Promise.all([
    getDirectorySchema(), hasPublicColumns("plumbers", EXTRA_LINKS),
    hasPublicColumns("plumbers", "sessa_number,lpgsa_number"),
    hasPublicColumns("plumbers", "index_status,index_reviewed_at"),
  ]);
  const selected = [PUBLIC_BASE_COLUMNS, "about,google_place_id,google_calendar_url,google_reviews_synced_at,updated_at",
    schema.evidence ? PUBLIC_EVIDENCE_COLUMNS : "",
    schema.availability ? "accepts_new_work,last_checked_at" : "",
    schema.dedicatedAvailability ? "availability_confirmed_at" : "",
    schema.recordStatus ? "record_status" : "",
    links ? EXTRA_LINKS : "", otherCredentials ? "sessa_number,lpgsa_number" : "",
    indexDisposition ? "index_status,index_reviewed_at" : "",
    schema.photos ? "photos(id,photo_url,is_profile_photo,caption)" : "",
  ].filter(Boolean).join(",");
  let query = requirePublicSupabase().from("plumbers").select(selected).eq("is_verified", true);
  if (schema.recordStatus) query = query.eq("record_status", "published");
  if (schema.photos) query = query.order("is_profile_photo", { referencedTable: "photos", ascending: false })
    .order("id", { referencedTable: "photos", ascending: true }).limit(10, { referencedTable: "photos" });
  const result = await (UUID_RE.test(id) ? query.eq("id", id) : query.eq("slug", id)).maybeSingle();
  assertPublicRead("Public profile query failed", result.error);
  const profile = result.data as unknown as PublicProfileRecord | null;
  return profile ? { ...profile, area: profile.area || "Area not recorded", specialties: profile.specialties ?? [], photos: profile.photos ?? [], whatsapp_number: profile.whatsapp_number || null } : null;
}, ["public-profile-v3"], { revalidate: 300, tags: ["public-directory"] }));

export const getPublicCredentialLabels = cache(unstable_cache(async (id: string): Promise<Array<{ id: string; cert_name: string }>> => {
  if (!await hasPublicColumns("certifications", "id,plumber_id,cert_name")) return [];
  // Only labels the anonymous role can already read. Never select file URLs or join accounts.
  const result = await requirePublicSupabase().from("certifications").select("id,cert_name").eq("plumber_id", id)
    .order("id", { ascending: true }).limit(20);
  assertPublicRead("Public credential labels query failed", result.error);
  return result.data ?? [];
}, ["public-certification-labels-v1"], { revalidate: 300, tags: ["public-directory"] }));

export const getPublicProfileReviews = cache(unstable_cache(async (id: string) => {
  const client = requirePublicSupabase();
  const reviews: ReviewRecord[] = [];
  // Full reviewer history is read server-side in bounded batches to select the latest
  // review per account/business. NULL/legacy guests remain independent records.
  const available = await hasPublicColumns("reviews", "id,plumber_id,reviewer_id,reviewer_name,rating,comment,created_at");
  if (available) {
    for (let offset = 0; ; ) {
      const result = await client.from("reviews").select("id,plumber_id,reviewer_id,reviewer_name,rating,comment,created_at")
        .eq("plumber_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 499);
      assertPublicRead("Public first-party reviews query failed", result.error);
      if (!result.data?.length) break;
      reviews.push(...result.data as ReviewRecord[]);
      offset += result.data.length;
    }
  }
  const { current, history } = splitReviewHistory(reviews);
  const summary = ratingSummary(current);
  // Reviewer account ids are used only to collapse history; do not return them to a client.
  return { current: current.map((review) => ({ id: review.id, reviewer_name: review.reviewer_name || "Reviewer", rating: review.rating,
    comment: review.comment ?? null, created_at: review.created_at })), summary, historicalCount: history.length, available };
}, ["public-current-reviews-v2"], { revalidate: 60, tags: ["public-directory"] }));

export const getPublicGoogleReviews = cache(unstable_cache(async (id: string) => {
  if (!await hasPublicColumns("google_reviews", "id,plumber_id,reviewer_name,rating,text,review_time")) return [];
  const result = await requirePublicSupabase().from("google_reviews").select("id,reviewer_name,rating,text,review_time")
    .eq("plumber_id", id).order("review_time", { ascending: false, nullsFirst: false }).order("id", { ascending: true }).limit(5);
  assertPublicRead("Public Google review excerpts query failed", result.error);
  return result.data ?? [];
}, ["public-google-review-excerpts-v1"], { revalidate: 300, tags: ["public-directory"] }));
