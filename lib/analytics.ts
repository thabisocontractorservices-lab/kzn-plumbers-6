import { DIRECTORY_AREAS, DIRECTORY_SERVICES } from "@/lib/directory";
import { KZN_AREAS, SPECIALTIES } from "@/lib/utils";

export type AnalyticsEvent = "search_submit" | "filter_apply" | "profile_view" | "whatsapp_click" | "call_click" | "booking_submit" | "booking_complete" | "claim_complete";
type EventParameters = Record<string, string | number | boolean | null | undefined>;
export const ANALYTICS_CONSENT_KEY = "kzn_analytics_consent";
export const ANALYTICS_READY_EVENT = "kzn-analytics-ready";
let productionEnabled = false;
let consentGranted = false;
let metricsAvailable = true;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** Called only after the server has checked VERCEL_ENV, not NODE_ENV in a preview build. */
export function setAnalyticsPermission(production: boolean, consent: boolean) {
  productionEnabled = production;
  consentGranted = consent;
}
export function canTrackAnalytics() { return productionEnabled && consentGranted; }

/** Only coarse route classes: no query, fragment, arbitrary slug, account id or referrer. */
export function analyticsSourcePath(value: string): string {
  const path = value.split(/[?#]/, 1)[0];
  if (["/", "/search", "/directory", "/privacy", "/contact", "/register", "/login", "/about", "/directory/[landing]", "/private", "/other"].includes(path)) return path;
  if (/^\/plumber\//.test(path)) return "/plumber/[profile]";
  if (/^\/claim\//.test(path)) return "/claim/[profile]";
  if (/^\/(?:plumbers|areas|area|services|service)\//.test(path)) return "/directory/[landing]";
  if (/^\/dashboard(?:\/|$)/.test(path)) return "/dashboard";
  if (/^\/(?:auth|admin|api)(?:\/|$)/.test(path)) return "/private";
  return "/other";
}

/** Values as well as keys are allowlisted. A safe-looking key is not permission to send free text. */
export function sanitiseAnalyticsParameters(parameters: EventParameters): EventParameters {
  const clean: EventParameters = {};
  const string = (key: string) => typeof parameters[key] === "string" ? parameters[key] as string : "";
  const id = string("plumber_id");
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) clean.plumber_id = id;
  const area = string("area");
  const knownArea = DIRECTORY_AREAS.find((item) => item.key === area || item.label === area || item.dbAreas.some((entry) => entry === area));
  if (knownArea) clean.area = knownArea.key;
  else if (area === "all-kzn") clean.area = area;
  else if (KZN_AREAS.some((entry) => entry === area)) clean.area = "other-kzn";
  const service = string("service");
  const knownService = DIRECTORY_SERVICES.find((item) => item.key === service || item.label === service || item.dbValue === service);
  if (knownService) clean.service = knownService.key;
  else if (service === "any" || service === "plumbing work") clean.service = "any";
  else if (service === "other" || service === "Other plumbing work" || SPECIALTIES.some((entry) => entry === service)) clean.service = "other";
  const enums: Record<string, readonly string[]> = {
    urgency: ["planned", "today", "emergency", "any"],
    source_page: ["directory", "plumber_profile", "booking_success", "direct_or_search", "internal", "external", "search_landing", "area_landing", "service_landing", "seo_page"],
    verification_state: ["credential_verified", "business_claimed", "directory_record", "ownership_review_pending"],
    filter: ["all", "available", "emergency", "verified", "certified", "claimed"],
  };
  for (const [key, values] of Object.entries(enums)) { const value = string(key); if (values.includes(value)) clean[key] = value; }
  if (typeof parameters.rank_position === "number" && Number.isInteger(parameters.rank_position) && parameters.rank_position > 0 && parameters.rank_position <= 1000) clean.rank_position = parameters.rank_position;
  if (typeof parameters.has_query === "boolean") clean.has_query = parameters.has_query;
  else if (typeof parameters.query_match === "string") clean.has_query = Boolean(parameters.query_match && parameters.query_match !== "structured-search");
  return clean;
}

export function trackEvent(name: AnalyticsEvent, parameters: EventParameters = {}) {
  if (typeof window === "undefined" || !canTrackAnalytics()) return;
  const clean = sanitiseAnalyticsParameters(parameters);
  const sourcePath = analyticsSourcePath(window.location.pathname);
  // Override automatic GA page defaults for each explicitly emitted event.
  try {
    window.gtag?.("event", name, { ...clean, page_location: `${window.location.origin}${sourcePath}`, page_path: sourcePath, page_referrer: "", page_title: "KZN directory" });
  } catch { /* Analytics must not interrupt a contact action. */ }
  if (!metricsAvailable || !["whatsapp_click", "call_click", "booking_complete", "claim_complete"].includes(name)) return;
  // No beacon: a beacon cannot distinguish a recorded event from unavailable storage.
  // Do not retry or queue these optional events, and never send search text or contact data.
  void fetch("/api/events", {
    method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
    body: JSON.stringify({ consent: "granted", event_name: name, source_path: sourcePath, metadata: clean }),
  }).then((response) => { if (!response.ok) metricsAvailable = false; }).catch(() => { metricsAvailable = false; });
}
