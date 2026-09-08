# KZN Plumbers Directory

A KwaZulu-Natal-specific Next.js directory with direct contact, regional and service collections, transparent credential evidence, plumber tools and a server-authorised admin workspace.

## Current release: 8 September 2026

**Code-first, compatible with the existing Supabase schema.** No extra paid project, Docker installation, local testing or SQL migration is required from the site owner.

Read **GO-LIVE-2026-09-08.md** for the current deployment instructions. Older migration/runbook documents are historical references, not prerequisites for this release. Do not run migration 007 or a review-archive script just to deploy this code.

### What's included

- Admin overview, searchable listings, evidence inspection, publication controls, ownership review, reviews/history, bookings, accounts, and read-only policy/capability reporting.
- Latest-per-account current reviews while retaining older feedback in the database; private history exports and public review-concern reporting.
- Fixed claim signup, confirmed-user registration, private certificate access, anonymous bookings, safe return URLs and clear partial failures.
- Bounded public data, stable search/filter/history/pagination, narrow KZN geography, honest credential/availability states, and full inventory sitemaps.
- Existing plumber profile, review, booking, upload and invoice tools retained. Optional metrics and structured outcome controls report when their database support is missing.

### Deployment

Vercel builds from GitHub using Node 24.x. Use the current production-scoped Supabase and mail credentials in Vercel. Never commit real .env files, secret keys, private certificates, customer exports or backup files.

Application guards do not modify legacy Supabase RLS or revoke already shared signed URLs. Policy reporting exposes what can be observed safely and labels remaining unknowns. No database cleanup or security migration has been executed by this code release.

### Developer commands (not required on the owner's computer)

- npm ci
- npm run dev
- npm run build
- npm run lint
- npm run typecheck
- npm test

The schema-dependent historical audit scripts remain for reference; they are read-only but require the correct credentials and are not part of the Vercel build.
