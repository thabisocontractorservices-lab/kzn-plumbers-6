"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ATTRIBUTION_KEYS, type Attribution } from "@/lib/leads";

const FIRST = "kzn_attr_first";
const LAST = "kzn_attr_last";

/**
 * Remembers where a visitor came from (ad, Google, Facebook, WhatsApp campaign …) so it can be
 * attached to their quote request. Stored only in this browser and only sent with a request.
 * First touch is kept for 90 days; last touch is refreshed whenever new campaign tags arrive.
 */
export function AttributionCapture() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tagged: Attribution = {};
      for (const key of ATTRIBUTION_KEYS) {
        const value = params.get(key);
        if (value) tagged[key] = value.slice(0, 150);
      }
      const now = new Date().toISOString();
      const referrer = document.referrer && !document.referrer.includes(window.location.host) ? document.referrer.slice(0, 300) : undefined;
      const visit: Attribution = { ...tagged, landing_page: window.location.pathname.slice(0, 300), referrer, first_seen_at: now };
      const first = JSON.parse(localStorage.getItem(FIRST) || "null") as Attribution | null;
      const firstAge = first?.first_seen_at ? Date.now() - Date.parse(first.first_seen_at) : Infinity;
      if (!first || firstAge > 90 * 86400_000) localStorage.setItem(FIRST, JSON.stringify(visit));
      if (Object.keys(tagged).length || referrer || !sessionStorage.getItem(LAST)) sessionStorage.setItem(LAST, JSON.stringify(visit));
    } catch { /* private mode / storage blocked — attribution is optional */ }
  }, [pathname]);
  return null;
}

/** Best attribution for a submission: this session's campaign if any, else first touch. */
export function readAttribution(): Attribution & { first_touch?: Attribution } {
  try {
    const last = JSON.parse(sessionStorage.getItem(LAST) || "null") as Attribution | null;
    const first = JSON.parse(localStorage.getItem(FIRST) || "null") as Attribution | null;
    const best = last && (last.utm_source || last.gclid || last.fbclid || last.referrer) ? last : first || last || {};
    return { ...best, page: window.location.pathname };
  } catch {
    return {};
  }
}
