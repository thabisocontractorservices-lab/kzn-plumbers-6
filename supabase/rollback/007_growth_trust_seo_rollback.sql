-- Rollback for 007_growth_trust_seo.sql
-- WARNING: this removes data captured in the new columns and tables.
-- Export lead_events, redirect_rules, and the new columns before running.

begin;

drop trigger if exists plumbers_sync_verification_rank on public.plumbers;
drop function if exists public.sync_plumber_verification_rank();
drop function if exists public.approve_plumber_claim(uuid, text);

drop view if exists public.plumber_duplicate_candidates;
drop view if exists public.seo_page_inventory;

drop policy if exists "Admins can read lead events" on public.lead_events;
drop policy if exists "Plumbers can read own lead events" on public.lead_events;
drop table if exists public.lead_events;

drop policy if exists "Admins manage redirects" on public.redirect_rules;
drop table if exists public.redirect_rules;

drop index if exists public.reviews_one_per_user_plumber_idx;
drop policy if exists "Authenticated users can post reviews" on public.reviews;
create policy "Anyone can post a review (logged in or guest)"
  on public.reviews for insert
  with check (
    exists (select 1 from public.plumbers where id = reviews.plumber_id and is_verified = true)
    and (reviewer_id is null or reviewer_id = auth.uid())
  );

drop policy if exists "Users and admins can read profiles" on public.profiles;
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);

drop policy if exists "Owners and admins can read certification evidence" on public.certifications;
create policy "Certifications are visible if plumber is verified"
  on public.certifications for select
  using (exists (
    select 1 from public.plumbers
    where id = certifications.plumber_id
      and (is_verified = true or profile_id = auth.uid() or public.is_admin())
  ));

alter table public.claims
  drop column if exists phone_match_observed,
  drop column if exists review_reason,
  drop column if exists evidence_notes,
  drop column if exists reviewed_by;

alter table public.bookings
  drop column if exists service_requested,
  drop column if exists suburb,
  drop column if exists urgency,
  drop column if exists source_path,
  drop column if exists accepted_at,
  drop column if exists completed_at,
  drop column if exists job_outcome,
  drop column if exists job_value;

alter table public.seo_pages
  drop column if exists index_status,
  drop column if exists canonical_target,
  drop column if exists redirect_target,
  drop column if exists disposition_reason,
  drop column if exists reviewed_at,
  drop column if exists updated_at;

alter table public.plumbers
  drop column if exists verification_state,
  drop column if exists verification_rank,
  drop column if exists verification_source_url,
  drop column if exists credential_verified_at,
  drop column if exists verification_expires_at,
  drop column if exists last_checked_at,
  drop column if exists service_areas,
  drop column if exists response_time_minutes,
  drop column if exists accepts_new_work,
  drop column if exists record_status,
  drop column if exists source_url,
  drop column if exists source_retrieved_at,
  drop column if exists source_notes;

commit;
