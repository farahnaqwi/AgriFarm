# backend/

Owner: Farah (report engine). v1 written by Nick so the app works for any farmer's real input; extend it here.

- `engine/index.ts`: `buildReport(capture, evidenceCard)` and `seal(report, { baseUrl })`. Pure TypeScript, no network:
  runs on the phone offline (imported by `app/src/engine.ts`) and in Node.
- `engine/speech.ts`: report sentences from `docs/phrases.json` only (fixed list), with Swahili number agreement and clip IDs.
- `engine/canonical.ts`: canonical JSON + SHA-256 (`reportHash`). The lender page uses the same function to detect edits.

Rules and thresholds: `../docs/RULES.md`. Output contract: `../docs/schema.json`.
Tests: `cd app && npm run test:engine` (schema validation + every rule + sealing + tamper detection).

## Python platform API (`agrifarm_api/`)

FastAPI backend for the wider platform. Evidence reports use the live Supabase tables; everything else runs on **dummy data** (Mbozi, Tanzania; see `agrifarm_api/seed.py`) held in memory, so a restart or `POST /demo/reset` restores it.

```powershell
cd backend
python -m venv .venv; .venv\Scripts\activate; pip install -r requirements.txt   # once
uvicorn main:app --reload          # then open http://127.0.0.1:8000/docs
python -m pytest -q                # tests
```

| Area | Endpoints |
|---|---|
| Farmer ID & plots | `POST /farmers`, `GET /farmers/{id}`, `POST /farmers/{id}/plots`, `PUT .../consent`, `DELETE /farmers/{id}` |
| Voice advisor | `POST /advisor/ask`, `/advisor/escalations` (extension officer) |
| Satellite alerts | `GET /alerts`, `GET /alerts/plots/{plot_id}?month=` |
| E-vouchers | `POST /vouchers/issue`, `POST /vouchers/redeem`, `GET /vouchers`, `/vouchers/flags` |
| Parametric insurance | `GET /insurance/policies`, `GET /insurance/index/{ward}`, `POST /insurance/evaluate` |
| Payments (mock) | `GET /payouts`, `POST /payouts/{id}/approve` / `reject`, `GET /wallets/{id}` |
| Market prices | `GET /prices`, `POST /prices/check-offer` |
| Evidence reports (Supabase) | `POST /reports`, `GET /reports/{hash}`, `POST /reports/{hash}/site-visit` |
| Institution | `/institution/registry.geojson`, `/targeting`, `/delivery`, `/impact`, `/climate`, `/disasters/{id}/affected`, `/disasters/{id}/propose-relief` |

Guardrails built into the API:
- **A person decides.** Insurance, relief and dealer reimbursements are proposals; money moves only on `POST /payouts/{id}/approve` with `X-Role: program_officer`. Demo roles come from the `X-Role` header (swap for Supabase Auth).
- **Not sure, not guessing.** The advisor only answers from the fixed list in `knowledge_base.py` and escalates weak matches to an extension officer; alerts return `not_sure` on cloudy images; price checks report the gap and never say sell.
- **Consent.** Institutions see pseudonymous IDs only, and only for farmers who opted in; withdrawal erases name and plot shapes.
- **No invented numbers.** `water_saved` is `null` (not measured); the impact view carries a not-causal caveat.
- The cross-check rules stay in the TS engine; Python does not re-judge or re-hash reports.
- Advisor text is demo content pending agronomist and native-speaker review.
