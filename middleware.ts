import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from "@/src/supabaseClient";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Refreshes the Supabase session cookie on every request and gates
 * protected routes server-side (so /dashboard and /admin don't flash their
 * loading skeleton before client-side useAuthGate kicks in).
 *
 * The actual page-level auth check still runs in useAuthGate as defence-in-depth.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }: CookieToSet) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: this call is what actually refreshes the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Logged-out users can't reach protected pages
  if (!user && (path.startsWith("/dashboard") || path.startsWith("/admin"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Non-admins can't reach /admin
  if (user && path.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string }>();
    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
