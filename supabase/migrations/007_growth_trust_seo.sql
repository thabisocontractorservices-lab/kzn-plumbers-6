-- KZN Plumbers trust, measurement, and index-quality migration
-- Review in a staging project first. This migration does not delete listings or SEO pages.

begin;

-- 1. Public trust state and data provenance
alter table public.plumbers
  add column if not exists verification_state text not null default 'directory_record',
  add column if not exists verification_rank smallint not null default 3,
  add column if not exists verification_source_url text,
  add column if not exists credential_verified_at timestamptz,
  add column if not exists verification_expires_at timestamptz,
  add column if not exists last_checked_at timestamptz,
  add column if not exists service_areas text[] not null default array[]::text[],
  add column if not exists response_time_minutes integer,
  add column if not exists accepts_new_work boolean not null default false,
  add column if not exists record_status text not null default 'published',
  add column if not exists source_url text,
  add column if not exists source_retrieved_at timestamptz,
  add column if not exists source_notes text;

do $$ begin
  alter table public.plumbers add constraint plumbers_verification_state_check
    check (verification_state in ('credential_verified', 'business_claimed', 'directory_record'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.plumbers add constraint plumbers_verification_rank_check
    check (verification_rank between 1 and 3);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.plumbers add constraint plumbers_record_status_check
    check (record_status in ('pending', 'published', 'rejected', 'suspended', 'merged'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.plumbers add constraint plumbers_response_time_check
    check (response_time_minutes is null or response_time_minutes between 1 and 10080);
exception when duplicate_object then null; end $$;

create index if not exists plumbers_verification_state_idx on public.plumbers(verification_state);
create index if not exists plumbers_verification_rank_idx on public.plumbers(verification_rank);
create index if not exists plumbers_record_status_idx on public.plumbers(record_status);
create index if not exists plumbers_accepts_work_idx on public.plumbers(accepts_new_work);
create index if not exists plumbers_last_checked_idx on public.plumbers(last_checked_at);

-- Existing published rows are directory records unless ownership or a documented
-- credential review is explicitly recorded after this migration.
update public.plumbers
set verification_state = case when profile_id is not null then 'business_claimed' else 'directory_record' end,
    verification_rank = case when profile_id is not null then 2 else 3 end,
    is_certified = false,
    accepts_new_work = false,
    record_status = case when is_verified then 'published' else 'pending' end
where credential_verified_at is null;

comment on column public.plumbers.verification_state is 'credential_verified = evidence checked; business_claimed = owner controls profile; directory_record = unclaimed public record.';
comment on column public.plumbers.accepts_new_work is 'Time-sensitive first-party availability signal; false until confirmed by the business.';

create or replace function public.sync_plumber_verification_rank()
returns trigger
language plpgsql
as $$
begin
  new.verification_rank := case new.verification_state
    when 'credential_verified' then 1
    when 'business_claimed' then 2
    else 3
  end;
  return new;
end;
$$;
drop trigger if exists plumbers_sync_verification_rank on public.plumbers;
create trigger plumbers_sync_verification_rank
before insert or update of verification_state on public.plumbers
for each row execute function public.sync_plumber_verification_rank();

-- 2. Booking source and outcome measurement
alter table public.bookings
  add column if not exists service_requested text,
  add column if not exists suburb text,
  add column if not exists urgency text not null default 'planned',
  add column if not exists source_path text,
  add column if not exists accepted_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists job_outcome text,
  add column if not exists job_value numeric(12,2);

do $$ begin
  alter table public.bookings add constraint bookings_urgency_check
    check (urgency in ('planned', 'today', 'emergency'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.bookings add constraint bookings_outcome_check
    check (job_outcome is null or job_outcome in ('accepted', 'declined', 'won', 'lost', 'cancelled'));
exception when duplicate_object then null; end $$;

create index if not exists bookings_source_idx on public.bookings(source_path);
create index if not exists bookings_outcome_idx on public.bookings(job_outcome);

-- 3. First-party conversion events. Public clients never receive a SELECT policy.
create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in ('whatsapp_click', 'call_click', 'booking_complete', 'claim_complete')),
  plumber_id uuid references public.plumbers(id) on delete set null,
  source_path text not null,
  source_query text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists lead_events_created_idx on public.lead_events(created_at desc);
create index if not exists lead_events_plumber_idx on public.lead_events(plumber_id, created_at desc);
create index if not exists lead_events_name_idx on public.lead_events(event_name, created_at desc);
alter table public.lead_events enable row level security;

drop policy if exists "Admins can read lead events" on public.lead_events;
create policy "Admins can read lead events" on public.lead_events for select using (public.is_admin());

drop policy if exists "Plumbers can read own lead events" on public.lead_events;
create policy "Plumbers can read own lead events" on public.lead_events for select using (
  exists (select 1 from public.plumbers p where p.id = lead_events.plumber_id and p.profile_id = auth.uid())
);

-- 4. Ownership claims remain pending until a human review.
alter table public.claims
  add column if not exists phone_match_observed boolean,
  add column if not exists review_reason text,
  add column if not exists evidence_notes text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

update public.claims
set status = 'pending', resolved_at = null,
    review_reason = coalesce(review_reason, 'Legacy auto-approval converted to manual ownership review')
where status = 'auto_approved' and plumber_id in (
  select p.id from public.plumbers p where p.profile_id is null
);

comment on table public.claims is 'Ownership requests. A phone match is evidence for review, not proof of ownership.';

create or replace function public.approve_plumber_claim(p_claim_id uuid, p_admin_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_claim public.claims%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into target_claim from public.claims where id = p_claim_id for update;
  if not found or target_claim.status <> 'pending' then
    raise exception 'Pending claim not found';
  end if;

  update public.plumbers
  set profile_id = target_claim.claimant_id,
      verification_state = 'business_claimed',
      last_checked_at = now(),
      updated_at = now()
  where id = target_claim.plumber_id and profile_id is null;

  if not found then
    raise exception 'Listing is already claimed or unavailable';
  end if;

  update public.profiles set role = 'plumber' where id = target_claim.claimant_id;
  update public.claims
  set status = 'approved', resolved_at = now(), reviewed_by = auth.uid(), admin_notes = p_admin_notes
  where id = p_claim_id;
end;
$$;
revoke all on function public.approve_plumber_claim(uuid, text) from public;
grant execute on function public.approve_plumber_claim(uuid, text) to authenticated;

-- 5. SEO page disposition, canonical and redirect governance
alter table public.seo_pages
  add column if not exists index_status text not null default 'keep',
  add column if not exists canonical_target text,
  add column if not exists redirect_target text,
  add column if not exists disposition_reason text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.seo_pages add constraint seo_pages_index_status_check
    check (index_status in ('keep', 'rebuild', 'merge', 'redirect', 'noindex', 'remove'));
exception when duplicate_object then null; end $$;

create index if not exists seo_pages_index_status_idx on public.seo_pages(index_status, published);
create index if not exists seo_pages_group_idx on public.seo_pages(group_name, city_focus);

drop trigger if exists seo_pages_updated_at on public.seo_pages;
create trigger seo_pages_updated_at before update on public.seo_pages
for each row execute function public.set_updated_at();

create table if not exists public.redirect_rules (
  id uuid primary key default gen_random_uuid(),
  source_path text not null unique check (source_path like '/%'),
  destination_path text not null check (destination_path like '/%'),
  status_code integer not null default 308 check (status_code in (301, 308)),
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists redirect_rules_updated_at on public.redirect_rules;
create trigger redirect_rules_updated_at before update on public.redirect_rules
for each row execute function public.set_updated_at();
alter table public.redirect_rules enable row level security;
drop policy if exists "Admins manage redirects" on public.redirect_rules;
create policy "Admins manage redirects" on public.redirect_rules for all using (public.is_admin()) with check (public.is_admin());

-- Mark known off-scope geography for review without deleting it.
update public.seo_pages
set index_status = 'remove',
    disposition_reason = 'Outside KwaZulu-Natal scope; confirmed in July 2026 audit',
    reviewed_at = now()
where slug in ('gas-cape-town', 'drain-durbanville', 'general-durbanville', 'geyser-durbanville');

-- 6. Review integrity: confirmed accounts only and one review per account/business.
drop policy if exists "Anyone can post a review (logged in or guest)" on public.reviews;
drop policy if exists "Authenticated users can post reviews" on public.reviews;
create policy "Authenticated users can post reviews" on public.reviews for insert with check (
  auth.uid() is not null
  and reviewer_id = auth.uid()
  and exists (select 1 from public.plumbers p where p.id = reviews.plumber_id and p.is_verified = true)
);
create unique index if not exists reviews_one_per_user_plumber_idx
  on public.reviews(plumber_id, reviewer_id) where reviewer_id is not null;

-- 7. Protect account and credential evidence from anonymous reads.
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users and admins can read profiles" on public.profiles;
create policy "Users and admins can read profiles" on public.profiles for select using (auth.uid() = id or public.is_admin());

drop policy if exists "Certifications are visible if plumber is verified" on public.certifications;
drop policy if exists "Owners and admins can read certification evidence" on public.certifications;
create policy "Owners and admins can read certification evidence" on public.certifications for select using (
  exists (select 1 from public.plumbers p where p.id = certifications.plumber_id and (p.profile_id = auth.uid() or public.is_admin()))
);

-- 8. Read-only audit views. They respect source-table RLS.
create or replace view public.seo_page_inventory
with (security_invoker = true) as
select
  slug, h1, group_ref, group_name, city_focus, published, index_status,
  canonical_target, redirect_target, disposition_reason, reviewed_at, updated_at,
  char_length(coalesce(regexp_replace(body_html, '<[^>]+>', ' ', 'g'), '')) as body_character_count,
  array_length(regexp_split_to_array(trim(coalesce(regexp_replace(body_html, '<[^>]+>', ' ', 'g'), '')), '\\s+'), 1) as approximate_word_count,
  md5(lower(regexp_replace(coalesce(body_html, ''), '\\s+', ' ', 'g'))) as body_hash
from public.seo_pages;

create or replace view public.plumber_duplicate_candidates
with (security_invoker = true) as
select
  lower(regexp_replace(trading_name, '[^a-z0-9]+', '', 'g')) as normalized_name,
  regexp_replace(coalesce(whatsapp_number, ''), '[^0-9]+', '', 'g') as normalized_phone,
  lower(regexp_replace(coalesce(pirb_number, ''), '[^a-z0-9]+', '', 'g')) as normalized_pirb,
  count(*) as record_count,
  array_agg(id order by created_at) as plumber_ids,
  array_agg(trading_name order by created_at) as trading_names
from public.plumbers
group by 1, 2, 3
having count(*) > 1;

commit;
