-- =============================================================================
-- Vault Ijazah Digital — skema awal, RBAC, dan Row Level Security
-- REQ-02 (isolasi off-chain), REQ-03 (MFA via klaim aal), REQ-06 (RBAC via RLS)
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipe
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('holder', 'issuer', 'admin');
create type public.diploma_status as enum ('draft', 'pending_approval', 'issued', 'revoked', 'failed');

-- -----------------------------------------------------------------------------
-- Tabel
-- -----------------------------------------------------------------------------
create table public.institutions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9-]{2,32}$'),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null unique,
  full_name       text,
  role            public.app_role not null default 'holder',
  institution_id  uuid references public.institutions (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint issuer_requires_institution check (role <> 'issuer' or institution_id is not null)
);

create table public.diplomas (
  id                uuid primary key default gen_random_uuid(),
  institution_id    uuid not null references public.institutions (id),
  holder_id         uuid references public.profiles (id) on delete set null,
  holder_email      text not null check (holder_email = lower(holder_email)),
  holder_name       text not null,
  program           text not null,
  graduation_date   date not null,
  serial_number     text not null unique,
  -- Nilai yang juga ada on-chain (non-PII)
  serial_key        text not null unique check (serial_key ~ '^0x[0-9a-f]{64}$'),
  doc_hash          text not null unique check (doc_hash ~ '^0x[0-9a-f]{64}$'),
  issuer_signature  text,
  -- PII sensitif: dienkripsi di lapisan aplikasi (AES-256-GCM via KMS), tidak pernah on-chain
  nik_encrypted     text,
  gpa_encrypted     text,
  -- Objek terenkripsi di Storage + DEK yang dibungkus (wrapped) oleh kunci master KMS
  storage_path      text not null unique,
  wrapped_dek       text not null,
  -- Status sinkronisasi blockchain
  status            public.diploma_status not null default 'draft',
  proposal_id       text,
  tx_hash           text,
  issued_by         uuid references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index diplomas_holder_id_idx on public.diplomas (holder_id);
create index diplomas_institution_id_idx on public.diplomas (institution_id);
create index diplomas_holder_email_idx on public.diplomas (holder_email) where holder_id is null;

create table public.share_links (
  id           uuid primary key default gen_random_uuid(),
  diploma_id   uuid not null references public.diplomas (id) on delete cascade,
  created_by   uuid not null references public.profiles (id) on delete cascade,
  -- Hanya HMAC token yang disimpan; token mentah hanya diketahui pemegang tautan.
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  revoked      boolean not null default false,
  view_count   integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint share_link_max_lifetime check (expires_at <= created_at + interval '365 days')
);

create index share_links_diploma_id_idx on public.share_links (diploma_id);

create table public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid,
  action       text not null,
  target_type  text,
  target_id    text,
  metadata     jsonb not null default '{}'::jsonb,
  ip           text,
  created_at   timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- -----------------------------------------------------------------------------
-- Fungsi bantu (SECURITY DEFINER, search_path dikunci)
-- -----------------------------------------------------------------------------
create or replace function public.app_current_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.app_current_institution()
returns uuid
language sql stable security definer set search_path = ''
as $$ select institution_id from public.profiles where id = auth.uid() $$;

-- true bila sesi sudah melewati MFA (Authenticator Assurance Level 2)
create or replace function public.app_is_mfa()
returns boolean
language sql stable
as $$ select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' $$;

revoke all on function public.app_current_role() from public, anon;
revoke all on function public.app_current_institution() from public, anon;
grant execute on function public.app_current_role() to authenticated;
grant execute on function public.app_current_institution() to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger diplomas_updated_at before update on public.diplomas
  for each row execute function public.set_updated_at();

-- Profil dibuat otomatis saat pendaftaran; peran default selalu 'holder'.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), new.raw_user_meta_data ->> 'full_name');

  if new.email_confirmed_at is not null then
    update public.diplomas set holder_id = new.id
    where holder_id is null and holder_email = lower(new.email);
  end if;
  return new;
end $$;

-- Ijazah hanya ditautkan ke akun setelah email TERKONFIRMASI,
-- agar penyerang tidak bisa mengklaim ijazah dengan mendaftar memakai email orang lain.
create or replace function public.handle_user_email_confirmed()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.diplomas set holder_id = new.id
    where holder_id is null and holder_email = lower(new.email);
  end if;
  return new;
end $$;

-- Dipanggil API penerbitan: tautkan ijazah baru ke akun holder yang SUDAH ada & terkonfirmasi.
create or replace function public.link_diploma_to_existing_holder(p_diploma_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.diplomas d set holder_id = u.id
  from auth.users u
  where d.id = p_diploma_id
    and d.holder_id is null
    and lower(u.email) = d.holder_email
    and u.email_confirmed_at is not null;
end $$;

revoke all on function public.link_diploma_to_existing_holder(uuid) from public, anon, authenticated;
grant execute on function public.link_diploma_to_existing_holder(uuid) to service_role;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
create trigger on_auth_user_email_confirmed after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_email_confirmed();

-- -----------------------------------------------------------------------------
-- Hak akses dasar (least privilege)
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on public.profiles, public.institutions, public.diplomas, public.share_links, public.audit_logs
  from authenticated;

grant select on public.profiles, public.institutions, public.diplomas, public.share_links to authenticated;
-- Pengguna hanya boleh mengubah nama; kolom role/institution_id hanya bisa diubah service role.
grant update (full_name) on public.profiles to authenticated;
grant insert (diploma_id, created_by, token_hash, expires_at) on public.share_links to authenticated;
grant update (revoked) on public.share_links to authenticated;
-- Penulisan diplomas & audit_logs hanya lewat API server (service role) setelah validasi.

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.institutions enable row level security;
alter table public.profiles     enable row level security;
alter table public.diplomas     enable row level security;
alter table public.share_links  enable row level security;
alter table public.audit_logs   enable row level security;

-- institutions
create policy institutions_select on public.institutions
  for select to authenticated using (true);

-- profiles
create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.app_current_role()) = 'admin');

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- diplomas: holder melihat miliknya; issuer melihat milik institusinya; admin semua. Wajib MFA.
create policy diplomas_select on public.diplomas
  for select to authenticated
  using (
    (select public.app_is_mfa())
    and (
      holder_id = (select auth.uid())
      or ((select public.app_current_role()) = 'issuer'
          and institution_id = (select public.app_current_institution()))
      or (select public.app_current_role()) = 'admin'
    )
  );

-- share_links: hanya pemilik ijazah yang bisa membuat/melihat/mencabut tautannya.
create policy share_links_select_own on public.share_links
  for select to authenticated
  using ((select public.app_is_mfa()) and created_by = (select auth.uid()));

create policy share_links_insert_own on public.share_links
  for insert to authenticated
  with check (
    (select public.app_is_mfa())
    and created_by = (select auth.uid())
    and expires_at > now()
    and exists (
      select 1 from public.diplomas d
      where d.id = diploma_id and d.holder_id = (select auth.uid()) and d.status = 'issued'
    )
  );

create policy share_links_revoke_own on public.share_links
  for update to authenticated
  using ((select public.app_is_mfa()) and created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()) and revoked = true);

-- audit_logs: hanya admin yang dapat membaca; tidak ada yang dapat mengubah/menghapus via API.
grant select on public.audit_logs to authenticated;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using ((select public.app_is_mfa()) and (select public.app_current_role()) = 'admin');

-- -----------------------------------------------------------------------------
-- Storage: bucket privat untuk PDF terenkripsi (REQ-02)
-- Tidak ada policy pada storage.objects untuk bucket ini => hanya service role
-- (API server) yang dapat membaca/menulis. Klien tidak pernah mengakses langsung.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diplomas', 'diplomas', false, 15728640, array['application/octet-stream'])
on conflict (id) do update set public = false;
