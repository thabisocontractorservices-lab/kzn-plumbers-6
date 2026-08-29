"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export function ProfileViewTracker({ plumberId, area }: { plumberId: string; area: string }) {
  useEffect(() => {
    trackEvent("profile_view", {
      plumber_id: plumberId,
      area,
      source_page: document.referrer || "direct_or_search",
    });
  }, [plumberId, area]);
  return null;
}
