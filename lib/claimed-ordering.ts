export type ClaimedPageRange = {
  claimed: boolean;
  from: number;
  to: number;
};

/**
 * Slice a logical [all claimed, all unclaimed] result set, not a fetched page.
 * Counts must share the same hard filters; offsets and limits are normalised by
 * the directory reader. Each tier is ordered by trading name, then listing id.
 */
export function claimedPageRanges(claimedTotal: number, unclaimedTotal: number, offset: number, limit: number): ClaimedPageRange[] {
  const ranges: ClaimedPageRange[] = [];
  const claimedLength = Math.min(limit, Math.max(0, claimedTotal - offset));
  if (claimedLength > 0) {
    ranges.push({ claimed: true, from: offset, to: offset + claimedLength - 1 });
  }
  const unclaimedFrom = Math.max(0, offset - claimedTotal);
  const unclaimedLength = Math.min(limit - claimedLength, Math.max(0, unclaimedTotal - unclaimedFrom));
  if (unclaimedLength > 0) {
    ranges.push({ claimed: false, from: unclaimedFrom, to: unclaimedFrom + unclaimedLength - 1 });
  }
  return ranges;
}
