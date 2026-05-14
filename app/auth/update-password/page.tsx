"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/src/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// /auth/update-password — Step 2 of password reset.
//
// User lands here after clicking the email link. Supabase has already
// established a session via the magic link, so we just need to call
// auth.updateUser({ password }) to set the new password.
// ─────────────────────────────────────────────────────────────────────────────

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Confirm a valid session exists (i.e. they clicked a fresh, non-expired
  // reset link). Otherwise show a recovery message.
  useEffect(() => {
    let mounted = true;

    // Listen for the PASSWORD_RECOVERY event Supabase fires when the user lands
    // here from a reset email — that's the only reliable signal the session is
    // ready for an updateUser call.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) {
          if (mounted) {
            setHasSession(true);
            setAuthReady(true);
          }
        }
      },
    );

    // Also check immediately in case the event already fired before this
    // listener was registered.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setHasSession(!!session);
        setAuthReady(true);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password });

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    setDone(true);
    // Auto-redirect after 2 seconds so they see the confirmation
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 2000);
  }

  if (!authReady) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
        <div className="text-gray-500 text-sm">Loading…</div>
      </div>
    );
  }

  if (!hasSession && !done) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex justify-center py-12 px-4 sm:px-6 bg-gradient-to-b from-brand-light to-[#F4F6FB]">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-floating p-6 sm:p-8 self-start">
          <h1 className="font-display text-2xl text-center mb-2">
            Link expired
          </h1>
          <p className="text-center text-gray-500 mb-6 text-sm leading-relaxed">
            Your reset link has expired or already been used. Reset links are
            valid for 1 hour. Request a new one to continue.
          </p>
          <Link
            href="/forgot-password"
            className="btn-primary w-full text-center block"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex justify-center py-12 px-4 sm:px-6 bg-gradient-to-b from-brand-light to-[#F4F6FB]">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-floating p-6 sm:p-8 self-start">
        <h1 className="font-display text-2xl sm:text-3xl text-center mb-2">
          Set a new password
        </h1>
        <p className="text-center text-gray-500 mb-6 text-sm">
          Choose a strong password you'll remember. Minimum 6 characters.
        </p>

        {done ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <strong className="block text-green-900 mb-1">
              ✓ Password updated
            </strong>
            <p className="text-sm text-green-900/80 leading-relaxed">
              You're all set. Redirecting to your dashboard…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              required
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              autoComplete="new-password"
              autoFocus
              minLength={6}
            />
            <input
              type="password"
              required
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input"
              autoComplete="new-password"
              minLength={6}
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
              {submitting ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
