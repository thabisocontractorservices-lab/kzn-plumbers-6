-- ─────────────────────────────────────────────────────────────────────────────
-- 008_invoices.sql — invoicing upgrade (real PDF downloads, due dates, discounts,
-- remembered business + banking details, safe invoice numbering).
--
-- SAFE TO RUN ON THE LIVE DATABASE:
--   • The invoices table already exists in production (it was created by hand and
--     never had a migration). Everything below is "if not exists" / additive.
--   • No invoice rows are changed or deleted.
--   • Safe to run more than once.
--
-- Run it in Supabase → SQL Editor → New query → paste → Run.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- 1. Table (only created if it is somehow missing, e.g. a fresh project) ────────
create table if not exists public.invoices (
  id                uuid primary key default gen_random_uuid(),
  plumber_id        uuid not null references public.plumbers(id) on delete cascade,
  invoice_number    text not null,
  customer_name     text not null,
  customer_address  text,
  customer_phone    text,
  customer_email    text,
  line_items        jsonb not null default '[]'::jsonb,
  subtotal          numeric(12,2) not null default 0,
  vat_amount        numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  include_vat       boolean not null default false,
  notes             text,
  status            text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  created_at        timestamptz not null default now()
);

-- 2. New columns ───────────────────────────────────────────────────────────────
alter table public.invoices add column if not exists invoice_date       date;
alter table public.invoices add column if not exists due_date           date;
alter table public.invoices add column if not exists payment_terms_days integer;
alter table public.invoices add column if not exists discount_amount    numeric(12,2) not null default 0;
alter table public.invoices add column if not exists reference          text;
alter table public.invoices add column if not exists footer_note        text;
alter table public.invoices add column if not exists business_address   text;
alter table public.invoices add column if not exists business_email     text;
alter table public.invoices add column if not exists vat_number         text;
alter table public.invoices add column if not exists updated_at         timestamptz not null default now();

-- Existing invoices: use the day they were created as their invoice date.
update public.invoices set invoice_date = (created_at at time zone 'Africa/Johannesburg')::date
where invoice_date is null;

alter table public.invoices alter column invoice_date set default ((now() at time zone 'Africa/Johannesburg')::date);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_payment_terms_days_check') then
    alter table public.invoices add constraint invoices_payment_terms_days_check
      check (payment_terms_days is null or payment_terms_days between 0 and 365);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoices_discount_amount_check') then
    alter table public.invoices add constraint invoices_discount_amount_check check (discount_amount >= 0);
  end if;
end $$;

-- 3. Keep updated_at current ─────────────────────────────────────────────────
drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- 4. Indexes + one invoice number per plumber ─────────────────────────────────
create index if not exists invoices_plumber_created_idx on public.invoices (plumber_id, created_at desc);

do $$
begin
  if exists (
    select 1 from public.invoices
    group by plumber_id, lower(trim(invoice_number))
    having count(*) > 1
  ) then
    raise notice 'Duplicate invoice numbers already exist for at least one plumber — unique index NOT created. '
                 'Rename the duplicates (see query in DEPLOYMENT-RUNBOOK.md) and run this migration again.';
  else
    create unique index if not exists invoices_plumber_number_unique
      on public.invoices (plumber_id, lower(trim(invoice_number)));
  end if;
end $$;

-- 5. Row-level security: a plumber can only see and change their own invoices ──
alter table public.invoices enable row level security;

drop policy if exists "Plumbers read own invoices"   on public.invoices;
drop policy if exists "Plumbers create own invoices" on public.invoices;
drop policy if exists "Plumbers update own invoices" on public.invoices;
drop policy if exists "Plumbers delete own invoices" on public.invoices;

create policy "Plumbers read own invoices" on public.invoices
  for select to authenticated
  using (exists (select 1 from public.plumbers p where p.id = invoices.plumber_id and p.profile_id = auth.uid()));

create policy "Plumbers create own invoices" on public.invoices
  for insert to authenticated
  with check (exists (select 1 from public.plumbers p where p.id = invoices.plumber_id and p.profile_id = auth.uid()));

create policy "Plumbers update own invoices" on public.invoices
  for update to authenticated
  using (exists (select 1 from public.plumbers p where p.id = invoices.plumber_id and p.profile_id = auth.uid()))
  with check (exists (select 1 from public.plumbers p where p.id = invoices.plumber_id and p.profile_id = auth.uid()));

create policy "Plumbers delete own invoices" on public.invoices
  for delete to authenticated
  using (exists (select 1 from public.plumbers p where p.id = invoices.plumber_id and p.profile_id = auth.uid()));

grant select, insert, update, delete on public.invoices to authenticated;
revoke all on public.invoices from anon;

commit;

-- Ask the API to pick up the new columns straight away.
notify pgrst, 'reload schema';
