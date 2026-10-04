# Known limits (source for the honest-limits slide)

Each limit lists what we do about it and what risk remains. Don't soften these in the video.

| # | Limit | Mitigation | Residual risk |
|---|---|---|---|
| 1 | **GPS spoofing**: mock-location apps can fake position | Turn-around freshness pair, NDVI history must match the claimed crop, pHash duplicate check, polygon-overlap check | A spoofer standing in a *real* coffee field passes. Site visit is the backstop. |
| 2 | **AI-generated / injected photos** | In-app camera only, no gallery; photo is supporting evidence only and can never verify a crop by itself | Rooted phones can inject frames; no C2PA on low-end Android |
| 3 | **Ownership gap**: satellites can't see land rights; much smallholder land is customary and undocumented | Tenure can only be `attested` (co-sign or document); report says `OWNERSHIP_NOT_SHOWN` otherwise | Farmers without a document or co-sign get a weaker report. That reflects a real-world gap our tool doesn't close. |
| 4 | **Local-language coverage**: Swahili ASR on small models mishears; Mbozi's first languages (Nyiha, Nyamwanga) have no usable ASR | Every extracted value is confirmed by fixed-choice tap with audio prompts, so voice is a shortcut, not a dependency | Farmers less fluent in Swahili rely on the tap path and on whoever helps them |
| 5 | **Satellite resolution and clouds** | Rule R-SMALL-01; contradiction needs ≥ 12 cloud-free months | Small, shaded, intercropped, or young coffee → `unverifiable` |
| 6 | **Classifier bias**: labels may over-represent estates | Contradiction threshold 0.80 > consistency 0.70; per-class accuracy reported; block-held-out test | Smallholder coffee may be under-detected, which is why it lands in unverifiable rather than contradicted |
| 7 | **Coarse weather**: CHIRPS ~5 km, POWER ~50 km | Rain can only *support* a bad season, never contradict it; temperature as anomaly only | Very local drought/hail missed |
| 8 | **Unit confusion**: farmers often talk in *ekari* (acres); 5 acres ≈ 2.02 ha | `value_as_spoken` + deterministic conversion; unknown unit → `unit_ambiguous` → not_sure | ASR mishearing *ekari* as *hekta* would produce a false contradiction unless the farmer catches it at the tap-confirm step |
| 9 | **Shared phone**: the smartphone belongs to her 16-year-old daughter | Raw audio deleted after extraction; one-tap delete; consent heard in audio by Noor herself | The daughter mediates, and household power dynamics are outside our control |
| 10 | **No field validation**: not yet tested with real farmers, cooperatives, or lenders | Stated plainly in the video | Every threshold is a hackathon choice |
| 11 | **Out of scope**: harvest price reference (in the brief) | None | Not addressed by this tool |
| 12 | **First install needs a connection**: ~78 MB (app, speech model, voice clips, satellite map) is cached on the first visit | Service-worker precache, once; after that the whole farmer flow runs in airplane mode | A farmer with no data bundle needs the cooperative's wifi (or help) for that first visit |
| 13 | **Speech recognition is Swahili only**; the English interface is for officers and reviewers | The English prompt says "speak in Swahili"; every value can be entered by tap instead | English (or Nyiha/Nyamwanga) answers are not transcribed |
| 14 | **A fingerprint, not a signature**: the SHA-256 in the QR shows the report wasn't edited after approval, not who made it | Evidence checks (satellite, rain, geofenced photos) are what make an invented report fail | No ES256 device signature yet (`signature: null`); a fabricated report sealed honestly still shows "Unaltered", with whatever contradictions the checks find |
| 15 | **The lender page needs internet**, and a report must have been uploaded once | "Not received yet" + retry; the farmer's screen shows the same code as the lender page, to compare by eye | No offline verification for the lender |
