import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";

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
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
