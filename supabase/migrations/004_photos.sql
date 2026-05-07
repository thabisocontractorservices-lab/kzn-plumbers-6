-- 004_photos.sql
-- Work photo gallery + profile photo

create table public.photos (
  id                uuid primary key default gen_random_uuid(),
  plumber_id        uuid not null references public.plumbers(id) on delete cascade,
  photo_url         text not null,
  is_profile_photo  boolean not null default false,
  caption           text,
  uploaded_at       timestamptz not null default now()
);

create index photos_plumber_idx on public.photos(plumber_id);
create index photos_profile_idx on public.photos(plumber_id, is_profile_photo) where is_profile_photo = true;

-- Only one profile photo per plumber
create unique index photos_one_profile_per_plumber
  on public.photos(plumber_id)
  where is_profile_photo = true;

-- RLS
alter table public.photos enable row level security;

create policy "Photos are visible if plumber is verified"
  on public.photos for select
  using (
    exists (
      select 1 from public.plumbers
      where id = photos.plumber_id
      and (is_verified = true or profile_id = auth.uid() or public.is_admin())
    )
  );

create policy "Plumbers can manage their own photos"
  on public.photos for all
  using (
    exists (
      select 1 from public.plumbers
      where id = photos.plumber_id and (profile_id = auth.uid() or public.is_admin())
    )
  );
