-- ─────────────────────────────────────────────────────────────────────────────
-- 010_profile_redirects.sql — permanent redirects for renamed plumber profiles.
--
-- 1. Loads 49 old → new profile/claim addresses that Google reported as 404
--    (Search Console export, 11 Oct 2026). Every destination was checked live (HTTP 200).
-- 2. Adds an automatic rule: whenever a plumber's slug changes, the old address
--    redirects to the new one, so this never happens again.
--
-- SAFE TO RUN ON THE LIVE DATABASE. Only adds/updates redirect rules. Safe to run twice.
-- Supabase → SQL Editor → New query → paste EVERYTHING below → Run.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- Table normally exists from 007; created here only if missing.
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
alter table public.redirect_rules enable row level security;

-- 1. Known renamed profiles
insert into public.redirect_rules (source_path, destination_path, status_code, reason)
select source_path, destination_path, 301, 'Profile renamed during Sept 2026 duplicate clean-up (Search Console 404, 11 Oct 2026)'
from (values
  ('/claim/abanqobi-plumbers', '/claim/abanqobi-plumbers-pty-ltd'),
  ('/plumber/24-7-geyser-and-plumbing-solutions-pty-ltd', '/plumber/24-7-geyser-and-plumbing-solutions'),
  ('/plumber/25-seven-assist', '/plumber/25-seven-assist-pty-ltd'),
  ('/plumber/a2d-plumbers-pty-ltd', '/plumber/a2d-plumbers'),
  ('/plumber/a2d-plumbing-pty-ltd', '/plumber/a2d-plumbing'),
  ('/plumber/abanqobi-plumbers', '/plumber/abanqobi-plumbers-pty-ltd'),
  ('/plumber/abt-plumbers-cc', '/plumber/abt-plumbers'),
  ('/plumber/acorn-projects-19-ptyltd', '/plumber/acorn-projects-19'),
  ('/plumber/adwater-pty-ltd', '/plumber/adwater'),
  ('/plumber/afriplumb-cc', '/plumber/afriplumb'),
  ('/plumber/agglomerate-intermediary-services-pty-ltd', '/plumber/agglomerate-intermediary-services'),
  ('/plumber/alan-jackson-ta-plumbexpress', '/plumber/plumbexpress'),
  ('/plumber/aneli-projects-pty-ltd', '/plumber/aneli-projects'),
  ('/plumber/astine-projects-cc', '/plumber/astine-projects'),
  ('/plumber/azania-bhaca-pty-ltd', '/plumber/azania-bhaca'),
  ('/plumber/baert-plumbing-cc', '/plumber/baert-plumbing'),
  ('/plumber/bfb-plumbing-construction-and-maintenance-pty-ltd', '/plumber/bfb-plumbing-construction-and-maintenance'),
  ('/plumber/big-o-trading-958-t-a-united-solar-rsa', '/plumber/united-solar-rsa'),
  ('/plumber/blackwolf-plumbing-and-accessories-pty-ltd', '/plumber/blackwolf-plumbing-and-accessories'),
  ('/plumber/bmtt-plumbing-services-1', '/plumber/bmtt-plumbing-services'),
  ('/plumber/buildworth-projects-pty-ltd', '/plumber/buildworth-projects'),
  ('/plumber/c-f-thompson-plumbers-cc', '/plumber/c-f-thompson-plumbers'),
  ('/plumber/capstone-1212cc-ta-evolution-construction', '/plumber/evolution-construction'),
  ('/plumber/cyclone-construction-pty-ltd', '/plumber/cyclone-construction'),
  ('/plumber/drainguarantee-cc-t-a-plumbguarantee', '/plumber/drain-guarantee-cc-trading-as-plumb-guarantee'),
  ('/plumber/embo-power-projet-pty-ltd', '/plumber/embo-power-projet'),
  ('/plumber/eshara-services-and-supplies-pty-ltd', '/plumber/eshara-services-and-supplies'),
  ('/plumber/fitt-rite-plumbers-cc', '/plumber/fitt-rite-plumbers'),
  ('/plumber/flow-bro-plumbing-pty-ltd', '/plumber/flow-bro-plumbing'),
  ('/plumber/flowrite-property-maintenance-and-plumbing-pty-ltd', '/plumber/flowrite-property-maintenance-and-plumbing'),
  ('/plumber/fuku-training-cc', '/plumber/fuku-training'),
  ('/plumber/ganga-plumbers-cc', '/plumber/ganga-plumbers'),
  ('/plumber/geyser-rescue-24-pty-ltd', '/plumber/geyser-rescue-24'),
  ('/plumber/gnh-construction-and-plumbing-pty-ltd', '/plumber/gnh-construction-and-plumbing'),
  ('/plumber/imbokodo-plumbing-services-pty-ltd', '/plumber/imbokodo-plumbing-services'),
  ('/plumber/komani-projects-pty-ltd', '/plumber/komani-projects'),
  ('/plumber/kvv-projects-pty-ltd', '/plumber/kvv-projects'),
  ('/plumber/matilda-projects-cc', '/plumber/matilda-projects'),
  ('/plumber/modl-plumbers-cc', '/plumber/modl-plumbers'),
  ('/plumber/mr-fix-it-durban', '/plumber/mr-fix-it'),
  ('/plumber/mzele-enterprise-pty-ltd', '/plumber/mzele-enterprise'),
  ('/plumber/naomeeya-pty-ltd', '/plumber/naomeeya'),
  ('/plumber/pj-s-plumbers-pty-ltd', '/plumber/pj-s-plumbers-durban'),
  ('/plumber/powermax-energy-projects-pty-ltd', '/plumber/powermax-energy-projects'),
  ('/plumber/quanden-trading', '/plumber/quanden-plumbing-and-projects'),
  ('/plumber/sipho-plumbing-solutions', '/plumber/sipho-plumbing-solutions-1'),
  ('/plumber/tessling-plumbers-and-maintenance', '/plumber/tessling-plumbers-maintenance'),
  ('/plumber/the-plumbingman-kzn', '/plumber/theplumbingman'),
  ('/plumber/umhlanga-plumbers-calco-plumbers', '/plumber/umhlanga-plumbers')
) as v(source_path, destination_path)
on conflict (source_path) do update
  set destination_path = excluded.destination_path, active = true, reason = excluded.reason, updated_at = now();

-- Never redirect a page that is live again (protects against loops if a slug is reused).
update public.redirect_rules r set active = false, updated_at = now()
where r.active and r.source_path like '/plumber/%'
  and exists (select 1 from public.plumbers p where '/plumber/' || p.slug = r.source_path);

-- 2. Automatic redirects on future slug changes
create or replace function public.plumber_slug_redirect()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.slug is not null and new.slug is not null and old.slug <> new.slug then
    insert into public.redirect_rules (source_path, destination_path, status_code, reason)
    values ('/plumber/' || old.slug, '/plumber/' || new.slug, 301, 'Automatic: profile slug changed')
    on conflict (source_path) do update
      set destination_path = excluded.destination_path, active = true, reason = excluded.reason, updated_at = now();
    insert into public.redirect_rules (source_path, destination_path, status_code, reason)
    values ('/claim/' || old.slug, '/claim/' || new.slug, 301, 'Automatic: profile slug changed')
    on conflict (source_path) do update
      set destination_path = excluded.destination_path, active = true, reason = excluded.reason, updated_at = now();
    -- If the new address previously redirected somewhere, it is now a real page again.
    update public.redirect_rules set active = false, updated_at = now()
    where source_path in ('/plumber/' || new.slug, '/claim/' || new.slug);
  end if;
  return new;
end $$;

drop trigger if exists plumbers_slug_redirect on public.plumbers;
create trigger plumbers_slug_redirect after update of slug on public.plumbers
  for each row execute function public.plumber_slug_redirect();

commit;

-- Check: should list the active redirects
select count(*) as active_redirects from public.redirect_rules where active;
