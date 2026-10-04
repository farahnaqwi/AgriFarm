-- schema_platform.sql: AgriFarm platform tables (farmer ID, plots, satellite,
-- vouchers, insurance, payments, prices, advisor escalations).
--
-- Companion to schema.sql, which owns the live evidence-report tables
-- (`reports`, `site_visit_requests`). This file is ADDITIVE ONLY:
--   * it never drops, alters or re-creates `reports` / `site_visit_requests`
--     or `get_report()`;
--   * every statement is idempotent (`if not exists` / `or replace`), so it is
--     safe to run on the live Supabase project, and safe to run twice.
-- Run schema.sql's tables first (they already exist in Supabase).
--
-- Shapes follow backend/agrifarm_api/seed.py; vocabularies follow
-- docs/schema.json so a platform farmer/plot and an evidence report agree:
--   farmer_id  ^F-[A-Z0-9]{4,12}$        (schema.json farmer.farmer_id)
--   language   sw | en                   (schema.json farmer_language)
--   crop       coffee | maize | coffee_banana | beans | other
--              (schema.json crop_type values + `beans` used by the platform)
--   geometry   GeoJSON Polygon [lon, lat] (schema.json plot.geometry)
--   season     YYYY/YY, Nov-Apr          (schema.json rainfall.seasons)
--   month      YYYY-MM                   (schema.json ndvi.monthly)
--
-- Access: RLS is on for every table with no anon/authenticated policies.
-- The platform API uses the service-role key (bypasses RLS), so the phone app
-- and the public anon key can read or write none of this.

-- ---------------------------------------------------------------- places

create table if not exists wards (
  name      text primary key,                  -- Vwawa, Mlowo, Iyula, Isansa, Igamba
  district  text not null,                     -- Mbozi
  lon       double precision not null check (lon between -180 and 180),
  lat       double precision not null check (lat between -90 and 90)
);

-- ---------------------------------------------------------------- people

create table if not exists farmers (
  farmer_id                      text primary key
                                 check (farmer_id ~ '^F-[A-Z0-9]{4,12}$'),  -- pseudonymous, no phone / national ID
  display_name                   text,                                    -- null after withdrawal
  language                       text not null default 'sw' check (language in ('sw', 'en')),
  ward                           text not null references wards(name),
  cooperative                    text,                                    -- as stated; null after withdrawal
  registered_at                  timestamptz not null default now(),
  registered_by                  text,                                    -- e.g. 'voice+photo+walked boundary'
  consent_registry               boolean not null,
  consent_share_with_programmes  boolean not null default false,          -- gates every /institution view
  consent_recorded_at            timestamptz not null default now(),
  withdrawn                      boolean not null default false,
  withdrawn_at                   timestamptz,
  -- No registration without consent; withdrawal erases personal data and revokes sharing.
  constraint farmers_consent_or_withdrawn check (consent_registry or withdrawn),
  constraint farmers_withdrawal_erases check (
    not withdrawn or (display_name is null and cooperative is null
                      and not consent_share_with_programmes and not consent_registry))
);
create index if not exists farmers_ward_idx on farmers (ward);

create table if not exists programmes (
  programme_id  text primary key,
  name          text not null,
  sponsor       text,
  started       text check (started ~ '^[0-9]{4}-[0-9]{2}$')               -- YYYY-MM
);

create table if not exists enrolments (
  farmer_id     text not null references farmers(farmer_id) on delete cascade,
  programme_id  text not null references programmes(programme_id) on delete cascade,
  enrolled_at   timestamptz not null default now(),
  primary key (farmer_id, programme_id)
);
create index if not exists enrolments_programme_idx on enrolments (programme_id);

create table if not exists dealers (
  dealer_id  text primary key,
  name       text not null,
  ward       text not null references wards(name),
  verified   boolean not null default false                               -- unverified -> redemption refused
);

-- ---------------------------------------------------------------- land and satellite

create table if not exists plots (
  plot_id          text primary key,
  farmer_id        text not null references farmers(farmer_id) on delete cascade,  -- withdrawal deletes plots
  crop             text not null check (crop in ('coffee', 'maize', 'coffee_banana', 'beans', 'other')),
  geometry         jsonb not null check (
                     geometry->>'type' = 'Polygon'
                     and jsonb_typeof(geometry->'coordinates') = 'array'),           -- GeoJSON, [lon, lat], WGS84
  geometry_source  text not null default 'gps_walk'
                   check (geometry_source in ('gps_walk', 'drawn_on_map', 'gps_walk_and_drawn')),  -- API 'walked' = gps_walk
  area_ha          numeric(10, 4) not null check (area_ha > 0),                       -- measured from polygon
  claimed_area_ha  numeric(10, 4) check (claimed_area_ha > 0),                        -- what the farmer said
  created_at       timestamptz not null default now()
);
create index if not exists plots_farmer_idx on plots (farmer_id);

create table if not exists ndvi_months (
  plot_id  text not null references plots(plot_id) on delete cascade,
  month    text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ndvi     numeric(5, 3) check (ndvi between -1 and 1),                   -- Sentinel-2 median
  cloudy   boolean not null default false,                                -- true -> "not sure", never a guess
  primary key (plot_id, month)
);

create table if not exists rainfall_months (
  ward       text not null references wards(name),
  month      text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  mm         numeric(7, 1) check (mm >= 0),                                 -- CHIRPS; null = missing
  normal_mm  numeric(7, 1) not null check (normal_mm >= 0),
  primary key (ward, month)
);

create table if not exists disaster_events (
  event_id  text primary key,
  type      text not null,                                                -- flood, ...
  date      date not null,
  geometry  jsonb not null check (geometry->>'type' = 'Polygon'),          -- affected area
  source    text
);

-- ---------------------------------------------------------------- money

-- One wallet per owner; the owner is exactly one of farmer, dealer or programme.
-- (The in-memory store keeps farmers.wallet_id = 'W-' || farmer_id; here the link
-- lives on the wallet so farmers <-> wallets has no circular foreign key.)
create table if not exists wallets (
  wallet_id           text primary key,
  owner_farmer_id     text unique references farmers(farmer_id),
  owner_dealer_id     text unique references dealers(dealer_id),
  owner_programme_id  text unique references programmes(programme_id),
  provider            text not null,                                      -- 'M-Pesa (mock)', 'bank (mock)'
  balance_tzs         bigint not null default 0,
  constraint wallets_one_owner check (num_nonnulls(owner_farmer_id, owner_dealer_id, owner_programme_id) = 1)
);

create table if not exists vouchers (
  voucher_id    text primary key,
  farmer_id     text not null references farmers(farmer_id),
  programme_id  text not null references programmes(programme_id),
  dealer_id     text references dealers(dealer_id),                       -- set on redemption
  code          text not null unique,                                     -- one-time
  item          text not null,
  value_tzs     integer not null check (value_tzs > 0),
  status        text not null default 'issued' check (status in ('issued', 'redeemed')),
  issued_by     text,                                                     -- programme officer
  issued_at     timestamptz not null default now(),
  redeemed_at   timestamptz,
  constraint vouchers_redemption_complete check (
    (status = 'issued'   and dealer_id is null     and redeemed_at is null) or
    (status = 'redeemed' and dealer_id is not null and redeemed_at is not null))
);
create index if not exists vouchers_farmer_idx on vouchers (farmer_id);

-- Refused redemptions, keyed by whatever code was tried (may not exist).
create table if not exists voucher_flags (
  id         bigint generated always as identity primary key,
  code       text not null,
  dealer_id  text,
  reason     text not null,                                               -- unverified dealer, reused code, ...
  at         timestamptz not null default now()
);

create table if not exists policies (
  policy_id        text primary key,
  farmer_id        text not null references farmers(farmer_id),
  product          text not null,                                         -- rainfall index
  ward             text not null references wards(name),
  season           text not null check (season ~ '^[0-9]{4}/[0-9]{2}$'),
  sum_insured_tzs  integer not null check (sum_insured_tzs > 0),
  trigger_ratio    numeric(4, 3) not null check (trigger_ratio > 0 and trigger_ratio <= 1),
  exit_ratio       numeric(4, 3) not null check (exit_ratio >= 0),
  constraint policies_exit_below_trigger check (exit_ratio < trigger_ratio)
);
create index if not exists policies_season_idx on policies (season, ward);

create table if not exists ledger_txs (
  tx_id        text primary key,
  from_wallet  text not null references wallets(wallet_id),
  to_wallet    text not null references wallets(wallet_id),
  amount_tzs   bigint not null check (amount_tzs > 0),
  memo         text,
  at           timestamptz not null default now(),
  constraint ledger_txs_distinct_wallets check (from_wallet <> to_wallet)
);
create index if not exists ledger_txs_from_idx on ledger_txs (from_wallet);
create index if not exists ledger_txs_to_idx on ledger_txs (to_wallet);

-- Proposals; money moves only after a person approves (A person decides).
create table if not exists payouts (
  payout_id      text primary key,
  kind           text not null check (kind in ('insurance', 'disaster_relief', 'dealer_reimbursement')),
  payee_wallet   text not null references wallets(wallet_id),
  amount_tzs     bigint not null check (amount_tzs > 0),
  reason         text,
  ref            text not null unique,                                    -- idempotency, e.g. 'ins:POL-009:2024/25'
  evidence       jsonb not null default '{}'::jsonb,                      -- index, event, voucher
  voucher_id     text references vouchers(voucher_id),                    -- dealer_reimbursement
  policy_id      text references policies(policy_id),                     -- insurance
  event_id       text references disaster_events(event_id),               -- disaster_relief
  status         text not null default 'pending_approval'
                 check (status in ('pending_approval', 'paid', 'rejected')),
  decided_by     text,                                                    -- a person, always
  decision_note  text,
  tx_id          text unique references ledger_txs(tx_id),
  created_at     timestamptz not null default now(),
  constraint payouts_person_decides check (
    (status = 'pending_approval' and decided_by is null     and tx_id is null) or
    (status = 'paid'             and decided_by is not null and tx_id is not null) or
    (status = 'rejected'         and decided_by is not null and tx_id is null))
);
create index if not exists payouts_status_idx on payouts (status, kind);

-- ---------------------------------------------------------------- reference and advisor

create table if not exists market_prices (
  date        date not null,
  market      text not null,
  commodity   text not null,                                              -- coffee_parchment | maize
  tzs_per_kg  integer not null check (tzs_per_kg > 0),
  primary key (date, market, commodity)
);

create table if not exists escalations (
  escalation_id  text primary key,
  farmer_id      text references farmers(farmer_id) on delete set null,
  question       text not null,                                           -- advisor was not sure
  language       text not null check (language in ('sw', 'en')),
  status         text not null default 'open' check (status in ('open', 'answered')),
  asked_at       timestamptz not null default now(),
  answer         text,                                                    -- from extension officer
  answered_by    text,
  constraint escalations_answered_complete check (
    status = 'open' or (answer is not null and answered_by is not null))
);
create index if not exists escalations_status_idx on escalations (status);

-- ---------------------------------------------------------------- rules as triggers

-- No vouchers for ghosts: the farmer needs at least one plot and must not have withdrawn.
-- Vouchers are redeemed only at verified dealers.
create or replace function check_voucher() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' and not exists (select 1 from plots where farmer_id = new.farmer_id) then
    raise exception 'voucher refused: farmer % has no registered plot', new.farmer_id;
  end if;
  if tg_op = 'INSERT' and exists (select 1 from farmers where farmer_id = new.farmer_id and withdrawn) then
    raise exception 'voucher refused: farmer % has withdrawn', new.farmer_id;
  end if;
  if tg_op = 'UPDATE' and old.status = 'redeemed'
     and (new.status, new.dealer_id, new.redeemed_at) is distinct from (old.status, old.dealer_id, old.redeemed_at) then
    raise exception 'voucher % is already redeemed', old.voucher_id;   -- once only
  end if;
  if new.status = 'redeemed' and (tg_op = 'INSERT' or old.status <> 'redeemed') then
    if not exists (select 1 from dealers where dealer_id = new.dealer_id and verified) then
      raise exception 'redemption refused: dealer % is not verified', new.dealer_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists vouchers_rules on vouchers;
create trigger vouchers_rules before insert or update on vouchers
  for each row execute function check_voucher();

-- Withdrawal erases plot shapes (and their satellite series); payment history stays.
create or replace function erase_withdrawn_plots() returns trigger
language plpgsql set search_path = public as $$
begin
  delete from plots where farmer_id = new.farmer_id;
  return new;
end $$;

drop trigger if exists farmers_withdrawal on farmers;
create trigger farmers_withdrawal after update of withdrawn on farmers
  for each row when (new.withdrawn and not old.withdrawn)
  execute function erase_withdrawn_plots();

-- ---------------------------------------------------------------- bridge to evidence reports

-- Read-only index over the live `reports` table (no change to it). security_invoker
-- keeps reports' RLS in force, so anon still cannot list reports through this view.
create or replace view report_index with (security_invoker = true) as
  select r.hash,
         r.report->>'report_id'                 as report_id,
         r.report->'farmer'->>'farmer_id'       as farmer_id,   -- joins to farmers.farmer_id when registered
         r.report->'plot'->>'plot_id'           as plot_id,
         r.report->'provenance'->>'mode'        as mode,        -- mock | demo | live
         (r.report->'not_sure'->>'flag')::boolean as not_sure,
         r.created_at
  from reports r;

revoke all on report_index from anon, authenticated;

-- ---------------------------------------------------------------- row level security

alter table wards           enable row level security;
alter table farmers         enable row level security;
alter table programmes      enable row level security;
alter table enrolments      enable row level security;
alter table dealers         enable row level security;
alter table plots           enable row level security;
alter table ndvi_months     enable row level security;
alter table rainfall_months enable row level security;
alter table disaster_events enable row level security;
alter table wallets         enable row level security;
alter table vouchers        enable row level security;
alter table voucher_flags   enable row level security;
alter table policies        enable row level security;
alter table ledger_txs      enable row level security;
alter table payouts         enable row level security;
alter table market_prices   enable row level security;
alter table escalations     enable row level security;
-- No policies: only the service role (platform API) can touch these tables.
