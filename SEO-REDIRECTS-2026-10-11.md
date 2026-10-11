# Profile redirects and robots.txt — 11 October 2026

## Problem
Search Console reported 68 "Not found (404)" pages. 59 were plumber/claim profiles whose web address changed in the
September 2026 duplicate clean-up (e.g. `/plumber/sipho-plumbing-solutions` → `/plumber/sipho-plumbing-solutions-1`).
The `redirect_rules` table existed but the website never read it, so old links (and their Google ranking) were lost.

## What changed
- `lib/redirects.ts`: reads active `redirect_rules` on the server (cached 5 minutes, follows chains, ignores loops and
  off-site targets). Only checked when a page would otherwise 404, so normal pages are not slowed down.
- `/plumber/[slug]`, `/claim/[slug]` and guide pages (`/[slug]`) now send a permanent redirect when an old address has a rule.
  Claim pages also follow their profile's redirect.
- `supabase/migrations/010_profile_redirects.sql`: loads 49 old → new addresses (all checked live, HTTP 200) and adds a
  database trigger so **any future slug change automatically creates the redirect**.
- `robots.txt`: blocks homepage search/filter combinations (`/?area=`, `/?specialty=`, `/?q=`, `/?service=`). Area and
  service landing pages remain the indexable versions.

## Not redirected (left as 404 on purpose)
- No matching current listing found: rowric-investments, genx-plumbing-and-refrigeration, academy-plumbers,
  rapid-response-plumber-durban, ingenious-worldwide, sipho-s-master-plumbing, plumbers-network-durban, plumstead-plumbers.
  If any still exists under another name, add a row in Supabase → `redirect_rules` (source_path `/plumber/old`, destination_path `/plumber/new`).
- acme-test-plumbing (test record), drain-durbanville and gas-cape-town (outside KZN, intentionally removed).
- /trust, /terms, /contact, /about, /privacy, /help: these load correctly now; the 404 was from an earlier failed deploy.

## Deploy
1. Supabase → SQL Editor → paste the whole of `010_profile_redirects.sql` → Run. Last line shows `active_redirects`.
2. Push the code.
3. Test: open https://www.kznplumbers.co.za/plumber/sipho-plumbing-solutions — it should land on `.../sipho-plumbing-solutions-1`.
4. Search Console → Pages → "Not found (404)" → **Validate fix**. Do the same for "Blocked by robots.txt".
   Google takes 1–4 weeks to process.

## Checks
lint ✓ · typecheck ✓ · 91 tests (4 new for redirects) ✓ · build ✓ · migration tested twice + rename trigger ✓ · robots.txt output checked ✓
