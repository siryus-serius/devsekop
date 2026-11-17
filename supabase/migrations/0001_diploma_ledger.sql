-- =====================================================================
-- Vault Ijazah Digital — append-only, hash-chained diploma ledger
--
-- Behaves like a minimal private blockchain:
--   * every issuance/update is a NEW row (never UPDATE/DELETE)
--   * each row stores prev_hash = entry_hash of the previous row
--   * entry_hash = sha256(prev_hash|serial|version|record_hash|payload)
-- Tampering with any row breaks the chain and is reported by
-- public.verify_diploma_ledger(). Later, entry_hash values can be
-- anchored to a public blockchain without moving personal data on-chain.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.diploma_ledger (
  id            bigint generated always as identity primary key,
  serial_number text        not null check (length(btrim(serial_number)) > 0),
  serial_key    text        generated always as (lower(serial_number)) stored,
  version       integer     not null check (version > 0),
  payload       jsonb       not null,
  record_hash   text        not null check (record_hash ~ '^[0-9a-f]{64}$'),
  prev_hash     text        not null check (prev_hash   ~ '^[0-9a-f]{64}$'),
  entry_hash    text        not null unique check (entry_hash ~ '^[0-9a-f]{64}$'),
  created_at    timestamptz not null default now(),
  unique (serial_key, version)
);

create index if not exists diploma_ledger_serial_key_version_idx
  on public.diploma_ledger (serial_key, version desc);

-- ---------------------------------------------------------------------
-- Immutability: block UPDATE / DELETE / TRUNCATE for every role
-- ---------------------------------------------------------------------
create or replace function public.diploma_ledger_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'diploma_ledger is append-only: % is not allowed', tg_op;
end;
$$;

drop trigger if exists diploma_ledger_no_update_delete on public.diploma_ledger;
create trigger diploma_ledger_no_update_delete
  before update or delete on public.diploma_ledger
  for each row execute function public.diploma_ledger_block_mutation();

drop trigger if exists diploma_ledger_no_truncate on public.diploma_ledger;
create trigger diploma_ledger_no_truncate
  before truncate on public.diploma_ledger
  for each statement execute function public.diploma_ledger_block_mutation();

-- ---------------------------------------------------------------------
-- Access control: only the server (service_role) may touch the ledger.
-- RLS on with no policies => anon/authenticated see nothing.
-- ---------------------------------------------------------------------
alter table public.diploma_ledger enable row level security;
revoke all on public.diploma_ledger from anon, authenticated;
revoke update, delete, truncate on public.diploma_ledger from service_role;

-- ---------------------------------------------------------------------
-- Current state per serial (latest version)
-- ---------------------------------------------------------------------
create or replace view public.diploma_current
with (security_invoker = true) as
select distinct on (serial_key)
  serial_number,
  serial_key,
  version,
  payload,
  record_hash,
  prev_hash,
  entry_hash,
  min(created_at) over (partition by serial_key) as first_issued_at,
  created_at                                       as updated_at
from public.diploma_ledger
order by serial_key, version desc;

revoke all on public.diploma_current from anon, authenticated;

-- ---------------------------------------------------------------------
-- Append a new ledger entry (atomic, serialized, idempotent)
-- ---------------------------------------------------------------------
create or replace function public.issue_diploma(
  p_serial_number text,
  p_payload       jsonb,
  p_record_hash   text
)
returns public.diploma_ledger
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_latest    public.diploma_ledger;
  v_prev_hash text;
  v_version   integer;
  v_row       public.diploma_ledger;
begin
  -- One writer at a time so the chain stays strictly linear.
  perform pg_advisory_xact_lock(hashtext('diploma_ledger_append'));

  select * into v_latest
  from public.diploma_ledger
  where serial_key = lower(p_serial_number)
  order by version desc
  limit 1;

  -- Re-issuing identical data does not create a new block.
  if found and v_latest.record_hash = p_record_hash and v_latest.payload = p_payload then
    return v_latest;
  end if;

  v_version := coalesce(v_latest.version, 0) + 1;

  select entry_hash into v_prev_hash
  from public.diploma_ledger
  order by id desc
  limit 1;
  v_prev_hash := coalesce(v_prev_hash, repeat('0', 64)); -- genesis

  insert into public.diploma_ledger
    (serial_number, version, payload, record_hash, prev_hash, entry_hash)
  values (
    p_serial_number,
    v_version,
    p_payload,
    p_record_hash,
    v_prev_hash,
    encode(digest(
      v_prev_hash || '|' || p_serial_number || '|' || v_version || '|' ||
      p_record_hash || '|' || p_payload::text, 'sha256'), 'hex')
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.issue_diploma(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.issue_diploma(text, jsonb, text) to service_role;

-- ---------------------------------------------------------------------
-- Audit: returns every row whose link or content no longer matches.
-- Empty result = chain intact.   Usage: select * from verify_diploma_ledger();
-- ---------------------------------------------------------------------
create or replace function public.verify_diploma_ledger()
returns table (id bigint, serial_number text, version integer, problem text)
language sql
stable
set search_path = public, extensions
as $$
  with ordered as (
    select l.*,
           coalesce(lag(l.entry_hash) over (order by l.id), repeat('0', 64)) as expected_prev,
           encode(digest(
             l.prev_hash || '|' || l.serial_number || '|' || l.version || '|' ||
             l.record_hash || '|' || l.payload::text, 'sha256'), 'hex') as recomputed
    from public.diploma_ledger l
  )
  select o.id, o.serial_number, o.version,
         case when o.prev_hash <> o.expected_prev then 'broken link: prev_hash mismatch'
              else 'content tampered: entry_hash mismatch' end
  from ordered o
  where o.prev_hash <> o.expected_prev
     or o.entry_hash <> o.recomputed
  order by o.id;
$$;

revoke all on function public.verify_diploma_ledger() from public, anon, authenticated;
grant execute on function public.verify_diploma_ledger() to service_role;
