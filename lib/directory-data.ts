import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { DIRECTORY_SERVICES, getAreaConfig, getServiceConfig, type DirectorySearchState, type DirectoryFilter, type DirectorySort } from "@/lib/directory";
import { assertPublicRead, hasPublicColumns, requirePublicSupabase } from "@/lib/directory-read";
import { AVAILABILITY_FRESHNESS_DAYS, availabilityConfirmationDate, getVerificationState, isTakingWork, type AvailabilityInput, type VerificationInput } from "@/lib/verification";
import type { PublicDirectoryResult, PublicPlumber } from "@/lib/directory-public-types";

export type { PublicPlumber, PublicDirectoryResult } from "@/lib/directory-public-types";

export type DirectoryRow = VerificationInput & AvailabilityInput & {
  id: string;
  trading_name: string;
  slug?: string | null;
  area?: string | null;
  hourly_rate?: number | null;
  specialties?: string[] | null;
  is_emergency?: boolean | null;
  whatsapp_number?: string | null;
  google_rating?: number | null;
  google_review_count?: number | null;
  photos?: Array<{ photo_url: string; is_profile_photo: boolean }> | null;
};

export const PUBLIC_BASE_COLUMNS = "id,profile_id,trading_name,slug,area,hourly_rate,specialties,is_emergency,availability_status,google_rating,google_review_count,whatsapp_number,pirb_number";
export const PUBLIC_EVIDENCE_COLUMNS = "verification_state,credential_verified_at,verification_source_url,verification_expires_at";

export const getDirectorySchema = cache(async () => {
  const [evidence, availability, recordStatus, dedicatedAvailability, photos] = await Promise.all([
    hasPublicColumns("plumbers", PUBLIC_EVIDENCE_COLUMNS),
    hasPublicColumns("plumbers", "accepts_new_work,last_checked_at"),
    hasPublicColumns("plumbers", "record_status"),
    hasPublicColumns("plumbers", "availability_confirmed_at"),
    hasPublicColumns("photos", "photo_url,is_profile_photo,plumber_id"),
  ]);
  return { evidence, availability, recordStatus, dedicatedAvailability, photos };
});

/** Only data explicitly approved for public display crosses the RSC/API boundary. */
export function toPublicPlumber(row: DirectoryRow): PublicPlumber {
  const state = getVerificationState(row);
  const rating = Number(row.google_rating);
  const count = Number(row.google_review_count);
  const hasGoogleRating = Number.isFinite(rating) && rating >= 1 && rating <= 5 && Number.isSafeInteger(count) && count > 0;
  return {
    id: row.id,
    trading_name: row.trading_name,
    slug: row.slug || null,
    area: row.area || "Area not recorded",
    hourly_rate: typeof row.hourly_rate === "number" && row.hourly_rate > 0 ? row.hourly_rate : null,
    specialties: (row.specialties ?? []).filter((value) => typeof value === "string" && value.trim().length > 0),
    is_emergency: row.is_emergency === true,
    whatsapp_number: row.whatsapp_number?.trim() || null,
    pirb_number: row.pirb_number?.trim() || null,
    google_rating: hasGoogleRating ? rating : null,
    google_review_count: Number.isSafeInteger(count) && count >= 0 && row.google_review_count != null ? count : null,
    is_claimed: !!row.profile_id,
    verification_state: state,
    credential_verified_at: state === "credential_verified" ? row.credential_verified_at ?? null : null,
    verification_expires_at: state === "credential_verified" ? row.verification_expires_at ?? null : null,
    taking_work: isTakingWork(row),
    availability_checked_at: row.accepts_new_work === true ? availabilityConfirmationDate(row) : null,
    photos: (row.photos ?? []).filter((photo) => photo.is_profile_photo && /^https?:\/\//i.test(photo.photo_url)).slice(0, 1)
      .map((photo) => ({ photo_url: photo.photo_url, is_profile_photo: true })),
  };
}

type DirectoryOptions = {
  areas?: readonly string[];
  specialty?: string;
  q?: string;
  filter?: DirectoryFilter;
  sort?: DirectorySort;
  credentialOnly?: boolean;
  emergencyOnly?: boolean;
  limit?: number;
  offset?: number;
};

async function queryDirectory(key: string): Promise<PublicDirectoryResult> {
  const options = JSON.parse(key) as Required<Omit<DirectoryOptions, "credentialOnly">>;
  const { areas, specialty, q, filter, sort, emergencyOnly, limit, offset } = options;
  const schema = await getDirectorySchema();
  const selected = [PUBLIC_BASE_COLUMNS,
    schema.evidence ? PUBLIC_EVIDENCE_COLUMNS : "",
    schema.availability ? "accepts_new_work,last_checked_at" : "",
    schema.dedicatedAvailability ? "availability_confirmed_at" : "",
    schema.photos ? "photos(photo_url,is_profile_photo)" : "",
  ].filter(Boolean).join(",");

  // is_verified is the existing administrator publication switch, never an endorsement.
  let query = requirePublicSupabase().from("plumbers").select(selected, { count: "exact" }).eq("is_verified", true);
  if (schema.recordStatus) query = query.eq("record_status", "published");
  if (areas.length) query = query.in("area", [...areas]);
  if (specialty) query = query.contains("specialties", [specialty]);
  if (emergencyOnly || filter === "emergency") query = query.eq("is_emergency", true);
  let notice: string | null = null;
  const now = new Date();
  if (filter === "credential") {
    if (schema.evidence) {
      query = query.eq("verification_state", "credential_verified")
        .not("credential_verified_at", "is", null).lte("credential_verified_at", now.toISOString())
        .gt("verification_expires_at", now.toISOString())
        .or("verification_source_url.like.https://_%,verification_source_url.like.http://_%");
    } else {
      query = query.is("id", null); // primary key cannot be NULL: never substitute is_certified.
      notice = "Current credential evidence is not available in these records. Legacy certification flags are not treated as verified credentials.";
    }
  }
  if (filter === "claimed") query = query.not("profile_id", "is", null);
  if (filter === "available") {
    if (schema.availability) {
      const checkedColumn = schema.dedicatedAvailability ? "availability_confirmed_at" : "last_checked_at";
      query = query.eq("availability_status", "available").eq("accepts_new_work", true)
        .gte(checkedColumn, new Date(now.getTime() - AVAILABILITY_FRESHNESS_DAYS * 86_400_000).toISOString())
        .lte(checkedColumn, now.toISOString());
    } else {
      query = query.is("id", null);
      notice = "Recent business opt-in is not recorded here. A legacy Available default does not mean the business is taking work; confirm directly.";
    }
  }
  if (q) {
    const safe = q.replace(/[^a-zA-Z0-9\s&-]/g, " ").replace(/\s+/g, " ").trim();
    if (safe) {
      const serviceMatches = DIRECTORY_SERVICES.filter((item) => `${item.label} ${item.dbValue}`.toLowerCase().includes(safe.toLowerCase()))
        .map((item) => `specialties.cs.{${item.dbValue}}`);
      query = query.or([`trading_name.ilike.%${safe}%`, `area.ilike.%${safe}%`, `about.ilike.%${safe}%`, ...serviceMatches].join(","));
    } else query = query.is("id", null);
  }
  if (sort === "rated") {
    query = query.order("google_rating", { ascending: false, nullsFirst: false })
      .order("google_review_count", { ascending: false, nullsFirst: false });
  }
  // Alphabetical default is neutral and stable; UUID is only the final tie-breaker.
  query = query.order("trading_name", { ascending: true }).order("id", { ascending: true });
  if (schema.photos) query = query.eq("photos.is_profile_photo", true).limit(1, { referencedTable: "photos" });
  if (filter === "credential" && schema.evidence) {
    // Source URLs require application-level validation as well as SQL date filters.
    // Scan only the small documented-evidence candidate set in bounded batches so
    // malformed sources cannot appear in the verified filter or inflate its count.
    const matches: PublicPlumber[] = [];
    let total = 0;
    for (let from = 0; ; ) {
      const batch = await query.range(from, from + 499);
      assertPublicRead("Credential-filter query failed", batch.error);
      const rows = batch.data as unknown as DirectoryRow[] ?? [];
      if (!rows.length) break;
      for (const row of rows) {
        const plumber = toPublicPlumber(row);
        if (plumber.verification_state !== "credential_verified") continue;
        if (total >= offset && matches.length < limit) matches.push(plumber);
        total += 1;
      }
      from += rows.length;
    }
    return { plumbers: matches, total, page: Math.floor(offset / limit) + 1, limit,
      hasMore: offset + matches.length < total, notice };
  }
  const result = await query.range(offset, offset + limit - 1);
  assertPublicRead("Directory listing query failed", result.error);
  const plumbers = (result.data as unknown as DirectoryRow[] ?? []).map(toPublicPlumber);
  return { plumbers, total: result.count ?? 0, page: Math.floor(offset / limit) + 1, limit,
    hasMore: offset + plumbers.length < (result.count ?? 0), notice };
}

const readDirectory = unstable_cache(queryDirectory, ["public-directory-list-v4"], { revalidate: 60, tags: ["public-directory"] });

const reusedDirectoryRead = cache(readDirectory);

export async function getPublicPlumbers(options: DirectoryOptions = {}): Promise<PublicDirectoryResult> {
  const limit = Math.max(1, Math.min(24, Math.floor(options.limit ?? 12)));
  const offset = Math.max(0, Math.min(239_976, Math.floor(options.offset ?? 0)));
  const key = JSON.stringify({
    areas: [...new Set(options.areas ?? [])].sort(), specialty: options.specialty ?? "",
    q: (options.q ?? "").trim().slice(0, 80), filter: options.credentialOnly ? "credential" : options.filter ?? "all",
    sort: options.sort ?? "recommended", emergencyOnly: options.emergencyOnly ?? false, limit, offset,
  });
  const result = await reusedDirectoryRead(key);
  const now = Date.now();
  const elapsed = result.plumbers.some((plumber) =>
    (plumber.verification_state === "credential_verified" && Date.parse(plumber.verification_expires_at ?? "") <= now) ||
    (plumber.taking_work && Date.parse(plumber.availability_checked_at ?? "") < now - AVAILABILITY_FRESHNESS_DAYS * 86_400_000));
  // A cache entry never extends a credential review or availability confirmation.
  return elapsed ? queryDirectory(key) : result;
}

export function searchPublicPlumbers(search: DirectorySearchState, limit = 12) {
  return getPublicPlumbers({ areas: getAreaConfig(search.area)?.dbAreas, specialty: getServiceConfig(search.service)?.dbValue,
    q: search.q, filter: search.filter, sort: search.sort, emergencyOnly: search.emergency,
    limit, offset: (search.page - 1) * limit });
}

export const getPublicDirectoryStats = cache(unstable_cache(async () => {
  const schema = await getDirectorySchema();
  let all = requirePublicSupabase().from("plumbers").select("id", { count: "exact", head: true }).eq("is_verified", true);
  let claimed = requirePublicSupabase().from("plumbers").select("id", { count: "exact", head: true }).eq("is_verified", true).not("profile_id", "is", null);
  if (schema.recordStatus) { all = all.eq("record_status", "published"); claimed = claimed.eq("record_status", "published"); }
  const [records, businesses] = await Promise.all([all, claimed]);
  assertPublicRead("Directory record count failed", records.error);
  assertPublicRead("Claimed business count failed", businesses.error);
  return { records: records.count ?? 0, claimed: businesses.count ?? 0 };
}, ["public-directory-stats-v2"], { revalidate: 300, tags: ["public-directory"] }));
