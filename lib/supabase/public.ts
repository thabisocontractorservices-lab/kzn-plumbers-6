import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Anonymous GETs only: no cookies, user sessions or service-role credentials.
const cachedPublicFetch: typeof fetch = (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  return fetch(input, {
    ...init,
    credentials: "omit",
    ...(method === "GET" || method === "HEAD"
      ? { cache: "force-cache", next: { revalidate: 300, tags: ["public-directory"] } }
      : { cache: "no-store" }),
  });
};

let publicClient: SupabaseClient | null | undefined;

export function getPublicSupabase(): SupabaseClient | null {
  if (publicClient !== undefined) return publicClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || key.startsWith("sb_secret_")) {
    publicClient = null;
    return null;
  }
  // Fail closed if a privileged JWT was accidentally put in a public-key variable.
  try {
    const payload = key.split(".")[1];
    if (payload) {
      const role = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role;
      if (role && role !== "anon") return null;
    }
  } catch { /* Publishable keys are not JWTs; Supabase validates their format. */ }

  publicClient = createClient(url, key, {
    global: { fetch: cachedPublicFetch },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return publicClient;
}
