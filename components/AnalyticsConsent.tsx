"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ANALYTICS_CONSENT_KEY, ANALYTICS_READY_EVENT, analyticsSourcePath, setAnalyticsPermission } from "@/lib/analytics";

type Choice = "granted" | "denied" | null;

export function AnalyticsConsent({ measurementId }: { measurementId?: string }) {
  const [choice, setChoice] = useState<Choice>(null);
  const [production, setProduction] = useState(false);
  const [gaEnabled, setGaEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const configured = useRef(false);
  const pathname = usePathname();

  useEffect(() => {
    const controller = new AbortController();
    function readChoice() {
      try {
        const saved = localStorage.getItem(ANALYTICS_CONSENT_KEY);
        setChoice(saved === "granted" || saved === "denied" ? saved : null);
      } catch { setChoice(null); }
    }
    readChoice();
    window.addEventListener("storage", readChoice);
    void fetch("/api/events", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const config = await response.json();
        if (!controller.signal.aborted) { setProduction(config.enabled === true); setGaEnabled(config.gaEnabled === true); }
      }).catch(() => { /* No production confirmation means no tracking or GA load. */ });
    return () => { controller.abort(); window.removeEventListener("storage", readChoice); setAnalyticsPermission(false, false); };
  }, []);

  useEffect(() => {
    const allowed = production && choice === "granted";
    setAnalyticsPermission(production, choice === "granted");
    const gaId = measurementId && /^G-[A-Z0-9]+$/i.test(measurementId) ? measurementId : null;
    if (gaId) (window as unknown as Record<string, unknown>)[`ga-disable-${gaId}`] = !allowed || !gaEnabled;
    if (!allowed) return;
    const safePath = analyticsSourcePath(pathname || "/");
    if (gaId && gaEnabled) {
      window.dataLayer ??= [];
      // gtag's command queue uses the native Arguments shape documented by Google.
      // eslint-disable-next-line prefer-rest-params
      window.gtag ??= function () { window.dataLayer!.push(arguments); };
      const gtag = window.gtag;
      const page = { page_location: `${window.location.origin}${safePath}`, page_path: safePath, page_referrer: "", page_title: "KZN directory" };
      if (!configured.current) {
        gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
        gtag("js", new Date());
        gtag("set", page);
        gtag("config", gaId, { ...page, send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
        if (!document.getElementById("kzn-consented-ga")) {
          const script = document.createElement("script");
          script.id = "kzn-consented-ga";
          script.async = true;
          script.referrerPolicy = "no-referrer";
          script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
          document.head.appendChild(script);
        }
        configured.current = true;
      } else gtag("set", page);
      // Emit only this sanitised page view, never the query string or document referrer.
      if (safePath !== "/private") gtag("event", "page_view", page);
    }
    window.dispatchEvent(new Event(ANALYTICS_READY_EVENT));
  }, [choice, production, gaEnabled, measurementId, pathname]);

  function choose(value: Exclude<Choice, null>) {
    setAnalyticsPermission(production, value === "granted");
    if (value === "denied" && measurementId) (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = true;
    try { localStorage.setItem(ANALYTICS_CONSENT_KEY, value); } catch { /* Current-page choice still works. */ }
    setChoice(value);
    setSettingsOpen(false);
  }

  if (!production) return null;
  return choice === null || settingsOpen ? (
    <aside className="fixed bottom-4 left-4 right-4 z-[80] mx-auto max-w-2xl rounded-2xl border border-slate-300 bg-white p-4 shadow-2xl sm:p-5" aria-label="Analytics choice">
      <p className="text-sm font-bold text-slate-950">Help improve the KZN directory?</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">Optional usage counts{gaEnabled && measurementId ? " and Google Analytics" : ""} help us improve the directory. We exclude search text and contact details from these events. Booking, reviews and contact work if you decline.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => choose("granted")} className="btn-primary">Allow analytics</button>
        <button type="button" onClick={() => choose("denied")} className="btn-secondary">Decline</button>
        <a href="/privacy" className="self-center px-2 text-xs font-bold text-brand hover:underline">Privacy details</a>
      </div>
    </aside>
  ) : (
    <button type="button" onClick={() => setSettingsOpen(true)} className="fixed bottom-2 right-2 z-50 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600">Analytics settings</button>
  );
}
