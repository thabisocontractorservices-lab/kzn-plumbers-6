"use client";

import { track } from "@vercel/analytics";

/**
 * Cookieless outcome counts in Vercel Analytics (Analytics → Events).
 * These measure whether a visit led to contact, independent of the GA consent banner.
 * Only coarse labels are sent: never names, numbers, messages or search text.
 */
export type Outcome =
  | "call_click"
  | "whatsapp_click"
  | "quote_click"
  | "estimate_started"
  | "estimate_completed"
  | "kzn_whatsapp_click";

type Props = { page?: string; area?: string; service?: string; plumber?: "claimed" | "unclaimed" };

export function pageType(pathname = typeof window !== "undefined" ? window.location.pathname : "/"): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/plumber/")) return "profile";
  if (pathname.startsWith("/plumbers/")) return "area";
  if (pathname.startsWith("/services/")) return "service";
  if (pathname.startsWith("/blog")) return "blog";
  if (pathname.startsWith("/get-estimate")) return "estimate";
  if (pathname.startsWith("/all-plumbers")) return "directory";
  return "guide";
}

const clean = (v?: string) => (v ? v.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40) : undefined);

export function trackOutcome(name: Outcome, props: Props = {}) {
  if (typeof window === "undefined") return;
  try {
    const data: Record<string, string> = { page: props.page ?? pageType() };
    if (props.area) data.area = clean(props.area)!;
    if (props.service) data.service = clean(props.service)!;
    if (props.plumber) data.plumber = props.plumber;
    track(name, data);
  } catch { /* metrics must never block a contact action */ }
}
