export type ReviewRecord = {
  id: string;
  plumber_id?: string;
  reviewer_id?: string | null;
  reviewer_name?: string;
  rating: number;
  comment?: string | null;
  created_at: string;
};

function reviewTime(value: string): bigint {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return 0n;
  const fraction = (value.match(/\.(\d+)/)?.[1] || "").padEnd(6, "0");
  return BigInt(ms) * 1000n + BigInt(fraction.slice(3, 6) || "0");
}

export function compareNewest(a: ReviewRecord, b: ReviewRecord): number {
  const at = reviewTime(a.created_at), bt = reviewTime(b.created_at);
  if (at !== bt) return at > bt ? -1 : 1;
  return b.id.localeCompare(a.id);
}

export function splitReviewHistory<T extends ReviewRecord>(reviews: T[]) {
  const current: T[] = [], history: T[] = [];
  const seen = new Set<string>();
  for (const review of [...reviews].sort(compareNewest)) {
    // Unknown/legacy guests are distinct; never group every NULL reviewer together.
    const key = review.reviewer_id ? `${review.plumber_id || "profile"}:${review.reviewer_id}` : `legacy:${review.id}`;
    if (seen.has(key)) history.push(review);
    else { seen.add(key); current.push(review); }
  }
  return { current, history };
}

export function ratingSummary(reviews: ReviewRecord[]) {
  const valid = reviews.filter(r => Number.isFinite(r.rating) && r.rating >= 1 && r.rating <= 5);
  return { count: valid.length, rating: valid.length ? Math.round(valid.reduce((n,r)=>n+r.rating,0) / valid.length * 10) / 10 : null };
}
