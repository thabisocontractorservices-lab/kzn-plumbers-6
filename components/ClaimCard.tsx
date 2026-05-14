"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { initials } from "@/lib/utils";

export type Claim = {
  id: string;
  plumber_id: string;
  claimant_id: string;
  phone_entered: string;
  status: string;
  created_at: string;
  admin_notes: string | null;
  plumber?: {
    trading_name: string;
    area: string;
    whatsapp_number: string;
    slug: string | null;
  };
  claimant?: {
    full_name: string | null;
    email: string;
  };
};

export function ClaimCard({ claim }: { claim: Claim }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(
    null,
  );

  async function handleClaim(approve: boolean) {
    setBusy(true);
    try {
      if (approve) {
        // 1. Update claim status
        await supabase
          .from("claims")
          .update({
            status: "approved",
            resolved_at: new Date().toISOString(),
          })
          .eq("id", claim.id);

        // 2. Link plumber to claimant profile
        await supabase
          .from("plumbers")
          .update({ profile_id: claim.claimant_id })
          .eq("id", claim.plumber_id);

        setDecision("approved");
      } else {
        await supabase
          .from("claims")
          .update({
            status: "rejected",
            resolved_at: new Date().toISOString(),
          })
          .eq("id", claim.id);

        setDecision("rejected");
      }
    } catch (err) {
      console.error("Claim action error:", err);
    }
    setBusy(false);
    setTimeout(() => router.refresh(), 600);
  }

  if (decision) {
    return (
      <div
        className={`rounded-xl p-5 border-2 transition-all ${
          decision === "approved"
            ? "bg-teal-light border-teal"
            : "bg-red-50 border-red-300"
        }`}
      >
        <div className="text-center font-semibold">
          {decision === "approved"
            ? "✓ Approved — listing linked"
            : "✗ Rejected"}
        </div>
      </div>
    );
  }

  const tradingName = claim.plumber?.trading_name ?? "Unknown Business";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-card transition-all">
      <div className="flex gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
          style={{ background: "linear-gradient(135deg,#DE8A3A,#BE6A1A)" }}
        >
          {initials(tradingName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold truncate">{tradingName}</div>
          <div className="text-xs text-gray-500">
            📍 {claim.plumber?.area ?? "Unknown"} · Claimed{" "}
            {new Date(claim.created_at).toLocaleDateString("en-ZA")}
          </div>
        </div>
        {claim.status === "auto_approved" && (
          <span className="text-[10px] bg-green-100 text-green-800 px-2 py-1 rounded-full font-semibold self-start">
            Auto ✓
          </span>
        )}
      </div>

      <div className="text-sm text-gray-600 space-y-1 mb-4">
        {claim.claimant?.full_name && (
          <div>
            <strong>Claimant:</strong> {claim.claimant.full_name}
          </div>
        )}
        {claim.claimant?.email && (
          <div>
            <strong>Email:</strong> {claim.claimant.email}
          </div>
        )}
        <div>
          <strong>Phone entered:</strong> {claim.phone_entered}
        </div>
        <div>
          <strong>Listed phone:</strong>{" "}
          {claim.plumber?.whatsapp_number ?? "—"}
        </div>
      </div>

      {claim.status === "pending" && (
        <div className="grid grid-cols-3 gap-1.5">
          <a
            href={`/plumber/${claim.plumber?.slug ?? claim.plumber_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs py-2 text-center"
          >
            👁 View
          </a>
          <button
            disabled={busy}
            onClick={() => handleClaim(true)}
            className="btn text-xs py-2 bg-teal text-white hover:bg-teal/90"
          >
            ✓ Approve
          </button>
          <button
            disabled={busy}
            onClick={() => handleClaim(false)}
            className="btn text-xs py-2 bg-red-600 text-white hover:bg-red-700"
          >
            ✗ Reject
          </button>
        </div>
      )}
    </div>
  );
}
