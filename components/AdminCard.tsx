"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { initials } from "@/lib/utils";

export function AdminCard({
  app,
}: {
  app: {
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
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);

  async function action(approve: boolean) {
    setBusy(true);
    if (approve) {
      await supabase.from("plumbers").update({ is_verified: true }).eq("id", app.id);
      setDecision("approved");
    } else {
      // For now, we just delete the plumber row.
      // In production, set a `rejected_at` column and notify the user.
      await supabase.from("plumbers").delete().eq("id", app.id);
      setDecision("rejected");
    }
    setBusy(false);
    setTimeout(() => router.refresh(), 600);
  }

  if (decision)
    return (
      <div
        className={`rounded-xl p-5 border-2 transition-all ${
          decision === "approved"
            ? "bg-teal-light border-teal"
            : "bg-red-50 border-red-300"
        }`}
      >
        <div className="text-center font-semibold">
          {decision === "approved" ? "✓ Approved — now live" : "✗ Rejected"}
        </div>
      </div>
    );

  const certCount = app.certifications?.[0]?.count ?? 0;
  const photoCount = app.photos?.[0]?.count ?? 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-card transition-all">
      <div className="flex gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
          style={{ background: "linear-gradient(135deg,#3A7FDE,#1A5FBE)" }}
        >
          {initials(app.trading_name)}
        </div>
        <div>
          <div className="font-display font-bold">{app.trading_name}</div>
          <div className="text-xs text-gray-500">
            📍 {app.area} · Applied {new Date(app.created_at).toLocaleDateString("en-ZA")}
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-600 space-y-1 mb-4">
        {app.profile?.full_name && (
          <div><strong>Owner:</strong> {app.profile.full_name}</div>
        )}
        {app.pirb_number && <div><strong>PIRB:</strong> {app.pirb_number}</div>}
        <div><strong>Specialties:</strong> {app.specialties.slice(0, 3).join(", ")}</div>
        <div><strong>Uploads:</strong> {certCount} certs · {photoCount} photos</div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => alert(`Certs: ${certCount}\nPhotos: ${photoCount}\nReview document URLs in DB.`)}
          className="btn-secondary text-xs py-2"
        >
          📄 Docs
        </button>
        {!app.is_verified && (
          <>
            <button
              disabled={busy}
              onClick={() => action(true)}
              className="btn text-xs py-2 bg-teal text-white hover:bg-teal/90"
            >
              ✓ Approve
            </button>
            <button
              disabled={busy}
              onClick={() => action(false)}
              className="btn text-xs py-2 bg-red-600 text-white hover:bg-red-700"
            >
              ✗ Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}
