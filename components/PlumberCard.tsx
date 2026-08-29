"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Building2, Clock3, MapPin, MessageCircle, Phone, ShieldQuestion, Star } from "lucide-react";
import { callLink, formatRand, initials, isLandline, whatsAppLink } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import {
  formattedVerificationDate,
  getVerificationState,
  verificationDescription,
  verificationLabel,
  verificationTone,
} from "@/lib/verification";
import type { Plumber } from "@/types/database";

type CardPlumber = Plumber & {
  verification_state?: "credential_verified" | "business_claimed" | "directory_record" | null;
  credential_verified_at?: string | null;
  verification_expires_at?: string | null;
  last_checked_at?: string | null;
  response_time_minutes?: number | null;
  accepts_new_work?: boolean | null;
};

export function PlumberCard({
  plumber,
  sourcePage = "directory",
  rankPosition,
}: {
  plumber: CardPlumber;
  sourcePage?: string;
  rankPosition?: number;
}) {
  const landline = isLandline(plumber.whatsapp_number);
  const profileHref = `/plumber/${plumber.slug ?? plumber.id}`;
  const primaryService = plumber.specialties?.[0] ?? "plumbing work";
  const message = `Hi, I found ${plumber.trading_name} on kznplumbers.co.za and would like to get a quote for ${primaryService.toLowerCase()} in ${plumber.area}.`;
  const waLink = whatsAppLink(plumber.whatsapp_number, message);
  const phoneLink = callLink(plumber.whatsapp_number);
  const profilePhoto = plumber.photos?.find((photo) => photo.is_profile_photo)?.photo_url ?? null;
  const state = getVerificationState(plumber);
  const checkedDate = formattedVerificationDate(plumber.credential_verified_at || plumber.last_checked_at);
  const rating = plumber.google_rating && plumber.google_review_count
    ? Number(plumber.google_rating)
    : null;
  const takingWork = plumber.accepts_new_work !== false && plumber.availability_status === "available";

  function trackContact(kind: "whatsapp_click" | "call_click") {
    trackEvent(kind, {
      plumber_id: plumber.id,
      area: plumber.area,
      service: primaryService,
      source_page: sourcePage,
      rank_position: rankPosition,
      verification_state: state,
    });
  }

  const StateIcon = state === "credential_verified"
    ? BadgeCheck
    : state === "business_claimed"
      ? Building2
      : ShieldQuestion;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
      <div className="flex items-start gap-3">
        <Link href={profileHref} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-brand text-white">
          {profilePhoto ? (
            <Image
              src={profilePhoto}
              alt={`${plumber.trading_name} profile`}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-lg font-bold">
              {initials(plumber.trading_name)}
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={profileHref} className="group block">
            <h3 className="font-display text-lg font-bold leading-tight text-slate-950 group-hover:text-brand">
              {plumber.trading_name}
            </h3>
          </Link>
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {plumber.area}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className={`rounded-lg border px-3 py-2 ${verificationTone(state)}`}>
          <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide">
            <StateIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {verificationLabel(state)}
          </div>
          <p className="mt-1 text-xs leading-relaxed opacity-90">{verificationDescription(state)}</p>
          {checkedDate && state === "credential_verified" && (
            <p className="mt-1 text-[11px] font-semibold">Checked {checkedDate}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={`badge ${takingWork ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
            <Clock3 className="h-3 w-3" aria-hidden="true" />
            {takingWork ? "Taking work" : "Confirm availability"}
          </span>
          {plumber.is_emergency && (
            <span className="badge bg-orange-50 text-orange-800">24-hour call-outs listed</span>
          )}
          {plumber.pirb_number && state === "credential_verified" && (
            <span className="badge bg-teal-light text-teal">PIRB {plumber.pirb_number}</span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {(plumber.specialties ?? []).slice(0, 4).map((specialty) => (
          <span key={specialty} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            {specialty}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-y border-slate-100 py-3">
        <div>
          {rating ? (
            <div className="flex items-center gap-1.5 text-sm">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              <strong className="text-slate-950">{rating.toFixed(1)}</strong>
              <span className="text-slate-500">Google · {plumber.google_review_count}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-500">No Google rating displayed</span>
          )}
        </div>
        <div className="text-right">
          {plumber.hourly_rate ? (
            <>
              <div className="font-display text-lg font-bold text-slate-950">{formatRand(plumber.hourly_rate)}</div>
              <div className="text-[10px] text-slate-500">per hour · confirm call-out</div>
            </>
          ) : (
            <span className="text-sm font-semibold text-slate-700">Request a written quote</span>
          )}
        </div>
      </div>

      <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 pt-4">
        {landline ? (
          <a href={phoneLink} onClick={() => trackContact("call_click")} className="btn-primary">
            <Phone className="h-4 w-4" aria-hidden="true" /> Call
          </a>
        ) : (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackContact("whatsapp_click")}
            className="btn-whatsapp"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
          </a>
        )}
        <Link
          href={profileHref}
          onClick={() => trackEvent("profile_view", {
            plumber_id: plumber.id,
            area: plumber.area,
            source_page: sourcePage,
            rank_position: rankPosition,
          })}
          className="btn-secondary"
        >
          Details
        </Link>
      </div>
    </article>
  );
}
