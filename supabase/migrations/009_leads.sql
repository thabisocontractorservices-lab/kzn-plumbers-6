-- ─────────────────────────────────────────────────────────────────────────────
-- 009_leads.sql — Phase 1 lead capture: free estimates, homeowner-chosen
-- plumbers, lead tracking and admin management.
--
-- SAFE TO RUN ON THE LIVE DATABASE: only creates new tables/columns, never
-- changes or deletes existing plumbers, bookings, reviews or invoices.
-- Safe to run more than once.
--
-- Run in Supabase → SQL Editor → New query → paste EVERYTHING below → Run.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- 1. Plumber lead settings ───────────────────────────────────────────────────
-- Leads only ever go to CLAIMED, published plumbers. This switch lets admin pause one.
alter table public.plumbers add column if not exists leads_enabled boolean not null default true;

-- 2. Lead reference numbers: KZN-1001, KZN-1002 … ───────────────────────────
create sequence if not exists public.lead_ref_seq start with 1001;

-- 3. Leads ─────────────────────────────────────────────────────────────────
create table if not exists public.leads (
  id                    uuid primary key default gen_random_uuid(),
  ref                   text not null unique default ('KZN-' || nextval('public.lead_ref_seq')::text),
  lead_type             text not null default 'marketplace' check (lead_type in ('marketplace', 'requested_plumber')),
  status                text not null default 'new' check (status in (
                          'new', 'qualified', 'matched', 'sent', 'accepted', 'contacted', 'quoted',
                          'won', 'completed', 'lost', 'invalid', 'duplicate', 'no_plumber', 'expired')),
  plumber_choice        text not null default 'homeowner' check (plumber_choice in ('homeowner', 'kzn')),
  preferred_plumber_id  uuid references public.plumbers(id) on delete set null,
  fallback_allowed      boolean not null default false,

  first_name            text not null,
  last_name             text,
  phone                 text not null,
  whatsapp              text,
  email                 text,

  area_key              text not null,
  area_label            text not null,
  suburb                text not null,
  postcode              text,
  service_key           text not null,
  service_label         text not null,
  urgency               text not null check (urgency in ('emergency', 'today', 'few_days', 'this_week', 'planning')),
  description           text,
  photo_paths           text[] not null default array[]::text[],

  estimate_low          integer,
  estimate_high         integer,

  consent_share         boolean not null default false,
  consent_marketing     boolean not null default false,
  consent_text          text,
  consent_at            timestamptz,

  source                text,
  medium                text,
  campaign              text,
  attribution           jsonb not null default '{}'::jsonb,

  quality_tags          text[] not null default array[]::text[],
  admin_notes           text,
  duplicate_of          uuid references public.leads(id) on delete set null,
  ip_hash               text,
  user_agent            text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists leads_created_idx  on public.leads (created_at desc);
create index if not exists leads_status_idx   on public.leads (status, created_at desc);
create index if not exists leads_phone_idx    on public.leads (phone, created_at desc);
create index if not exists leads_ip_idx       on public.leads (ip_hash, created_at desc);
create index if not exists leads_area_svc_idx on public.leads (area_key, service_key);

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- 4. Which plumbers each lead went to (max 3) ───────────────────────────────
create table if not exists public.lead_assignments (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.leads(id) on delete cascade,
  plumber_id    uuid not null references public.plumbers(id) on delete cascade,
  chosen_by     text not null default 'homeowner' check (chosen_by in ('homeowner', 'preferred', 'admin')),
  status        text not null default 'offered' check (status in (
                  'offered', 'notified', 'viewed', 'accepted', 'declined', 'expired',
                  'contacted', 'quoted', 'won', 'lost', 'removed')),
  notified_at   timestamptz,
  viewed_at     timestamptz,
  accepted_at   timestamptz,
  declined_at   timestamptz,
  contacted_at  timestamptz,
  quoted_at     timestamptz,
  closed_at     timestamptz,
  job_value     numeric(12,2),
  decline_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (lead_id, plumber_id)
);

create index if not exists lead_assignments_plumber_idx on public.lead_assignments (plumber_id, created_at desc);
create index if not exists lead_assignments_lead_idx    on public.lead_assignments (lead_id);

drop trigger if exists lead_assignments_updated_at on public.lead_assignments;
create trigger lead_assignments_updated_at before update on public.lead_assignments
  for each row execute function public.set_updated_at();

-- Never more than 3 active plumbers on one lead (protects homeowners from too many calls).
create or replace function public.limit_lead_assignments()
returns trigger language plpgsql as $$
begin
  if new.status <> 'removed' and (
    select count(*) from public.lead_assignments a
    where a.lead_id = new.lead_id and a.status <> 'removed' and a.id <> new.id
  ) >= 3 then
    raise exception 'A lead can be sent to at most 3 plumbers' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists lead_assignments_limit on public.lead_assignments;
create trigger lead_assignments_limit before insert or update of status on public.lead_assignments
  for each row execute function public.limit_lead_assignments();

-- 5. Full lead history ──────────────────────────────────────────────────────
create table if not exists public.lead_activity (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.leads(id) on delete cascade,
  assignment_id uuid references public.lead_assignments(id) on delete set null,
  plumber_id    uuid references public.plumbers(id) on delete set null,
  actor         text not null check (actor in ('system', 'homeowner', 'plumber', 'admin')),
  actor_id      uuid,
  event         text not null,
  detail        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists lead_activity_lead_idx on public.lead_activity (lead_id, created_at);

-- 6. Estimate price ranges (editable in Admin → Leads → Estimate prices) ────
create table if not exists public.estimate_rules (
  service_key    text primary key,
  service_label  text not null,
  low            integer,
  high           integer,
  note           text,
  sort_order     integer not null default 100,
  active         boolean not null default true,
  updated_at     timestamptz not null default now()
);

insert into public.estimate_rules (service_key, service_label, low, high, note, sort_order) values
  ('blocked_drain',      'Blocked drain',          650,   1800, 'Call-out and clearing. Jetting or camera inspection costs more.', 10),
  ('burst_pipe',         'Burst pipe',             750,   2500, 'Depends on access, pipe type and wall or floor repairs.', 20),
  ('leak',               'Leak',                   600,   2200, 'Hidden leaks needing detection equipment cost more.', 30),
  ('geyser_repair',      'Geyser repair',          900,   3000, 'Element, thermostat or valve replacement.', 40),
  ('geyser_replacement', 'Geyser replacement',    8500,  18000, 'Typical 150L electric geyser supplied and installed with CoC.', 50),
  ('toilet',             'Toilet',                 550,   1800, 'Cistern parts, leaks or blockages. New toilet costs more.', 60),
  ('tap',                'Tap',                    450,   1200, 'Washer, cartridge or tap replacement.', 70),
  ('bathroom',           'Bathroom plumbing',     1500,  35000, 'Small repairs to full renovations — ask for a site visit.', 80),
  ('kitchen',            'Kitchen plumbing',       700,   3500, 'Sinks, dishwasher or washing machine connections.', 90),
  ('sewer',              'Sewer issue',           1500,   8000, 'Main line blockages, repairs or relining.', 100),
  ('new_installation',   'New installation',      1500,  12000, 'Depends on size of the job and materials.', 110),
  ('maintenance',        'Maintenance',            600,   2000, 'General check-up and small fixes.', 120),
  ('solar_geyser',       'Solar geyser',         18000,  45000, 'Supplied and installed. Price depends on system size.', 130),
  ('gas_fitting',        'Gas fitting',           1200,   6000, 'Gas geysers, stoves and compliance certificates.', 140),
  ('other',              'Other',                  null,   null, 'The plumber will quote after seeing the job.', 150)
on conflict (service_key) do nothing;

-- 7. Private storage for homeowner job photos ──────────────────────────────
insert into storage.buckets (id, name, public) values ('lead-photos', 'lead-photos', false)
on conflict (id) do update set public = false;

-- 8. Security: nobody reads leads directly from the browser. ─────────────────
-- All access goes through the website's server, which checks who is asking
-- and hides customer contact details until a plumber accepts the job.
alter table public.leads            enable row level security;
alter table public.lead_assignments enable row level security;
alter table public.lead_activity    enable row level security;
alter table public.estimate_rules   enable row level security;

drop policy if exists "Admins read leads"            on public.leads;
drop policy if exists "Admins read lead assignments" on public.lead_assignments;
drop policy if exists "Admins read lead activity"    on public.lead_activity;
drop policy if exists "Anyone reads estimate rules"  on public.estimate_rules;

create policy "Admins read leads"            on public.leads            for select to authenticated using (public.is_admin());
create policy "Admins read lead assignments" on public.lead_assignments for select to authenticated using (public.is_admin());
create policy "Admins read lead activity"    on public.lead_activity    for select to authenticated using (public.is_admin());
create policy "Anyone reads estimate rules"  on public.estimate_rules   for select using (active);

revoke all on public.leads, public.lead_assignments, public.lead_activity from anon;
revoke insert, update, delete on public.estimate_rules from anon, authenticated;

commit;

notify pgrst, 'reload schema';
