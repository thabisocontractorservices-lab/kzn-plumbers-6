-- 006_bookings.sql
-- Customer booking requests

create type public.booking_status as enum ('pending', 'confirmed', 'cancelled');

create table public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  plumber_id         uuid not null references public.plumbers(id) on delete cascade,
  customer_id        uuid references public.profiles(id) on delete set null,
  customer_name      text not null,
  customer_phone     text not null,
  customer_email     text,
  job_description    text not null,
  preferred_datetime timestamptz not null,
  status             public.booking_status not null default 'pending',
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

create index bookings_plumber_idx on public.bookings(plumber_id);
create index bookings_status_idx on public.bookings(status);
create index bookings_datetime_idx on public.bookings(preferred_datetime);

-- Storage buckets (run in SQL editor or via dashboard)
-- These INSERT statements are idempotent thanks to ON CONFLICT
insert into storage.buckets (id, name, public)
values
  ('certs', 'certs', false),
  ('photos', 'photos', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Public can read photo bucket"
  on storage.objects for select
  using (bucket_id = 'photos');

create policy "Public can read avatars bucket"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Authenticated users can upload to photos"
  on storage.objects for insert
  with check (
    bucket_id = 'photos'
    and auth.role() = 'authenticated'
  );

create policy "Authenticated users can upload to avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
  );

create policy "Authenticated users can upload to certs"
  on storage.objects for insert
  with check (
    bucket_id = 'certs'
    and auth.role() = 'authenticated'
  );

create policy "Plumbers can read their own certs"
  on storage.objects for select
  using (
    bucket_id = 'certs'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin()
    )
  );

create policy "Users can update/delete their own files"
  on storage.objects for delete
  using (auth.uid()::text = (storage.foldername(name))[1]);

-- RLS for bookings
alter table public.bookings enable row level security;

create policy "Plumbers can see their own bookings"
  on public.bookings for select
  using (
    exists (
      select 1 from public.plumbers
      where id = bookings.plumber_id and profile_id = auth.uid()
    )
    or customer_id = auth.uid()
    or public.is_admin()
  );

create policy "Anyone can create a booking"
  on public.bookings for insert
  with check (
    exists (
      select 1 from public.plumbers
      where id = bookings.plumber_id and is_verified = true
    )
  );

create policy "Plumbers can update their own bookings"
  on public.bookings for update
  using (
    exists (
      select 1 from public.plumbers
      where id = bookings.plumber_id and profile_id = auth.uid()
    )
    or public.is_admin()
  );
