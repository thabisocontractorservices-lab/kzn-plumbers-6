# Invoicing upgrade — 8 October 2026

## The problem
Plumbers tapped **Download PDF** and got the browser's **Print** dialog instead of a file.
The old button called `window.print()` in a pop-up window; nothing ever created a PDF.

## What changed

**Real PDF files**
- New route `GET /api/invoices/:id/pdf` builds the PDF on the server (`@react-pdf/renderer`) and sends it as a
  download named `Invoice INV-0004 - Customer Name.pdf`. Add `?inline=1` to open it in the browser instead.
- Only the plumber who owns the invoice can get it (session cookie or bearer token). Logged-out → 401, not theirs → 404.
- Layout follows the invoice plumbers already send: logo, business details, Invoice No. / Date / Due Date,
  Bill To, Qty · Description · Unit Price · Total, Subtotal / Discount / VAT / Total / **Balance Due**,
  notes, banking details, "Thank you for your business.", page numbers, PAID watermark once paid.
- PDFs are made fresh on every download, so they always match the latest edits — every invoice a plumber
  has ever made can be downloaded again from the list.

**Simpler screens (inspired by Brisk Invoicing)**
- **Invoices list**: totals at the top (waiting to be paid, overdue, paid this month), search, status filters
  (All / Unpaid / Overdue / Paid / Draft), a green **Download PDF** button on every invoice and a **More** menu
  (View PDF, Send to customer, Edit, Mark as paid / sent / unpaid, Duplicate, Delete). Cards on phones.
- **New / edit invoice**: business details and logo shown automatically; invoice number auto-continues from
  the highest number used; date + payment terms set the due date; pick a past customer to fill in their
  details; common plumbing jobs suggested and past prices remembered; add item / discount; VAT toggle;
  "Note to customer" and "Banking / payment details" tabs (banking details remembered); live total;
  sticky bar with **Clear · Preview · Save draft · Save & Download PDF**.
- **Invoice page**: Download PDF, View PDF, Send to customer (on phones this opens the share sheet with the
  PDF attached — WhatsApp, email, etc.; on computers it downloads the PDF and opens WhatsApp with a message).
- Print pop-up removed.

## Files
- `lib/invoice.ts` – shared types, totals, numbering, dates, filenames (tested in `tests/invoice.test.ts`)
- `lib/invoice-pdf.tsx` – the PDF document (server only)
- `lib/invoice-client.ts` – download / view / share / save helpers
- `lib/useInvoiceBusiness.ts` – loads the plumber's business details + logo
- `app/api/invoices/[id]/pdf/route.ts` – PDF download route
- `app/dashboard/invoices/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx` (new)
- `components/invoices/` – `InvoiceForm`, `InvoiceActions`, `InvoicePreview`, `Toast`
- `supabase/migrations/008_invoices.sql` – database update
- `package.json` / `package-lock.json` – adds `@react-pdf/renderer`

## Deploy — in this order

1. **Run the database update** (2 minutes). Supabase → SQL Editor → New query → paste all of
   `supabase/migrations/008_invoices.sql` → **Run**. It only adds things; no invoice is changed or deleted, and
   it is safe to run twice.
   - If the result says *"Duplicate invoice numbers already exist"*, run the query below, rename the
     duplicates, then run the migration again. (Everything else is applied either way.)
     ```sql
     select plumber_id, invoice_number, count(*)
     from public.invoices
     group by plumber_id, lower(trim(invoice_number))
     having count(*) > 1;
     ```
   - Check Authentication → Policies → `invoices`: there should be the four "Plumbers … own invoices"
     policies. Delete any older policy that lets everyone read invoices.
2. **Push the code to GitHub** (Vercel deploys it automatically). No new environment variables are needed —
   the PDF route uses the existing `SUPABASE_SERVICE_ROLE_KEY`.
3. **Test** with a plumber account: create an invoice → **Save & Download PDF** → a `.pdf` file appears in
   Downloads. Open the list → **Download PDF** on an older invoice → file downloads. On a phone, try
   **Send to customer**.

If the code is deployed before step 1, invoices still save (the extra fields are skipped and the plumber sees
a short notice), so the order is forgiving — but run the migration as soon as possible.

## Checks run
`npm run lint` ✓ · `npm run typecheck` ✓ · `npm test` (76 tests, 7 new) ✓ · `npm run build` ✓ ·
migration tested on a copy of the old table, a fresh database, twice in a row, and with duplicate numbers ✓ ·
PDF rendered for a normal invoice and a 40-line, 3-page paid invoice ✓ · PDF route returns 401 when logged out ✓.

Note: `SHA256SUMS.txt` lists checksums for the previous release and is now out of date.
