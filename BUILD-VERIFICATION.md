# Build Verification

Date: 16 August 2026

## Passed checks

- ESLint: pass, zero warnings
- TypeScript strict check: pass
- Automated tests: 23 passed across 7 test files
- Production build: pass on Next.js 16.3.1
- Full npm audit: zero known vulnerabilities
- Built-site verifier: pass
- Canonical non-www and HTTP redirect checks: 308 to `https://www.kznplumbers.co.za`
- Vercel preview-host check: preview host remains accessible and is not redirected to production
- Protected dashboard and admin routes: unauthenticated requests redirect to login
- Protected cron and IndexNow routes: unauthenticated requests return 401

## Rendered route checks

- Homepage: 158,772 bytes
- Filtered homepage: 162,425 bytes
- Durban regional collection: 115,131 bytes
- Blocked-drain service collection: 126,989 bytes
- Paginated all-plumbers page: 194,355 bytes
- Trust page: 46,146 bytes
- Help page: 38,585 bytes
- CoC resource: 46,780 bytes
- Sample plumber profile: 86,434 bytes

The prior public audit measured homepage and all-plumbers HTML at roughly 1.1 MB each. The rebuilt pages remain below the source budgets in `scripts/verify-built-site.mjs`.

## Index checks

- Split sitemap index: pass
- Profile sitemap: 854 indexable records
- Content sitemap: 559 URLs before page-disposition migration
- Four Cape Town or Durbanville pages excluded from the sitemap
- Claim routes are crawlable so page-level noindex can be read
- Query-filtered homepage canonicalizes to the root directory
- Low-signal profile sample returns `noindex, follow`

## Read-only live-data audit

- 1,253 published plumber records
- 67 claimed profiles
- 37 exact duplicate-candidate groups
- 981 records with one or more manual review flags
- 478 descriptions matching the retired generated templates
- 563 SEO pages
- 311 retention reviews
- 204 merge reviews
- 44 noindex reviews
- 4 off-scope removals

## Important deployment boundary

No production database record, DNS setting, Search Console setting, or live deployment was changed. Apply the migration and code using `DEPLOYMENT-RUNBOOK.md`.
