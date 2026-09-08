"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";

export function ReviewForm({ plumberId }: { plumberId: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [loginHref, setLoginHref] = useState("/login");
  const inFlight = useRef(false);
  const router = useRouter();

  // Auth state
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [userName, setUserName] = useState("");
  const [checking, setChecking] = useState(true);

  // Signup form state
  const [signupMode, setSignupMode] = useState(false);
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupAddress, setSignupAddress] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [signupConfirmation, setSignupConfirmation] = useState(false);

  useEffect(() => {
    let active = true;
    setLoginHref(`/login?next=${encodeURIComponent(`${window.location.pathname}#reviews`)}`);
    void (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!active || !u) return;
      if (!u.email_confirmed_at) { setSignupEmail(u.email || ""); setSignupConfirmation(true); return; }
      setUser(u);
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", u.id).maybeSingle();
      const name = typeof profile?.full_name === "string" ? profile.full_name.trim() : "";
      if (active) setUserName(name && !/@|\b\d[\d\s()+-]{6,}\d\b/.test(name) ? name.slice(0, 120) : "Directory member");
    })().catch(() => {}).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupError(null);
    setSignupSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail.trim().toLowerCase(),
        password: signupPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`${window.location.pathname}#reviews`)}`,
          data: { full_name: signupName.trim().slice(0, 120), area: signupAddress.trim().slice(0, 120) },
        },
      });
      if (error) throw error;
      setSignupPassword("");
      if (data.session && data.user?.email_confirmed_at) {
        setUser(data.user);
        setUserName(signupName.trim() || "Directory member");
        setSignupMode(false);
      } else setSignupConfirmation(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create the account.";
      setSignupError(/already|registered|exists/i.test(message)
        ? "An account with this email may already exist. Try signing in instead."
        : "Could not create the account. Please try again.");
    } finally {
      setSignupSubmitting(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    setSubmitError(null);
    if (rating === 0) { setSubmitError("Please pick a star rating."); return; }
    if (!user) { setSignupMode(true); return; }
    inFlight.current = true;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session expired. Sign in again before submitting.");
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plumber_id: plumberId, rating, comment: comment.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.review?.id) throw new Error(result.error || "The review could not be confirmed as saved. Refresh before retrying.");
      setPosted(true);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "The review could not be submitted. Please try again.");
    } finally { inFlight.current = false; setSubmitting(false); }
  }

  if (checking) return <p role="status" className="text-sm text-gray-500">Checking sign-in…</p>;
  if (posted) return <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">Your review was posted. Thank you for sharing your experience.</div>;

  if (signupConfirmation) {
    return (
      <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <div className="font-display text-lg font-bold text-blue-950">Confirm your email before reviewing</div>
        <p className="mt-2 text-sm leading-relaxed text-blue-900">
          Check <strong>{signupEmail}</strong> for a confirmation link. Confirm the address, then return to this profile to post the review. If you already have an account, sign in instead. No review has been submitted.
        </p>
        <a href={loginHref} className="btn-primary mt-4">Go to sign in</a>
      </div>
    );
  }

  // Not logged in and not in signup mode — show prompt to create account
  if (!user && !signupMode) {
    return (
      <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
        <div className="font-semibold text-sm mb-2">Leave a Review</div>
        <p className="text-sm text-gray-600 mb-4">
          Create a free homeowner account to leave a review. It only takes a minute.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setSignupMode(true)}
            className="btn-primary text-sm"
          >
            Create account & review
          </button>
          <a href={loginHref} className="btn-secondary text-sm text-center">
            I already have an account
          </a>
        </div>
      </div>
    );
  }

  // Signup mode — simple form
  if (!user && signupMode) {
    return (
      <form
        onSubmit={handleSignup}
        className="bg-gray-50 rounded-xl p-5 border border-gray-200"
      >
        <div className="font-semibold text-sm mb-1">Create your account</div>
        <p className="text-xs text-gray-500 mb-4">
          Quick signup to leave your review — just 4 fields.
        </p>

        <div className="space-y-3">
          <input
            required
            type="text"
            placeholder="Your full name"
            value={signupName}
            onChange={(e) => setSignupName(e.target.value)}
            className="input"
          />
          <input
            required
            type="email"
            placeholder="Email address"
            value={signupEmail}
            onChange={(e) => setSignupEmail(e.target.value)}
            className="input"
          />
          <input
            required
            type="text"
            placeholder="Your area (e.g. Durban North)"
            value={signupAddress}
            onChange={(e) => setSignupAddress(e.target.value)}
            className="input"
          />
          <input
            required
            type="password"
            placeholder="Create a password (min. 8 characters)"
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
            minLength={8}
            maxLength={128}
            className="input"
          />
        </div>

        {signupError && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {signupError}
            {signupError.includes("already exists") && (
              <a href={loginHref} className="block mt-1 text-brand font-semibold underline">
                Go to login →
              </a>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button type="submit" disabled={signupSubmitting} className="btn-primary text-sm">
            {signupSubmitting ? "Creating..." : "Create account"}
          </button>
          <button
            type="button"
            onClick={() => setSignupMode(false)}
            className="btn-secondary text-sm"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Email confirmation helps reduce fake and duplicate review accounts.
        </p>
      </form>
    );
  }

  // Logged in — show review form
  return (
    <form
      onSubmit={onSubmit}
      className="bg-gray-50 rounded-xl p-5 border border-gray-200"
    >
      <div className="font-semibold text-sm mb-1">Leave a Review</div>
      <p className="text-xs text-gray-500 mb-3">
        Posting as <strong>{userName}</strong>
      </p>
      <div className="mb-3">
        <div className="text-xs font-semibold text-gray-700 mb-1">Rating</div>
        <div className="flex gap-1 text-2xl sm:text-3xl select-none">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setRating(s)}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${s} star${s === 1 ? "" : "s"}`}
              aria-pressed={rating === s}
              className={`cursor-pointer transition-colors ${
                s <= (hover || rating) ? "text-amber-500" : "text-gray-300"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <textarea
        rows={3}
        placeholder="Share your experience working with this plumber..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={2000}
        aria-label="Your review"
        className="input resize-none"
      />
      <p className="mt-2 text-xs text-gray-500">Review your own experience. Do not include private contact or payment details. An existing review from this account will not be overwritten.</p>
      {submitError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{submitError} <a href={loginHref} className="font-semibold underline">Sign in</a></p>}
      <div className="text-right mt-3">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Posting..." : "Submit Review"}
        </button>
      </div>
    </form>
  );
}
