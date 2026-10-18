"use client";

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { cleanAnalyticsUrl } from "@/lib/analytics-url";

const OPT_OUT_KEY = "kzn_va_off";
const PRIVATE = /^\/(admin|dashboard|api|auth|login|register|forgot-password|claim)(\/|$)/;

function optedOut() {
  try { return localStorage.getItem(OPT_OUT_KEY) === "1"; } catch { return false; }
}

/**
 * Vercel Web Analytics: cookieless, no personal data, counts every visit without the cookie banner.
 * - Admin, dashboard, login and claim pages are never counted.
 * - Owners can stop counting their own browser: visit any page with ?analytics=off (undo with ?analytics=on).
 */
export function VercelAnalytics() {
  useEffect(() => {
    try {
      const flag = new URLSearchParams(window.location.search).get("analytics");
      if (flag === "off") localStorage.setItem(OPT_OUT_KEY, "1");
      if (flag === "on") localStorage.removeItem(OPT_OUT_KEY);
    } catch { /* storage blocked */ }
  }, []);

  return (
    <Analytics
      beforeSend={(event) => {
        if (optedOut()) return null;
        try { if (PRIVATE.test(new URL(event.url).pathname)) return null; } catch { /* keep */ }
        return { ...event, url: cleanAnalyticsUrl(event.url) };
      }}
    />
  );
}
