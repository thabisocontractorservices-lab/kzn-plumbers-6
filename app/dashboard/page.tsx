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
import { DashboardNav } from "@/components/DashboardNav";

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
  whatsapp_number: string | null;
  hourly_rate: number | null;
  has_photos?: boolean;
  has_profile_photo?: boolean;
  has_certs?: boolean;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPlumbers, setAdminPlumbers] = useState<Array<{ id: string; trading_name: string; slug: string | null }>>([]);
  const [previewingAs, setPreviewingAs] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    (async () => {
      const [plumberRes, profileRes, roleRes] = await Promise.all([
        supabase
          .from("plumbers")
          .select("*")
          .eq("profile_id", user.id)
          .maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
        supabase.from("profiles").select("role").eq("id", user.id).single(),
      ]);

      if (!mounted) return;

      const admin = (roleRes.data as { role?: string } | null)?.role === "admin";
      setIsAdmin(admin);

      let p = plumberRes.data as Plumber | null;

      // Admin without own plumber profile: load a list of plumbers to preview
      if (!p && admin) {
        const { data: allPlumbers } = await supabase
          .from("plumbers")
          .select("id, trading_name, slug")
          .eq("is_verified", true)
          .order("trading_name")
          .limit(100);
        // Filter to only plumbers with profile_id (claimed accounts)
        const claimed = ((allPlumbers ?? []) as Array<{ id: string; trading_name: string; slug: string | null; profile_id?: string }>)
          .filter((pl) => !!pl.profile_id);
        if (mounted) setAdminPlumbers(claimed);
      }

      // Check photos + certs for completeness %
      if (p) {
        const [photosRes, profilePhotoRes, certsRes] = await Promise.all([
          supabase
            .from("photos")
            .select("id", { count: "exact", head: true })
            .eq("plumber_id", p.id),
          supabase
            .from("photos")
            .select("id", { count: "exact", head: true })
            .eq("plumber_id", p.id)
            .eq("is_profile_photo", true),
          supabase
            .from("certifications")
            .select("id", { count: "exact", head: true })
            .eq("plumber_id", p.id),
        ]);
        (p as Plumber).has_photos = (photosRes.count ?? 0) > 0;
        (p as Plumber).has_profile_photo = (profilePhotoRes.count ?? 0) > 0;
        (p as Plumber).has_certs = (certsRes.count ?? 0) > 0;
      }

      setPlumber(p);
      setProfileName(profileRes.data?.full_name ?? user.email ?? "there");

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

  if (!plumber && !previewingAs) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center">
        <div className="w-20 h-20 rounded-full bg-brand-light text-brand flex items-center justify-center text-4xl mx-auto mb-6">
          🔧
        </div>
        <h1 className="font-display text-3xl mb-3">
          {isAdmin ? "Admin Dashboard Preview" : "Complete your business profile"}
        </h1>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          {isAdmin
            ? "You're logged in as admin. Select a plumber below to preview their dashboard experience."
            : "You're signed in but don't have a business listing yet. Set up your profile to appear on the KZN Plumbers directory."}
        </p>

        {isAdmin && adminPlumbers.length > 0 ? (
          <div className="max-w-md mx-auto">
            <select
              className="input mb-4 text-center"
              defaultValue=""
              onChange={async (e) => {
                if (!e.target.value) return;
                setLoading(true);
                const { data } = await supabase
                  .from("plumbers")
                  .select("*")
                  .eq("id", e.target.value)
                  .single();
                if (data) {
                  const p = data as Plumber;
                  const [photosRes, profilePhotoRes, certsRes] = await Promise.all([
                    supabase.from("photos").select("id", { count: "exact", head: true }).eq("plumber_id", p.id),
                    supabase.from("photos").select("id", { count: "exact", head: true }).eq("plumber_id", p.id).eq("is_profile_photo", true),
                    supabase.from("certifications").select("id", { count: "exact", head: true }).eq("plumber_id", p.id),
                  ]);
                  p.has_photos = (photosRes.count ?? 0) > 0;
                  p.has_profile_photo = (profilePhotoRes.count ?? 0) > 0;
                  p.has_certs = (certsRes.count ?? 0) > 0;
                  setPlumber(p);
                  setPreviewingAs(p.trading_name);
                  const { data: bk } = await supabase
                    .from("bookings")
                    .select("*")
                    .eq("plumber_id", p.id)
                    .order("created_at", { ascending: false })
                    .limit(8);
                  setBookings((bk as Booking[]) ?? []);
                }
                setLoading(false);
              }}
            >
              <option value="">Select a plumber to preview...</option>
              {adminPlumbers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.trading_name}
                </option>
              ))}
            </select>
            <Link href="/admin" className="btn-secondary">
              ← Back to Admin Panel
            </Link>
          </div>
        ) : (
          <Link href={isAdmin ? "/admin" : "/register"} className="btn-primary">
            {isAdmin ? "← Back to Admin Panel" : "Set up my business →"}
          </Link>
        )}
      </div>
    );
  }

  // At this point plumber is guaranteed non-null (checked above)
  const p = plumber!;

  const r = combinedRating(
    p.google_rating,
    p.google_review_count,
    p.ratings?.internal_rating,
    p.ratings?.internal_count,
  );

  const completeness = computeCompleteness(p);
  const reviewLink = p.google_place_id ? reviewUrl(p.google_place_id) : null;
  const shortLink = `${typeof window !== "undefined" ? window.location.origin : ""}/review/${p.slug ?? p.id}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid lg:grid-cols-[240px_1fr] gap-6">
      <DashboardNav />

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
          <AvailabilityToggle plumberId={p.id} initial={p.availability_status} />
        </header>

        {/* Admin preview banner */}
        {previewingAs && (
          <div className="mb-6 rounded-xl border border-purple-200 bg-purple-50 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">👁</span>
              <span className="text-sm font-semibold text-purple-800">
                Previewing as: {previewingAs}
              </span>
            </div>
            <button
              onClick={() => { setPlumber(null); setPreviewingAs(null); setBookings([]); }}
              className="text-xs text-purple-700 hover:underline font-medium"
            >
              ← Back to picker
            </button>
          </div>
        )}

        {/* WhatsApp Community banner */}
        <div className="mb-6 rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-5">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center text-2xl shrink-0">
              💬
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-base font-bold text-gray-900 mb-0.5">
                Join our exclusive WhatsApp community
              </h3>
              <p className="text-sm text-gray-600">
                Connect with other KZN plumbers, get tips, share leads, and stay updated on new features.
              </p>
            </div>
            <a
              href="https://whatsapp.com/channel/0029Vb8gADzG3R3pl9D5Qe1u"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp whitespace-nowrap shrink-0 text-sm"
            >
              💬 Join community
            </a>
          </div>
        </div>

        {!p.is_verified && (
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
            <span className="font-bold text-brand">{completeness.percent}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                completeness.percent === 100
                  ? "bg-gradient-to-r from-green-400 to-teal"
                  : "bg-gradient-to-r from-brand to-teal"
              }`}
              style={{ width: `${completeness.percent}%` }}
            />
          </div>
          {completeness.percent === 100 ? (
            <p className="text-xs text-green-600 mt-2 font-medium">
              ✓ Your profile is 100% complete — looking great!
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500 mt-2">
                Complete your profile to unlock 3.4× more enquiries.
              </p>
              {completeness.missing.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {completeness.missing.slice(0, 3).map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs shrink-0">○</span>
                      {item}
                    </li>
                  ))}
                  {completeness.missing.length > 3 && (
                    <li className="text-xs text-gray-400 pl-7">
                      +{completeness.missing.length - 3} more
                    </li>
                  )}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Stat icon="👁" value={p.profile_views} label="Profile views (30d)" color="bg-brand-light text-brand" />
          <Stat icon="📅" value={bookings.length} label="Recent bookings" color="bg-green-100 text-green-800" />
          <Stat icon="⭐" value={r.rating ?? "—"} label={`Avg rating · ${r.count} reviews`} color="bg-amber-light text-amber" />
          <Stat icon="💬" value={p.is_emergency ? "24/7" : "Business hrs"} label="Availability" color="bg-purple-100 text-purple-700" />
        </div>

        {reviewLink && (
          <ReviewLinkSection reviewUrl={reviewLink} shortUrl={shortLink} plumberName={p.trading_name} />
        )}

        <div className="grid lg:grid-cols-2 gap-5 mt-6">
          <BookingsTable bookings={bookings} />
        </div>
      </div>
    </div>
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

type CompletenessResult = { percent: number; missing: string[] };

function computeCompleteness(p: Plumber): CompletenessResult {
  const criteria: [boolean, string, string][] = [
    // [isMet, label, link to fix it]
    [!!p.about && p.about.length >= 20, "Add a business description", "/dashboard/profile"],
    [p.specialties.length > 0, "Add at least one specialty", "/dashboard/profile"],
    [!!p.whatsapp_number, "Add a phone number", "/dashboard/profile"],
    [!!p.pirb_number, "Add your PIRB number", "/dashboard/profile"],
    [!!p.has_profile_photo, "Upload a profile photo", "/dashboard/uploads"],
    [!!p.has_photos, "Upload work photos", "/dashboard/uploads"],
    [!!p.has_certs, "Upload certifications", "/dashboard/uploads"],
    [!!p.hourly_rate, "Set your hourly rate", "/dashboard/profile"],
  ];

  const met = criteria.filter(([ok]) => ok).length;
  const missing = criteria.filter(([ok]) => !ok).map(([, label]) => label);
  return { percent: Math.round((met / criteria.length) * 100), missing };
}
