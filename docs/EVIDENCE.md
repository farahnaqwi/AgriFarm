# Demo plot evidence (real data)

The two demo plots carry **real** evidence cards: what the report engine checks a farmer's claims against. The farmers are fictional; the fields and the data are not. Pulled by `app/scripts/fetch-evidence.ts` on 2026-10-04; output `app/src/data/evidence/demo-plots.json`, bundled into the app so it works offline.

## The plots

| Plot | Where | Why this field | Size |
|---|---|---|---|
| `P-MBZ-A101` (Noor, A) | 32.9075 E, 9.0935 S, west of Vwawa, Mbozi | Dark-green block among bare fields in the dry season: a tree crop, the pattern coffee shows | 2.20 ha |
| `P-MBZ-B102` (Farm B) | 32.9158 E, 9.0885 S, 1 km from A | Bare in the dry season, green in the rains: the pattern maize shows | 2.09 ha |

Picked by scanning ~1,000 plot-sized squares around Vwawa on a clear dry-season scene (28 Aug 2025) and a clear rainy-season scene (14 Feb 2025), then checked on the true-colour basemap. **Nobody visited them.** "Coffee" for A is the farmer's claim; the satellite only shows a plant that stays green all year (a woodlot would look similar).

## What was measured

| Evidence | Source | A | B |
|---|---|---|---|
| Monthly greenness (NDVI), Oct 2024 – Sep 2026 | Sentinel-2 L2A, Microsoft Planetary Computer; a month counts only if ≥ 90% of the plot is clear in the scene classification | 24/24 clear months; dry season 0.63–0.83, rainy peak 0.90 | 22/24 clear months; dry season 0.15–0.24, rainy peak 0.78 |
| Crop pattern | A **rule**, not a trained classifier: share of clear dry-season months (Jun–Oct) with NDVI ≥ 0.45 (coffee) or < 0.30 after a rainy-season green-up ≥ 0.55 (seasonal crop) | coffee pattern, 10/10 months | seasonal-crop pattern, 10/10 months |
| Season rainfall, Nov–Apr | CHIRPS v2.0 daily (0.05°, ~5 km), via NASA/USAID SERVIR ClimateSERV; vs 1990/91–2019/20 | 2021/22 +23% · 2022/23 +11% · 2023/24 +20% · 2024/25 −7% · 2025/26 +7% | same CHIRPS cell |
| Season max temperature anomaly | NASA POWER daily T2M_MAX (~50 km) | in the card | in the card |
| Soil, 0–30 cm | ISRIC SoilGrids 2.0 (250 m), model estimate | pH 5.5 | pH 5.5 |

## What it means for the demo

- **A (Noor):** coffee → consistent; 5 acres vs 2.20 ha mapped → consistent. Her "2022 was a bad season" is **not** confirmed: CHIRPS shows 2021/22 was wetter than normal (97th percentile), so the report says rain was normal and points her to the extension officer. Rain can confirm a bad season but never contradict one.
- **B:** "coffee" → **contradicted** (seasonal-crop pattern, 22 clear months); "5 hectares" vs 2.09 ha → **contradicted**; the report suggests a site visit.
- No accuracy is claimed for the crop rule: it has not been tested against labelled fields.

## Licences

Copernicus Sentinel data (free, full and open; "Contains modified Copernicus Sentinel data 2024–2026"). CHIRPS: public domain. NASA POWER: free, cite NASA Langley POWER. SoilGrids: CC BY 4.0, ISRIC.
