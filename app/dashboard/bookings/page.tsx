"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { useAuthGate } from "@/lib/useAuthGate";
import { DashboardLoading } from "@/components/DashboardLoading";
import { DashboardNav } from "@/components/DashboardNav";

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  job_description: string;
  preferred_datetime: string;
  status: "pending" | "confirmed" | "cancelled";
};

export default function BookingsPage() {
  const router = useRouter();
  const { user, authChecking } = useAuthGate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    (async () => {
      const { data: p } = await supabase
        .from("plumbers")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!mounted) return;
      if (!p) {
        router.replace("/register");
        return;
      }

      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("plumber_id", p.id)
        .order("created_at", { ascending: false });

      if (!mounted) return;
      setBookings((data as Booking[]) ?? []);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [user, router]);

  if (authChecking || loading) return <DashboardLoading />;
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid lg:grid-cols-[240px_1fr] gap-6">
      <DashboardNav />
      <div>
      <h1 className="font-display text-3xl mb-6">All bookings</h1>
      <div className="panel overflow-x-auto">
        {bookings.length === 0 ? (
          <p className="text-sm text-gray-500">No bookings yet.</p>
        ) : (
          <table className="w-full text-sm min-w-[600px]">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
              <tr>
                <th className="py-3">Customer</th>
                <th>Phone</th>
                <th>Job</th>
                <th>Preferred</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-gray-100">
                  <td className="py-3 font-semibold">{b.customer_name}</td>
                  <td>
                    <a
                      href={`https://wa.me/${b.customer_phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:underline"
                    >
                      {b.customer_phone}
                    </a>
                  </td>
                  <td>{b.job_description}</td>
                  <td>{new Date(b.preferred_datetime).toLocaleString("en-ZA")}</td>
                  <td>
                    <span className={`badge ${statusClass(b.status)}`}>{b.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>
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
