import Link from "next/link";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { MobileMenu } from "./MobileMenu";

export async function Navbar() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string }>();
    role = data?.role ?? null;
  }

  return (
    <nav className="bg-brand sticky top-0 z-40 shadow-md relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white rounded-lg flex items-center justify-center text-lg sm:text-xl shrink-0">
            🔧
          </div>
          <span className="text-white font-bold text-base sm:text-lg tracking-tight truncate">
            KZN<span className="text-sky-300">Plumbers</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex gap-1 items-center">
          <Link
            href="/"
            className="text-white/85 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/10 text-sm font-semibold"
          >
            Find a Plumber
          </Link>
          {!user && (
            <Link
              href="/register"
              className="text-white/85 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/10 text-sm font-semibold"
            >
              List Your Business
            </Link>
          )}
          {user && (
            <Link
              href="/dashboard"
              className="text-white/85 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/10 text-sm font-semibold"
            >
              Dashboard
            </Link>
          )}
          {role === "admin" && (
            <Link
              href="/admin"
              className="text-white/85 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/10 text-sm font-semibold"
            >
              Admin
            </Link>
          )}
        </div>

        {/* Desktop auth buttons + Mobile hamburger */}
        <div className="flex gap-1.5 sm:gap-2 items-center shrink-0">
          {user ? (
            <>
              <span className="hidden md:inline text-white/70 text-xs">
                {user.email}
              </span>
              <form action="/auth/signout" method="post" className="hidden md:block">
                <button className="text-white/90 border border-white/40 hover:bg-white/15 px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold">
                  Logout
                </button>
              </form>
            </>
          ) : (
            <div className="hidden md:flex gap-1.5 sm:gap-2">
              <Link
                href="/login"
                className="text-white/90 border border-white/40 hover:bg-white/15 px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="bg-white text-brand hover:bg-brand-light px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold whitespace-nowrap"
              >
                List Free
              </Link>
            </div>
          )}

          {/* Mobile hamburger menu */}
          <MobileMenu isLoggedIn={!!user} isAdmin={role === "admin"} />
        </div>
      </div>
    </nav>
  );
}
