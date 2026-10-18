# Analytics fix — 11 October 2026

## Why views "dropped"
Google Search traffic roughly doubled from July to October, but Google Analytics showed a 71% drop because the
8 September release:
- only loaded GA after a visitor clicked "Allow analytics" (most never do), and only if
  `GA_AUTOMATIC_MEASUREMENT_DISABLED=true` was set in Vercel;
- renamed every page "KZN directory" and blanked the referrer, so every visit looked like "(direct)".

## What changed
1. **Vercel Web Analytics added** (`@vercel/analytics`, `components/VercelAnalytics.tsx`). Cookieless and anonymous, so it
   counts every visit without the cookie banner. URLs are cleaned first: marketing tags (utm_*, gclid, fbclid), area,
   service and page number are kept; anything else (search text, reference numbers, private links) is removed.
   Admin pages are reported as `/private`, dashboard record IDs as `[id]`.
2. **Google Analytics now reports real data** (still only after consent):
   real page titles, the cleaned page address, and the referring site (e.g. google.com), so traffic sources work again.
   Dashboard, admin and quote-confirmation pages are reported as "Private page".

## To switch on
1. Push the code. Vercel → Analytics shows visitors within a few minutes of the first visits (no setting needed).
2. Google Analytics (optional, for the full GA reports):
   - In GA → Admin → Data streams → your web stream → Enhanced measurement → turn **off** "Form interactions" and
     "Site search" (these can capture typed text). Page views, scrolls and outbound clicks can stay on.
   - In Vercel → Environment Variables (Production), set `GA_AUTOMATIC_MEASUREMENT_DISABLED=true` and check
     `NEXT_PUBLIC_GA_ID` is your G- ID. Redeploy.
   GA will still only count visitors who allow analytics. Use Vercel Analytics as the true visitor total.

## Checks
lint ✓ · typecheck ✓ · 87 tests (2 new for URL cleaning) ✓ · production build ✓
