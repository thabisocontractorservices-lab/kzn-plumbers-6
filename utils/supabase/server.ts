// utils/supabase/server.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cookie-aware Supabase client for SERVER-SIDE auth only.
// Use this in:
//   • Route handlers that need to set/clear session cookies
//     (e.g. /auth/callback, /auth/signout)
//   • Middleware (session refresh + protected-route gating)
//   • Server components that need to know if the user is logged in
//     (e.g. Navbar showing Dashboard/Logout links)
//
// For client-side data calls (signUp, signIn, .from(...), .storage), keep using
// `supabase` from src/supabaseClient.js. They share the same cookie session.
// ─────────────────────────────────────────────────────────────────────────────

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from "@/src/supabaseClient";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Build a Supabase server client bound to the current request's cookies.
 *
 * Usage in a route handler / server component:
 *   const supabase = await createSupabaseServerClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — middleware refreshes the session
          // on the next request, so this is safe to ignore.
        }
      },
    },
  });
}
