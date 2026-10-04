-- schema.sql: AgriFarm (reports keyed by hash)
-- The app computes the hash (SHA-256 of the RFC 8785 canonical report
-- with the `integrity` member removed). The database only stores it.
-- This file documents what is already in Supabase. Do NOT re-run it on
-- the live project: it starts with `drop table` and would delete data.

drop table if exists site_visit_requests;
drop table if exists reports;
drop function if exists report_is_intact(text);
drop function if exists set_report_hash();

create table reports (
  hash        text primary key,      -- the hash in the QR, computed by the app
  report      jsonb not null,        -- the whole signed report
  created_at  timestamptz not null default now()
);

create table site_visit_requests (
  id           bigint generated always as identity primary key,
  report_hash  text not null references reports(hash) on delete cascade,
  lender       text not null,
  requested_at timestamptz not null default now()
);

alter table reports enable row level security;
alter table site_visit_requests enable row level security;

-- Anon can only INSERT. There is no read policy, so nobody can list rows.
create policy "app can insert reports" on reports
  for insert to anon, authenticated with check (true);
create policy "app can insert visit requests" on site_visit_requests
  for insert to anon, authenticated with check (true);

-- A report is fetched by its hash (from the QR) through this function.
create or replace function get_report(h text) returns jsonb
language sql stable security definer set search_path = public as $$
  select report from reports where hash = h
$$;

grant execute on function get_report(text) to anon, authenticated;
