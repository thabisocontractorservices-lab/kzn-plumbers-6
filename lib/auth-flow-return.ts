/** Only same-site paths; never accept protocol-relative URLs or encoded separators. */
export function safeAuthReturnPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || value.length > 1000 || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\\\u0000-\u0020\u007f]/.test(value) || /%(?:2f|5c|00|0a|0d|25)/i.test(value)) return fallback;
  try {
    const base = "https://auth-return.invalid";
    const url = new URL(value, base);
    if (url.origin !== base || url.pathname.startsWith("//") || /^\/(?:api|auth)(?:\/|$)/.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
