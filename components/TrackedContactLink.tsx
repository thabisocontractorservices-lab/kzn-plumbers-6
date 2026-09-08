"use client";

import { trackEvent } from "@/lib/analytics";

export function TrackedContactLink({
  href,
  kind,
  plumberId,
  area,
  service,
  className,
  children,
  newWindow = false,
}: {
  href: string;
  kind: "whatsapp_click" | "call_click";
  plumberId: string;
  area: string;
  service: string;
  className?: string;
  children: React.ReactNode;
  newWindow?: boolean;
}) {
  return (
    <a
      href={href}
      target={newWindow ? "_blank" : undefined}
      rel={newWindow ? "noopener noreferrer" : undefined}
      className={className}
      onClick={() => {
        // Track a coarse action only. Never include the contact href or WhatsApp text,
        // and never await metrics or interfere with native link navigation.
        trackEvent(kind, { plumber_id: plumberId, area, service, source_page: "plumber_profile" });
      }}
    >
      {children}
    </a>
  );
}
