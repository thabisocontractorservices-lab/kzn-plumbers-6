"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { useAuthGate } from "@/lib/useAuthGate";
import { AdminCard } from "@/components/AdminCard";
import { DashboardLoading } from "@/components/DashboardLoading";

type Application = {
  id: string;
  trading_name: string;
  area: string;
  pirb_number: string | null;
  specialties: string[];
  is_verified: boolean;
  created_at: string;
  certifications?: Array<{ count: number }>;
  photos?: Array<{ count: number }>;
  profile?: { full_name?: string; email?: string };
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
  const [pending, setPending] = useState(0);
  const [approved, setApproved] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    (async () => {
      const [appsRes, pendingRes, approvedRes] = await Promise.all([
        supabase
          .from("plumbers")
          .select("*, certifications(count), photos(count), profile:profiles(full_name, email)")
          .eq("is_verified", isVerified)
          .order("created_at", { ascending: false }),
        supabase.from("plumbers").select("*", { count: "exact", head: true }).eq("is_verified", false),
        supabase.from("plumbers").select("*", { count: "exact", head: true }).eq("is_verified", true),
      ]);

      if (!mounted) return;
      setApplications((appsRes.data as Application[]) ?? []);
      setPending(pendingRes.count ?? 0);
      setApproved(approvedRes.count ?? 0);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [user, isVerified]);

  if (authChecking || loading) return <DashboardLoading />;
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <header className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl">Admin Panel</h1>
          <p className="text-gray-500 text-sm">Review and approve plumber applications</p>
        </div>
        <div className="flex gap-3">
          <StatBox icon="⏳" value={pending} label="Pending review" color="bg-amber-light text-amber" />
          <StatBox icon="✓" value={approved} label="Verified live" color="bg-green-100 text-green-800" />
        </div>
      </header>

      <div className="flex gap-2 mb-6">
        <TabLink href="/admin?tab=pending" active={tab === "pending"} count={pending}>
          Pending
        </TabLink>
        <TabLink href="/admin?tab=approved" active={tab === "approved"} count={approved}>
          Approved
        </TabLink>
      </div>

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
