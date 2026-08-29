import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let publicClient: SupabaseClient | null | undefined;

export function getPublicSupabase(): SupabaseClient | null {
  if (publicClient !== undefined) return publicClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    publicClient = null;
    return null;
  }

  publicClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return publicClient;
}
