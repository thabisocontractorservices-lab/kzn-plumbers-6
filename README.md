# KZN Plumbers Directory

A KwaZulu-Natal-specific marketplace and directory that helps homeowners compare plumbing businesses by service area, job type, transparent verification state, and direct contact.

## What changed in this release

- Replaced the full-dataset homepage payload with bounded server-side search and 12-result pages.
- Added seven regional collections and eight service collections with live inventory above the fold.
- Separated three trust states: credential verified, business claimed, and directory record.
- Added verification provenance, expiry, listing status, lead events, booking outcomes, page dispositions, and redirect governance through a reversible migration.
- Added lead analytics for search, filters, calls, WhatsApp, bookings, and claims.
- Added Trust, Help, Corrections, Complaints, and sourced KZN homeowner resources.
- Added canonical controls, host redirects, crawlable pagination, split sitemaps, safer robots rules, breadcrumbs, and structured data.
- Hardened registration, claims, file uploads, profile privacy, review accounts, and email rendering.
- Upgraded to Next.js 16.3.1 and removed known production dependency vulnerabilities.
- Added read-only SEO and plumber-data audit scripts, automated tests, and a built-site verification script.

## Stack

- Next.js 16 App Router
- React 19 and TypeScript
- Tailwind CSS 3
- Supabase Postgres, Auth, Storage, and RLS
- Vercel deployment from GitHub
- Resend for transactional email
- Google Places API New for cached Google review data
- Google Analytics 4, loaded only after visitor consent

## Required environment variables

Copy `.env.example` to `.env.local` for local development. Never commit `.env.local`.

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `CRON_SECRET`
- `GOOGLE_API_KEY`
- `RESEND_API_KEY`
- `ADMIN_EMAIL`
- `FROM_EMAIL`

Optional:

- `NEXT_PUBLIC_GA_ID`

## Local setup

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

After starting a production build on port 3100:

```bash
npm run verify:preview
```

## Database rollout

No live database changes are performed by this repository. Review and run the scripts manually in Supabase.

1. Export a database backup.
2. Run `scripts/007_growth_trust_seo_dry_run.sql`.
3. Resolve duplicate reviews that would block the unique review index.
4. Review the generated reports in `reports/`.
5. Deploy the new code against the legacy staging schema and run the smoke tests.
6. Apply `supabase/migrations/007_growth_trust_seo.sql` in staging, then repeat the tests.
7. In production, promote the backward-compatible code first, run a short smoke test, then apply the migration and repeat the tests.

Rollback SQL is in `supabase/rollback/007_growth_trust_seo_rollback.sql`. It is destructive to newly captured data, so export the new tables and columns before using it.

## Read-only audit scripts

```bash
npm run audit:content
npm run audit:plumbers
```

Both scripts read Supabase and write CSV/JSON reports locally. They do not update records.

Current generated reports include:

- `reports/seo-page-inventory.csv`
- `reports/seo-page-inventory-summary.json`
- `reports/plumber-data-audit.csv`
- `reports/plumber-data-audit-summary.json`
- `reports/plumber-duplicate-candidates.csv`

The current content report recommends review of 311 pages for retention, 204 for possible merge, 44 for possible noindex, and 4 off-scope removals. The plumber report identifies 478 legacy generated-description patterns and limits the current profile sitemap to 854 records with at least one substantive signal.

These are triage suggestions, not automatic deletion decisions. Add current Search Console demand, backlinks, conversions, and live provider inventory before approving redirects or removals.

## Trust rules

- A claimed business is not automatically credential verified.
- An uploaded certificate is private evidence, not a public download or permanent proof.
- Imported records must not imply endorsement, current availability, or credential status.
- Verification, reviews, or organic ranking cannot be purchased.
- No prices, ratings, response times, or credentials may be invented.

See `/trust` and `CONTENT-PRINCIPLES.md` for the public and editorial standards.

## Deployment

Use GitHub as the source repository and Vercel as the runtime. Follow `DEPLOYMENT-RUNBOOK.md` for the staged database, code, analytics, and search migration.
