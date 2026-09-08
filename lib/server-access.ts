import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { isAllowedAdminEmail } from "@/lib/admin-identity";

export class AccessError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function requireUser(request?: Request): Promise<User> {
  const header = request?.headers.get("authorization");
  const client = header?.startsWith("Bearer ") ? getSupabaseAdmin() : await createSupabaseServerClient();
  const result = header?.startsWith("Bearer ")
    ? await client.auth.getUser(header.slice(7))
    : await client.auth.getUser();
  if (result.error || !result.data.user) throw new AccessError("Please sign in again.", 401);
  if (!result.data.user.email_confirmed_at) throw new AccessError("Confirm your email address first.", 403);
  return result.data.user;
}

export async function requireAdmin(request?: Request) {
  const user = await requireUser(request);
  if (!isAllowedAdminEmail(user.email)) throw new AccessError("This account is not authorised for directory administration.", 403);
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error) throw new AccessError("Cannot verify administrator access right now.", 503);
  if (data?.role !== "admin") throw new AccessError("Administrator access is required.", 403);
  return { user, admin };
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  const canonical = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (origin && origin !== expected && origin !== canonical) throw new AccessError("Invalid request origin.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new AccessError("Cross-site request refused.", 403);
}

export function privateJson(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie, Authorization" } });
}

export function accessFailure(error: unknown) {
  if (error instanceof AccessError) return privateJson({ error: error.message }, error.status);
  console.error("[admin] Request failed");
  return privateJson({ error: "This action could not be completed. No success was recorded." }, 503);
}

export function isMissingSchema(error: { code?: string; message?: string } | null | undefined): boolean {
  return Boolean(error && ["42703", "42P01", "PGRST204", "PGRST205", "PGRST202"].includes(error.code || ""));
}
