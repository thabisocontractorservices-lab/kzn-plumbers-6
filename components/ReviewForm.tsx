"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/supabaseClient";

export function ReviewForm({ plumberId }: { plumberId: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) {
        setUser(u);
        // Get profile name
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", u.id)
          .single();
        setUserName(profile?.full_name ?? u.email ?? "");
      }
      setChecking(false);
    })();
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupError(null);
    setSignupSubmitting(true);

    try {
      // Create account via server API — no email confirmation required
      const res = await fetch("/api/register/homeowner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          area: signupAddress,
          password: signupPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSignupError(data.error ?? "Could not create account.");
        setSignupSubmitting(false);
        return;
      }

      // Sign in immediately with the new credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: signupEmail,
        password: signupPassword,
      });

      if (signInError) {
        setSignupError("Account created but could not sign in. Please go to the login page.");
        setSignupSubmitting(false);
        return;
      }

      // Get the signed-in user
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        setUser(newUser);
        setUserName(signupName);
        setSignupMode(false);
      }
    } catch {
      setSignupError("Something went wrong. Please try again.");
    }

    setSignupSubmitting(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return alert("Please pick a star rating");
    if (!user) {
      setSignupMode(true);
      return;
    }
    setSubmitting(true);

    const { error } = await supabase.from("reviews").insert({
      plumber_id: plumberId,
      reviewer_id: user.id,
      reviewer_name: userName,
      rating,
      comment: comment || null,
    });

    setSubmitting(false);
    if (error) return alert("Could not post review: " + error.message);

    setRating(0);
    setComment("");
    location.reload();
  }

  if (checking) return null;

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
          <a href="/login" className="btn-secondary text-sm text-center">
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
            placeholder="Create a password (min. 6 characters)"
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
            minLength={6}
            className="input"
          />
        </div>

        {signupError && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {signupError}
            {signupError.includes("already exists") && (
              <a href="/login" className="block mt-1 text-brand font-semibold underline">
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
          Your account will be created instantly. No email confirmation needed.
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
            <span
              key={s}
              onClick={() => setRating(s)}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              className={`cursor-pointer transition-colors ${
                s <= (hover || rating) ? "text-amber-500" : "text-gray-300"
              }`}
            >
              ★
            </span>
          ))}
        </div>
      </div>
      <textarea
        rows={3}
        placeholder="Share your experience working with this plumber..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="input resize-none"
      />
      <div className="text-right mt-3">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Posting..." : "Submit Review"}
        </button>
      </div>
    </form>
  );
}
