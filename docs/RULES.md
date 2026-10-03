# Cross-check rules (deterministic, not AI)

Owner: backend/verification lead. The engine is a pure JS module with no network access, so it runs offline on the phone and again on the server. Thresholds are hackathon choices. Tune them against the benchmark and record every change here.

| Rule | Checks | Consistent | Contradicted | Otherwise |
|---|---|---|---|---|
| R-AREA-01 | Claimed area (normalized to ha) vs geodesic polygon area | ratio claimed/measured in [0.80, 1.25] | ratio < 0.67 or > 1.50 | unverifiable; `unit_ambiguous` if the unit wasn't heard |
| R-CROP-01 | Claimed crop vs NDVI classifier | same class, p ≥ 0.70 | different class, p ≥ **0.80**, and ≥ 12 cloud-free months | unverifiable + not_sure `low_classifier_confidence` |
| R-CROP-02 | Claimed crop vs photo crop check | ≥1 photo `coffee` p ≥ 0.70 and none `not_coffee` | **never on its own** (supporting evidence only) | inconclusive |
| R-RAIN-01 | Claimed bad season vs CHIRPS Nov–Apr total | anomaly ≤ −15% or percentile ≤ 20 | **never**: normal rain doesn't disprove a bad harvest (pests, disease, soil) | unverifiable + phrase `RAIN_NORMAL` |
| R-HEAT-01 | Season Tmax anomaly (NASA POWER) | adds `HEAT_HIGH` if ≥ +1.0 °C | never | none |
| R-TENURE-01 | Land tenure | only via co-sign or document → `attested` | never | self_reported + `OWNERSHIP_NOT_SHOWN` (schema forbids `machine_verified`) |
| R-GEO-01 | Photo inside polygon | inside, buffer = max(10 m, GPS accuracy) | photo rejected at capture (`CAPTURE_OUTSIDE`) | none |
| R-FRESH-01 | Turn-around pair | heading delta 120–240°, ≤ 60 s apart | none | not_sure `freshness_challenge_failed` |
| R-DUP-01 | pHash vs every stored photo | Hamming > 6 | none | not_sure `possible_duplicate_photo` |
| R-OVL-01 | Polygon vs other farmers' polygons | overlap ≤ 10% | none | not_sure `plot_overlaps_other_plot` |
| R-SMALL-01 | Plot size vs 10 m pixels | ≥ 50 pixels inside polygon | none | not_sure `plot_too_small_for_satellite` |
| R-NARR-01 | Every number in a narrative sentence | equals a value in its `claim_refs`/evidence, after documented rounding (area 0.5, percent 10, season→harvest year) | none | **sentence dropped**, template fallback |

## Aggregation

- **Claim status:** `contradicted` if any check is contradicted. Otherwise `consistent` if at least one check is consistent or an attestation covers the claim. Otherwise `unverifiable`.
- **Tier precedence:** `attested` > `machine_verified` > `self_reported`. `machine_verified` requires `consistent` (enforced in the schema). An attested claim *can* be contradicted, and that combination is shown to the lender as a red flag.
- **Unconfirmed values:** if the farmer didn't confirm a value by fixed-choice tap, it never enters a report (schema rejects `confirmed_by_farmer: false`).
- **not_sure.flag** is true if any reason fires. The farmer hears `NOT_SURE` before `SHARE_ASK`, and the lender sees the banner and the site-visit button first.

## Fairness note

The 0.80 contradiction threshold is deliberately higher than the 0.70 consistency threshold. A false "contradicted" harms a farmer more than a false "unverifiable" harms a lender. Shaded or intercropped smallholder coffee is the most likely false-negative, so it should land in `unverifiable`, not `contradicted`.
