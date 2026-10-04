# AgriFarm

Hack-Nation × World Bank "Small AI for Development", Challenge 4, Agriculture.

A smallholder coffee farmer speaks for ~2 minutes in Swahili, walks or draws her plot, and takes two photos. The phone, offline, turns that into an **evidence report**. Every line is tagged *self-reported*, *machine-verified* (checked against Sentinel-2, CHIRPS, NASA POWER), or *attested* (co-signed by her cooperative), and anything contradicted or unverifiable is flagged. She listens to the report and decides whether to share it. A loan officer scans a QR code, confirms the report is unaltered, and decides, or requests a site visit.

**It never approves a loan, never claims ownership, and is never called "proof."**

## Try it

- **Farmer app:** https://agrifarm-evidence.vercel.app/?demo=1 (installable PWA; English by default, globe button → Kiswahili; `?demo=1` simulates GPS inside the demo plots). Open it once online (~78 MB cached), then it runs in airplane mode.
- **Lender page** (what the QR opens), demo farm B: https://agrifarm-evidence.vercel.app/verify#r=ER-TZ-MBZ-B002-20261003&h=af4c8a212de357ad9b1ebe0822b5dfff139b7d8cf5778a8dad7a87851bd7c1bf
- **Run it locally:** `cd app && npm install && npm run fetch-models && npm run dev`. Tests: `npm run test:engine`.

**What is real today vs. demo stand-ins** (we don't blur these):

| Real, running | Stand-in or not built |
|---|---|
| On-device speech-to-text in Swahili or English (whisper-tiny, 8-bit, WebAssembly), offline: she speaks the language the app is set to | Farmers are fictional; the two demo fields are real but nobody visited them |
| Swahili and English claim extraction (rules) + tap-to-confirm | Crop check is a transparent **rule** (green through the dry season?), not a trained classifier; no accuracy claimed |
| **Satellite greenness, rainfall, temperature and soil for the two demo plots: real data** (Sentinel-2, CHIRPS, NASA POWER, SoilGrids; [docs/EVIDENCE.md](docs/EVIDENCE.md)) | Other plots get no satellite check ("plot not registered"): only the demo plots have evidence cards |
| Rule engine, report sentences, Swahili/English voice (ElevenLabs clips), SHA-256 seal + QR | Cooperative co-signing: designed in the schema, not built |
| Supabase upload (offline queue), lender page re-hash check, site-visit requests | No digital signature yet (`signature: null`); the fingerprint detects edits, it doesn't prove who made the report |

## Repo

```
app/       PWA: farmer view (offline) + lender view
ml/        Earth Engine pulls, NDVI crop classifier, benchmark
backend/   Cross-check engine, narrative composer, sealing/signing, static reports
docs/      schema.json · mocks/ · phrases.json · RULES.md · DATA_SOURCES.md · LIMITS.md · TASKS.md
```

Contracts: [docs/schema.json](docs/schema.json) · [docs/mocks/](docs/mocks/) · [docs/phrases.json](docs/phrases.json) · [docs/RULES.md](docs/RULES.md). Owners and hours: [docs/TASKS.md](docs/TASKS.md).

Secrets: copy `.env.example` → `.env`. Nothing secret goes in `app/` (anything `VITE_*` ships to the browser).

Speech model: `cd app && npm install && npm run fetch-models` puts whisper-tiny (43.6 MB, hash-checked) in `app/public/models/` and the ONNX runtime in `app/public/ort/`. Both are git-ignored, and `npm run build` fetches them first, on Vercel too. After adding files there, restart `npm run dev` so it serves them.

## Words we don't use

proof, proven, approved, eligible, creditworthy, owner (without attestation), guaranteed, "AI verified".
Use instead: evidence report, consistent / contradicted / could not be checked, a person decides.

## Demo script (target 4:15, hard max 5:00)

**0:00–0:20 · Problem sentence (on screen + voice)**
> Because of this tool, **Noor** will **bring a loan officer an independently checked evidence report about her farm** by **the November input-loan window** that she would otherwise **approach with only her word, or not at all**; we know because **we ran the whole flow end to end on a real phone in airplane mode [add the ASR word-error rate and classifier accuracy only if measured; no invented numbers]**

*(Validate "November input-loan window" with anyone who knows Southern Highlands coffee credit, or drop the date phrase.)*

**0:20–0:55 · What the AI does, and why SMS/spreadsheet/search can't**
- Speech → structured claims in Swahili, on the phone. An SMS form can't take a 2-minute spoken account.
- Crop classifier over 2+ years of satellite NDVI. A spreadsheet can't tell coffee (green all year) from maize (one spike per season) on *her* plot.
- Search has no idea about *her* polygon, *her* claimed bad season, or *her* rainfall.
- Guardrails (one line each): fixed phrase list, so it can't say anything outside it · every number must trace to a structured field · she confirms every value by tap · "not sure → ask a person" · a person always decides.

**0:55–2:40 · End-to-end demo (phone in airplane mode, visible)**
1. Airplane mode on. Open the installed app. Consent in Swahili audio, green tap.
2. Noor (Farm A) speaks: crop, *"ekari tano"*, 11 years in the cooperative, bad season 2022, *"last year the harvest dropped and I don't know why."* Extracted values appear and she taps to confirm.
3. Walk/draw the plot, take a photo inside the plot, then the turn-around photo. Show one rejected photo taken outside the boundary.
4. Report plays in Swahili (or English via the globe button), on **real** satellite and rain data: coffee consistent ✅ (stays green all year), area consistent ✅, co-op membership "not checked: your cooperative can co-sign", **2022 bad season: rain was actually normal (CHIRPS: wetter than usual), so the cause may be pests, disease or soil: ask your extension officer** (this is the "doesn't know why" moment), ownership not shown.
5. She approves → QR.
6. **Live contradiction, Farm B:** says *"hekta tano"* of coffee. Report: area **contradicted** (map ≈ 2 ha), crop **contradicted** (real Sentinel-2: bare every dry season, green in the rains, like maize). Same number word as Noor, different unit, different result.

**2:40–3:20 · Lender view**
- Scan Farm B's QR → "Unaltered" ✅ → contradictions on top → NDVI curve (maize spikes) → "Request site visit".
- Tamper: `cd app && node scripts/tamper-demo.ts "<lender link>"` changes the farm size in the stored copy (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env`), reload → "Does not match" ❌. `--restore` puts it back.

**3:20–3:45 · Where it sits in her day + stack**
- Evening at home on her daughter's phone, no data needed. Evidence cards are refreshed when someone at the cooperative office has a connection.
- Stack: PWA (Vite/React/TypeScript, Workbox service worker, IndexedDB) · on-device ASR (transformers.js + ONNX Runtime Web) · deterministic TypeScript rule engine · SHA-256 fingerprint in the QR · Supabase · Vercel. Evidence cards are precomputed per plot (real Sentinel-2/CHIRPS/NASA POWER/SoilGrids for the demo plots, `app/scripts/fetch-evidence.ts`).

**3:45–4:00 · Honest limits** (from [docs/LIMITS.md](docs/LIMITS.md)): GPS spoofing, fake photos, ownership gap, language coverage, no field validation yet.

**4:00–4:15 · "What does localizing AI development mean to us?"**
Draft: *It means the hard part isn't the model. It's that "tano" means 2 hectares to one farmer and 5 to another, that numbers change form with the noun, and that the most honest thing a small model can say is "I'm not sure, ask a person." Local means building around the farmer's words, units, and people, not just translating the interface.*

## Demo farms

Region: Mbozi District, Songwe Region, Tanzania. Personas are fictional, plots are real fields (see [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md)).

| Farm | Purpose | Data |
|---|---|---|
| A, Noor | Mostly consistent; a bad season the rain record doesn't explain → extension officer | Real plot `P-MBZ-A101` ([docs/EVIDENCE.md](docs/EVIDENCE.md)); contract example [report-farm-a-consistent.json](docs/mocks/report-farm-a-consistent.json) |
| B | Live contradiction (5 ha coffee claimed; ~2 ha seasonal-crop plot) | Real plot `P-MBZ-B102`; contract example [report-farm-b-contradiction.json](docs/mocks/report-farm-b-contradiction.json) |
| C | Fail-safe: small/shaded plot → `not_sure` → ask a person | TBD (backend, H14) |
