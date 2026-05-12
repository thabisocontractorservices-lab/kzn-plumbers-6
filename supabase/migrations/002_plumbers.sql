-- 002_plumbers.sql
-- Core plumbers table with verification and Google Place ID

create type public.availability_status as enum ('available', 'busy', 'unavailable');

create table public.plumbers (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid unique references public.profiles(id) on delete cascade,  -- null = unclaimed directory listing managed by admins
  trading_name          text not null,
  slug                  text unique,
  area                  text not null,
  hourly_rate           integer check (hourly_rate is null or hourly_rate >= 0),  -- null = "Contact for quote"
  about                 text,
  specialties           text[] default array[]::text[],
  is_emergency          boolean not null default false,
  availability_status   public.availability_status not null default 'available',
  google_calendar_url   text,
  google_place_id       text,
  pirb_number           text,
  is_certified          boolean not null default false,
  is_verified           boolean not null default false, -- admin-approved
  google_rating         numeric(2,1),
  google_review_count   integer default 0,
  google_reviews_synced_at timestamptz,
  whatsapp_number       text not null,
  profile_views         integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger plumbers_updated_at
  before update on public.plumbers
  for each row execute function public.set_updated_at();

-- Generate URL slug from trading_name
create or replace function public.set_plumber_slug()
returns trigger
language plpgsql
as $$
declare
  base_slug text;
  new_slug text;
  counter int := 0;
begin
  if new.slug is not null then return new; end if;
  base_slug := lower(regexp_replace(new.trading_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  new_slug := base_slug;
  while exists(select 1 from public.plumbers where slug = new_slug and id != new.id) loop
    counter := counter + 1;
    new_slug := base_slug || '-' || counter;
  end loop;
  new.slug := new_slug;
  return new;
end;
$$;

create trigger plumbers_set_slug
  before insert on public.plumbers
  for each row execute function public.set_plumber_slug();

-- Indexes
create index plumbers_area_idx on public.plumbers(area);
create index plumbers_verified_idx on public.plumbers(is_verified);
create index plumbers_availability_idx on public.plumbers(availability_status);
create index plumbers_emergency_idx on public.plumbers(is_emergency);
create index plumbers_slug_idx on public.plumbers(slug);
create index plumbers_specialties_idx on public.plumbers using gin(specialties);

-- RLS
alter table public.plumbers enable row level security;

create policy "Verified plumbers are publicly visible"
  on public.plumbers for select
  using (is_verified = true or auth.uid() = profile_id or public.is_admin());

create policy "Plumbers can insert their own record"
  on public.plumbers for insert
  with check (auth.uid() = profile_id);

create policy "Plumbers can update their own record"
  on public.plumbers for update
  using (auth.uid() = profile_id or public.is_admin())
  with check (
    -- Plumbers cannot self-verify; admins can
    (auth.uid() = profile_id and is_verified = (select p.is_verified from public.plumbers p where p.id = plumbers.id))
    or public.is_admin()
  );

create policy "Admins can do anything to plumbers"
  on public.plumbers for all
  using (public.is_admin());
