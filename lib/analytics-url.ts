// Shared URL cleaning for analytics. Keeps the page path and marketing tags,
// drops everything else (search text, tokens, references, personal details).
const KEEP_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid",
  "area", "service", "page",
]);

/** Private areas are reported by section only, never by full address. */
export function analyticsPath(pathname: string): string {
  if (/^\/(admin|api|auth)(\/|$)/.test(pathname)) return "/private";
  if (/^\/dashboard(\/|$)/.test(pathname)) return pathname.replace(/\/[0-9a-f-]{20,}(?=\/|$)/gi, "/[id]");
  if (/^\/get-estimate\/received/.test(pathname)) return "/get-estimate/received";
  return pathname;
}

export function cleanAnalyticsUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const kept = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (KEEP_PARAMS.has(key)) kept.set(key, value.slice(0, 100));
    });
    const qs = kept.toString();
    return `${url.origin}${analyticsPath(url.pathname)}${qs ? `?${qs}` : ""}`;
  } catch {
    return raw.split(/[?#]/)[0];
  }
}
