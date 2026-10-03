-- schema.sql: AgriFarm (reports keyed by hash)
-- The app computes the hash (SHA-256 of the RFC 8785 canonical report
-- with the `integrity` member removed). The database only stores it.

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

create policy "app can insert reports" on reports
  for insert to anon, authenticated with check (true);
create policy "app can read reports" on reports
  for select to anon, authenticated using (true);

create policy "app can insert visit requests" on site_visit_requests
  for insert to anon, authenticated with check (true);
create policy "app can read visit requests" on site_visit_requests
  for select to anon, authenticated using (true);
