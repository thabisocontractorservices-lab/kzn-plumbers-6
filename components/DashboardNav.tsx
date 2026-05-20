"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "📊", label: "Overview" },
  { href: "/dashboard/profile", icon: "👤", label: "Edit Profile" },
  { href: "/dashboard/uploads", icon: "📸", label: "Photos & Certs" },
  { href: "/dashboard/bookings", icon: "📅", label: "Bookings" },
  { href: "/dashboard/reviews", icon: "⭐", label: "Reviews" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile: horizontal scrollable nav */}
      <div className="lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 mb-6 overflow-x-auto">
        <nav className="flex gap-2 min-w-max pb-2">
          {NAV_ITEMS.map((i) => {
            const active =
              i.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(i.href);
            return (
              <Link
                key={i.href}
                href={i.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-brand text-white"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                <span>{i.icon}</span>
                {i.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Desktop: vertical sidebar */}
      <aside className="hidden lg:block bg-white border border-gray-200 rounded-xl p-3 h-fit">
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((i) => {
            const active =
              i.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(i.href);
            return (
              <Link
                key={i.href}
                href={i.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-light text-brand"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span>{i.icon}</span>
                {i.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
