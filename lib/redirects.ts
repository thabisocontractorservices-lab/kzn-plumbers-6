import "server-only";
import { unstable_cache } from "next/cache";
import { permanentRedirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Old page addresses → new ones, from the `redirect_rules` table.
 * The table is admin-only, so it is read on the server with the service key,
 * cached for 5 minutes, and only ever consulted when a page would otherwise 404.
 */
const loadRules = unstable_cache(async (): Promise<Record<string, string>> => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("redirect_rules").select("source_path, destination_path").eq("active", true).limit(20000);
    if (error) { console.error("[redirects] could not load redirect rules", error.message); return {}; }
    return Object.fromEntries((data ?? []).map((r) => [normalise(r.source_path), r.destination_path]));
  } catch (error) {
    console.error("[redirects] redirect rules unavailable", error);
    return {};
  }
}, ["redirect-rules-v1"], { revalidate: 300, tags: ["redirect-rules"] });

function normalise(path: string): string {
  let p = path.trim();
  try { p = decodeURI(p); } catch { /* keep as is */ }
  p = p.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return p.toLowerCase();
}

/** Final destination for a path, following chains (A→B→C) up to 5 hops. Null if none. */
export async function findRedirect(path: string): Promise<string | null> {
  const rules = await loadRules();
  let current = normalise(path);
  let destination: string | null = null;
  for (let hop = 0; hop < 5; hop++) {
    const next = rules[current];
    if (!next || normalise(next) === current) break;
    destination = next;
    current = normalise(next);
  }
  return destination && destination.startsWith("/") && !destination.startsWith("//") ? destination : null;
}

/** Call before notFound(): sends a permanent redirect if the old address has a new home. */
export async function redirectIfMoved(path: string): Promise<void> {
  const destination = await findRedirect(path);
  if (destination) permanentRedirect(destination);
}
