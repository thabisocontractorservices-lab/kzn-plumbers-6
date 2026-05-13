import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Strip non-digits from a SA phone number; returns the wa.me-friendly form. */
export function formatWhatsApp(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  // Convert local 0XX to international 27XX
  if (digits.startsWith("0")) digits = "27" + digits.slice(1);
  if (!digits.startsWith("27") && digits.length === 9) digits = "27" + digits;
  return digits;
}

/** Build a wa.me link with optional pre-filled text. */
export function whatsAppLink(phone: string, text?: string): string {
  const num = formatWhatsApp(phone);
  const txt = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${num}${txt}`;
}

/**
 * SA mobile numbers (which support WhatsApp) start with 6, 7, or 8 after the
 * country code. Landlines start with 1, 2, 3, 4, or 5 (area codes like 011,
 * 021, 031, etc.). Returns true if the number is a landline → don't show
 * the WhatsApp button for those.
 */
export function isLandline(phone: string): boolean {
  const digits = formatWhatsApp(phone);
  if (!digits || digits.length !== 11) return true; // unparseable → safest = treat as landline
  if (!digits.startsWith("27")) return true;
  const firstNational = digits.charAt(2);
  return !["6", "7", "8"].includes(firstNational);
}

/** Build a tel: link for landline call buttons. */
export function callLink(phone: string): string {
  const num = formatWhatsApp(phone);
  return `tel:+${num}`;
}

/** Combine Google + internal ratings into a single weighted average. */
export function combinedRating(
  googleRating: number | null | undefined,
  googleCount: number | null | undefined,
  internalRating: number | null | undefined,
  internalCount: number | null | undefined,
): { rating: number | null; count: number } {
  const gR = googleRating ?? 0;
  const gC = googleCount ?? 0;
  const iR = internalRating ?? 0;
  const iC = internalCount ?? 0;
  const total = gC + iC;
  if (total === 0) return { rating: null, count: 0 };
  const weighted = (gR * gC + iR * iC) / total;
  return { rating: Math.round(weighted * 10) / 10, count: total };
}

/** Format a number as ZAR currency. */
export function formatRand(amount: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Initials from a trading name, max 2 chars. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export const KZN_AREAS = [
  "Durban North",
  "Durban South",
  "PMB",
  "Richards Bay",
  "Newcastle",
  "Pinetown",
  "Ballito",
  "Other KZN",
] as const;

export const SPECIALTIES = [
  "Burst pipes",
  "Geyser repair",
  "Drain cleaning",
  "Bathroom fitting",
  "Gas fitting",
  "Solar geyser",
  "Industrial",
  "Leak detection",
  "Pipe relining",
  "Commercial",
] as const;

export type KznArea = (typeof KZN_AREAS)[number];
export type Specialty = (typeof SPECIALTIES)[number];
