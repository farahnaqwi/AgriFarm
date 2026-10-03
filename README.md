# AgriFarm

Hack-Nation × World Bank "Small AI for Development", Challenge 4, Agriculture.

A smallholder coffee farmer speaks for ~2 minutes in Swahili, walks or draws her plot, and takes two photos. The phone, offline, turns that into an **evidence report**. Every line is tagged *self-reported*, *machine-verified* (checked against Sentinel-2, CHIRPS, NASA POWER), or *attested* (co-signed by her cooperative), and anything contradicted or unverifiable is flagged. She listens to the report and decides whether to share it. A loan officer scans a QR code, confirms the report is unaltered, and decides, or requests a site visit.

**It never approves a loan, never claims ownership, and is never called "proof."**

## Repo

```
app/       PWA: farmer view (offline) + lender view
ml/        Earth Engine pulls, NDVI crop classifier, benchmark
backend/   Cross-check engine, narrative composer, sealing/signing, static reports
docs/      schema.json · mocks/ · phrases.json · RULES.md · DATA_SOURCES.md · LIMITS.md · TASKS.md
```

Contracts: [docs/schema.json](docs/schema.json) · [docs/mocks/](docs/mocks/) · [docs/phrases.json](docs/phrases.json) · [docs/RULES.md](docs/RULES.md). Owners and hours: [docs/TASKS.md](docs/TASKS.md).

Secrets: copy `.env.example` → `.env`. Nothing secret goes in `app/` (anything `VITE_*` ships to the browser).

## Words we don't use

proof, proven, approved, eligible, creditworthy, owner (without attestation), guaranteed, "AI verified".
Use instead: evidence report, consistent / contradicted / could not be checked, a person decides.

## Demo script (target 4:15, hard max 5:00)

**0:00–0:20 · Problem sentence (on screen + voice)**
> Because of this tool, **Noor** will **bring a loan officer an independently checked evidence report about her farm** by **the November input-loan window** that she would otherwise **approach with only her word, or not at all**; we know because **[EVIDENCE: fill at H16 with measured results: classifier held-out accuracy on N fields, end-to-end airplane-mode run on a real phone, and any cooperative/lender feedback. No invented numbers.]**

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
4. Report plays in Swahili (subtitles in English): coffee consistent ✅, area consistent ✅, coop attested 🤝, 2022 drought confirmed ✅, **2025 drop: rain was normal, so ask your extension officer; soil looks acidic** (this is the "doesn't know why" moment), ownership not shown.
5. She approves → QR.
6. **Live contradiction, Farm B:** says *"hekta tano"* of coffee. Report: area **contradicted** (map ≈ 2 ha), crop **contradicted** (satellite looks like maize). Same number word as Noor, different unit, different result.

**2:40–3:20 · Lender view**
- Scan Farm B's QR → "Unaltered" ✅ → contradictions on top → NDVI curve (maize spikes) → "Request site visit".
- Edit one value in the JSON, reload → "Does not match" ❌.

**3:20–3:45 · Where it sits in her day + stack**
- Evening at home on her daughter's phone, no data needed. Evidence cards are refreshed when someone at the cooperative office has a connection.
- Stack: PWA (Vite/React, service worker, IndexedDB) · on-device ASR (transformers.js) · deterministic JS rule engine · Earth Engine precompute · Vercel static hosting · ES256 signing.

**3:45–4:00 · Honest limits** (from [docs/LIMITS.md](docs/LIMITS.md)): GPS spoofing, fake photos, ownership gap, language coverage, no field validation yet.

**4:00–4:15 · "What does localizing AI development mean to us?"**
Draft: *It means the hard part isn't the model. It's that "tano" means 2 hectares to one farmer and 5 to another, that numbers change form with the noun, and that the most honest thing a small model can say is "I'm not sure, ask a person." Local means building around the farmer's words, units, and people, not just translating the interface.*

## Demo farms

Region: Mbozi District, Songwe Region, Tanzania. Personas are fictional, plots are real fields (see [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md)).

| Farm | Purpose | Mock |
|---|---|---|
| A, Noor | Mostly consistent; one unexplained yield drop → extension officer | [report-farm-a-consistent.json](docs/mocks/report-farm-a-consistent.json) |
| B | Live contradiction (5 ha coffee claimed; ~2 ha maize plot) | [report-farm-b-contradiction.json](docs/mocks/report-farm-b-contradiction.json) |
| C | Fail-safe: small/shaded plot → `not_sure` → ask a person | TBD (backend, H14) |
