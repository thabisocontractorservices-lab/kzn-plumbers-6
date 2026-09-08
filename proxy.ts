import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL } from "@/lib/site";
import { isAllowedAdminEmail } from "@/lib/admin-identity";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/src/supabaseClient";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const canonical = new URL(SITE_URL);
  const host = request.headers.get("host")?.toLowerCase();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.toLowerCase();

  const localHost = host?.startsWith("localhost") || host?.startsWith("127.0.0.1");
  const enforceCanonicalHost = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === "production"
    : process.env.NODE_ENV === "production";
  if (
    enforceCanonicalHost &&
    !localHost &&
    ((host && host !== canonical.host.toLowerCase()) || (forwardedProto && forwardedProto !== "https"))
  ) {
    const destination = new URL(`${path}${request.nextUrl.search}`, SITE_URL);
    return NextResponse.redirect(destination, 308);
  }

  const protectedRoute = path.startsWith("/dashboard") || path.startsWith("/admin");
  const authRoute = path.startsWith("/auth");
  if (!protectedRoute && !authRoute) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && protectedRoute) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  if (user && path.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string }>();
    if (profile?.role !== "admin" || !isAllowedAdminEmail(user.email) || !user.email_confirmed_at) return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
