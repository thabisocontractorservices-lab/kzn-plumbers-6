# Bounce rate and contact tracking (18 October 2026)

## What changed
1. **Contact events in Vercel Analytics** (Analytics → Events). Cookieless, no personal details:
   - `call_click`: Call button on a card or profile
   - `whatsapp_click`: WhatsApp button on a card or profile
   - `quote_click`: Request a Quote on a directory card
   - `estimate_started`: visitor completed step 1 of the estimate form
   - `estimate_completed`: quote request saved (duplicates not counted)
   - `kzn_whatsapp_click`: "Message KZNPlumbers About My Request" on the confirmation page
   Each event carries only the page type (home, profile, area, service, blog, estimate, guide) and, where known, the area or service key.
2. **Private pages are no longer counted**: admin, dashboard, login, register, forgot-password, claim and API pages.
3. **Exclude your own visits**: on each browser/phone you use, open `https://www.kznplumbers.co.za/?analytics=off` once. Undo with `?analytics=on`.
4. **Next steps for one-page visitors**:
   - Profiles: a "See other plumbers in [area]" shortcut near the top that jumps to the comparison section.
   - Unclaimed profiles: a "Want more than one quote? Get a free estimate" box beside the contact details (direct contact is unchanged).
   - Blog posts: the end box now offers the free estimate as well as directory search, followed by links to every area and service page.

## How to read the numbers (after 2–4 weeks)
- **Contact rate** = (call_click + whatsapp_click + estimate_completed) ÷ visitors. This is the main health number.
- **Estimate completion** = estimate_completed ÷ estimate_started. Below roughly 30% suggests the form needs simplifying.
- Bounce rate by page: a high bounce with a high contact rate is fine (people found a plumber and called). High bounce with few contacts marks a page to improve.
- Filter by referrer (google.com, facebook.com) or UTM campaign to compare sources.

## Speed
Server response on the live site measured 0.08–0.32 s for the home page, a profile, the directory, a guide and the estimate page. Server speed is not causing bounces. For real mobile load times, enable **Vercel → Speed Insights** (it needs the `@vercel/speed-insights` package; ask if you want it added).

## Checks
Lint passed. 96 tests passed (1 new). Production build passed. No database changes; no SQL to run.
