export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.kznplumbers.co.za"
).replace(/\/$/, "");

export const SITE_NAME = "KZN Plumbers Directory";
export const SUPPORT_EMAIL = "thabiso@kznplumbers.co.za";
export const SUPPORT_WHATSAPP = "27609922848";

export function absoluteUrl(path = "/"): string {
  return new URL(path, `${SITE_URL}/`).toString();
}
