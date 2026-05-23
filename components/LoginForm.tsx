"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";

export function LoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<"plumber" | "homeowner">("plumber");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loginEmail(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSubmitting(false);
      return setError(error.message);
    }
    // Hard redirect so the server re-reads the session cookie and Navbar updates
    window.location.href = role === "plumber" ? "/dashboard" : "/";
  }

  async function loginGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${role === "plumber" ? "/dashboard" : "/"}`,
      },
    });
  }

  return (
    <>
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        {(["plumber", "homeowner"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`flex-1 py-2.5 px-3 rounded-lg font-semibold text-sm transition-all ${
              role === r ? "bg-white text-brand shadow-sm" : "text-gray-600"
            }`}
          >
            {r === "plumber" ? "🔧 I'm a Plumber" : "🏠 I'm a Homeowner"}
          </button>
        ))}
      </div>

      <button onClick={loginGoogle} className="btn-secondary w-full mb-4">
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="flex items-center gap-3 my-5 text-gray-400 text-xs uppercase tracking-wider">
        <div className="flex-1 h-px bg-gray-200" />
        or with email
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <form onSubmit={loginEmail} className="space-y-3">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
        <input
          type="password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />

        <div className="flex justify-between text-xs text-gray-600">
          <label className="flex items-center gap-2">
            <input type="checkbox" /> Remember me
          </label>
          <Link href="/forgot-password" className="text-brand hover:underline">
            Forgot password?
          </Link>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600 mt-6">
        Don't have an account?{" "}
        <Link href="/register" className="text-brand font-semibold hover:underline">
          Register as a plumber
        </Link>
      </p>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path
        d="M16.5 9.2c0-.6 0-1.2-.2-1.7H9v3.3h4.2c-.2 1-.7 1.8-1.5 2.4v2h2.4c1.4-1.3 2.2-3.3 2.2-5.6v-.4z"
        fill="#4285F4"
      />
      <path
        d="M9 17c2 0 3.7-.7 5-1.8l-2.4-2c-.7.5-1.5.8-2.6.8-2 0-3.7-1.4-4.4-3.2H2v2.1A8 8 0 0 0 9 17z"
        fill="#34A853"
      />
      <path
        d="M4.6 10.8c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7V5.3H2A8 8 0 0 0 1 9c0 1.3.3 2.5.9 3.6l2.6-1.8z"
        fill="#FBBC05"
      />
      <path
        d="M9 4c1.1 0 2.1.4 2.9 1.1l2.1-2A8 8 0 0 0 9 1a8 8 0 0 0-7 4.3l2.6 2C5.3 5.4 7 4 9 4z"
        fill="#EA4335"
      />
    </svg>
  );
}
