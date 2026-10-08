import type { Metadata } from "next";
import { Suspense } from "react";
import { LeadReceived } from "@/components/leads/LeadReceived";

export const metadata: Metadata = {
  title: "Your plumbing request has been received | KZN Plumbers",
  robots: { index: false, follow: false },
};

export default function ReceivedPage() {
  return (
    <div className="bg-gradient-to-b from-brand-light via-white to-white">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white shadow-xl" />}>
          <LeadReceived />
        </Suspense>
      </div>
    </div>
  );
}
