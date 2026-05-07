-- seed.sql
-- Optional admin seed. Run this AFTER signing up an admin user via Supabase Auth.
-- Replace the email below with the email of the user you want to elevate to admin.

update public.profiles
set role = 'admin'
where email = 'admin@kznplumbers.co.za';

-- Sample verified plumber for demo (optional)
-- Replace the profile_id with a real signed-up plumber UUID
-- insert into public.plumbers (
--   profile_id, trading_name, area, hourly_rate, about, specialties,
--   is_emergency, availability_status, pirb_number, is_certified, is_verified,
--   whatsapp_number
-- ) values (
--   '<REPLACE-WITH-AUTH-USER-UUID>',
--   'Sipho''s Master Plumbing',
--   'Durban North',
--   450,
--   '18 years serving KZN homeowners. PIRB-registered, solar geyser specialist.',
--   array['Solar geyser', 'Leak detection', 'Emergency'],
--   true,
--   'available',
--   'PB-12847',
--   true,
--   true,
--   '27821234567'
-- );
