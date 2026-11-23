-- =============================================================================
-- Vault Ijazah Digital — skema database (off-chain)
--
-- Tabel:
--   profiles    : akun staf kampus + peran (issuer / admin)
--   diplomas    : metadata ijazah (data fiktif untuk demo) + bukti on-chain
--   audit_logs  : jejak audit & kejadian keamanan (dibaca Grafana untuk monitoring)
-- Storage:
--   bucket privat "diplomas" : file PDF ijazah (hanya server yang bisa akses)
--
-- Prinsip: semua PENULISAN lewat API server (service role) setelah cek peran + MFA.
-- Pengguna login hanya bisa MEMBACA, dibatasi Row Level Security (RLS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipe
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('issuer', 'admin');
create type public.diploma_status as enum ('issued', 'revoked');

-- -----------------------------------------------------------------------------
-- Tabel
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  full_name   text,
  -- NULL = akun terdaftar tetapi belum diberi akses (default aman / deny by default)
  role        public.app_role,
  created_at  timestamptz not null default now()
);

create table public.diplomas (
  id               uuid primary key default gen_random_uuid(),
  -- Data ijazah (fiktif untuk demo)
  serial_number    text not null unique check (serial_number ~ '^[A-Za-z0-9./_-]{3,64}$'),
  student_name     text not null,
  student_number   text not null,                 -- NIM
  program          text not null,                 -- program studi
  graduation_date  date not null,
  -- Lokasi file PDF di bucket privat
  storage_path     text not null unique,
  -- Nilai yang juga tercatat on-chain (bukan data pribadi)
  serial_key       text not null unique check (serial_key ~ '^0x[0-9a-f]{64}$'),
  doc_hash         text not null unique check (doc_hash   ~ '^0x[0-9a-f]{64}$'),
  tx_hash          text not null,
  -- Status
  status           public.diploma_status not null default 'issued',
  issued_by        uuid references public.profiles (id),
  issued_at        timestamptz not null default now(),
  revoked_by       uuid references public.profiles (id),
  revoked_at       timestamptz,
  revoke_tx_hash   text
);

create table public.audit_logs (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  level        text not null default 'info' check (level in ('info', 'warning', 'critical')),
  action       text not null,                     -- mis. diploma.issued, verify.not_found
  actor_id     uuid,
  target_id    text,
  ip           text,
  metadata     jsonb not null default '{}'::jsonb
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);

-- -----------------------------------------------------------------------------
-- Fungsi bantu (SECURITY DEFINER, search_path dikunci)
-- -----------------------------------------------------------------------------
create or replace function public.app_current_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

-- true bila sesi sudah melewati MFA (Authenticator Assurance Level 2)
create or replace function public.app_is_mfa()
returns boolean
language sql stable
as $$ select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' $$;

revoke all on function public.app_current_role() from public, anon;
grant execute on function public.app_current_role() to authenticated;

-- Profil dibuat otomatis saat akun dibuat, TANPA peran.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Hak akses (least privilege): pengguna hanya boleh SELECT, tidak boleh menulis.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.diplomas, public.audit_logs to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.diplomas   enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: lihat profil sendiri; admin melihat semua.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.app_current_role()) = 'admin');

-- diplomas: hanya staf (issuer/admin) yang sudah MFA.
create policy diplomas_select on public.diplomas
  for select to authenticated
  using ((select public.app_is_mfa()) and (select public.app_current_role()) is not null);

-- audit_logs: hanya admin yang sudah MFA.
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using ((select public.app_is_mfa()) and (select public.app_current_role()) = 'admin');

-- -----------------------------------------------------------------------------
-- Storage: bucket privat untuk PDF.
-- Tanpa policy di storage.objects => hanya service role (API server) yang bisa akses.
-- Unduhan memakai signed URL berumur pendek setelah cek peran.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diplomas', 'diplomas', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false;
