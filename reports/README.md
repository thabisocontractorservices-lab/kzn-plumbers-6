# Read-only audit reports

Generated on 16 August 2026 from the supplied public Supabase configuration.

- `seo-page-inventory.csv` classifies all 563 SEO pages using word count, normalized similarity, scope, and existing disposition fields.
- `seo-page-inventory-summary.json` summarizes the triage.
- `plumber-data-audit.csv` scores 1,253 published records for missing or conflicting fields that need review, including 478 descriptions matching the legacy generated templates.
- `plumber-duplicate-candidates.csv` lists 37 exact candidate groups across normalized name, phone, PIRB number, or domain.
- `plumber-data-audit-summary.json` summarizes the plumber-data review and identifies 854 records with at least one substantive indexable signal.

These files do not authorize deletion, merging, noindexing, or redirects. Join them with current Search Console, backlinks, conversion data, business ownership, and branch evidence before changing live records.
