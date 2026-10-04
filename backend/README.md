# backend/

Owner: Farah (report engine). v1 written by Nick so the app works for any farmer's real input; extend it here.

- `engine/index.ts`: `buildReport(capture, evidenceCard)` and `seal(report, { baseUrl })`. Pure TypeScript, no network:
  runs on the phone offline (imported by `app/src/engine.ts`) and in Node.
- `engine/speech.ts`: report sentences from `docs/phrases.json` only (fixed list), with Swahili number agreement and clip IDs.
- `engine/canonical.ts`: canonical JSON + SHA-256 (`reportHash`). The lender page uses the same function to detect edits.

Rules and thresholds: `../docs/RULES.md`. Output contract: `../docs/schema.json`.
Tests: `cd app && npm run test:engine` (schema validation + every rule + sealing + tamper detection).
