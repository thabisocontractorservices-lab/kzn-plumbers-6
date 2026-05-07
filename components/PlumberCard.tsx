import Link from "next/link";
import { combinedRating, formatRand, initials, whatsAppLink } from "@/lib/utils";
import type { Plumber } from "@/types/database";

export function PlumberCard({ plumber }: { plumber: Plumber }) {
  const r = combinedRating(
    plumber.google_rating,
    plumber.google_review_count,
    plumber.ratings?.internal_rating,
    plumber.ratings?.internal_count,
  );

  const stars = r.rating
    ? "★".repeat(Math.round(r.rating)) + "☆".repeat(5 - Math.round(r.rating))
    : "—";

  const waLink = whatsAppLink(
    plumber.whatsapp_number,
    `Hi ${plumber.trading_name.split(" ")[0]}, I found you on KZN Plumbers Directory and would like to enquire about your services.`,
  );

  const availabilityClass = {
    available: "bg-green-100 text-green-800",
    busy: "bg-amber-light text-amber",
    unavailable: "bg-red-100 text-red-800",
  }[plumber.availability_status];

  return (
    <article className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-card-hover hover:-translate-y-0.5 hover:border-blue-200 transition-all flex flex-col">
      <Link
        href={`/plumber/${plumber.slug ?? plumber.id}`}
        className="flex gap-3 items-start mb-3"
      >
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-white text-lg shrink-0"
          style={{ background: "linear-gradient(135deg,#1A5FBE,#3A7FDE)" }}
        >
          {initials(plumber.trading_name)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-lg text-gray-900 leading-tight">
            {plumber.trading_name}
          </h3>
          <div className="text-sm text-gray-500 flex items-center gap-1">
            📍 {plumber.area}
            {plumber.pirb_number ? ` · ${plumber.pirb_number}` : ""}
          </div>
        </div>
      </Link>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {plumber.is_certified && plumber.is_verified && (
          <span className="badge bg-teal-light text-teal">✓ PIRB Certified</span>
        )}
        <span className={`badge ${availabilityClass}`}>
          ● {plumber.availability_status}
        </span>
        {plumber.is_emergency && (
          <span className="badge bg-emergency-light text-emergency">🚨 24/7</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {plumber.specialties.slice(0, 4).map((s) => (
          <span
            key={s}
            className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium"
          >
            {s}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 py-2 border-y border-gray-100 mb-3">
        <span className="text-amber text-sm tracking-wide">{stars}</span>
        {r.rating && (
          <>
            <strong className="text-sm text-gray-900">{r.rating}</strong>
            <span className="text-xs text-gray-500">({r.count} reviews)</span>
          </>
        )}
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold">
          G + Internal
        </span>
      </div>

      <div className="mt-auto flex flex-col gap-2.5">
        <div className="flex items-baseline gap-1">
          <span className="font-display text-xl font-bold text-gray-900">
            {formatRand(plumber.hourly_rate)}
          </span>
          <span className="text-xs text-gray-500">/hour · callout extra</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-whatsapp text-xs py-2"
            onClick={(e) => e.stopPropagation()}
          >
            💬 WA
          </a>
          <Link
            href={`/plumber/${plumber.slug ?? plumber.id}#book`}
            className="btn-secondary text-xs py-2"
          >
            Book
          </Link>
          <Link
            href={`/plumber/${plumber.slug ?? plumber.id}`}
            className="btn-primary text-xs py-2"
          >
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
