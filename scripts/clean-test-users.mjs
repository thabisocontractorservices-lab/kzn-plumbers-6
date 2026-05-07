#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/clean-test-users.mjs
//
// Delete all test users from auth.users via the Supabase Admin API.
// Test users are matched by email pattern (default: emails ending in
// @example.com, starting with "test", or ending in @test.local).
//
// Usage:
//   npm run clean:test-users
//   PATTERN='@mydomain.test' npm run clean:test-users
//   DRY_RUN=1 npm run clean:test-users          # preview without deleting
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// ── Load .env.local manually (no dotenv dep) ────────────────────────────────
try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  console.warn("⚠ Could not read .env.local — falling back to process.env");
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === "1";

// Default test patterns. Override with `PATTERN=...` env var (single substring).
const PATTERNS = process.env.PATTERN
  ? [process.env.PATTERN]
  : ["@example.com", "@test.local", "testplumber"];

if (!URL || !SERVICE_KEY) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`Searching for users matching: ${PATTERNS.map((p) => `"${p}"`).join(", ")}`);

// ── Paginate through all users ──────────────────────────────────────────────
const matches = [];
let page = 1;
const perPage = 200;

while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
  if (error) {
    console.error("✗ Failed to list users:", error.message);
    process.exit(1);
  }
  if (data.users.length === 0) break;

  for (const u of data.users) {
    if (u.email && PATTERNS.some((p) => u.email.includes(p))) {
      matches.push(u);
    }
  }

  if (data.users.length < perPage) break;
  page++;
}

if (matches.length === 0) {
  console.log("✓ No matching users found. Nothing to do.");
  process.exit(0);
}

console.log(`\nFound ${matches.length} user(s):`);
for (const u of matches) {
  console.log(`  • ${u.email.padEnd(40)}  ${u.id}`);
}

if (DRY_RUN) {
  console.log("\n(DRY_RUN=1 set — no users deleted)");
  process.exit(0);
}

console.log("\nDeleting…");
let ok = 0,
  failed = 0;
for (const u of matches) {
  const { error } = await admin.auth.admin.deleteUser(u.id);
  if (error) {
    console.error(`  ✗ ${u.email}: ${error.message}`);
    failed++;
  } else {
    console.log(`  ✓ ${u.email}`);
    ok++;
  }
}

console.log(`\n✓ Deleted ${ok} user(s).${failed > 0 ? ` ✗ ${failed} failed.` : ""}`);
console.log("  (Cascading FK deletes also removed their profiles, plumbers, bookings, reviews.)");
