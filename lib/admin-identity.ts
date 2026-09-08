// Server-side backstop while legacy profiles.role is being audited.
// These are the existing owner/admin identities supplied in the project handoff.
// This list does not grant access: the user must also have a verified session,
// a confirmed email and role=admin in profiles.
const EXISTING_ADMIN_EMAILS = [
  "thabisocontractorservices@gmail.com",
  "thabiso@kznplumbers.co.za",
  "zonamagadla@gmail.com",
];

export function isAllowedAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const configured = process.env.ADMIN_ALLOWED_EMAILS;
  const allowed = configured === undefined
    ? EXISTING_ADMIN_EMAILS
    : configured.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
