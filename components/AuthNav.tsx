"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/src/supabaseClient";

export function AuthNav() {
  const [auth, setAuth] = useState<{ loggedIn: boolean; admin: boolean }>({ loggedIn: false, admin: false });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted || !session?.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      if (mounted) setAuth({ loggedIn: true, admin: profile?.role === "admin" });
    });
    return () => { mounted = false; };
  }, []);

  if (auth.loggedIn) {
    return (
      <div className="hidden items-center gap-2 md:flex">
        {auth.admin && <Link href="/admin" className="rounded-lg px-3 py-2 text-sm font-bold text-white/85 hover:bg-white/10 hover:text-white">Admin</Link>}
        <Link href="/dashboard" className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-brand hover:bg-sky-50">Dashboard</Link>
        <form action="/auth/signout" method="post">
          <button className="rounded-lg border border-white/30 px-3 py-2 text-sm font-bold text-white hover:bg-white/10">Sign out</button>
        </form>
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Link href="/login" className="rounded-lg border border-white/30 px-3 py-2 text-sm font-bold text-white hover:bg-white/10">Sign in</Link>
      <Link href="/register" className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-brand hover:bg-sky-50">List a business</Link>
    </div>
  );
}
