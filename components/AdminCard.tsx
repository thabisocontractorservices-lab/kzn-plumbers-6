"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { initials } from "@/lib/utils";
import type { VerificationState } from "@/lib/verification";

export function AdminCard({ app }: { app: {
  id: string;
  trading_name: string;
  slug: string | null;
  area: string;
  pirb_number: string | null;
  specialties: string[];
  is_verified: boolean;
  profile_id?: string | null;
  verification_state?: VerificationState | null;
  verification_source_url?: string | null;
  created_at: string;
  certifications?: Array<{ count: number }>;
  photos?: Array<{ count: number }>;
  profile?: { full_name?: string; email?: string };
} }) {
  const router = useRouter();
  const initialState: VerificationState = app.verification_state || (app.profile_id ? "business_claimed" : "directory_record");
  const [verificationState, setVerificationState] = useState<VerificationState>(initialState);
  const [sourceUrl, setSourceUrl] = useState(app.verification_source_url || "");
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const certCount = app.certifications?.[0]?.count ?? 0;
  const photoCount = app.photos?.[0]?.count ?? 0;

  async function approve() {
    setBusy(true);
    setError(null);
    if (verificationState === "credential_verified" && (!app.pirb_number || !sourceUrl.trim())) {
      setError("Credential verification requires a recorded PIRB number and evidence source URL.");
      setBusy(false);
      return;
    }

    const now = new Date();
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + 6);
    const payload = {
      is_verified: true,
      is_certified: verificationState === "credential_verified",
      verification_state: verificationState,
      verification_source_url: sourceUrl.trim() || null,
      credential_verified_at: verificationState === "credential_verified" ? now.toISOString() : null,
      verification_expires_at: verificationState === "credential_verified" ? expires.toISOString() : null,
      last_checked_at: now.toISOString(),
      record_status: "published",
    };
    let result = await supabase.from("plumbers").update(payload).eq("id", app.id);
    if (result.error && /column|schema cache/i.test(result.error.message)) {
      result = await supabase.from("plumbers").update({ is_verified: true, is_certified: false }).eq("id", app.id);
    }
    if (result.error) {
      setError(result.error.message);
      setBusy(false);
      return;
    }
    setDecision("approved");
    setBusy(false);
    window.setTimeout(() => router.refresh(), 600);
  }

  async function reject() {
    setBusy(true);
    setError(null);
    let result = await supabase.from("plumbers").update({ is_verified: false, record_status: "rejected" }).eq("id", app.id);
    if (result.error && /column|schema cache/i.test(result.error.message)) {
      result = await supabase.from("plumbers").update({ is_verified: false }).eq("id", app.id);
    }
    if (result.error) {
      setError(result.error.message);
      setBusy(false);
      return;
    }
    setDecision("rejected");
    setBusy(false);
    window.setTimeout(() => router.refresh(), 600);
  }

  if (decision) {
    return <div className={`rounded-xl border-2 p-5 text-center font-bold ${decision === "approved" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"}`}>{decision === "approved" ? "Published with the selected trust state" : "Rejected without deleting the record"}</div>;
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand font-bold text-white">{initials(app.trading_name)}</div>
        <div className="min-w-0">
          <a href={`/plumber/${app.slug ?? app.id}`} target="_blank" rel="noopener noreferrer" className="font-display font-bold text-brand hover:underline">{app.trading_name} ↗</a>
          <div className="text-xs text-slate-500">{app.area} · Applied {new Date(app.created_at).toLocaleDateString("en-ZA")}</div>
        </div>
      </div>

      <dl className="mt-4 space-y-1 text-sm text-slate-700">
        {app.profile?.full_name && <div><dt className="inline font-bold">Owner: </dt><dd className="inline">{app.profile.full_name}</dd></div>}
        <div><dt className="inline font-bold">PIRB supplied: </dt><dd className="inline">{app.pirb_number || "No"}</dd></div>
        <div><dt className="inline font-bold">Evidence: </dt><dd className="inline">{certCount} private file{certCount === 1 ? "" : "s"} · {photoCount} photo{photoCount === 1 ? "" : "s"}</dd></div>
        <div><dt className="inline font-bold">Services: </dt><dd className="inline">{app.specialties.slice(0, 4).join(", ")}</dd></div>
      </dl>

      {!app.is_verified && (
        <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
          <label className="block text-xs font-bold text-slate-700">Public trust state
            <select value={verificationState} onChange={(event) => setVerificationState(event.target.value as VerificationState)} className="input mt-1">
              <option value="directory_record">Directory record</option>
              <option value="business_claimed">Business claimed</option>
              <option value="credential_verified">Credential verified</option>
            </select>
          </label>
          {verificationState === "credential_verified" && (
            <label className="block text-xs font-bold text-slate-700">Evidence source URL
              <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} type="url" placeholder="Authoritative lookup or evidence source" className="input mt-1" />
            </label>
          )}
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={approve} className="btn bg-emerald-700 text-white hover:bg-emerald-800">Publish</button>
            <button disabled={busy} onClick={reject} className="btn bg-red-700 text-white hover:bg-red-800">Reject</button>
          </div>
        </div>
      )}
    </article>
  );
}
