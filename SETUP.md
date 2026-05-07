# Setup Guide

A step-by-step setup walkthrough for **KZN Plumbers Directory**.

## 1. Supabase project

1. Go to https://app.supabase.com → New Project
2. Choose a region close to ZA (Frankfurt or São Paulo)
3. Save your `Project URL` and `anon` key for `.env.local`
4. From Settings → API, also copy `service_role` key (server-only)

### Apply migrations

```bash
# Install the Supabase CLI
npm i -g supabase

# Link to your hosted project
supabase login
supabase link --project-ref <your-project-ref>

# Apply migrations
supabase db push
```

OR for local dev:
```bash
supabase start          # spins up local Postgres + Studio
supabase db reset       # applies all migrations
```

### Storage buckets

The migrations create three buckets:
- `certs` (private — credential PDFs)
- `photos` (public — work gallery)
- `avatars` (public — profile photos)

If they don't appear, create them manually via Storage in the Supabase dashboard.

## 2. Google Cloud project

1. Go to https://console.cloud.google.com → New Project
2. Enable APIs:
   - **Places API (New)** — for live business reviews
   - **Calendar API** — optional, for embedded scheduling
3. Credentials → Create Credentials → API Key
4. Restrict the key:
   - HTTP referrers: `https://kznplumbers.co.za/*`, `http://localhost:3000/*`
   - APIs: Places API (New) only
5. Copy the key into `.env.local` as `GOOGLE_API_KEY`

### Google OAuth (for user sign-in)

1. Credentials → Create Credentials → OAuth client ID
2. Application type: Web application
3. Authorized redirect URIs:
   - `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - `http://localhost:54321/auth/v1/callback` (local dev)
4. Copy `Client ID` and `Client Secret`
5. In Supabase → Authentication → Providers → Google → enable, paste the credentials

## 3. Vercel deployment

```bash
# Push your code to GitHub first
git init
git add .
git commit -m "Initial KZN Plumbers Directory"
git remote add origin git@github.com:you/kzn-plumbers.git
git push -u origin main
```

1. https://vercel.com/new → import the repo
2. Framework preset: Next.js (auto-detected)
3. Environment Variables — add all 6 from `.env.example`
4. Deploy
5. Project → Settings → Domains → add `kznplumbers.co.za`
6. The cron at `/api/cron/refresh-google` runs daily at 03:00 UTC (see `vercel.json`). Vercel injects `Authorization: Bearer ${CRON_SECRET}` automatically.

## 4. Seed an admin

```bash
# After signing up your first user via /register or /login
psql "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" \
  -c "update profiles set role='admin' where email='you@example.com';"
```

OR run `supabase/seed.sql` after editing the email.

## 5. Test the flow end-to-end

- [ ] Register a plumber via `/register`
- [ ] Login as admin and approve them via `/admin`
- [ ] Verified plumber appears on `/`
- [ ] Open their profile, submit a review and a booking
- [ ] Login as the plumber, check `/dashboard` for the booking
- [ ] Toggle availability, verify the badge changes on their card
- [ ] Trigger the cron manually:
      `curl -H "Authorization: Bearer $CRON_SECRET" https://kznplumbers.co.za/api/cron/refresh-google`
- [ ] Confirm Google rating + reviews refresh on their profile

## 6. Production hardening

- [ ] Enable email confirmation in Supabase Auth → Providers → Email
- [ ] Set up SMTP (SendGrid / Resend) under Auth → SMTP Settings
- [ ] Add an SPF/DKIM record for your domain
- [ ] Rate-limit `/api/bookings` (e.g. via Vercel Edge Middleware or Upstash)
- [ ] Replace the lightweight `customer_id is null` policy with reCAPTCHA on the booking form
- [ ] Add Sentry / Logtail for error tracking
- [ ] Add `robots.txt` and `sitemap.xml` (Next.js can generate these)
- [ ] Switch DB types to generated: `npm run supabase:types`
