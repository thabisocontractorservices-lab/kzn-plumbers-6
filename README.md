# KZN Plumbers Directory

A verified plumber listing platform for KwaZulu-Natal, South Africa. Built with Next.js 14 (App Router), Supabase, and the Google Places API.

## Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + TypeScript
- **Backend**: Supabase (Postgres, Auth, Storage, RLS)
- **Auth**: Supabase Auth with Google OAuth
- **Reviews**: Google Places API (New) v1
- **Calendar**: Google Calendar booking links (paste-and-go)
- **Messaging**: WhatsApp via `wa.me` links
- **Deployment**: Vercel

## Quick start

```bash
# 1. Install deps
npm install

# 2. Copy env and fill in
cp .env.example .env.local

# 3. Start Supabase (local) and apply migrations
npx supabase start
npx supabase db reset

# OR push to a hosted Supabase project
npx supabase link --project-ref <your-ref>
npx supabase db push

# 4. Seed an admin (optional)
psql $DATABASE_URL < supabase/seed.sql

# 5. Run dev server
npm run dev
```

## Environment variables

See `.env.example` — you need:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (formerly the anon key — Supabase's new naming)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose)
- `GOOGLE_API_KEY` (with Places API New + Calendar API enabled)
- `NEXT_PUBLIC_SITE_URL`
- `CRON_SECRET` (random string for cron auth)

## Project structure

```
app/
  page.tsx                       # Public directory
  register/page.tsx              # Plumber registration (4-step wizard)
  login/page.tsx                 # Login (plumber + homeowner)
  plumber/[id]/page.tsx          # Public plumber profile
  dashboard/                     # Plumber-only dashboard
    page.tsx
    profile/page.tsx
    reviews/page.tsx
    bookings/page.tsx
  admin/page.tsx                 # Admin approval panel
  review/[slug]/route.ts         # Short link redirect
  api/
    places/details/route.ts      # Google Places API proxy
    bookings/route.ts            # Booking submissions
    cron/refresh-google/route.ts # Daily review refresh (Vercel cron)
  auth/callback/route.ts         # OAuth callback
components/                      # Shared UI components
utils/
  supabase/                      # Supabase client (browser/server/middleware)
    client.ts                    # Browser client
    server.ts                    # RSC + service role client
    middleware.ts                # Session refresh + route gating
lib/
  google/places.ts               # Google Places API wrapper
  utils.ts                       # Shared utilities (combinedRating, whatsAppLink, etc.)
supabase/
  migrations/                    # 6 SQL migration files
  seed.sql                       # Optional admin seed
types/
  database.ts                    # DB types (run `npm run supabase:types` to regenerate)
```

## Deploy to Vercel

1. Push to GitHub
2. Import the repo on https://vercel.com/new
3. Add all env vars from `.env.example`
4. Deploy
5. Connect custom domain `kznplumbers.co.za`
6. Cron job (`/api/cron/refresh-google`) runs daily at 03:00 UTC — see `vercel.json`

## Launch checklist

- [ ] Supabase project created and linked
- [ ] Migrations applied (`supabase db push`)
- [ ] Storage buckets created (`certs`, `photos`, `avatars`)
- [ ] Google Cloud project with Places API + Calendar API enabled
- [ ] Google OAuth client configured (Authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback`)
- [ ] Vercel project created and env vars set
- [ ] Custom domain configured
- [ ] Admin account seeded (`supabase/seed.sql`)
- [ ] Test plumber registration end-to-end
- [ ] Test Google review link generation
- [ ] Test WhatsApp booking flow
- [ ] Go live

## License

MIT
