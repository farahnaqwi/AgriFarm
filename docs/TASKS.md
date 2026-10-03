# Task list

H0 = hackathon start. **Feature freeze H16. Submit by H22.** Product lead can cut scope at any time. ✅ = done.

## Contracts (frozen at H1; change only with a PR that updates mocks + validator)

- `docs/schema.json`: evidence report v1.0.0
- `docs/mocks/*.json`: build against these until H8
- `docs/phrases.json`: the only sentences the app can speak
- `docs/RULES.md`: rule IDs and thresholds

## 1. ML/data lead

| By | Task |
|---|---|
| H1 | Pick 3 real plots in Mbozi (A: open-sun coffee ~2 ha; B: maize ~2 ha; C: small/shaded coffee or cloud-heavy, which must trigger `not_sure`). Send GeoJSON to backend. |
| H4 | GEE pulls per plot: S2 monthly NDVI (2017→now), CHIRPS Nov–Apr totals + 1991–2020 baseline, POWER Tmax anomaly, iSDAsoil. Output = `evidence_summary` block of the schema. Pick Noor's bad-season claim from what CHIRPS **actually** shows. |
| H6 | Labels: ≥ 60 coffee / ≥ 60 maize / ≥ 30 other. Coffee labels independent of NDVI. Geographic block split. |
| H10 | Train classifier (harmonic/seasonal features + logistic regression or gradient boosting; small, explainable). Precompute only, doesn't run on the phone. |
| H14 | Benchmark → `docs/BENCHMARK.md`: held-out accuracy, per-class precision/recall, confusion matrix, accuracy at p ≥ 0.70/0.80, 3 failure examples. ASR WER on 20–50 Common Voice Swahili clips. |
| H16 | Fill every `TBD`/`(verify)` you own in DATA_SOURCES.md. |
| Stretch | Photo crop check (zero-shot small CLIP in browser). First to cut. |

## 2. Frontend/PWA lead

| By | Task |
|---|---|
| H1 | Vite + React + `vite-plugin-pwa`, deployed on Vercel, installable. |
| H3 | **ASR spike** on a real mid-range Android: whisper-tiny via transformers.js. Report load time, latency for 30 s audio, and model MB. Decide the model at H3. |
| H6 | Farmer flow: consent (audio + green/red) → record → ASR → extracted values → **fixed-choice tap confirm** (crop icons; number pad with ekari/hekta toggle) → polygon (GPS walk + draw on S2 RGB overlay) → in-app camera, geofence, turn-around pair → audio review → approve → on-device JCS hash → QR. |
| H8 | Offline: precache shell, model, audio clips, evidence cards, map overlay; IndexedDB for captures. Airplane-mode test #1. |
| H9 | Integration with the backend engine. |
| H16 | Polish and real-phone airplane-mode runs of all 3 farms. |

## 3. Backend/verification lead (you)

| By | Task |
|---|---|
| ✅ H1 | Schema, 2 mocks (validated; hash recomputes; tamper detected), phrases, RULES.md |
| H2 | Repo tooling: `backend/` package, Ajv validator over every JSON in `docs/mocks` + `backend/data`, run in CI on every push |
| H5 | **Engine** (pure JS, no network, runs on the phone): unit normalization, geodesic area, geofence, R-* rules, tier/status aggregation, tally, not_sure. Tests: A → 0 contradicted; B → 2 contradicted; C → not_sure. |
| H7 | Narrative composer: phrase + slot clips, noun-class-aware numbers, R-NARR-01 grounding check. LLM phrasing only if it passes R-NARR-01; otherwise templates. |
| H8 | Seal: JCS + SHA-256 (WebCrypto) on device; `/api/sign` (ES256) + static `/reports/{id}.json`. |
| H9 | E2E integration lead. |
| H14 | Third mock/real report for farm C; tamper demo script. |

## 4. Product/demo lead

| By | Task |
|---|---|
| H1 | Lock the demo script (README). Find a native Tanzanian Swahili reviewer. |
| H4 | Swahili review → ElevenLabs batch from `docs/phrases.json` → `app/public/audio/{sw,en}/{id}.mp3`. |
| H8 | Lender view (static page): scan QR → fetch report → recompute hash → ✅/❌; contradictions first; tier table; NDVI sparkline; rainfall bars; limitations; "Request site visit"; banner for `mock`/`demo` and `not_sure`. |
| H14 | Slides: problem sentence, "why not SMS/spreadsheet/search", guardrails, limits, data sources, "localizing AI means…". |
| H16 | Call feature freeze. Cut list in order: photo crop check → LLM phrasing → GPS walk (keep draw) → NASA POWER → iSDAsoil. **Never cut:** airplane-mode flow, live contradiction, QR verify, limits slide. |
| H18–21 | Record and edit the video (≤ 4:30). Phone screen recording in airplane mode. |
| H22 | Submit. Checklist: repo link, deploy link, video, DATA_SOURCES, LIMITS, BENCHMARK. |

## Open risks (decide at H8)

1. **On-device LLM may not fit a low-end phone.** Fallback: rule-based Swahili slot extraction (crop keywords, numbers, *ekari/hekta*, years). The tap-confirm step makes this safe either way.
2. **Whisper-tiny Swahili WER may be unusable.** Fallback: tap-only capture, with voice kept as a demo of the capability plus the measured WER.
3. **No independent coffee labels** → classifier accuracy can't be claimed honestly. Fallback: report it as a rule-based baseline (dry-season NDVI threshold) and say so.
