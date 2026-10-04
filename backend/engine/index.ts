// Evidence report engine v1. Pure TypeScript, no network: runs on the phone (offline) and in Node.
//   buildReport(capture, evidenceCard) -> Report   (integrity placeholder; nothing is approved yet)
//   seal(report, { baseUrl })          -> Report   (farmer approved: hash + QR payload, on the phone)
// Rules and thresholds: docs/RULES.md. Output: docs/schema.json. Text: docs/phrases.json only.

import type { Capture, Check, Claim, ConfirmedClaim, EvidenceCard, Report, Sentence, CapturePhoto } from "../../app/src/types/index.ts";
import { reportHash } from "./canonical.ts";
import { numberMi, numberN, resetSentenceIds, sentence, tens, unit, year } from "./speech.ts";

export { canonicalJson, reportHash, sha256Hex } from "./canonical.ts";

export const ENGINE_VERSION = "engine-v1";
const HA_PER_ACRE = 0.40468564224;
type NotSureReason = Report["not_sure"]["reasons"][number];
type Status = Claim["status"];

// ---------- geometry (authoritative; the capture-side copy is only for live feedback) ----------
const rad = (d: number) => (d * Math.PI) / 180;
function areaHa(ring: number[][]): number {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) s += rad(ring[i + 1][0] - ring[i][0]) * (2 + Math.sin(rad(ring[i][1])) + Math.sin(rad(ring[i + 1][1])));
  return Math.abs((s * 6378137 * 6378137) / 2) / 10000;
}
function centroid(ring: number[][]): [number, number] {
  const p = ring.slice(0, -1);
  return [+(p.reduce((a, q) => a + q[0], 0) / p.length).toFixed(6), +(p.reduce((a, q) => a + q[1], 0) / p.length).toFixed(6)];
}
function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 2) {
    let x = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

// ---------- aggregation (RULES.md "Aggregation") ----------
function statusOf(checks: Check[]): Status {
  if (checks.some((c) => c.result === "contradicted")) return "contradicted";
  if (checks.some((c) => c.result === "consistent")) return "consistent";
  return "unverifiable";
}
const tierOf = (status: Status, checks: Check[]): Claim["tier"] =>
  status === "consistent" && checks.some((c) => c.result === "consistent") ? "machine_verified" : "self_reported";

const RESULT_PHRASE: Record<Status, string> = { consistent: "RESULT_MACHINE", contradicted: "RESULT_CONTRADICTED", unverifiable: "RESULT_UNVERIFIABLE" };

// ---------- per-field rules ----------
interface Evaluated { checks: Check[]; confidence: number | null; normalized: { value: number; unit: string } | null; lines: Sentence[]; reasons: NotSureReason[] }

function evaluate(c: ConfirmedClaim, plotHa: number, card: EvidenceCard | null): Evaluated {
  const out: Evaluated = { checks: [], confidence: null, normalized: null, lines: [], reasons: [] };
  const ref = [c.claim_id];

  switch (c.field) {
    case "crop_type": {
      const said = { coffee: "CROP_SAID_COFFEE", maize: "CROP_SAID_MAIZE", coffee_banana: "CROP_SAID_COFFEE_BANANA" }[String(c.value)];
      if (said) out.lines.push(sentence(said, ref));
      if (!card) break;
      // R-CROP-01: NDVI classifier vs claimed crop.
      const expected = c.value === "maize" ? "seasonal_crop" : c.value === "other" ? "other" : "coffee";
      const { predicted_class: predicted, probabilities: p } = card.ndvi.classifier;
      const prob = (k: string) => Number((p as Record<string, unknown>)[k] ?? 0);
      const pExpected = prob(expected);
      const pPredicted = predicted === "uncertain" ? 0 : prob(predicted);
      const enoughMonths = card.ndvi.months_cloud_free >= 12;
      let result: Check["result"] = "inconclusive";
      if (predicted === expected && pExpected >= 0.7) result = "consistent";
      else if (predicted !== expected && predicted !== "uncertain" && pPredicted >= 0.8 && enoughMonths) result = "contradicted";
      else out.reasons.push(enoughMonths ? "low_classifier_confidence" : "too_few_cloud_free_months");
      const satPhrase = predicted === "coffee" ? "CROP_SAT_COFFEE" : predicted === "seasonal_crop" ? "CROP_SAT_SEASONAL" : "CROP_SAT_UNSURE";
      out.checks.push({ rule_id: "R-CROP-01", against: "sentinel2_ndvi_classifier", expected, observed: { predicted_class: predicted, p: +(result === "consistent" ? pExpected : pPredicted).toFixed(2) }, result, phrase_id: satPhrase });
      out.confidence = result === "inconclusive" ? null : +(result === "consistent" ? pExpected : pPredicted).toFixed(2);
      out.lines.push(sentence(result === "inconclusive" ? "CROP_SAT_UNSURE" : satPhrase, ref));
      break;
    }
    case "plot_area": {
      const u = c.unit === "acre" || c.unit === "ha" ? c.unit : null;
      const value = Number(c.value);
      if (u) out.lines.push(sentence("AREA_SAID", ref, { unit: unit(u), number: numberN(value) }));
      if (!u) { out.reasons.push("unit_ambiguous"); break; }
      const claimedHa = u === "acre" ? value * HA_PER_ACRE : value;
      out.normalized = { value: +claimedHa.toFixed(2), unit: "ha" };
      // R-AREA-01: claimed vs measured; the map figure is spoken in HER unit so she can compare.
      const ratio = claimedHa / plotHa;
      const result: Check["result"] = ratio >= 0.8 && ratio <= 1.25 ? "consistent" : ratio < 0.67 || ratio > 1.5 ? "contradicted" : "inconclusive";
      out.checks.push({ rule_id: "R-AREA-01", against: "polygon_area", expected: { ha: +claimedHa.toFixed(2) }, observed: { ha: +plotHa.toFixed(2), ratio: +ratio.toFixed(2) }, result, phrase_id: "AREA_MAP" });
      const measuredInHerUnit = u === "acre" ? plotHa / HA_PER_ACRE : plotHa;
      out.lines.push(sentence("AREA_MAP", ref, { unit: unit(u), number: numberN(measuredInHerUnit) }));
      break;
    }
    case "bad_season": {
      const season = String(c.value);
      const harvestYear = Number(season.slice(0, 4)) + 1;
      out.lines.push(sentence("SEASON_SAID", ref, { year: year(harvestYear) }));
      const rain = card?.rainfall.seasons.find((s) => s.season === season);
      if (!rain) break;
      // R-RAIN-01: rain can confirm a bad season, never contradict it (pests, disease, soil...).
      const dry = rain.anomaly_pct <= -15 || rain.percentile <= 20;
      out.checks.push({ rule_id: "R-RAIN-01", against: "chirps_rainfall", expected: "below_normal", observed: { season, anomaly_pct: rain.anomaly_pct, percentile: rain.percentile }, result: dry ? "consistent" : "inconclusive", phrase_id: dry ? "RAIN_DRY" : "RAIN_NORMAL" });
      out.lines.push(dry ? sentence("RAIN_DRY", ref, { percent: tens(rain.anomaly_pct) }) : sentence("RAIN_NORMAL", ref));
      // R-HEAT-01: supporting note only.
      const heat = card?.temperature.seasons.find((s) => s.season === season);
      if (heat && heat.mean_tmax_anomaly_c >= 1.0) out.lines.push(sentence("HEAT_HIGH", ref));
      break;
    }
    case "cooperative_membership_years": {
      const years = Math.round(Number(c.value));
      out.lines.push(years === 1 ? sentence("COOP_SAID_ONE", ref) : sentence("COOP_SAID", ref, { number: numberMi(years) }));
      break;
    }
    case "last_harvest_delivered":
      out.lines.push(sentence("HARVEST_SAID", ref));
      break;
    case "land_tenure":
      // R-TENURE-01: satellites can't see land rights; only a co-sign or document can.
      out.lines.push(sentence("OWNERSHIP_NOT_SHOWN", ref), sentence("OWNERSHIP_HOW", ref));
      break;
    default:
      break;
  }
  return out;
}

// ---------- empty evidence blocks for an unregistered plot (schema-valid, clearly marked) ----------
function noCard(now: string): EvidenceCard {
  const day = now.slice(0, 10);
  const none = "Not available: plot not in the cooperative registry";
  return {
    evidence_card_id: "none",
    computed_at: now,
    ndvi: { source: none, period_start: day, period_end: day, months_total: 0, months_cloud_free: 0, pixels_in_plot: 0, monthly: [], classifier: { model_id: "none", predicted_class: "uncertain", probabilities: { coffee: 0, seasonal_crop: 0, other: 0 }, heldout_accuracy: null, heldout_n_fields: null } },
    rainfall: { source: none, season_window: "Nov-Apr", baseline_period: "1991-2020", seasons: [] },
    temperature: { source: none, seasons: [] },
    soil: { source: none, depth_cm: "0-20" },
  } as EvidenceCard;
}

const LIMITATIONS: Report["limitations"] = ["ownership_not_shown", "gps_can_be_spoofed", "photos_can_be_faked", "rainfall_is_5km_average", "temperature_is_50km_average", "satellite_misses_shaded_or_intercropped_coffee", "soil_values_are_model_estimates", "speech_recognition_can_mishear", "yield_not_measured"];

export async function buildReport(capture: Capture, evidenceCard: EvidenceCard | null, opts: { now?: Date } = {}): Promise<Report> {
  if (!capture.plot || !capture.consent) throw new Error("Capture needs consent and a plot before a report can be built.");
  if (capture.claims.length === 0) throw new Error("Capture needs at least one confirmed claim.");
  resetSentenceIds();
  const now = (opts.now ?? new Date()).toISOString();
  const ring = capture.plot.geometry.coordinates[0] as number[][];
  const plotHa = areaHa(ring);
  const card = evidenceCard;
  const reasons = new Set<NotSureReason>();
  if (!card) reasons.add("plot_not_registered");
  if (card && card.ndvi.pixels_in_plot < 50) reasons.add("plot_too_small_for_satellite");

  const narrative: Sentence[] = [sentence("REVIEW_INTRO", [])];
  const claims: Claim[] = capture.claims.map((c) => {
    const ev = evaluate(c, plotHa, card);
    ev.reasons.forEach((r) => reasons.add(r));
    const status = statusOf(ev.checks);
    const tier = tierOf(status, ev.checks);
    narrative.push(...ev.lines);
    // Close each claim with its verdict, unless the field's own lines already said it.
    if (!["land_tenure", "bad_season"].includes(c.field) || (c.field === "bad_season" && ev.checks.length === 0)) {
      narrative.push(sentence(RESULT_PHRASE[status], [c.claim_id]));
    }
    return {
      claim_id: c.claim_id, field: c.field, value: c.value, unit: c.unit,
      value_as_spoken: c.value_as_spoken ?? null, value_normalized: ev.normalized,
      tier, source: { ...c.source, confirmed_by_farmer: true },
      confidence: ev.confidence, status, checks: ev.checks, attestation_refs: [], timestamp: c.timestamp,
    } as Claim;
  });

  // Photos: geofence was enforced at capture; check duplicates and the turn-around challenge (R-DUP-01, R-FRESH-01).
  const photos = capture.photos.map((p: CapturePhoto, i) => {
    const dup = capture.photos.slice(0, i).find((q) => hamming(q.phash, p.phash) <= 6);
    if (dup) reasons.add("possible_duplicate_photo");
    if (p.freshness && p.freshness.passed === false) reasons.add("freshness_challenge_failed");
    if (!p.inside_plot) reasons.add("photo_outside_plot");
    return { ...p, duplicate_of: dup ? dup.photo_id : null, crop_check: null };
  });
  if (photos.length && photos.every((p) => p.inside_plot)) narrative.push(sentence("PHOTO_INSIDE", []));
  if (reasons.has("possible_duplicate_photo")) narrative.push(sentence("PHOTO_DUPLICATE", []));
  if (card?.soil.ph != null && card.soil.ph < 5.5) narrative.push(sentence("SOIL_ACIDIC", []));
  if (claims.some((c) => c.status === "contradicted")) narrative.push(sentence("SITE_VISIT", []));
  narrative.push(sentence("DISCLAIMER", []));

  const tally = { self_reported: 0, machine_verified: 0, attested: 0, consistent: 0, contradicted: 0, unverifiable: 0 };
  for (const c of claims) { tally[c.tier]++; tally[c.status]++; }

  const meta = capture.plot_meta ?? { country: "ZZ", admin_area: "Unregistered plot" };
  const plotId = capture.plot_id ?? `P-UNREG-${capture.capture_id.slice(0, 6).toUpperCase()}`;
  const mockCard = card?.ndvi.classifier.model_id.endsWith("-mock") ?? false;
  const mode: Report["provenance"]["mode"] = mockCard ? "mock" : capture.demo_farm ? "demo" : "live";
  const ev = card ?? noCard(now);

  const report: Report = {
    schema_version: "1.0.0",
    report_id: `ER-${meta.country}-${plotId.replace(/^P-/, "")}-${now.slice(0, 10).replace(/-/g, "")}-${capture.capture_id.slice(0, 4).toUpperCase()}`,
    created_at: now,
    provenance: {
      mode,
      app_version: ENGINE_VERSION,
      device_id_hash: capture.device_id_hash,
      notes: [
        "Built on the phone from the farmer's confirmed answers.",
        mockCard ? "Satellite and weather values are MOCK (invented) until real evidence cards replace them." : "",
        card?.ndvi.classifier.model_id.includes("rule") ? "The crop check is a transparent rule (does the plot stay green through the dry season?), not a trained classifier." : "",
        !card ? "No evidence card: the plot is not in the cooperative registry, so nothing could be checked against satellite or weather data." : "",
      ].filter(Boolean).join(" "),
    },
    farmer_language: capture.farmer_language,
    farmer: { farmer_id: `F-${capture.device_id_hash.slice(0, 8).toUpperCase()}`, display_name: null, cooperative_name: null },
    consent: { ...capture.consent, reviewed_report_audio: false, approved_for_sharing: false, approved_at: null },
    plot: {
      plot_id: plotId, country: meta.country, admin_area: meta.admin_area,
      geometry: capture.plot.geometry, geometry_source: capture.plot.geometry_source, captured_at: capture.plot.captured_at,
      area_ha: +plotHa.toFixed(2), centroid: centroid(ring),
      overlap: { checked: false, overlapping_plot_count: 0, max_overlap_fraction: 0 }, // needs other farmers' plots (online)
    },
    claims: claims as Report["claims"], // non-empty: checked above
    attestations: [],
    evidence_summary: { ...ev, photos, tally } as Report["evidence_summary"],
    narrative,
    not_sure: reasons.size ? { flag: true, reasons: [...reasons], phrase_id: "NOT_SURE" } : { flag: false, reasons: [], phrase_id: null },
    limitations: LIMITATIONS,
    disclaimer: "This is an evidence report, not proof. It does not approve or refuse a loan. A person makes the decision.",
    human_decision_required: true,
    integrity: { canonicalization: "RFC8785-JCS", hash_alg: "SHA-256", report_hash: "0".repeat(64), hashed_at: now, signature: null, qr_payload: "" },
  };
  return report;
}

/** The farmer tapped "share": record approval, fingerprint the report, build the QR payload. */
export async function seal(report: Report, opts: { baseUrl?: string; now?: Date } = {}): Promise<Report> {
  const approvedAt = (opts.now ?? new Date()).toISOString();
  const sealed: Report = structuredClone(report);
  sealed.consent = { ...sealed.consent, reviewed_report_audio: true, approved_for_sharing: true, approved_at: approvedAt };
  const hash = await reportHash(sealed);
  const base = (opts.baseUrl ?? "https://agrifarm-evidence.vercel.app").replace(/\/+$/, "");
  sealed.integrity = { canonicalization: "RFC8785-JCS", hash_alg: "SHA-256", report_hash: hash, hashed_at: approvedAt, signature: null, qr_payload: `${base}/verify#r=${sealed.report_id}&h=${hash}` };
  return sealed;
}
