# KZN Plumbers Deployment and Search Migration Runbook

This release is designed for GitHub to Vercel. Apply it in stages; do not combine database cleanup, redirects, and a code deployment without a tested rollback.

## 0. Security preflight

The supplied handoff archive contained a `.env.local` file. The new bundle excludes it, but privileged credentials from the old archive should be treated as exposed and rotated before production:

- Supabase service role key
- Google API key
- Resend API key
- Cron secret
- Any OAuth client secret stored outside the repository

The Supabase publishable key is intentionally public, but it must still be supplied through the environment rather than hard-coded.

Check the GitHub repository history for committed environment files. Removing a file in a new commit does not remove it from old commits.

## 1. Back up and stage

1. Export the production Supabase schema and data.
2. Create a staging Supabase project from a recent production export, with customer-sensitive data minimised where practical.
3. Push the new code to a GitHub branch and deploy that branch to a Vercel preview connected only to staging services.
4. Copy only the required staging environment variables into the Vercel preview. Never point a preview at the production service-role key.
5. Smoke-test the preview before the migration. The new code is intentionally backward-compatible with the current schema.
6. Run `scripts/007_growth_trust_seo_dry_run.sql` against staging and save the output with the deployment record.
7. Resolve duplicate reviews before applying the migration; the one-review-per-user index will stop the migration if duplicates remain.
8. Review `reports/plumber-duplicate-candidates.csv`. Do not merge records automatically; shared numbers, branches and renamed businesses require human review.
9. Review `reports/seo-page-inventory.csv` with current Search Console page and query data.

## 2. Apply the database migration in staging and retest

Run:

- `supabase/migrations/007_growth_trust_seo.sql`

The migration does not delete plumbers or SEO pages. It adds trust states, provenance, expiry, listing status, booking outcomes, lead events, redirect governance, page dispositions, claim evidence, safer review rules, and restricted credential/profile policies.

After the migration:

- Existing claimed profiles become `business_claimed`.
- Other published records become `directory_record`.
- Legacy `is_certified` flags are cleared until evidence is reviewed.
- `accepts_new_work` defaults to false until the business confirms availability.
- Known Cape Town and Durbanville content is marked for removal from the index.

Re-run the full preview test set after the migration. Staging must pass twice: once on the legacy schema and once on the migrated schema. This proves the production code-first rollout can be reversed without an immediate database rollback.

## 3. Test staging before production

Run locally:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Then test these flows in the staging deployment:

- Homepage area, service, urgency, text search, filters, sort, and pagination
- Regional and service collection pagination
- Plumber profile display and contact links
- New plumber registration and email confirmation
- Private credential and public photo upload
- Ownership claim submission and admin approval
- Booking request, source fields, and direct WhatsApp follow-up
- Homeowner email confirmation and one-review-per-business rule
- Admin publishing as directory record, business claimed, or credential verified
- Availability update and freshness date
- Contact form email delivery
- Daily Google review cron authorization
- IndexNow authorization
- Split sitemap content and robots rules
- Analytics consent, GA4 events, and first-party lead events

Run the built-site smoke test against staging:

```bash
VERIFY_BASE_URL=https://your-staging-domain.example npm run verify:preview
```

## 4. GitHub to Vercel production deployment

Use a short code-first maintenance window because this bundle can run on both the legacy and migrated schemas, while the old production code must not run against the new restricted review and ownership rules.

1. Create or open the GitHub repository used by Vercel.
2. Upload the contents of the `kzn-plumbers` folder, not the parent archive folder.
3. Do not upload `node_modules`, `.next`, `.env.local`, database exports, audit exports containing sensitive customer data, or private certificates.
4. Confirm `package-lock.json` is committed so Vercel uses the tested dependency graph.
5. In Vercel, set Node.js 20.9 or newer.
6. Add all variables from `.env.example` using real rotated values.
7. Set `NEXT_PUBLIC_SITE_URL` to `https://www.kznplumbers.co.za`.
8. Deploy the GitHub branch to a Vercel preview and run every staging check.
9. Take a fresh production Supabase backup and save the current Vercel production deployment ID.
10. Merge the same reviewed commit into the production branch so Vercel performs a fresh build with Production-scoped environment variables. Do not promote a preview artifact that was built with staging Supabase values. Deploy the backward-compatible production build before changing the database.
11. Run a five-minute public smoke test: homepage search, one region, one service, one profile, robots, sitemap, login redirect, booking form load, and protected cron responses.
12. Apply `supabase/migrations/007_growth_trust_seo.sql` to production.
13. Immediately repeat the smoke test, then test registration, claim review, uploads, booking outcomes, admin trust-state publishing, and the profile sitemap.
14. If the code smoke test fails before step 12, promote the previous Vercel deployment and do not run the migration. If the migration fails, its transaction should roll back; keep the new backward-compatible code live while investigating.

## 5. Host and DNS checks

Verify a single permanent redirect hop for:

- `http://kznplumbers.co.za` to `https://www.kznplumbers.co.za`
- `https://kznplumbers.co.za` to `https://www.kznplumbers.co.za`
- Any old Vercel production alias that should not be indexed

Do not redirect Vercel preview URLs to production; previews are needed for acceptance testing.

## 6. Search migration

After production is stable:

1. Open `https://www.kznplumbers.co.za/robots.txt` and confirm claim pages are not blocked.
2. Open `https://www.kznplumbers.co.za/sitemap.xml` and confirm it is a sitemap index.
3. Submit only the sitemap index in Google Search Console and Bing Webmaster Tools.
4. Request indexing for the homepage, priority regional hubs, priority service hubs, Trust page, and two sourced resources.
5. Use the protected IndexNow endpoint only after the approved indexable URL set is live.
6. Do not mass-request indexing for merge, noindex, redirect, or removal candidates.
7. Keep any old URL live until its approved redirect or noindex disposition is deployed.

Before activating bulk redirects, join `reports/seo-page-inventory.csv` to current Search Console page data. Preserve URLs with clicks, quality backlinks, conversions, or distinct demand unless there is a reviewed replacement.

## 7. GA4 and outcome measurement

The code emits these GA4 events:

- `search_submit`
- `filter_apply`
- `profile_view`
- `whatsapp_click`
- `call_click`
- `booking_submit`
- `booking_complete`
- `claim_complete`

In GA4, mark `whatsapp_click`, `call_click`, `booking_complete`, and `claim_complete` as key events. Do not mark browsing events as conversions.

The `lead_events` table stores a limited first-party record for core contacts. It excludes booking descriptions, contact-form messages, passwords, banking details, and full customer records.

## 8. Rollback

### Code-only rollback

Before the production migration, use Vercel deployment history to promote the previous known-good deployment. This is the fastest response to a code regression and is why the code is promoted first.

After the production migration, do not blindly promote the old code: it contains legacy claim, upload, and review behaviour that the migration intentionally replaces. Prefer the current backward-compatible release or a hotfix. Promote the old deployment only after a compatibility test against a migrated staging database.

### Database rollback

Use `supabase/rollback/007_growth_trust_seo_rollback.sql` only after exporting data created in the new columns and tables. The rollback removes lead-event, redirect and trust-state data captured after migration. If the forward migration fails inside its transaction, verify that it rolled back before considering the destructive rollback script.

Do not roll back by deleting plumber or SEO records.

## 9. Monitoring checkpoints

### First 24 hours

- Server errors and failed API routes
- Search and profile response times
- Booking, claim, upload, and contact completion
- Sitemap and robots availability
- Canonical host redirects

### Day 7

- GA4 event volume and source parameters
- Search-to-contact conversion
- Profiles with high views but no contacts
- Credential and ownership review backlog
- Search Console crawl anomalies

### Day 28

- Non-brand clicks
- Priority regional and service page CTR
- Indexed page cohorts by page type
- Contact rate per profile view
- Claimed-profile growth
- Duplicate resolution progress

### Day 90

- Booked-job and won-job reporting coverage
- Response-time coverage
- Complaint rate
- Original-resource citations and qualified backlinks
- Whether any new page type has enough evidence to scale

No ranking position is guaranteed. The release should be judged by accurate indexation, qualified contacts, response quality and booked work—not page count.
