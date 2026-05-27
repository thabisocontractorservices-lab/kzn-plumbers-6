import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/admin/setup-rls?secret=YOUR_CRON_SECRET
 *
 * One-time setup: creates public READ policies on photos and certifications
 * so visitors can see plumber uploads on profile pages.
 *
 * Safe to run multiple times — uses IF NOT EXISTS equivalent via
 * DROP + CREATE pattern.
 *
 * Delete this file after running.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Unauthorized. Pass ?secret=YOUR_CRON_SECRET" },
      { status: 401 },
    );
  }

  const results: { statement: string; status: string; error?: string }[] = [];

  const statements = [
    // Photos: public read
    `DROP POLICY IF EXISTS "Photos are publicly readable" ON photos`,
    `CREATE POLICY "Photos are publicly readable" ON photos FOR SELECT USING (true)`,

    // Certifications: public read
    `DROP POLICY IF EXISTS "Certifications are publicly readable" ON certifications`,
    `CREATE POLICY "Certifications are publicly readable" ON certifications FOR SELECT USING (true)`,

    // Reviews: public read (for profile pages)
    `DROP POLICY IF EXISTS "Reviews are publicly readable" ON reviews`,
    `CREATE POLICY "Reviews are publicly readable" ON reviews FOR SELECT USING (true)`,

    // Google reviews: public read
    `DROP POLICY IF EXISTS "Google reviews are publicly readable" ON google_reviews`,
    `CREATE POLICY "Google reviews are publicly readable" ON google_reviews FOR SELECT USING (true)`,
  ];

  for (const sql of statements) {
    const { error } = await supabaseAdmin.rpc("exec_sql", { query: sql }).single();
    if (error) {
      // Fallback: try via raw REST (service role can execute SQL)
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
        {
          method: "POST",
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: sql }),
        },
      );
      if (!res.ok) {
        results.push({ statement: sql, status: "failed", error: error.message });
      } else {
        results.push({ statement: sql, status: "ok" });
      }
    } else {
      results.push({ statement: sql, status: "ok" });
    }
  }

  return NextResponse.json({
    message: "RLS setup complete. Check results below.",
    note: "If all show 'failed', run the SQL manually in Supabase SQL Editor (see instructions).",
    manual_sql: `
-- Run this in Supabase SQL Editor if the API route didn't work:

DROP POLICY IF EXISTS "Photos are publicly readable" ON photos;
CREATE POLICY "Photos are publicly readable" ON photos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Certifications are publicly readable" ON certifications;
CREATE POLICY "Certifications are publicly readable" ON certifications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Reviews are publicly readable" ON reviews;
CREATE POLICY "Reviews are publicly readable" ON reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Google reviews are publicly readable" ON google_reviews;
CREATE POLICY "Google reviews are publicly readable" ON google_reviews FOR SELECT USING (true);
    `.trim(),
    results,
  });
}
