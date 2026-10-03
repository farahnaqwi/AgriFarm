# Data sources

Judged criterion (15%): name every dataset, its source, license, and size, and say what it does **not** cover. Every row must be checked by the person who pulls the data: replace `(verify)` and `TBD` with facts, and add initials and a date.

Region: **Mbozi District, Songwe Region, Tanzania** (Southern Highlands arabica belt). Personas are fictional. Demo plots are real fields picked from Sentinel-2 imagery, and no data about the actual landholders is collected.

## Datasets

| Dataset | Used for | Source | License | Size (full / our pull) | What it does NOT cover |
|---|---|---|---|---|---|
| **Sentinel-2 L2A surface reflectance** (B4, B8, SCL) | Monthly NDVI curve per plot; classifier input; true-colour offline basemap | ESA Copernicus via Google Earth Engine `COPERNICUS/S2_SR_HARMONIZED`; 10 m, ~5-day revisit, 2017 onward | Copernicus Sentinel data: free, full and open; attribution "Contains modified Copernicus Sentinel data [years]" (verify wording) | Petabytes / TBD: target < 100 KB NDVI JSON for all plots + < 2 MB RGB overlay | Cloudy months (Dec–Apr rains leave gaps); plots < ~0.5 ha (mixed 10 m pixels); shaded or banana-intercropped coffee; coffee < ~3 yrs old; crop health detail; yield; who owns or farms the land |
| **CHIRPS v2.0** daily precipitation | Seasonal (Nov–Apr) rainfall totals, anomaly vs 1991–2020, percentile | UCSB Climate Hazards Center via GEE `UCSB-CHG/CHIRPS/DAILY`; 0.05° (~5.5 km), 1981–present | Public domain / CC0 waiver per GEE catalog (verify) | ~TBs global / TBD: target < 200 KB (daily series, 3–6 pixels) | Rain differences inside a ~30 km² pixel; hillside/orographic effects; hail and storm timing; irrigation; sparse gauges in Songwe; last few weeks are preliminary |
| **NASA POWER** daily meteorology (T2M_MAX) | Season temperature **anomaly** (supporting note only) | NASA Langley POWER project, Daily API (AG community); MERRA-2 0.5° × 0.625°, 1981–present | Free, no restrictions; cite POWER project (verify citation text) | API / TBD: target < 100 KB | Elevation: one cell spans > 1,000 m of relief, so absolute temps are wrong for a farm at ~1,600 m (we use anomalies only); shade and microclimate; frost pockets; rainfall (CHIRPS covers that) |
| **iSDAsoil v1** (pH, organic carbon, total N; 0–20 cm) | Context only ("why did yields slip?"); never verifies or contradicts a claim | iSDA via GEE `ISDASOIL/Africa/v1/*`; 30 m, Africa | CC BY 4.0 (verify) | ~100s GB / < 5 KB per plot | Current soil state (static model built from legacy samples); lime/fertilizer history; it is a **prediction with error**, not a lab test; variation within 30 m |
| **NDVI crop-type training set** (ours) | Train + held-out test of coffee vs seasonal crop vs other | Our labelled field polygons in Mbozi/Songwe. Coffee labels: TBD, must be **independent of NDVI** (e.g. visible row structure in very-high-res imagery whose license permits labelling, or field-visited points). Maize: ESA WorldCereal 2021 maize product (verify) + visual | Ours: CC BY 4.0 (released in repo) | TBD: target ≥ 60 coffee / ≥ 60 maize / ≥ 30 other fields; per-field monthly NDVI | Labels may skew to large **estates** (open-sun, regular rows) rather than smallholder coffee; other regions, robusta, shaded systems (Kilimanjaro, Kagera); years outside the pull. Split **by geographic block**, not by pixel, or accuracy is inflated. If coffee labels came from NDVI curves, the accuracy is circular. Say so if that happened. |
| ESA WorldCereal 2021 (optional) | Maize label candidates | ESA via Zenodo/GEE | CC BY 4.0 (verify) | TBD | Single year (2021); not validated for Mbozi specifically |
| ESA WorldCover 2021 v200 (optional) | "Other" class negatives (forest, shrub, built) | ESA via GEE `ESA/WorldCover/v200` | CC BY 4.0 | TBD | No crop types |
| Mozilla Common Voice Swahili | ASR word-error-rate test clips | commonvoice.mozilla.org | CC0 | TBD: target 20–50 clips | Read speech by volunteers, not farmers in a field; few Southern Highlands accents |

## Models

| Model | Used for | Source | License | Size on device | What it does NOT cover |
|---|---|---|---|---|---|
| Whisper-tiny (or Swahili fine-tune, TBD after spike) | On-device Swahili speech-to-text | OpenAI / Hugging Face (`onnx-community/whisper-tiny` for transformers.js) (verify) | MIT (fine-tunes: check each) | ~40–75 MB quantized (verify) | High Swahili WER on tiny models; **no coverage of Nyiha/Nyamwanga** (local first languages in Mbozi); noisy outdoor audio |
| MMS-1b-all (rejected for on-device) | Considered for less-supported languages | Meta | **CC BY-NC 4.0**: non-commercial, so a lender can't deploy it | ~4 GB, too large to side-load | Not used. Documented as the answer to "what about a less-supported language" |
| Photo crop check (TBD: zero-shot small CLIP vs fine-tuned MobileNet) | "Does this photo show coffee?" (supporting only) | TBD | TBD | TBD (< 50 MB target) | Close-ups vs whole-plant shots; young coffee; coffee under banana |
| Small LLM (TBD, e.g. Qwen2.5-0.5B-Instruct) | Speech → fixed schema extraction | TBD | Apache-2.0 (verify for chosen model) | TBD | May not run on a low-end phone; output only accepted after farmer tap-confirmation |
| ElevenLabs TTS | Pre-generated Swahili/English phrase clips (build time) | elevenlabs.io | Commercial ToS (verify clip usage rights) | ~60–120 clips, target < 3 MB total | Only the fixed phrase list. **Nothing outside docs/phrases.json can be spoken offline.** |

## Human review

| Item | Reviewer | Date |
|---|---|---|
| Swahili phrases (docs/phrases.json) | TBD: native Tanzanian Swahili speaker | |
| Demo plot selection | ML lead | |
