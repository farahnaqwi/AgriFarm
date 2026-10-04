# AgriFarm data schema

Two stores:

- **Supabase (live):** `reports` and `site_visit_requests`, the verified farm evidence reports and lender requests. Defined in [`../schema.sql`](../schema.sql).
- **Platform tables:** everything else. Defined in [`../schema_platform.sql`](../schema_platform.sql); the API still serves them from memory with dummy data seeded by [`../backend/agrifarm_api/seed.py`](../backend/agrifarm_api/seed.py), and that seed loads into these tables unchanged. Lists in memory (for example `farmers.programmes`) are proper join tables here.

`schema_platform.sql` is additive: it never drops or alters `reports`, `site_visit_requests` or `get_report()`, and every statement is idempotent, so it can be run on the live Supabase project (and run again) without touching existing data. `schema.sql` stays as it is on `main`.

Vocabularies are shared with the evidence report contract ([`schema.json`](schema.json)), so a platform farmer or plot and a report about it agree:

| Field | Platform tables | `schema.json` |
|---|---|---|
| Farmer ID | `farmers.farmer_id` checked against `^F-[A-Z0-9]{4,12}$` | `farmer.farmer_id`, same pattern |
| Language | `sw` \| `en` | `farmer_language` |
| Crop | `coffee`, `maize`, `coffee_banana`, `beans`, `other` | `crop_type` values (`beans` is platform-only) |
| Plot shape | `plots.geometry`: GeoJSON Polygon, `[lon, lat]`, as `jsonb` (no PostGIS needed) | `plot.geometry` |
| How the boundary was captured | `plots.geometry_source`: `gps_walk` \| `drawn_on_map` \| `gps_walk_and_drawn` (the API's `walked` = `gps_walk`) | `plot.geometry_source` |
| Season / month | `YYYY/YY` / `YYYY-MM` | rainfall seasons / NDVI months |

`report_index` is a read-only view over `reports` (report ID, farmer ID, plot ID, mode, not-sure flag) for joining reports to `farmers`. It uses `security_invoker`, so the reports RLS still applies and the anon key can't list reports through it.

Access: RLS is on for every platform table, with no anon or authenticated policies. Only the platform API, using the service-role key, can read or write them.

## Entity-relationship diagram

```mermaid
erDiagram
    WARD ||--o{ FARMER : "home of"
    WARD ||--o{ RAINFALL_MONTH : "has"
    WARD ||--o{ DEALER : "hosts"
    FARMER ||--o{ PLOT : "owns"
    PLOT ||--o{ NDVI_MONTH : "seen by satellite"
    FARMER ||--o| WALLET : "paid into"
    FARMER ||--o{ ENROLMENT : "joins"
    PROGRAMME ||--o{ ENROLMENT : "enrols"
    PROGRAMME ||--o{ VOUCHER : "funds"
    FARMER ||--o{ VOUCHER : "receives"
    DEALER |o--o{ VOUCHER : "redeems"
    DEALER ||--o| WALLET : "reimbursed into"
    PROGRAMME ||--o| WALLET : "funds from"
    VOUCHER ||--o| PAYOUT : "reimbursed by"
    FARMER ||--o{ POLICY : "insured by"
    POLICY ||--o{ PAYOUT : "triggers"
    DISASTER_EVENT ||--o{ PAYOUT : "relief"
    PAYOUT }o--|| WALLET : "pays"
    PAYOUT |o--o| LEDGER_TX : "settled by"
    WALLET ||--o{ LEDGER_TX : "from / to"
    FARMER |o--o{ ESCALATION : "asks"
    REPORT ||--o{ SITE_VISIT_REQUEST : "prompts"
    FARMER |o..o{ REPORT : "subject of (report_index view)"
    POLICY }o--|| WARD : "indexed on"

    WARD {
        text name PK "Vwawa, Mlowo, Iyula, Isansa, Igamba"
        text district "Mbozi"
        float lon
        float lat
    }
    FARMER {
        text farmer_id PK "pseudonymous, e.g. F-MBZ001"
        text display_name "null after withdrawal"
        text language "sw | en"
        text ward FK
        text cooperative
        bool consent_registry "required unless withdrawn"
        bool consent_share_with_programmes "gates institution views"
        timestamptz registered_at
        bool withdrawn
        timestamptz withdrawn_at
    }
    PLOT {
        text plot_id PK
        text farmer_id FK
        text crop "coffee | maize | coffee_banana | beans | other"
        jsonb geometry "GeoJSON polygon"
        text geometry_source "gps_walk | drawn_on_map | gps_walk_and_drawn"
        numeric area_ha "measured from polygon"
        numeric claimed_area_ha "farmer said"
    }
    NDVI_MONTH {
        text plot_id PK,FK
        text month PK "YYYY-MM"
        float ndvi "Sentinel-2"
        bool cloudy "true -> not sure"
    }
    RAINFALL_MONTH {
        text ward PK,FK
        text month PK
        float mm "CHIRPS"
        float normal_mm
    }
    PROGRAMME {
        text programme_id PK
        text name
        text sponsor
        text started
    }
    ENROLMENT {
        text farmer_id PK,FK
        text programme_id PK,FK
        timestamptz enrolled_at
    }
    DEALER {
        text dealer_id PK
        text name
        text ward FK
        bool verified "unverified -> redemption refused"
    }
    VOUCHER {
        text voucher_id PK
        text farmer_id FK
        text programme_id FK
        text dealer_id FK "set on redemption"
        text code UK "one-time"
        text item
        int value_tzs
        text status "issued | redeemed"
        text issued_by "officer"
        timestamptz issued_at
        timestamptz redeemed_at
    }
    VOUCHER_FLAG {
        bigint id PK
        text code
        text dealer_id
        text reason "unverified dealer, reused code..."
        timestamptz at
    }
    POLICY {
        text policy_id PK
        text farmer_id FK
        text product "rainfall index"
        text ward FK
        text season "e.g. 2024/25"
        int sum_insured_tzs
        float trigger_ratio "0.75"
        float exit_ratio "0.40"
    }
    DISASTER_EVENT {
        text event_id PK
        text type "flood"
        date date
        geometry area "affected polygon"
        text source
    }
    PAYOUT {
        text payout_id PK
        text kind "insurance | disaster_relief | dealer_reimbursement"
        text payee_wallet FK
        int amount_tzs
        text ref UK "idempotency key"
        jsonb evidence "index, event, voucher"
        text voucher_id FK "dealer_reimbursement"
        text policy_id FK "insurance"
        text event_id FK "disaster_relief"
        text status "pending_approval | paid | rejected"
        text decided_by "a person, always"
        text decision_note
        text tx_id FK,UK
    }
    WALLET {
        text wallet_id PK
        text owner_farmer_id FK,UK "exactly one owner"
        text owner_dealer_id FK,UK
        text owner_programme_id FK,UK
        text provider "M-Pesa (mock)"
        int balance_tzs
    }
    LEDGER_TX {
        text tx_id PK
        text from_wallet FK
        text to_wallet FK
        int amount_tzs
        text memo
        timestamptz at
    }
    MARKET_PRICE {
        date date PK
        text market PK
        text commodity PK "coffee_parchment | maize"
        int tzs_per_kg
    }
    ESCALATION {
        text escalation_id PK
        text farmer_id FK
        text question "advisor was not sure"
        text language
        text status "open | answered"
        timestamptz asked_at
        text answer "from extension officer"
        text answered_by
    }
    REPORT {
        text hash PK "SHA-256 of canonical report, from the phone"
        jsonb report "whole signed evidence report"
        timestamptz created_at
    }
    SITE_VISIT_REQUEST {
        bigint id PK
        text report_hash FK
        text lender
        timestamptz requested_at
    }
```

`MARKET_PRICE` and `VOUCHER_FLAG` stand alone: prices are a reference series, and flags log refused redemptions, keyed by whatever code was tried.

## Rules the schema encodes

| Rule | Where |
|---|---|
| A farmer can't register without consent | check: `consent_registry` must be true unless withdrawn |
| Institutions see only opted-in farmers, never names | `FARMER.consent_share_with_programmes` filters every `/institution` view |
| No vouchers for ghosts | trigger `vouchers_rules`: a new `VOUCHER` needs the farmer to have at least one `PLOT` and not be withdrawn |
| Vouchers are redeemed only at verified dealers, and only once | trigger `vouchers_rules` checks `DEALER.verified` and freezes a redeemed voucher; `VOUCHER.code` unique |
| Money moves only after a person approves | check: `pending_approval` has no `decided_by` or `tx_id`; `paid` needs both; `rejected` needs `decided_by` |
| Re-running insurance doesn't pay twice | `PAYOUT.ref` unique, e.g. `ins:POL-009:2024/25` |
| A cloudy image gives "not sure", not a guess | `NDVI_MONTH.cloudy` |
| Evidence reports are tamper-evident | `REPORT.hash` is computed on the phone; the lender page re-hashes |
| Withdrawal erases personal data | check: a withdrawn farmer has no name, cooperative or consent; trigger `farmers_withdrawal` deletes their `PLOT` rows (and NDVI series); payment history kept for audit |
| A wallet has one owner | check: exactly one of `owner_farmer_id`, `owner_dealer_id`, `owner_programme_id` |
