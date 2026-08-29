"use client";

import { useEffect, useState } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";

export function AnalyticsConsent({ measurementId }: { measurementId?: string }) {
  const [choice, setChoice] = useState<"granted" | "denied" | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("kzn_analytics_consent");
    if (saved === "granted" || saved === "denied") setChoice(saved);
  }, []);

  function choose(value: "granted" | "denied") {
    window.localStorage.setItem("kzn_analytics_consent", value);
    setChoice(value);
  }

  return (
    <>
      {measurementId && choice === "granted" && <GoogleAnalytics gaId={measurementId} />}
      {choice === null && (
        <aside className="fixed bottom-4 left-4 right-4 z-[80] mx-auto max-w-2xl rounded-2xl border border-slate-300 bg-white p-4 shadow-2xl sm:p-5" aria-label="Analytics choice">
          <p className="text-sm font-bold text-slate-950">Help improve the KZN directory?</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">Optional Google Analytics helps us understand which pages and searches are useful. Essential booking and contact actions still work if you decline.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => choose("granted")} className="btn-primary">Allow analytics</button>
            <button type="button" onClick={() => choose("denied")} className="btn-secondary">Decline</button>
            <a href="/privacy" className="self-center px-2 text-xs font-bold text-brand hover:underline">Privacy details</a>
          </div>
        </aside>
      )}
    </>
  );
}
