// src/supabaseClient.js
// ─────────────────────────────────────────────────────────────────────────────
// Primary Supabase client — used everywhere on the browser side.
// Uses createBrowserClient (cookie-aware) so the SSR helper at
// utils/supabase/server.ts can read the same session on the server.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from "@supabase/ssr";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://missing-config.supabase.co";

export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "missing-public-key";

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

// One browser client shared by auth and authenticated dashboard features.
// Production deployments must provide both NEXT_PUBLIC_SUPABASE_* variables.
export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
