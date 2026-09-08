import { callLink, formatWhatsApp, isLandline, whatsAppLink } from "@/lib/utils";

export function directoryContact(phone?: string | null, message?: string) {
  const value = phone?.trim() ?? "";
  const digits = formatWhatsApp(value);
  const valid = /^[+\d()\s.-]+$/.test(value) && /^27[1-8]\d{8}$/.test(digits);
  return {
    telephone: valid ? `+${digits}` : null,
    phoneHref: valid ? callLink(value) : null,
    whatsappHref: valid && !isLandline(value) ? whatsAppLink(value, message) : null,
  };
}
