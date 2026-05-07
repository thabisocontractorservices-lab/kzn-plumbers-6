-- ─────────────────────────────────────────────────────────────────────────────
-- scripts/clean-test-users.sql
--
-- Delete all test users from auth.users in one shot.
-- ON DELETE CASCADE removes their profiles, plumbers, certifications, photos,
-- reviews, and bookings automatically.
--
-- Run in Supabase Studio → SQL Editor.
-- Or via CLI:  psql $DATABASE_URL -f scripts/clean-test-users.sql
--
-- ⚠ Edit the email pattern below if your test users use a different convention.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- 1. Preview what will be deleted (dry run — comment out the DELETE below first)
-- select id, email, created_at
-- from auth.users
-- where email ilike '%@example.com'
--    or email ilike 'test%@%'
--    or email ilike '%@test.local'
-- order by created_at desc;

-- 2. Delete the matching users (cascades via FKs)
delete from auth.users
where email ilike '%@example.com'
   or email ilike 'test%@%'
   or email ilike '%@test.local';

commit;

-- 3. Verify nothing matched is left
select count(*) as remaining_test_users
from auth.users
where email ilike '%@example.com'
   or email ilike 'test%@%'
   or email ilike '%@test.local';
