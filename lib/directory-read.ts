import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getPublicSupabase } from "@/lib/supabase/public";

export type DatabaseReadError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

export class PublicReadError extends Error {
  constructor(context: string, error?: DatabaseReadError) {
    super("This part of the directory is temporarily unavailable. Please try again shortly.");
    this.name = "PublicReadError";
    // Retain diagnostic information on the server, not in public responses.
    console.error(`[public-read] ${context}`, error ?? { message: "Public Supabase configuration is unavailable" });
  }
}

export function requirePublicSupabase() {
  const client = getPublicSupabase();
  if (!client) throw new PublicReadError("Public client unavailable");
  return client;
}

export function isMissingSchemaError(error: DatabaseReadError | null | undefined): boolean {
  return !!error && ["42703", "42P01", "PGRST200", "PGRST204", "PGRST205"].includes(error.code ?? "");
}

/**
 * Check optional column groups without reading any rows. Missing schema is the only
 * reason to use a legacy query; auth, RLS, timeout and network failures are surfaced.
 * The fixed table/column callers and five-minute public fetch cache bound probe reuse.
 */
export const hasPublicColumns = cache(unstable_cache(async (table: string, columns: string): Promise<boolean> => {
  const result = await requirePublicSupabase().from(table).select(columns).limit(0);
  if (!result.error) return true;
  if (isMissingSchemaError(result.error)) return false;
  throw new PublicReadError(`Could not check ${table} public schema`, result.error);
}, ["public-directory-schema-v1"], { revalidate: 300 }));

export function assertPublicRead(context: string, error: DatabaseReadError | null | undefined): void {
  if (error) throw new PublicReadError(context, error);
}
