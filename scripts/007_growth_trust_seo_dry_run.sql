-- Read-only preflight for 007_growth_trust_seo.sql
-- Run in Supabase SQL Editor before the migration. This script changes nothing.

select 'plumbers_total' as check_name, count(*)::text as result from public.plumbers
union all
select 'published_plumbers', count(*)::text from public.plumbers where is_verified = true
union all
select 'claimed_plumbers', count(*)::text from public.plumbers where profile_id is not null
union all
select 'rows_currently_marked_certified', count(*)::text from public.plumbers where is_certified = true
union all
select 'seo_pages_total', count(*)::text from public.seo_pages
union all
select 'seo_pages_published', count(*)::text from public.seo_pages where published = true
union all
select 'auto_approved_claims', count(*)::text from public.claims where status = 'auto_approved'
union all
select 'guest_reviews', count(*)::text from public.reviews where reviewer_id is null;

-- Exact duplicate candidates by normalized name, phone, or PIRB number.
with normalized as (
  select
    id,
    trading_name,
    lower(regexp_replace(trading_name, '[^a-z0-9]+', '', 'g')) as normalized_name,
    nullif(regexp_replace(coalesce(whatsapp_number, ''), '[^0-9]+', '', 'g'), '') as normalized_phone,
    nullif(lower(regexp_replace(coalesce(pirb_number, ''), '[^a-z0-9]+', '', 'g')), '') as normalized_pirb
  from public.plumbers
)
select match_type, match_value, count(*) as record_count, array_agg(id) as plumber_ids, array_agg(trading_name) as trading_names
from (
  select 'name' as match_type, normalized_name as match_value, id, trading_name from normalized where normalized_name <> ''
  union all
  select 'phone', normalized_phone, id, trading_name from normalized where normalized_phone is not null
  union all
  select 'pirb', normalized_pirb, id, trading_name from normalized where normalized_pirb is not null
) candidates
group by match_type, match_value
having count(*) > 1
order by record_count desc, match_type, match_value;

-- Repeated-template families and approximate content depth.
select
  coalesce(group_name, '(ungrouped)') as group_name,
  coalesce(city_focus, '(no city)') as city_focus,
  count(*) as page_count,
  round(avg(array_length(regexp_split_to_array(trim(coalesce(regexp_replace(body_html, '<[^>]+>', ' ', 'g'), '')), '\\s+'), 1))) as average_words,
  count(distinct md5(lower(regexp_replace(coalesce(body_html, ''), '\\s+', ' ', 'g')))) as distinct_body_hashes
from public.seo_pages
where published = true
group by group_name, city_focus
order by page_count desc;

-- Off-scope geography identified by the July 2026 audit.
select slug, h1, city_focus, published
from public.seo_pages
where slug in ('gas-cape-town', 'drain-durbanville', 'general-durbanville', 'geyser-durbanville');

-- Duplicate reviews that will conflict with the one-account-per-business rule.
select plumber_id, reviewer_id, count(*) as review_count, array_agg(id order by created_at) as review_ids
from public.reviews
where reviewer_id is not null
group by plumber_id, reviewer_id
having count(*) > 1
order by review_count desc;

-- Current policies that the migration changes. Save this result with the deployment record.
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('profiles', 'certifications', 'reviews', 'plumbers', 'bookings', 'claims')
order by tablename, policyname;
