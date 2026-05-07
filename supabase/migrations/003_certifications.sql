-- 003_certifications.sql
-- Certification documents (PIRB, SESSA, LPGSA, etc.)

create table public.certifications (
  id            uuid primary key default gen_random_uuid(),
  plumber_id    uuid not null references public.plumbers(id) on delete cascade,
  cert_name     text not null,
  cert_file_url text not null,
  uploaded_at   timestamptz not null default now()
);

create index certifications_plumber_idx on public.certifications(plumber_id);

-- RLS
alter table public.certifications enable row level security;

create policy "Certifications are visible if plumber is verified"
  on public.certifications for select
  using (
    exists (
      select 1 from public.plumbers
      where id = certifications.plumber_id
      and (is_verified = true or profile_id = auth.uid() or public.is_admin())
    )
  );

create policy "Plumbers can upload their own certifications"
  on public.certifications for insert
  with check (
    exists (
      select 1 from public.plumbers
      where id = certifications.plumber_id and profile_id = auth.uid()
    )
  );

create policy "Plumbers can delete their own certifications"
  on public.certifications for delete
  using (
    exists (
      select 1 from public.plumbers
      where id = certifications.plumber_id and (profile_id = auth.uid() or public.is_admin())
    )
  );
