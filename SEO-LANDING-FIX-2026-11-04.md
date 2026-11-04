# KZN Plumbers — landing-page accuracy and SEO fix

## Source and scope
Built from the project ZIP supplied on 4 November 2026. No live website or database was modified. Google indexing is not guaranteed.

This change targets the legacy `seo_pages` records where `group_name` is `Landing Pages`, the body contains the known shared phrase `Every plumber listed for`, and the slug has one of the supported historical topic prefixes. In the Search Console export reviewed on 4 November, 131 working content pages matched the same phrase and topic/group pattern using the then-current live page and inventory report. The actual affected count may differ on deployment. Other landing pages and individually edited pages without that signature are not changed by this rule.

## What changes when deployed
- For matching records, the page presents a safer, shorter summary with topic-specific practical questions, honest verification guidance, a truthful location heading and description, and links to the trust page and free estimate. It replaces the old visible body rather than attempting to preserve old paragraphs that contain unsupported claims. Original database fields, body, and metadata remain untouched. The override applies only while the identifying phrase remains in the stored body; an edited record without that phrase uses its stored editorial content as before. There is no SQL migration.
- Titles, headings, descriptions, OpenGraph descriptions and Article structured-data descriptions use the same safer content. `pricing-general` is described as KZN pricing, not a town called general.
- Where a matching topic has a directory specialty and an exact supported area label, provider cards are limited to the relevant service and stored area label. An empty result is explicitly shown rather than a broader unrelated match. Towns that do not map to a stored label are not treated as confirmed coverage.
- Existing URLs, canonical URLs, robots directives, redirects, profile pages, sitemaps and public database records are unchanged. The dated source-record label is not shown on overridden copy because it would not be the date of this new text.
- This is a safety and clarity correction; it does not create evidence for business details, reviews, prices, credentials or availability, and no claim is made that the pages will be indexed. It may apply to matching landing pages beyond the 131 in the supplied report.
- Other editorial groups are not rewritten. For example `geyser-replacement-cost-kzn` has separately identified legacy price, insurance and registration claims that still require an individually sourced review; this fix does not correct that article.

## Build and deployment
- The npm build script now uses `next build --webpack`. In this sandbox, the default Turbopack build failed to resolve generated Google font URLs, while the webpack production build completed successfully. No dependency versions were changed. If Vercel has a manually overridden build command, check that it uses `npm run build` or `next build --webpack`.
- In GitHub, apply the contents of this ZIP to the same repository and branch that currently deploy the site, preserving files and Vercel/Supabase environment variables. The ZIP contains no `.env.local` or secret credentials. Do not run `007_growth_trust_seo.sql`.
- After Vercel deployment, check `/compliance-pinetown`, `/leak-newcastle`, `/pricing-general`, a separately edited guide and a plumber profile. Confirm titles, safe body, area/service matching, clear empty states and no false universal claims. In Search Console, inspect a few important changed URLs and request indexing selectively after verifying the live page.
- Check Search Console over the following weeks; the cached report and Google's indexing decisions may take time to change.

## Tests
Run `npm run check`. Automated tests include legacy matching and non-matching records, metadata, locality, service filtering and empty-state rendering.
