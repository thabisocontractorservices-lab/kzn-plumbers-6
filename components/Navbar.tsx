import Link from "next/link";
import { createSupabaseServerClient } from "@/utils/supabase/server";

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
    <nav className="bg-brand sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-xl">
            🔧
          </div>
          <span className="text-white font-bold text-lg tracking-tight">
            KZN<span className="text-sky-300">Plumbers</span>
          </span>
        </Link>

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

        <div className="flex gap-2 items-center">
          {user ? (
            <>
              <span className="hidden sm:inline text-white/70 text-xs">
                {user.email}
              </span>
              <form action="/auth/signout" method="post">
                <button className="text-white/90 border border-white/40 hover:bg-white/15 px-3 py-1.5 rounded-md text-sm font-semibold">
                  Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-white/90 border border-white/40 hover:bg-white/15 px-3 py-1.5 rounded-md text-sm font-semibold"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="bg-white text-brand hover:bg-brand-light px-3 py-1.5 rounded-md text-sm font-semibold"
              >
                List Free
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
