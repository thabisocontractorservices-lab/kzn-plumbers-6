"use client";

import { useEffect, useRef } from "react";
import { ANALYTICS_READY_EVENT, canTrackAnalytics, trackEvent } from "@/lib/analytics";

export function ProfileViewTracker({ plumberId, area }: { plumberId: string; area: string }) {
  const tracked = useRef<string | null>(null);
  useEffect(() => {
    function recordView() {
      if (!canTrackAnalytics() || tracked.current === plumberId) return;
      tracked.current = plumberId;
      // Never forward a referrer URL: it may contain queries, email addresses or tokens.
      trackEvent("profile_view", { plumber_id: plumberId, area, source_page: "plumber_profile" });
    }
    recordView();
    window.addEventListener(ANALYTICS_READY_EVENT, recordView);
    return () => window.removeEventListener(ANALYTICS_READY_EVENT, recordView);
  }, [plumberId, area]);
  return null;
}
