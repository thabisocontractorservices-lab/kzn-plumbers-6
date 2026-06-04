"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { useAuthGate } from "@/lib/useAuthGate";
import { AdminCard } from "@/components/AdminCard";
import { ClaimCard, type Claim } from "@/components/ClaimCard";
import { DashboardLoading } from "@/components/DashboardLoading";

type Application = {
  id: string;
  trading_name: string;
  slug: string | null;
  area: string;
  pirb_number: string | null;
  specialties: string[];
  is_verified: boolean;
  created_at: string;
  certifications?: Array<{ count: number }>;
  photos?: Array<{ count: number }>;
  profile?: { full_name?: string; email?: string };
};

type UserWithBusiness = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  phone_number: string | null;
  whatsapp_number: string | null;
  created_at: string;
  plumber?: {
    id: string;
    trading_name: string;
    area: string;
    is_verified: boolean;
    slug: string | null;
  }[];
};

// Outer wrapper — Next.js requires useSearchParams() to live inside a
// Suspense boundary so the page shell can be statically prerendered.
export default function AdminPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const search = useSearchParams();
  const { user, authChecking } = useAuthGate({ requireAdmin: true });

  const tab = search.get("tab") ?? "pending";
  const isVerified = tab === "approved";

  const [applications, setApplications] = useState<Application[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [users, setUsers] = useState<UserWithBusiness[]>([]);
  const [pending, setPending] = useState(0);
  const [approved, setApproved] = useState(0);
  const [claimsPending, setClaimsPending] = useState(0);
  const [usersCount, setUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    (async () => {
      const [appsRes, pendingRes, approvedRes, claimsCountRes, usersCountRes] = await Promise.all([
        supabase
          .from("plumbers")
          .select("*, certifications(count), photos(count), profile:profiles(full_name, email)")
          .eq("is_verified", isVerified)
          .order("created_at", { ascending: false }),
        supabase.from("plumbers").select("*", { count: "exact", head: true }).eq("is_verified", false),
        supabase.from("plumbers").select("*", { count: "exact", head: true }).eq("is_verified", true),
        supabase.from("claims").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);

      if (!mounted) return;

      setApplications((appsRes.data as Application[]) ?? []);
      setPending(pendingRes.count ?? 0);
      setApproved(approvedRes.count ?? 0);
      setClaimsPending(claimsCountRes.count ?? 0);
      setUsersCount(usersCountRes.count ?? 0);

      if (tab === "claims") {
        const claimsRes = await supabase
          .from("claims")
          .select("*, plumber:plumbers(trading_name, area, whatsapp_number, slug), claimant:profiles(full_name, email)")
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        if (mounted) setClaims((claimsRes.data as Claim[]) ?? []);
      }

      if (tab === "users") {
        // Use server API route to bypass RLS — admin needs to see ALL plumber data
        const usersRes = await fetch("/api/admin/users");
        if (usersRes.ok) {
          const { users: usersData } = await usersRes.json();
          if (mounted) setUsers((usersData as UserWithBusiness[]) ?? []);
        }
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [user, isVerified, tab]);

  if (authChecking || loading) return <DashboardLoading />;
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <header className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl">Admin Panel</h1>
          <p className="text-gray-500 text-sm">Review and approve plumber applications</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <StatBox icon="⏳" value={pending} label="Pending review" color="bg-amber-light text-amber" />
          <StatBox icon="✓" value={approved} label="Verified live" color="bg-green-100 text-green-800" />
          <StatBox icon="🏢" value={claimsPending} label="Claims pending" color="bg-orange-100 text-orange-700" />
          <StatBox icon="👥" value={usersCount} label="Total users" color="bg-blue-100 text-blue-700" />
        </div>
      </header>

      <div className="flex gap-2 mb-6">
        <TabLink href="/admin?tab=pending" active={tab === "pending"} count={pending}>
          Pending
        </TabLink>
        <TabLink href="/admin?tab=approved" active={tab === "approved"} count={approved}>
          Approved
        </TabLink>
        <TabLink href="/admin?tab=claims" active={tab === "claims"} count={claimsPending}>
          Claims
        </TabLink>
        <TabLink href="/admin?tab=users" active={tab === "users"} count={usersCount}>
          Users
        </TabLink>
      </div>

      {tab === "users" ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Business</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Signed up</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const biz = u.plumber?.[0];
                  return (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{u.full_name || "—"}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            u.role === "admin"
                              ? "bg-purple-100 text-purple-700"
                              : u.role === "plumber"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {biz ? (
                          <div>
                            <a
                              href={`/plumber/${biz.slug ?? u.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand hover:underline font-semibold"
                            >
                              {biz.trading_name} ↗
                            </a>
                            <div className="text-xs text-gray-500">
                              📍 {biz.area}
                              {biz.is_verified ? (
                                <span className="ml-1 text-green-600">✓ Verified</span>
                              ) : (
                                <span className="ml-1 text-amber-600">⏳ Pending</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No business profile</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {u.whatsapp_number || u.phone_number || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(u.created_at).toLocaleDateString("en-ZA")}
                      </td>
                      <td className="px-4 py-3">
                        {biz ? (
                          <a
                            href={`/plumber/${biz.slug ?? u.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand hover:underline font-semibold"
                          >
                            View profile ↗
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                      No registered users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "claims" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {claims.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} />
          ))}
          {claims.length === 0 && (
            <div className="col-span-full bg-white border border-gray-200 rounded-xl p-12 text-center">
              <div className="text-3xl mb-2">📭</div>
              <div className="font-semibold">No pending claims</div>
              <p className="text-sm text-gray-500 mt-1">
                When plumbers claim their listings, they&apos;ll appear here for review.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {applications.map((app) => (
            <AdminCard key={app.id} app={app} />
          ))}
          {applications.length === 0 && (
            <div className="col-span-full bg-white border border-gray-200 rounded-xl p-12 text-center">
              <div className="text-3xl mb-2">📭</div>
              <div className="font-semibold">No applications in this view</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ icon, value, label, color }: { icon: string; value: number; label: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex gap-3 items-center">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm ${color}`}>{icon}</div>
      <div>
        <div className="font-display text-lg font-bold leading-none">{value}</div>
        <div className="text-[11px] text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function TabLink({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
        active
          ? "bg-brand text-white border-brand"
          : "bg-white text-gray-700 border-gray-200 hover:border-brand"
      }`}
    >
      {children} ({count})
    </Link>
  );
}
