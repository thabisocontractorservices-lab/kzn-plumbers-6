import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AccessError, requireAdmin, requireUser } from "@/lib/server-access";

/** Ownership is checked server-side. A writable profiles.role alone grants nothing. */
export async function requireAuthFlowFileManager(request: Request, plumberId: string) {
  const user = await requireUser(request);
  const admin = getSupabaseAdmin();
  const result = await admin.from("plumbers").select("profile_id").eq("id", plumberId).maybeSingle();
  if (result.error) throw new AccessError("Cannot verify file access right now.", 503);
  if (!result.data) throw new AccessError("Listing not found.", 404);
  if (result.data.profile_id !== user.id) await requireAdmin(request);
  return { user, admin };
}

/**
 * Accept canonical bucket paths and legacy Supabase signed/public URLs from this project only.
 * Never fetch or redirect to a stored URL; extract and validate its object key before signing anew.
 */
export function authFlowStoragePath(value: string, bucket: "certs" | "photos", plumberId: string): string | null {
  if (!value || value.length > 4096 || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(plumberId)) return null;
  const rawPath = value.split(/[?#]/, 1)[0];
  if (/(?:^|\/)\.{1,2}(?:\/|$)/.test(rawPath) || /%(?:2f|5c|2e|25|00|0a|0d)/i.test(rawPath)) return null;
  let candidate = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const configured = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
      const url = new URL(value);
      if (url.origin !== configured.origin || url.username || url.password || url.hash) return null;
      const prefix = [`/storage/v1/object/sign/${bucket}/`, `/storage/v1/object/public/${bucket}/`]
        .find((part) => url.pathname.startsWith(part));
      if (!prefix) return null;
      candidate = url.pathname.slice(prefix.length);
    } catch { return null; }
  } else if (candidate.startsWith("/") || candidate.includes(":") || /[?#]/.test(candidate)) {
    return null;
  }
  // Reject encoded separators, dot traversal (including double encoding), and control bytes.
  if (/%(?:2f|5c|2e|25|00|0a|0d)/i.test(candidate)) return null;
  try { candidate = decodeURIComponent(candidate); } catch { return null; }
  if (candidate.length > 1024 || /[\\%?#:\u0000-\u001f\u007f]/.test(candidate)) return null;
  const parts = candidate.split("/");
  if (parts.length < 2 || parts[0] !== plumberId || parts.some((part) => !part || part === "." || part === ".." || part.trim() !== part)) return null;
  return candidate;
}
