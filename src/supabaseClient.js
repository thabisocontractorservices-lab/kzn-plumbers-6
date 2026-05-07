// src/supabaseClient.js
// ─────────────────────────────────────────────────────────────────────────────
// Primary Supabase client — used everywhere on the browser side.
// Uses createBrowserClient (cookie-aware) so the SSR helper at
// utils/supabase/server.ts can read the same session on the server.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from "@supabase/ssr";

// 👇 PASTE YOUR SUPABASE URL HERE (project base URL only — no /rest/v1/ suffix)
export const SUPABASE_URL = "https://fpgtulituouuzpxqlofh.supabase.co";

// 👇 PASTE YOUR SUPABASE PUBLIC (anon / publishable) KEY HERE
export const SUPABASE_PUBLIC_KEY = "sb_publishable_zfuBFuumrTc7KjoTbUIWjw_rhvqVez1";

// One Supabase client, used everywhere in the app.
// Same .auth / .from / .storage API as before — sessions now live in cookies.
export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
