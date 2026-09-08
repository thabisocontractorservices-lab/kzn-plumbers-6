import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { safeAuthReturnPath } from "@/lib/auth-flow-return";

/**
 * OAuth callback handler.
 * Configure Supabase Auth → URL Configuration → Redirect URLs to include:
 *   https://yourdomain.com/auth/callback
 *   http://localhost:3000/auth/callback
 *
 * Exchanges the auth code for a session and writes the session cookie via
 * the SSR helper, so subsequent server-side requests see the user as logged in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeAuthReturnPath(searchParams.get("next"));
  let destination = new URL("/login", origin);
  destination.searchParams.set("error", "auth");
  destination.searchParams.set("next", next);
  try {
    if (code && code.length <= 4096) {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!userError && user?.email_confirmed_at) destination = new URL(next, origin);
        else destination.searchParams.set("error", "confirmation");
      }
    }
  } catch {
    // Do not log callback URLs, codes, tokens or user data.
  }
  const response = NextResponse.redirect(destination, { status: 303 });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
