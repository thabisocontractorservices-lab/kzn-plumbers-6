"use client";

import { Analytics } from "@vercel/analytics/next";
import { cleanAnalyticsUrl } from "@/lib/analytics-url";

/**
 * Vercel Web Analytics: cookieless, no personal data, so it counts every visit
 * without needing the cookie banner. URLs are cleaned before sending.
 */
export function VercelAnalytics() {
  return <Analytics beforeSend={(event) => ({ ...event, url: cleanAnalyticsUrl(event.url) })} />;
}
