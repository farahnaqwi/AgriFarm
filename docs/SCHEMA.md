# AgriFarm data schema

Two stores:

- **Supabase (live):** `reports` and `site_visit_requests`, the verified farm evidence reports and lender requests. Defined in [`../schema.sql`](../schema.sql).
- **Platform API (in memory, dummy data):** everything else, seeded by [`../backend/agrifarm_api/seed.py`](../backend/agrifarm_api/seed.py). The diagram shows the shape these tables would take if they moved to Supabase/PostGIS. Some links are lists in memory today (for example `farmers.programmes`), and the diagram draws them as proper join tables.

## Entity-relationship diagram

```mermaid
erDiagram
    WARD ||--o{ FARMER : "home of"
    WARD ||--o{ RAINFALL_MONTH : "has"
    WARD ||--o{ DEALER : "hosts"
    FARMER ||--o{ PLOT : "owns"
    PLOT ||--o{ NDVI_MONTH : "seen by satellite"
    FARMER ||--|| WALLET : "paid into"
    FARMER ||--o{ ENROLMENT : "joins"
    PROGRAMME ||--o{ ENROLMENT : "enrols"
    PROGRAMME ||--o{ VOUCHER : "funds"
    FARMER ||--o{ VOUCHER : "receives"
    DEALER |o--o{ VOUCHER : "redeems"
    DEALER ||--|| WALLET : "reimbursed into"
    VOUCHER ||--o| PAYOUT : "reimbursed by"
    FARMER ||--o{ POLICY : "insured by"
    POLICY ||--o{ PAYOUT : "triggers"
    DISASTER_EVENT ||--o{ PAYOUT : "relief"
    PAYOUT }o--|| WALLET : "pays"
    PAYOUT |o--o| LEDGER_TX : "settled by"
    WALLET ||--o{ LEDGER_TX : "from / to"
    FARMER |o--o{ ESCALATION : "asks"
    REPORT ||--o{ SITE_VISIT_REQUEST : "prompts"
    FARMER |o..o{ REPORT : "subject of (farmer_id inside JSON)"

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
        text wallet_id FK
        bool consent_registry "required"
        bool consent_share_with_programmes "gates institution views"
        timestamptz registered_at
        bool withdrawn
    }
    PLOT {
        text plot_id PK
        text farmer_id FK
        text crop "coffee | maize | beans | other"
        geometry boundary "GeoJSON polygon, walked"
        float area_ha "measured from polygon"
        float claimed_area_ha "farmer said"
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
        text status "pending_approval | paid | rejected"
        text decided_by "a person, always"
        text tx_id FK
    }
    WALLET {
        text wallet_id PK
        text owner "farmer, dealer or programme"
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
| A farmer can't register without consent | `FARMER.consent_registry` must be true |
| Institutions see only opted-in farmers, never names | `FARMER.consent_share_with_programmes` filters every `/institution` view |
| No vouchers for ghosts | a `VOUCHER` needs the farmer to have at least one `PLOT` |
| Vouchers are redeemed only at verified dealers, and only once | `DEALER.verified`, `VOUCHER.code` unique, `status` |
| Money moves only after a person approves | `PAYOUT.status` starts at `pending_approval`; a `LEDGER_TX` exists only after approval, recorded in `decided_by` |
| Re-running insurance doesn't pay twice | `PAYOUT.ref` unique, e.g. `ins:POL-009:2024/25` |
| A cloudy image gives "not sure", not a guess | `NDVI_MONTH.cloudy` |
| Evidence reports are tamper-evident | `REPORT.hash` is computed on the phone; the lender page re-hashes |
| Withdrawal erases personal data | `FARMER.display_name` set to null, the farmer's `PLOT` rows deleted, `withdrawn` set; payment history kept for audit |
