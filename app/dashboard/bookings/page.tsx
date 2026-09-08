"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { useAuthGate } from "@/lib/useAuthGate";
import { DashboardLoading } from "@/components/DashboardLoading";
import { DashboardNav } from "@/components/DashboardNav";
import { formatWhatsApp } from "@/lib/utils";

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  job_description: string;
  service_requested?: string | null;
  suburb?: string | null;
  urgency?: "planned" | "today" | "emergency";
  preferred_datetime: string;
  status: "pending" | "confirmed" | "cancelled";
  job_outcome?: "accepted" | "declined" | "won" | "lost" | "cancelled" | null;
  created_at?: string;
  updated_at?: string;
  notes?: string;
};

export default function BookingsPage() {
  const router = useRouter();
  const { user, authChecking } = useAuthGate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const { data: plumber } = await supabase.from("plumbers").select("id").eq("profile_id", user.id).maybeSingle();
      if (!mounted) return;
      if (!plumber) {
        router.replace("/register");
        return;
      }
      const { data, error } = await supabase.from("bookings").select("*").eq("plumber_id", plumber.id).order("created_at", { ascending: false });
      if(error){if(mounted){setError("Bookings could not load. Reload the page.");setLoading(false);}return;}
      if (mounted) {
        setBookings((data as Booking[]) ?? []);
        setLoading(false);
      }
    })().catch(()=>{if(mounted){setError("Bookings could not load.");setLoading(false);}});
    return () => { mounted = false; };
  }, [user, router]);

  async function updateOutcome(booking: Booking, outcome: "accepted" | "declined" | "won" | "lost") {
    setUpdating(booking.id); setError(null);
    try {
      const response=await fetch("/api/dashboard/bookings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:booking.id,outcome,expected_updated_at:booking.updated_at})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Booking update failed.");
      setBookings(current=>current.map(item=>item.id===booking.id?result.booking as Booking:item));
    }catch(err){setError(err instanceof Error?err.message:"Update failed; reload before retrying.");}
    finally{setUpdating(null);}
  }

  if (authChecking || loading) return <DashboardLoading />;
  if (!user) return null;

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[240px_1fr]">
      <DashboardNav />
      <main>
        <div className="mb-6"><h1 className="font-display text-3xl font-bold text-slate-950">Booking requests</h1><p className="mt-1 text-sm text-slate-600">Confirm or decline requests. Job-outcome controls appear only when the database can store them.</p></div>
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {bookings.length === 0 ? (
          <div className="panel text-sm text-slate-600">No booking requests yet.</div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <article key={booking.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-lg font-bold text-slate-950">{booking.customer_name}</h2><span className={`badge ${statusClass(booking.status)}`}>{booking.job_outcome || booking.status}</span>{booking.urgency && <span className={`badge ${booking.urgency === "emergency" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`}>{booking.urgency}</span>}</div>
                    <p className="mt-2 text-sm font-semibold text-slate-800">{booking.service_requested || "Plumbing request"}{booking.suburb ? ` · ${booking.suburb}` : ""}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{booking.job_description}</p>
                    {booking.notes && <p className="mt-3 whitespace-pre-wrap text-xs text-slate-600">{booking.notes}</p>}
                    <p className="mt-3 text-xs text-slate-500">Preferred: {new Date(booking.preferred_datetime).toLocaleString("en-ZA")}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <a href={`https://wa.me/${formatWhatsApp(booking.customer_phone)}`} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">WhatsApp customer</a>
                    <a href={`tel:+${formatWhatsApp(booking.customer_phone)}`} className="btn-secondary">Call</a>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {booking.job_outcome !== "won" && <button disabled={updating === booking.id} onClick={() => updateOutcome(booking, "accepted")} className="btn-secondary">Accept lead</button>}
                  {Object.prototype.hasOwnProperty.call(booking,"job_outcome") && <button disabled={updating === booking.id} onClick={() => updateOutcome(booking, "won")} className="btn bg-emerald-700 text-white hover:bg-emerald-800">Mark job won</button>}
                  {Object.prototype.hasOwnProperty.call(booking,"job_outcome") && <button disabled={updating === booking.id} onClick={() => updateOutcome(booking, "lost")} className="btn-secondary">Mark not won</button>}
                  {booking.status === "pending" && <button disabled={updating === booking.id} onClick={() => updateOutcome(booking, "declined")} className="btn-secondary">Decline</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function statusClass(status: string) {
  return ({ pending: "bg-amber-100 text-amber-800", confirmed: "bg-emerald-100 text-emerald-800", cancelled: "bg-red-100 text-red-800" }[status] ?? "bg-slate-100 text-slate-700");
}
