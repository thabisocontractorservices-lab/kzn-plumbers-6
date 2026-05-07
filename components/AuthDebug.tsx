"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/supabaseClient";

type AuthState = {
  email: string | null;
  userId: string | null;
  expiresAt: number | null; // ms epoch
  role: string | null;
  loading: boolean;
};

/**
 * Floating auth state widget for development.
 * Shows email, user id, role from profiles, and live session expiry.
 *
 * Mounted from app/layout.tsx behind a NODE_ENV check, so it's compiled out
 * of production bundles entirely.
 */
export function AuthDebug() {
  const [state, setState] = useState<AuthState>({
    email: null,
    userId: null,
    expiresAt: null,
    role: null,
    loading: true,
  });
  const [collapsed, setCollapsed] = useState(false);
  const [, forceTick] = useState(0); // re-render every 30s for relative expiry

  // Tick the clock so "expires in 47m" stays current
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Subscribe to auth changes
  useEffect(() => {
    let mounted = true;

    async function loadFromSession(
      session: {
        user: { id: string; email?: string };
        expires_at?: number;
      } | null,
    ) {
      if (!session) {
        if (mounted)
          setState({
            email: null,
            userId: null,
            expiresAt: null,
            role: null,
            loading: false,
          });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;
      setState({
        email: session.user.email ?? null,
        userId: session.user.id,
        expiresAt: session.expires_at ? session.expires_at * 1000 : null,
        role: profile?.role ?? null,
        loading: false,
      });
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => loadFromSession(session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      loadFromSession(session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isLoggedIn = !!state.email;
  const dotClass = isLoggedIn ? "bg-green-400 animate-pulse" : "bg-gray-500";

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="Show auth debug"
        aria-label="Show auth debug"
        className="fixed top-3 right-3 z-50 w-8 h-8 rounded-full bg-gray-900/90 hover:bg-gray-800 text-white flex items-center justify-center shadow-lg backdrop-blur-sm border border-gray-700"
      >
        <span className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
      </button>
    );
  }

  return (
    <div className="fixed top-3 right-3 z-50 w-72 bg-gray-900/95 text-white rounded-lg shadow-2xl text-xs font-mono backdrop-blur-sm border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotClass}`} />
          <span className="uppercase tracking-wider text-gray-400 text-[10px] font-semibold">
            auth debug
          </span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          aria-label="Collapse"
          className="text-gray-400 hover:text-white leading-none px-1.5 -my-1"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1.5">
        {state.loading ? (
          <Row label="status" value="loading…" mute />
        ) : isLoggedIn ? (
          <>
            <Row label="email" value={state.email!} />
            <Row label="user" value={truncateUuid(state.userId!)} mute />
            <Row
              label="role"
              value={state.role ?? "—"}
              highlight={!!state.role && state.role !== "homeowner"}
              mute={!state.role}
            />
            <Row
              label="expires"
              value={formatExpiry(state.expiresAt)}
              warn={isExpiringSoon(state.expiresAt)}
            />
          </>
        ) : (
          <Row label="status" value="logged out" mute />
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mute,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  mute?: boolean;
  highlight?: boolean;
  warn?: boolean;
}) {
  let cls = "text-white";
  if (mute) cls = "text-gray-400";
  else if (highlight) cls = "text-green-400 font-semibold";
  else if (warn) cls = "text-amber-300";

  return (
    <div className="flex justify-between gap-2 items-baseline">
      <span className="text-gray-500 uppercase tracking-wider text-[10px] shrink-0">
        {label}
      </span>
      <span className={`truncate ${cls}`} title={value}>
        {value}
      </span>
    </div>
  );
}

function truncateUuid(id: string) {
  return id.slice(0, 8) + "…";
}

function formatExpiry(expiresAt: number | null): string {
  if (!expiresAt) return "—";
  const ms = expiresAt - Date.now();
  if (ms < 0) return "expired";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`;
  return `in ${Math.floor(hrs / 24)}d`;
}

function isExpiringSoon(expiresAt: number | null): boolean {
  if (!expiresAt) return false;
  return expiresAt - Date.now() < 5 * 60_000; // <5 min
}
