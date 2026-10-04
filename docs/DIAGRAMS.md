# AgriFarm system diagrams

Mermaid sources for the ERD, process flows and integration map, drawn from the code on `main` (as of `8bfd120`). GitHub renders them on this page. Planned and mocked parts are labelled.

Contents: [ERD](#1-entity-relationship-diagram) · [Process flow](#2-process-flow) · [Integration map](#3-integration-map)

## 1. Entity-relationship diagram

19 tables and one view in Supabase Postgres, from [`../schema.sql`](../schema.sql) and [`../schema_platform.sql`](../schema_platform.sql). Split into three groups; shared tables appear by name only where they repeat. Dotted lines are not foreign keys. Rules and access are described in [`SCHEMA.md`](SCHEMA.md).

### A. Evidence reports (live, `schema.sql`)

```mermaid
erDiagram
    reports ||--o{ site_visit_requests : "report_hash"
    reports ||..|| report_index : "view (read-only)"
    report_index }o..o| farmers : "farmer_id inside report JSON"

    reports {
        text hash PK "SHA-256 of canonical report, computed on the phone"
        jsonb report "whole sealed evidence report (schema.json)"
        timestamptz created_at
    }
    site_visit_requests {
        bigint id PK "identity"
        text report_hash FK "on delete cascade"
        text lender
        timestamptz requested_at
    }
    report_index {
        text hash
        text report_id
        text farmer_id
        text plot_id
        text mode "mock | demo | live"
        boolean not_sure
        timestamptz created_at
    }
    farmers {
        text farmer_id PK "F-XXXX, pseudonymous"
    }
```

### B. Farmers, land and climate (`schema_platform.sql`)

```mermaid
erDiagram
    wards ||--o{ farmers : "home of"
    wards ||--o{ dealers : "hosts"
    wards ||--o{ rainfall_months : "CHIRPS series"
    farmers ||--o{ plots : "owns (deleted on withdrawal)"
    plots ||--o{ ndvi_months : "Sentinel-2 series"
    farmers ||--o{ enrolments : "joins"
    programmes ||--o{ enrolments : "enrols"
    farmers |o--o{ escalations : "asks"

    wards {
        text name PK
        text district
        float8 lon
        float8 lat
    }
    farmers {
        text farmer_id PK "^F-[A-Z0-9]{4,12}$"
        text display_name "null after withdrawal"
        text language "sw | en"
        text ward FK
        text cooperative
        timestamptz registered_at
        text registered_by
        boolean consent_registry "true unless withdrawn"
        boolean consent_share_with_programmes
        timestamptz consent_recorded_at
        boolean withdrawn
        timestamptz withdrawn_at
    }
    plots {
        text plot_id PK
        text farmer_id FK "cascade"
        text crop "coffee | maize | coffee_banana | beans | other"
        jsonb geometry "GeoJSON Polygon"
        text geometry_source "gps_walk | drawn_on_map | gps_walk_and_drawn"
        numeric area_ha "measured, > 0"
        numeric claimed_area_ha "farmer said"
        timestamptz created_at
    }
    ndvi_months {
        text plot_id PK,FK
        text month PK "YYYY-MM"
        numeric ndvi "-1..1"
        boolean cloudy "true -> not sure"
    }
    rainfall_months {
        text ward PK,FK
        text month PK "YYYY-MM"
        numeric mm "null = missing"
        numeric normal_mm
    }
    programmes {
        text programme_id PK
        text name
        text sponsor
        text started "YYYY-MM"
    }
    enrolments {
        text farmer_id PK,FK
        text programme_id PK,FK
        timestamptz enrolled_at
    }
    dealers {
        text dealer_id PK
        text name
        text ward FK
        boolean verified
    }
    escalations {
        text escalation_id PK
        text farmer_id FK "set null"
        text question
        text language "sw | en"
        text status "open | answered"
        timestamptz asked_at
        text answer
        text answered_by
    }
    market_prices {
        date date PK
        text market PK
        text commodity PK
        int tzs_per_kg
    }
    disaster_events {
        text event_id PK
        text type
        date date
        jsonb geometry "GeoJSON Polygon"
        text source
    }
```

### C. Vouchers, insurance and payments (`schema_platform.sql`)

```mermaid
erDiagram
    farmers ||--o| wallets : "owner_farmer_id"
    dealers ||--o| wallets : "owner_dealer_id"
    programmes ||--o| wallets : "owner_programme_id"
    farmers ||--o{ vouchers : "receives"
    programmes ||--o{ vouchers : "funds"
    dealers |o--o{ vouchers : "redeems"
    farmers ||--o{ policies : "insured by"
    wards ||--o{ policies : "index area"
    vouchers |o--o{ payouts : "dealer_reimbursement"
    policies |o--o{ payouts : "insurance"
    disaster_events |o--o{ payouts : "disaster_relief"
    wallets ||--o{ payouts : "payee_wallet"
    payouts |o--o| ledger_txs : "tx_id (only when paid)"
    wallets ||--o{ ledger_txs : "from_wallet / to_wallet"

    wallets {
        text wallet_id PK
        text owner_farmer_id FK,UK "exactly one owner"
        text owner_dealer_id FK,UK
        text owner_programme_id FK,UK
        text provider "M-Pesa (mock)"
        bigint balance_tzs
    }
    vouchers {
        text voucher_id PK
        text farmer_id FK "needs a plot"
        text programme_id FK
        text dealer_id FK "set on redemption, verified only"
        text code UK "one-time"
        text item
        int value_tzs
        text status "issued | redeemed (frozen)"
        text issued_by
        timestamptz issued_at
        timestamptz redeemed_at
    }
    voucher_flags {
        bigint id PK
        text code
        text dealer_id
        text reason
        timestamptz at
    }
    policies {
        text policy_id PK
        text farmer_id FK
        text product
        text ward FK
        text season "YYYY/YY"
        int sum_insured_tzs
        numeric trigger_ratio "0-1"
        numeric exit_ratio "< trigger_ratio"
    }
    payouts {
        text payout_id PK
        text kind "insurance | disaster_relief | dealer_reimbursement"
        text payee_wallet FK
        bigint amount_tzs
        text reason
        text ref UK "idempotency key"
        jsonb evidence
        text voucher_id FK
        text policy_id FK
        text event_id FK
        text status "pending_approval | paid | rejected"
        text decided_by "a person, always"
        text decision_note
        text tx_id FK,UK
        timestamptz created_at
    }
    ledger_txs {
        text tx_id PK
        text from_wallet FK
        text to_wallet FK "differs from from_wallet"
        bigint amount_tzs
        text memo
        timestamptz at
    }
```

## 2. Process flow

Diamonds are decisions; rounded boxes are end states.

### A. Evidence report: farmer to lender

`app/src/capture/Flow.tsx` → `backend/engine` → `app/src/data/reports.ts` → `app/src/lender/Verify.tsx`

```mermaid
flowchart TD
    subgraph PHONE["Farmer's phone · PWA, works in airplane mode · state saved to IndexedDB after every step"]
        S([Open app]) --> C1{"1 · Consent<br/>Swahili audio, tap"}
        C1 -- declines --> X1([Nothing recorded])
        C1 -- agrees --> SP["2 · Speak ~2 min<br/>whisper-tiny ASR on device<br/>raw audio discarded after"]
        SP --> EX["Rule-based Swahili extraction<br/>crop · ekari/hekta · years · seasons"]
        EX --> CF{"3 · Confirm each value<br/>by tap"}
        CF -- "wrong / not heard" --> TAP["Farmer enters value by tap"] --> CF
        CF -- confirmed --> PL["4 · Plot<br/>walk with GPS or draw on offline map"]
        PL --> MR{"Matches a cooperative-<br/>registered plot? (20 m)"}
        MR -- yes --> EC["Load precomputed evidence card<br/>NDVI · CHIRPS · NASA POWER · soil"]
        MR -- no --> NC["No card: satellite and rain<br/>checks become 'could not be checked'"]
        EC --> PH
        NC --> PH
        PH{"5 · Photos<br/>inside plot boundary?"}
        PH -- no --> RJ["Rejected, retake"] --> PH
        PH -- yes --> TA["Turn-around photo<br/>freshness + dHash duplicate check"]
        TA --> BR["6 · Build report offline<br/>rule engine: crop · area · rain · heat · tenure"]
        BR --> NS{"Anything the machine<br/>could not decide?"}
        NS -- yes --> NSF["not_sure flag:<br/>'ask a person before sharing'"] --> RV
        NS -- no --> RV["Farmer hears the report<br/>in Swahili, fixed phrase list"]
        RV --> SH{"Share with a lender?"}
        SH -- no --> KEEP([Report stays on the phone,<br/>can be deleted])
        SH -- yes --> SEAL["Seal: SHA-256 of canonical JSON<br/>QR = /verify#r=id&h=hash"]
        SEAL --> OB["Queue in outbox"]
    end
    subgraph NET["When a connection exists"]
        OB --> ON{"Online?"}
        ON -- "no, wait for 'online'" --> ON
        ON -- yes --> UP["POST reports to Supabase<br/>anon key, insert-only"]
    end
    subgraph LENDER["Loan officer · /verify page"]
        QR([Scans farmer's QR]) --> GR["get_report(h) RPC"]
        UP -.-> GR
        GR --> FOUND{"Report found?"}
        FOUND -- no --> NF([Not found / unreachable])
        FOUND -- yes --> RH{"Re-hash matches<br/>hash in the QR?"}
        RH -- no --> ALT(["Does not match:<br/>report was altered"])
        RH -- yes --> OK["Unaltered: contradictions first,<br/>then evidence, then limits"]
        OK --> DEC{"A person decides"}
        DEC -- "needs checking" --> SV["Request site visit<br/>insert site_visit_requests"]
        DEC -- "enough evidence" --> DONE([Lender's own decision])
    end
```

### B. Programme payouts: proposal, then a person approves

`backend/agrifarm_api/routers/`: `vouchers`, `insurance`, `institution`, `payments`

```mermaid
flowchart TD
    subgraph SRC["Proposals · Platform API, role-checked"]
        VI["Programme officer issues vouchers"] --> VC{"Registered, opted in,<br/>has a mapped plot,<br/>no unused voucher?"}
        VC -- no --> VR([Refused with reason])
        VC -- yes --> VO["Voucher issued<br/>one-time code"]
        VO --> RD{"Dealer redeems:<br/>dealer verified and<br/>code unused?"}
        RD -- no --> FL([Refused, logged in voucher_flags])
        RD -- yes --> P1["Propose dealer_reimbursement"]
        IN["Officer evaluates rainfall<br/>index for a season"] --> IX{"Ward rainfall data<br/>complete?"}
        IX -- no --> NSI([not sure: no proposal])
        IX -- yes --> TR{"Index below<br/>trigger ratio?"}
        TR -- no --> NT([Not triggered])
        TR -- yes --> P2["Propose insurance payout<br/>scaled between trigger and exit"]
        DE["Disaster event polygon"] --> AF["Find opted-in farmers<br/>with plots inside"] --> P3["Propose disaster_relief<br/>per farmer"]
    end
    P1 --> PO
    P2 --> PO
    P3 --> PO
    PO["payouts row · pending_approval<br/>unique ref stops double payment"]
    PO --> AP{"Programme officer reviews"}
    AP -- reject --> RJ([rejected · decided_by recorded])
    AP -- approve --> TX["Ledger transfer from programme<br/>wallet to payee · M-Pesa mock"]
    TX --> PD([paid · tx_id + decided_by recorded])
```

## 3. Integration map

Solid lines run today; dotted lines are planned or mocked. Build-time sources never run on the farmer's phone: their output ships inside the app so it works offline.

```mermaid
flowchart LR
    subgraph BUILD["Build time · npm prebuild on Vercel"]
        HF["Hugging Face<br/>whisper-tiny q8, pinned rev + SHA-256"]
        NPM["npm: onnxruntime-web<br/>WebAssembly runtime"]
        EL["ElevenLabs TTS<br/>Swahili + English phrase clips"]
        PC["Microsoft Planetary Computer<br/>Sentinel-2 basemap scene"]
    end
    subgraph APP["AgriFarm PWA · Vercel static hosting"]
        FARM["Farmer app<br/>React + service worker + IndexedDB"]
        ENG["Report engine<br/>backend/engine, TypeScript"]
        VER["Lender /verify page"]
    end
    subgraph DATA["Supabase · Postgres + PostgREST"]
        REP[("reports<br/>site_visit_requests")]
        PLAT[("platform tables<br/>schema_platform.sql")]
    end
    subgraph API["Platform API · Python FastAPI"]
        PY["Routers: farmers, advisor, alerts,<br/>vouchers, insurance, payouts,<br/>prices, institution, reports"]
        DEMO["Demo UI /demo"]
        MEM[("In-memory store<br/>seed.py dummy data")]
    end
    subgraph ML["ML precompute · ml/ (planned; mocks today)"]
        GEE["Google Earth Engine<br/>Sentinel-2 · CHIRPS · iSDAsoil"]
        NP["NASA POWER<br/>temperature anomaly"]
        CARDS["Evidence cards<br/>public/cards/{plot_id}.json"]
    end
    subgraph EXT["Planned / mocked"]
        MP["M-Pesa payouts"]
        AUTH["Supabase Auth<br/>replaces X-Role header"]
        SIG["ES256 report signing"]
    end

    HF -- "model files, precached" --> FARM
    NPM -- "ort-wasm copied" --> FARM
    EL -- "mp3 committed" --> FARM
    PC -- "basemap jpg committed" --> FARM
    FARM <--> ENG
    VER -- "re-hash" --> ENG
    FARM -- "POST reports · anon key, insert-only" --> REP
    VER -- "rpc get_report(h)" --> REP
    VER -- "POST site_visit_requests" --> REP
    PY -- "service-role key" --> REP
    DEMO -- "HTTP + X-Role" --> PY
    PY --> MEM
    PY -. "target store" .-> PLAT
    GEE --> CARDS
    NP --> CARDS
    CARDS -. "served with the app" .-> FARM
    PY -. "payouts" .-> MP
    PY -. "auth" .-> AUTH
    REP -. "signature: null today" .-> SIG
```

| Integration | Direction | When | Credentials | Status | Where in code |
|---|---|---|---|---|---|
| Supabase `reports` | Farmer app → Supabase | Runtime, when online (outbox retries) | Anon key; RLS insert only | Live | `app/src/data/reports.ts` |
| Supabase `get_report(h)` | Lender page → Supabase | Runtime | Anon key; security-definer function | Live | `app/src/data/reports.ts`, `schema.sql` |
| Supabase `site_visit_requests` | Lender page → Supabase | Runtime | Anon key; insert only | Live | `app/src/lender/Verify.tsx` |
| Supabase service role | Platform API → Supabase | Runtime | `SUPABASE_SERVICE_ROLE_KEY`, backend only | Live when configured | `backend/agrifarm_api/routers/reports.py` |
| Supabase platform tables | Platform API → Supabase | Runtime | Service role; RLS on, no public policies | Schema ready; API still in memory | `schema_platform.sql`, `backend/agrifarm_api/store.py` |
| Hugging Face | Build → `app/public/models` | npm prebuild | None; pinned revision `ff41770` + SHA-256 | Live | `app/scripts/fetch-models.ts` |
| onnxruntime-web (npm) | `node_modules` → `app/public/ort` | npm prebuild | None | Live | `app/scripts/fetch-models.ts` |
| ElevenLabs TTS | Script → `app/public/audio` | Manual, build time | `ELEVENLABS_API_KEY` | Clips committed | `app/scripts/generate-audio.ts` |
| Microsoft Planetary Computer | Script → `app/public/map` | Manual, build time | None | Scene committed | `app/scripts/fetch-basemap.ts` |
| Vercel | Hosts the PWA and `/verify` | Deploy | Project settings | Live | `app/vercel.json` |
| Google Earth Engine (Sentinel-2, CHIRPS, iSDAsoil) | `ml/` → evidence cards | Offline batch | `EE_PROJECT` + service-account key | Planned; mocks today | `ml/`, `app/src/data/cards.ts` |
| NASA POWER | `ml/` → evidence cards | Offline batch | None | Planned; mocks today | `docs/DATA_SOURCES.md` |
| M-Pesa | Platform API → payee wallets | On payout approval | — | Mock ledger | `backend/agrifarm_api/routers/payments.py` |
| Supabase Auth | Platform API roles | Runtime | — | Planned; `X-Role` header today | `backend/agrifarm_api/auth.py` |
| ES256 report signing | Backend → `integrity.signature` | On sync | `REPORT_SIGNING_PRIVATE_KEY_B64` | Planned; signature is `null` | `backend/engine/index.ts` |
