import type { Metadata } from "next";
import { Suspense } from "react";
import { BadgeCheck, Clock3, ShieldCheck } from "lucide-react";
import { EstimateForm } from "@/components/leads/EstimateForm";

export const metadata: Metadata = {
  title: "Free Plumbing Cost Estimate in Under 60 Seconds | KZN Plumbers",
  description: "Tell us what needs fixing in KwaZulu-Natal and get an indicative plumbing price range, then choose up to 3 reviewed local plumbers to quote.",
  alternates: { canonical: "/get-estimate" },
};

export default function GetEstimatePage() {
  return (
    <div className="bg-gradient-to-b from-brand-light via-white to-white">
      <div className="mx-auto grid max-w-6xl gap-5 sm:gap-8 px-4 py-5 sm:px-6 sm:py-12 lg:grid-cols-[1fr_1.35fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand shadow-sm">
            <Clock3 className="h-3.5 w-3.5" /> Takes under 60 seconds
          </p>
          <h1 className="mt-3 font-display text-[1.7rem] font-bold leading-tight text-gray-950 sm:mt-4 sm:text-5xl">
            Get a Free Plumbing Cost Estimate in Under 60 Seconds
          </h1>
          <p className="mt-4 hidden text-base leading-relaxed text-gray-600 sm:block sm:text-lg">
            Not sure what your plumbing job should cost? Tell KZNPlumbers what needs fixing and we&apos;ll estimate the likely price range and help you find suitable plumbers in your area.
          </p>
          <p className="mt-2 text-sm text-gray-600 sm:hidden">Tell us what needs fixing — see a price range, then choose up to 3 reviewed local plumbers.</p>
          <ul className="mt-6 hidden space-y-3 text-sm text-gray-700 sm:block">
            <li className="flex gap-3"><BadgeCheck className="h-5 w-5 shrink-0 text-teal" /> You choose which plumbers see your job — up to 3, best reviewed first.</li>
            <li className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-teal" /> Your number is only shared with plumbers who accept your job.</li>
            <li className="flex gap-3"><Clock3 className="h-5 w-5 shrink-0 text-teal" /> Free and no obligation. Emergency requests are flagged as urgent.</li>
          </ul>
          <p className="mt-6 hidden text-xs leading-relaxed text-gray-500 lg:block">
            Estimates are indicative and based on the information provided. Final pricing may vary after the plumber assesses the job.
          </p>
        </div>
        <div>
          <Suspense fallback={<div className="h-[520px] animate-pulse rounded-2xl bg-white shadow-xl" />}>
            <EstimateForm />
          </Suspense>
          <p className="mt-4 text-center text-xs leading-relaxed text-gray-500 lg:hidden">
            Estimates are indicative and based on the information provided. Final pricing may vary after the plumber assesses the job.
          </p>
        </div>
      </div>
    </div>
  );
}
