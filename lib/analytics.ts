export type AnalyticsEvent =
  | "search_submit"
  | "filter_apply"
  | "profile_view"
  | "whatsapp_click"
  | "call_click"
  | "booking_submit"
  | "booking_complete"
  | "claim_complete";

type EventParameters = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: AnalyticsEvent, parameters: EventParameters = {}) {
  if (typeof window === "undefined") return;

  const cleanParameters = Object.fromEntries(
    Object.entries(parameters).filter(([, value]) => value !== undefined && value !== null),
  );

  window.gtag?.("event", name, cleanParameters);

  if (["whatsapp_click", "call_click", "booking_complete", "claim_complete"].includes(name)) {
    const body = JSON.stringify({
      event_name: name,
      source_path: window.location.pathname,
      source_query: window.location.search.slice(1, 500),
      metadata: cleanParameters,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  }
}
