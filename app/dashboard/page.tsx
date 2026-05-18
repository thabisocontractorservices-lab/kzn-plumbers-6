"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/src/supabaseClient";
import { reviewUrl } from "@/lib/google/places";
import { combinedRating } from "@/lib/utils";
import { useAuthGate } from "@/lib/useAuthGate";
import { AvailabilityToggle } from "@/components/AvailabilityToggle";
import { ReviewLinkSection } from "@/components/ReviewLinkSection";
import { DashboardLoading } from "@/components/DashboardLoading";

type Plumber = {
  id: string;
  trading_name: string;
  slug: string | null;
  availability_status: "available" | "busy" | "unavailable";
  google_place_id: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  is_emergency: boolean;
  about: string | null;
  specialties: string[];
  google_calendar_url: string | null;
  pirb_number: string | null;
  is_certified: boolean;
  is_verified: boolean;
  profile_views: number;
  has_photos?: boolean;
  ratings?: { internal_rating: number | null; internal_count: number };
};

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  job_description: string;
  preferred_datetime: string;
  status: "pending" | "confirmed" | "cancelled";
};

export default function DashboardPage() {
  const { user, authChecking } = useAuthGate();
  const [plumber, setPlumber] = useState<Plumber | null>(null);
  const [profileName, setProfileName] = useState<string>("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    (async () => {
      const [plumberRes, profileRes] = await Promise.all([
        supabase
          .from("plumbers")
          .select("*")
          .eq("profile_id", user.id)
          .maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      ]);

      if (!mounted) return;
      const p = plumberRes.data as Plumber | null;

      // Check if plumber has photos (for completeness %)
      if (p) {
        const { count } = await supabase
          .from("photos")
          .select("id", { count: "exact", head: true })
          .eq("plumber_id", p.id);
        (p as Plumber).has_photos = (count ?? 0) > 0;
      }

      setPlumber(p);
      setProfileName(profileRes.data?.full_name ?? user.email);

      if (p) {
        const { data } = await supabase
          .from("bookings")
          .select("*")
          .eq("plumber_id", p.id)
          .order("created_at", { ascending: false })
          .limit(8);
        if (mounted) setBookings((data as Booking[]) ?? []);
      }

      if (mounted) setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

  if (authChecking || loading) return <DashboardLoading />;
  if (!user) return null; // redirecting

  if (!plumber) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center">
        <h1 className="font-display text-3xl mb-3">No plumber profile yet</h1>
        <p className="text-gray-600 mb-6">
          You're logged in but haven't completed registration.
        </p>
        <Link href="/register" className="btn-primary">
          Complete registration
        </Link>
      </div>
    );
  }

  const r = combinedRating(
    plumber.google_rating,
    plumber.google_review_count,
    plumber.ratings?.internal_rating,
    plumber.ratings?.internal_count,
  );

  const completeness = computeCompleteness(plumber);
  const reviewLink = plumber.google_place_id ? reviewUrl(plumber.google_place_id) : null;
  const shortLink = `${typeof window !== "undefined" ? window.location.origin : ""}/review/${plumber.slug ?? plumber.id}`;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-[240px_1fr] gap-6">
      <Sidebar />

      <div>
        <header className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl">
              Sawubona, {profileName?.split(" ")[0] ?? "there"} 👋
            </h1>
            <p className="text-gray-500 text-sm">
              Here's what's happening with your business today
            </p>
          </div>
          <AvailabilityToggle plumberId={plumber.id} initial={plumber.availability_status} />
        </header>

        {!plumber.is_verified && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
            <div className="flex gap-3 items-start">
              <span className="text-2xl shrink-0">⏳</span>
              <div className="flex-1">
                <strong className="block text-amber-900 mb-1">
                  Pending verification
                </strong>
                <p className="text-sm text-amber-900/80 leading-relaxed">
                  Your application is under review. Our admin team typically
                  verifies new plumbers within 24–48 hours. Once approved, your
                  business will appear on the public directory and you'll start
                  receiving enquiries.
                </p>
                <p className="text-xs text-amber-900/70 mt-2">
                  In the meantime, complete your profile below to be ready when
                  you go live.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="panel mb-6">
          <div className="flex justify-between items-center mb-2">
            <strong>Profile completeness</strong>
            <span className="font-bold text-brand">{completeness}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand to-teal transition-all"
              style={{ width: `${completeness}%` }}
            />
          </div>
          {completeness < 100 && (
            <p className="text-xs text-gray-500 mt-2">
              Complete your profile to unlock 3.4× more enquiries.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Stat icon="👁" value={plumber.profile_views} label="Profile views (30d)" color="bg-brand-light text-brand" />
          <Stat icon="📅" value={bookings.length} label="Recent bookings" color="bg-green-100 text-green-800" />
          <Stat icon="⭐" value={r.rating ?? "—"} label={`Avg rating · ${r.count} reviews`} color="bg-amber-light text-amber" />
          <Stat icon="💬" value={plumber.is_emergency ? "24/7" : "Business hrs"} label="Availability" color="bg-purple-100 text-purple-700" />
        </div>

        {reviewLink && (
          <ReviewLinkSection reviewUrl={reviewLink} shortUrl={shortLink} plumberName={plumber.trading_name} />
        )}

        <div className="grid lg:grid-cols-2 gap-5 mt-6">
          <BookingsTable bookings={bookings} />
        </div>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="bg-white border border-gray-200 rounded-xl p-3 h-fit">
      <nav className="flex flex-col gap-1">
        {[
          { href: "/dashboard", icon: "📊", label: "Overview" },
          { href: "/dashboard/profile", icon: "👤", label: "Edit Profile" },
          { href: "/dashboard/uploads", icon: "📸", label: "Photos & Certs" },
          { href: "/dashboard/bookings", icon: "📅", label: "Bookings" },
          { href: "/dashboard/reviews", icon: "⭐", label: "Reviews" },
        ].map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium"
          >
            <span>{i.icon}</span>
            {i.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function Stat({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg mb-2 ${color}`}>{icon}</div>
      <div className="font-display text-2xl font-bold leading-none">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function BookingsTable({ bookings }: { bookings: Booking[] }) {
  return (
    <div className="panel">
      <h2 className="font-display text-xl mb-4">Recent bookings</h2>
      {bookings.length === 0 ? (
        <p className="text-sm text-gray-500">No bookings yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
            <tr>
              <th className="py-2">Customer</th>
              <th className="py-2">Job</th>
              <th className="py-2">When</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-gray-100 last:border-0">
                <td className="py-3">
                  <strong>{b.customer_name}</strong>
                  <br />
                  <span className="text-xs text-gray-500">{b.customer_phone}</span>
                </td>
                <td className="py-3">{b.job_description.slice(0, 40)}</td>
                <td className="py-3">
                  {new Date(b.preferred_datetime).toLocaleString("en-ZA", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-3">
                  <span className={`badge ${statusClass(b.status)}`}>{b.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function statusClass(s: string) {
  return (
    {
      pending: "bg-amber-light text-amber",
      confirmed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    }[s] ?? "bg-gray-100"
  );
}

function computeCompleteness(p: Plumber): number {
  const checks = [
    p.about,
    p.specialties.length > 0,
    p.google_place_id,
    p.google_calendar_url,
    p.pirb_number,
    p.is_certified,
    p.has_photos,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
