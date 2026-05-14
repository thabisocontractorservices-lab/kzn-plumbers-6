"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/src/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// /forgot-password — Step 1 of password reset:
//   User enters their email → Supabase sends a magic-link email →
//   they click it and land on /auth/update-password to set a new password.
// ─────────────────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSent(true);
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex justify-center py-12 px-4 sm:px-6 bg-gradient-to-b from-brand-light to-[#F4F6FB]">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-floating p-6 sm:p-8 self-start">
        <h1 className="font-display text-2xl sm:text-3xl text-center mb-2">
          Reset your password
        </h1>
        <p className="text-center text-gray-500 mb-6 text-sm">
          Enter your email and we'll send you a link to set a new password.
        </p>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <strong className="block text-green-900 mb-1">
              ✉ Check your inbox
            </strong>
            <p className="text-sm text-green-900/80 leading-relaxed">
              We've sent a password reset link to <strong>{email}</strong>. The
              link expires in 1 hour. Click it to set a new password.
            </p>
            <p className="text-xs text-green-900/60 mt-3">
              Didn't get it? Check your spam folder or try again in a minute.
            </p>
            <button
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="text-sm text-brand font-semibold hover:underline mt-3"
            >
              Send to a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              autoComplete="email"
              autoFocus
            />

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-600 mt-6">
          Remember your password?{" "}
          <Link href="/login" className="text-brand font-semibold hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
