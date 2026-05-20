"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileMenu({
  isLoggedIn,
  isAdmin,
}: {
  isLoggedIn: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function close() {
    setOpen(false);
  }

  return (
    <div className="md:hidden">
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(!open)}
        className="text-white p-2 -mr-2 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Toggle menu"
      >
        {open ? (
          // X icon
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          // Hamburger icon
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        )}
      </button>

      {/* Slide-down menu */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={close}
          />

          {/* Menu panel */}
          <div className="absolute top-full left-0 right-0 bg-brand border-t border-white/10 shadow-xl z-50 animate-slideDown">
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
              <MobileLink
                href="/"
                label="🔍 Find a Plumber"
                active={pathname === "/"}
                onClick={close}
              />

              {!isLoggedIn && (
                <MobileLink
                  href="/register"
                  label="📋 List Your Business"
                  active={pathname === "/register"}
                  onClick={close}
                />
              )}

              {isLoggedIn && (
                <MobileLink
                  href="/dashboard"
                  label="📊 Dashboard"
                  active={pathname.startsWith("/dashboard")}
                  onClick={close}
                />
              )}

              {isAdmin && (
                <MobileLink
                  href="/admin"
                  label="⚙️ Admin"
                  active={pathname === "/admin"}
                  onClick={close}
                />
              )}

              {/* Divider + auth actions */}
              <div className="border-t border-white/15 my-1.5" />

              {isLoggedIn ? (
                <form action="/auth/signout" method="post">
                  <button
                    onClick={close}
                    className="w-full text-left text-white/80 hover:text-white hover:bg-white/10 px-4 py-3 rounded-lg text-sm font-medium"
                  >
                    🚪 Logout
                  </button>
                </form>
              ) : (
                <>
                  <MobileLink
                    href="/login"
                    label="🔑 Login"
                    active={pathname === "/login"}
                    onClick={close}
                  />
                  <MobileLink
                    href="/register"
                    label="✨ Register Free"
                    active={pathname === "/register"}
                    onClick={close}
                    highlight
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MobileLink({
  href,
  label,
  active,
  onClick,
  highlight,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        highlight
          ? "bg-white text-brand font-semibold"
          : active
            ? "bg-white/15 text-white"
            : "text-white/80 hover:text-white hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );
}
