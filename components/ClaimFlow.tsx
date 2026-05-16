"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/supabaseClient";

type Step = "auth" | "verify" | "success" | "pending";

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
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
            data: { full_name: fullName, role: "plumber" },
          },
        });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
      setStep("verify");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  /* ─── Step 2: Verify phone → submit claim ─── */
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
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

      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Claim failed");

      if (data.status === "auto_approved") {
        setStep("success");
      } else {
        setStep("pending");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  /* ─── Already logged in? Check & skip to verify ─── */
  async function checkExistingSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      setStep("verify");
    }
  }

  // Check session on mount
  useEffect(() => {
    checkExistingSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="panel">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-6">
        <StepDot active={step === "auth"} done={step !== "auth"} label="1" />
        <div className="flex-1 h-0.5 bg-gray-200" />
        <StepDot
          active={step === "verify"}
          done={step === "success" || step === "pending"}
          label="2"
        />
        <div className="flex-1 h-0.5 bg-gray-200" />
        <StepDot
          active={step === "success" || step === "pending"}
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
              placeholder={mode === "register" ? "Min. 6 characters" : ""}
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
            Enter the phone number listed for{" "}
            <strong>{tradingName}</strong> to verify you own this
            business. The number on file ends in{" "}
            <strong>{maskedPhone}</strong>.
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
              💡 If the number doesn&apos;t match, your claim will be sent to our
              team for manual review.
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
              {loading ? "Verifying…" : "Verify & claim listing"}
            </button>
          </form>
        </>
      )}

      {/* ─── Success: Auto-approved ─── */}
      {step === "success" && (
        <div className="text-center py-6">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="font-display text-2xl font-bold mb-2">
            Listing claimed!
          </h2>
          <p className="text-gray-600 mb-6">
            <strong>{tradingName}</strong> is now linked to your account.
            Head to your dashboard to update your profile, upload photos, and
            manage bookings.
          </p>
          <div className="flex gap-3 justify-center">
            <a href="/dashboard" className="btn-primary">
              Go to dashboard →
            </a>
            <a
              href={`/plumber/${plumberSlug}`}
              className="btn-secondary"
            >
              View listing
            </a>
          </div>
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
            The phone number didn&apos;t match our records, so our team will
            review your claim for <strong>{tradingName}</strong>. This usually
            takes 1–2 business days. We&apos;ll email you once it&apos;s approved.
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
