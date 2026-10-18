# Fix 2: useful, factual profile content

## Changes
- Profiles without a usable description now show a labelled directory summary based on the business name, area, recorded services and claimed status. Existing usable business descriptions are preserved.
- Recorded services have practical pre-booking questions and links to the corresponding service directory pages.
- Recognised areas link to the regional directory, with a warning that listed location does not establish coverage of every nearby suburb.
- Profiles missing a description prompt owners to claim or update their business with original information and permitted photos.

## What deliberately did not change
- No generated biographies, invented operating history, unsupported credentials, coverage claims or prices.
- No database records were rewritten. No SQL migration is needed.
- Existing sitemap inclusion, canonicals, publication rules and indexability remain unchanged.
- Existing photos, review display and related-business sections remain in place.

## Deployment and checking
Push the updated project to GitHub and let Vercel deploy. Check an incomplete profile, a profile with a genuine business description, and one with several services. The new content comes from current database fields, including the legacy schema supplied on 11 October.

In Search Console, inspect a handful of the previously unindexed public profiles using Test Live URL. Verify that the page is crawlable and the canonical points to the profile. Request indexing for the strongest improved pages; do not request indexing for claim/login pages. Track this sample over several weeks. Google controls indexing and no outcome is guaranteed.

The biggest follow-up improvement is real owner-supplied information: actual services, business description, work photos, accurate links and genuine reviews. Repeating longer generic paragraphs across every profile is not an evidence-based substitute for that.

## Checks
Lint passed. All 95 tests passed. Production build (including TypeScript validation) passed. No live database writes or live-site deployment were performed.
