# Setup Guide

Use this guide for a new local or staging environment. For the existing production database, follow `DEPLOYMENT-RUNBOOK.md` instead of replaying every historical migration.

## 1. Install and configure

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with credentials from your own services. Never commit the file.

## 2. Supabase

For a fresh Supabase project:

1. Link the Supabase CLI to the new project.
2. Apply the migrations in numeric order.
3. Confirm `photos` is public and `certs` is private.
4. Configure email confirmation and Google OAuth in Supabase Auth.
5. Add the production and preview callback URLs.
6. Create the first account normally, then assign the admin role using the Supabase SQL Editor.

For an existing KZN Plumbers database:

1. Export a backup.
2. Run `scripts/007_growth_trust_seo_dry_run.sql`.
3. Resolve blockers identified by the dry-run.
4. Test the new code against staging before the migration.
5. Apply `supabase/migrations/007_growth_trust_seo.sql` in staging and repeat the tests.
6. In production, promote the backward-compatible code first, smoke-test it, then apply the migration and retest.

## 3. Google and email services

- Enable Places API New for the server-side Google review refresh.
- Restrict the Google key to only the APIs the project uses.
- Configure Google OAuth through Supabase Auth.
- Verify the sending domain in Resend.
- Configure Resend SMTP in Supabase if auth emails should use the KZN Plumbers domain.

## 4. GitHub and Vercel

1. Push the contents of this project folder to GitHub.
2. Import that repository into Vercel.
3. Use Node.js 20.9 or newer.
4. Add all required Vercel environment variables from `.env.example`.
5. Deploy to a preview URL first.
6. Run the staging checklist in `DEPLOYMENT-RUNBOOK.md`.
7. Promote the tested preview to production.

## 5. Required checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

After starting the production build locally on port 3100:

```bash
npm run start -- -p 3100
npm run verify:preview
```

## 6. Scheduled jobs

`vercel.json` schedules the Google review refresh route. Confirm `CRON_SECRET` is set and verify the request uses the expected authorization header.

IndexNow is protected by the same secret and should be invoked only after the approved indexable URL set is live.
