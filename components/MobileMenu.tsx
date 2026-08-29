"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { supabase } from "@/src/supabaseClient";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState({ loggedIn: false, admin: false });
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted || !session?.user) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      if (mounted) setAuth({ loggedIn: true, admin: profile?.role === "admin" });
    });
    return () => { mounted = false; };
  }, []);

  function close() {
    setOpen(false);
  }

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg p-2 text-white hover:bg-white/10"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 bg-black/35" onClick={close} />
          <div className="absolute left-0 right-0 top-full z-50 border-t border-white/10 bg-brand shadow-xl">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4">
              <MobileLink href="/" label="Find a plumber" active={pathname === "/"} onClick={close} />
              <MobileLink href="/#regions" label="Browse by area" active={false} onClick={close} />
              <MobileLink href="/#services" label="Browse by service" active={false} onClick={close} />
              <MobileLink href="/trust" label="How we verify" active={pathname === "/trust"} onClick={close} />
              <MobileLink href="/help" label="Help centre" active={pathname === "/help"} onClick={close} />
              <MobileLink href="/blog" label="Guides" active={pathname.startsWith("/blog")} onClick={close} />
              <div className="my-2 border-t border-white/15" />
              {auth.admin && <MobileLink href="/admin" label="Admin" active={pathname.startsWith("/admin")} onClick={close} />}
              {auth.loggedIn ? (
                <>
                  <MobileLink href="/dashboard" label="Dashboard" active={pathname.startsWith("/dashboard")} onClick={close} highlight />
                  <form action="/auth/signout" method="post"><button onClick={close} className="w-full rounded-lg px-4 py-3 text-left text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white">Sign out</button></form>
                </>
              ) : (
                <>
                  <MobileLink href="/login" label="Sign in" active={pathname === "/login"} onClick={close} />
                  <MobileLink href="/register" label="List a business" active={pathname === "/register"} onClick={close} highlight />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MobileLink({ href, label, active, onClick, highlight = false }: { href: string; label: string; active: boolean; onClick: () => void; highlight?: boolean }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
        highlight
          ? "bg-white text-brand"
          : active
            ? "bg-white/15 text-white"
            : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}
