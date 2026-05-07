-- 005_reviews.sql
-- Internal platform reviews + cached Google My Business reviews

create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  plumber_id    uuid not null references public.plumbers(id) on delete cascade,
  reviewer_id   uuid references public.profiles(id) on delete set null,
  reviewer_name text not null,
  rating        integer not null check (rating between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now()
);

create index reviews_plumber_idx on public.reviews(plumber_id);
create index reviews_created_idx on public.reviews(created_at desc);

-- Cached Google Places reviews (refreshed every 24h via Vercel cron)
create table public.google_reviews (
  id                  uuid primary key default gen_random_uuid(),
  plumber_id          uuid not null references public.plumbers(id) on delete cascade,
  reviewer_name       text not null,
  rating              integer not null check (rating between 1 and 5),
  text                text,
  google_author_url   text,
  profile_photo_url   text,
  review_time         timestamptz,
  cached_at           timestamptz not null default now(),
  unique(plumber_id, reviewer_name, review_time)
);

create index google_reviews_plumber_idx on public.google_reviews(plumber_id);
create index google_reviews_time_idx on public.google_reviews(review_time desc);

-- Aggregate view: combined platform + Google rating per plumber
create or replace view public.plumber_ratings as
select
  p.id as plumber_id,
  coalesce(p.google_rating, 0) as google_rating,
  coalesce(p.google_review_count, 0) as google_count,
  coalesce(avg(r.rating)::numeric(2,1), 0) as internal_rating,
  count(r.id)::int as internal_count,
  case
    when coalesce(p.google_review_count, 0) + count(r.id) = 0 then null
    else round((
      coalesce(p.google_rating * p.google_review_count, 0) + coalesce(sum(r.rating), 0)
    )::numeric / (coalesce(p.google_review_count, 0) + count(r.id)), 1)
  end as combined_rating,
  coalesce(p.google_review_count, 0) + count(r.id)::int as combined_count
from public.plumbers p
left join public.reviews r on r.plumber_id = p.id
group by p.id;

-- RLS
alter table public.reviews enable row level security;
alter table public.google_reviews enable row level security;

create policy "Reviews on verified plumbers are public"
  on public.reviews for select
  using (
    exists (
      select 1 from public.plumbers
      where id = reviews.plumber_id and is_verified = true
    )
  );

create policy "Anyone can post a review (logged in or guest)"
  on public.reviews for insert
  with check (
    exists (
      select 1 from public.plumbers
      where id = reviews.plumber_id and is_verified = true
    )
    and (reviewer_id is null or reviewer_id = auth.uid())
  );

create policy "Reviewers can delete their own reviews"
  on public.reviews for delete
  using (reviewer_id = auth.uid() or public.is_admin());

create policy "Google reviews are public for verified plumbers"
  on public.google_reviews for select
  using (
    exists (
      select 1 from public.plumbers
      where id = google_reviews.plumber_id and is_verified = true
    )
  );

create policy "Only service role can write Google reviews"
  on public.google_reviews for all
  using (public.is_admin())
  with check (public.is_admin());
