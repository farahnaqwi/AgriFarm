-- schema.sql: AgriFarm hackathon

create extension if not exists pgcrypto with schema extensions;

-- 1. Reports: one row per QR code
create table reports (
  code         text primary key,              -- the code inside the QR
  report       jsonb not null,                -- the whole report
  report_hash  text,                          -- fingerprint set automatically on insert
  created_at   timestamptz not null default now()
);

-- 2. Site visit requests
create table site_visit_requests (
  id            bigint generated always as identity primary key,
  report_code   text not null references reports(code) on delete cascade,
  lender        text not null,
  requested_at  timestamptz not null default now()
);

-- Fingerprint the report when it is first saved
create function set_report_hash() returns trigger
language plpgsql set search_path = extensions, public as $$
begin
  new.report_hash := encode(digest(new.report::text, 'sha256'), 'hex');
  return new;
end $$;

create trigger trg_set_report_hash
before insert on reports
for each row execute function set_report_hash();

-- Tamper check: true = untouched, false = report was edited after saving
create function report_is_intact(p_code text) returns boolean
language sql stable set search_path = extensions, public as $$
  select encode(digest(report::text, 'sha256'), 'hex') = report_hash
  from reports where code = p_code;
$$;

-- Security: the app can add and read, but never edit or delete
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

-- Seed data (one honest farmer, one liar)
insert into reports (code, report) values
('HONEST-7K2M', '{
  "farmer": "demo-farmer-1",
  "claims":   {"crop": "maize",  "hectares": 2.0, "bad_season": "2022 drought"},
  "verified": {"crop": "maize",  "hectares": 2.1, "bad_season": true},
  "coop_vouch": "Co-op member for 11 years",
  "checks": [{"name": "Farm size",   "passed": true},
             {"name": "Crop type",   "passed": true},
             {"name": "Bad season",  "passed": true}]
}'),
('LIAR-3Q9X', '{
  "farmer": "demo-farmer-2",
  "claims":   {"crop": "coffee", "hectares": 5.0, "bad_season": "2023 flood"},
  "verified": {"crop": "maize",  "hectares": 2.0, "bad_season": false},
  "coop_vouch": "Not a co-op member",
  "checks": [{"name": "Farm size",   "passed": false},
             {"name": "Crop type",   "passed": false},
             {"name": "Bad season",  "passed": false}]
}');