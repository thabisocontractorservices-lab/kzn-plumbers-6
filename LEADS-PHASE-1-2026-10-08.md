# Lead capture — Phase 1 (8 October 2026)

KZNPlumbers now captures and tracks homeowner enquiries instead of only passing visitors straight to plumbers.
The directory, profiles, SEO pages and sitemaps are unchanged; nothing was removed from the database.

## Homeowner journey
1. **Get My Free Estimate** — new page `/get-estimate` (also linked from the menu, homepage hero, directory cards and profiles).
2. **4 quick steps**
   - Your job: area, suburb, optional postcode, service (15 job types)
   - Urgency (Emergency / Today / 2–3 days / This week / Planning) + optional description + up to 4 photos (shrunk on the phone before upload)
   - **Choose up to 3 plumbers** — claimed, published, lead-enabled plumbers who serve that area and job, ranked by
     reviews (Google + KZN), photos, verified credentials, availability and 24/7 for urgent jobs. Or tick
     "Let KZNPlumbers choose the best plumber for me".
     From a profile's **Request a Quote** button, that plumber is pre-selected and gets the job first; the homeowner can allow
     KZNPlumbers to find another plumber if they can't help.
   - Your details: first name, optional surname, mobile, WhatsApp (if different), optional email, required POPIA consent, optional marketing opt-in.
3. **Lead saved first** → reference like `KZN-1048` → confirmation page shows the **estimated price range first**, the reference,
   which plumbers it went to, the disclaimer, and **“Message KZNPlumbers About My Request”** (opens your WhatsApp with
   the reference, service, area and urgency pre-filled). WhatsApp is optional — the lead already exists.
   Clicking it tags the lead `whatsapp_opened` (this only proves WhatsApp opened, not that a message was sent).
   Add `customer_confirmed` yourself after chatting.

## Plumber journey
- Chosen plumbers get an email: “NEW KZNPLUMBERS JOB KZN-1048 — Blocked drain in Westville” with **View / Accept Job**.
- **Dashboard → Job leads** (new). Job details and photos are visible; the customer's phone, WhatsApp, email and surname are
  **hidden until the plumber accepts**. They can decline with a reason (admin is emailed).
- After accepting: Call / WhatsApp / Email buttons, then one-tap updates: *I contacted the customer* → *I sent a quote* →
  *Won (job value)* / *Lost*. These roll up to the lead's status.

## Admin — `/admin/leads` (button on the admin workspace)
- Funnel: leads, need a plumber, sent, accepted, contacted, quoted, won, won value, WhatsApp opened; breakdowns by service, area and source/campaign.
- Filters: status (incl. “no plumber on it” / “not accepted yet”), service, area, date range, search.
- Lead drawer: full contact details, photos, estimate, ad source (UTM / gclid / fbclid / landing page), plumbers on the lead,
  **assign plumber** (best area/service matches first, max 3), resend email, copy job link, **WhatsApp alert** to a plumber
  (pre-written “NEW KZNPLUMBERS JOB …” message), set plumber status, remove plumber, change lead status, mark invalid, reopen,
  quality tags, notes and complete history.
- **Lead plumbers** tab: switch leads on/off per claimed plumber; warns if fewer than 10 can receive leads.
- **Estimate prices** tab: edit low/high price and note per service. Emergency shows +35%, same-day +15%.
  Starting prices are reasonable KZN defaults — please review them before running ads.

## Safety built in
- Leads only ever go to **claimed** plumbers (never unclaimed directory listings).
- Max 3 plumbers per lead, enforced in the database.
- Spam: hidden honeypot field, minimum fill time, 6 requests per connection per hour, same phone + job within 24 h returns the existing request.
- All lead data is server-only (row-level security; no browser access). Photos are in a **private** bucket with 1-hour links.
- Privacy policy has a new “Free Estimates and Quote Requests” section (sharing, photos, marketing, retention).
- Ad attribution is stored in the visitor's own browser and only sent with a request.

## Deploy — in this order
1. **Supabase → SQL Editor → New query → paste the whole of `supabase/migrations/009_leads.sql` → Run.**
   Paste the *contents*, not the file name. Expect “Success. No rows returned”.
   (If you haven't yet run `008_invoices.sql` from the invoicing upgrade, run that first.)
2. **Vercel → Settings → Environment Variables** (Production):
   | Variable | Needed? | Value |
   |---|---|---|
   | `RESEND_API_KEY` | Strongly recommended | Your Resend key (already used for registration emails). Without it, leads still save but nobody is emailed. |
   | `LEADS_ADMIN_EMAIL` | Optional | Where new-lead alerts go. Defaults to `ADMIN_EMAIL` / admin@kznplumbers.co.za. |
   | `NEXT_PUBLIC_KZN_WHATSAPP_NUMBER` | Optional | The WhatsApp number on the confirmation page, e.g. `27609922848` (this is the default). |
   | `LEADS_AUTO_NOTIFY` | Optional | Set to `false` if you want to check every lead yourself before plumbers are emailed. |
3. **Push the code** to GitHub (Vercel deploys automatically).
4. **Test**: open `/get-estimate`, submit a job in an area where you have a claimed plumber (use your own number),
   check the confirmation page and WhatsApp button, then open `/admin/leads`. Log in as that plumber → Dashboard → Job leads → Accept.
5. Before ads: in **Admin → Leads → Lead plumbers**, make sure enough plumbers are switched on in each area you advertise,
   and review **Estimate prices**.

## Ad links
Tag ad URLs so the dashboard shows which campaign each lead came from, e.g.
`https://www.kznplumbers.co.za/get-estimate?utm_source=facebook&utm_medium=paid_social&utm_campaign=geyser-oct`
Google Ads auto-tagging (gclid) and Facebook (fbclid) are picked up automatically.

## Not in Phase 1 (planned)
- Phase 2: automatic matching for "KZNPlumbers chooses", response timeouts, requested-plumber fallback automation, follow-up reminders.
- Phase 3: HighLevel contacts, opportunities, pipeline and automated WhatsApp/SMS (needs the Meta WhatsApp Business API and approved templates).
- Phase 4: credits / pay-per-lead once 30–50 leads have been tracked.

## Checks run
`npm run lint` ✓ · `npm run typecheck` ✓ · `npm test` 84 tests (8 new for leads) ✓ · `npm run build` ✓ ·
migration tested twice in a row on a fresh database, including the 3-plumber limit and KZN-#### numbering ✓ ·
homeowner flow and admin screens checked in a browser on desktop and phone with sample data ✓.
Not yet tested against your live Supabase database — please do the step-4 test after deploying.
