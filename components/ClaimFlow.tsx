"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/supabaseClient";
import { trackEvent } from "@/lib/analytics";

type Step = "auth" | "confirm" | "verify" | "pending";

interface Props {
  plumberId: string;
  plumberSlug: string;
  tradingName: string;
  area: string;
  maskedPhone: string;
}

export function ClaimFlow({
  plumberId,
  plumberSlug,
  tradingName,
  area,
  maskedPhone,
}: Props) {
  const [step, setStep] = useState<Step>("auth");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const returnPath = `/claim/${encodeURIComponent(plumberSlug)}`;
  const loginHref = `/login?next=${encodeURIComponent(returnPath)}`;

  // Auth fields
  const [mode, setMode] = useState<"login" | "register">("register");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  // Verify field
  const [verifyPhone, setVerifyPhone] = useState("");

  /* ─── Step 1: Register or Log In ─── */
  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        if (fullName.trim().length < 2 || fullName.trim().length > 120 || password.length < 8 || password.length > 128) throw new Error("Enter your full name (2–120 characters) and a password of 8–128 characters.");
        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnPath)}`,
            data: { full_name: fullName.trim() },
          },
        });
        if (signupError) throw signupError;
        setPassword("");
        if (!data.session || !data.user?.email_confirmed_at) {
          setStep("confirm");
          return;
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (signInError) throw signInError;
        setPassword("");
        if (!data.user?.email_confirmed_at) {
          setStep("confirm");
          return;
        }
      }
      setVerifyPhone(phone);
      setStep("verify");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try signing in.");
    } finally { setLoading(false); }
  }

  /* Business phone is review context only; it never authorises a transfer. */
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Session expired. Please log in again.");
        setStep("auth");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          plumber_id: plumberId,
          phone: verifyPhone,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data.status === "pending") { setStep("pending"); return; }
      if (!res.ok || data.status !== "pending") throw new Error(data.error ?? "Claim could not be confirmed as saved.");

      trackEvent("claim_complete", {
        plumber_id: plumberId,
        area,
        verification_state: "ownership_review_pending",
      });
      setStep("pending");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      if (user?.email_confirmed_at) setStep("verify");
      else if (user) { setEmail(user.email || ""); setStep("confirm"); }
    }).catch(() => {}).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  if (checking) return <div className="panel" role="status">Checking your session…</div>;

  return (
    <div className="panel">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-6">
        <StepDot active={step === "auth" || step === "confirm"} done={step === "verify" || step === "pending"} label="1" />
        <div className="flex-1 h-0.5 bg-gray-200" />
        <StepDot
          active={step === "verify"}
          done={step === "pending"}
          label="2"
        />
        <div className="flex-1 h-0.5 bg-gray-200" />
        <StepDot
          active={step === "pending"}
          done={false}
          label="✓"
        />
      </div>

      {/* ─── Step 1: Auth ─── */}
      {step === "auth" && (
        <>
          <h2 className="font-display text-xl font-bold mb-1">
            Claim your listing
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Create an account or log in to claim{" "}
            <strong>{tradingName}</strong> in {area}.
          </p>

          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-5">
            <button
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                mode === "register"
                  ? "bg-white shadow text-brand"
                  : "text-gray-500"
              }`}
              onClick={() => setMode("register")}
            >
              Create account
            </button>
            <button
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                mode === "login"
                  ? "bg-white shadow text-brand"
                  : "text-gray-500"
              }`}
              onClick={() => setMode("login")}
            >
              I have an account
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {mode === "register" && (
              <>
                <Field
                  label="Full name"
                  value={fullName}
                  onChange={setFullName}
                  placeholder="e.g. Sipho Dlamini"
                  required
                />
                <Field
                  label="Phone number"
                  value={phone}
                  onChange={setPhone}
                  placeholder="e.g. 083 123 4567"
                  type="tel"
                />
              </>
            )}
            <Field
              label="Email address"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              type="email"
              required
            />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder={mode === "register" ? "Min. 8 characters" : ""}
              type="password"
              required
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading
                ? "Please wait…"
                : mode === "register"
                ? "Create account & continue"
                : "Log in & continue"}
            </button>
          </form>
        </>
      )}

      {/* ─── Step 2: Verify phone ─── */}
      {step === "verify" && (
        <>
          <h2 className="font-display text-xl font-bold mb-1">
            Verify ownership
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Enter the business phone number for <strong>{tradingName}</strong>.
            The public number on file ends in <strong>{maskedPhone}</strong>.
            A phone match helps the review but does not transfer ownership automatically.
          </p>

          <form onSubmit={handleVerify} className="space-y-4">
            <Field
              label="Business phone number"
              value={verifyPhone}
              onChange={setVerifyPhone}
              placeholder="e.g. 083 123 4567"
              type="tel"
              required
            />

            <p className="text-xs text-gray-500">
              Every ownership request is reviewed. We may ask for company, domain, email or registration evidence.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Submitting…" : "Submit ownership request"}
            </button>
          </form>
        </>
      )}

      {step === "confirm" && (
        <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-display text-xl font-bold">Confirm your email first</h2>
          <p className="mt-2 text-sm leading-relaxed">
            If signup can proceed, a confirmation link will be sent to <strong>{email}</strong>.
            Open it to return to this ownership request. If you already have an account, sign in instead.
            No claim has been submitted and no listing access has been transferred.
          </p>
          <a href={loginHref} className="btn-primary mt-4">Sign in and return to this claim</a>
        </div>
      )}

      {/* ─── Pending: Manual review ─── */}
      {step === "pending" && (
        <div className="text-center py-6">
          <div className="text-5xl mb-3">📋</div>
          <h2 className="font-display text-2xl font-bold mb-2">
            Claim submitted for review
          </h2>
          <p className="text-gray-600 mb-6">
            We&apos;ll review the ownership request for <strong>{tradingName}</strong>
            before transferring profile access. We may ask for supporting evidence.
            No access is granted until the ownership review is approved.
          </p>
          <a href="/" className="btn-primary">
            Back to directory
          </a>
        </div>
      )}
    </div>
  );
}

/* ─── Reusable components ─── */

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={type === "password" ? 128 : type === "email" ? 200 : type === "tel" ? 30 : 120}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none transition-all"
      />
    </div>
  );
}

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
        active
          ? "bg-brand text-white scale-110"
          : done
          ? "bg-green-500 text-white"
          : "bg-gray-200 text-gray-500"
      }`}
    >
      {done ? "✓" : label}
    </div>
  );
}
