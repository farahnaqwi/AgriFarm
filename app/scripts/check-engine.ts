/// <reference types="node" />
// Engine checks: `npm run test:engine`. Builds reports from captures reconstructed from the two demo farms
// (plus an unregistered plot and an edited answer), validates every report against docs/schema.json,
// and asserts the rule outcomes from docs/RULES.md, sealing, and tamper detection.

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../../docs/schema.json" with { type: "json" };
import mockA from "../../docs/mocks/report-farm-a-consistent.json" with { type: "json" };
import mockB from "../../docs/mocks/report-farm-b-contradiction.json" with { type: "json" };
import phrases from "../../docs/phrases.json" with { type: "json" };
import { buildReport, seal, reportHash } from "../../backend/engine/index.ts";
import { englishClips } from "../src/lib/clips.ts";
import evidence from "../src/data/evidence/demo-plots.json" with { type: "json" };
import type { Capture, EvidenceCard, Report } from "../src/types/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: false });
(addFormats as unknown as (a: Ajv2020) => void)(ajv);
const validate = ajv.compile(schema);

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
};

type Mock = typeof mockA;
function captureFrom(m: Mock, overrides: Partial<Capture> = {}): Capture {
  return {
    capture_id: "0f1e2d3c-test",
    farmer_language: "sw",
    device_id_hash: m.provenance.device_id_hash,
    demo_farm: null,
    plot_id: m.plot.plot_id,
    plot_meta: { country: m.plot.country, admin_area: m.plot.admin_area },
    consent: { given: true, recorded_at: m.consent.recorded_at, method: "tap", phrase_id: "CONSENT_ASK", scope: m.consent.scope as Capture["consent"] extends infer C ? C extends { scope: infer S } ? S : never : never, raw_audio_retention: "deleted_after_extraction" },
    claims: m.claims.map((c) => ({ claim_id: c.claim_id, field: c.field, value: c.value, unit: c.unit, value_as_spoken: c.value_as_spoken, source: c.source, timestamp: c.timestamp })) as Capture["claims"],
    plot: { geometry: m.plot.geometry, geometry_source: m.plot.geometry_source, captured_at: m.plot.captured_at } as Capture["plot"],
    photos: m.evidence_summary.photos.map((p) => ({ ...p, demo: true })) as unknown as Capture["photos"],
    ...overrides,
  };
}
const cardFrom = (m: Mock) => {
  const { photos: _p, tally: _t, ...card } = m.evidence_summary;
  return card as unknown as EvidenceCard;
};
const byField = (r: Report, field: string, value?: string | number) => r.claims.find((c) => c.field === field && (value === undefined || c.value === value))!;
function valid(label: string, r: Report) {
  const ok = validate(r) as boolean;
  check(`${label}: matches docs/schema.json`, ok, JSON.stringify(validate.errors?.slice(0, 3)));
}

// 0) The canonical hash reproduces the hashes baked into the mocks.
check("canonical hash reproduces mock A", (await reportHash(mockA)) === mockA.integrity.report_hash);
check("canonical hash reproduces mock B", (await reportHash(mockB)) === mockB.integrity.report_hash);

// 1) Noor (farm A): coffee on 5 acres ≈ her 2.09 ha polygon; 2021/22 drought confirmed; 2024/25 rain normal.
const a = await buildReport(captureFrom(mockA as Mock), cardFrom(mockA as Mock));
valid("Noor", a);
check("Noor: crop coffee → consistent, machine-verified", byField(a, "crop_type").status === "consistent" && byField(a, "crop_type").tier === "machine_verified");
check("Noor: 5 ekari vs 2.09 ha → consistent", byField(a, "plot_area").status === "consistent");
check("Noor: 2021/22 bad season → confirmed by rain", byField(a, "bad_season", "2021/22").status === "consistent");
check("Noor: 2024/25 normal rain → unverifiable, never contradicted", byField(a, "bad_season", "2024/25").status === "unverifiable");
check("Noor: land tenure → never machine-verified", byField(a, "land_tenure").tier !== "machine_verified");
check("Noor: report says ownership not shown", a.narrative.some((s) => s.phrase_id === "OWNERSHIP_NOT_SHOWN"));
check("Noor: acidic soil context line", a.narrative.some((s) => s.phrase_id === "SOIL_ACIDIC"));
check("Noor: map area spoken in HER unit (ekari)", a.narrative.some((s) => s.phrase_id === "AREA_MAP" && s.audio_clips.includes("U_ACRE")));
check("Noor: no contradictions, no not-sure flag", a.evidence_summary.tally.contradicted === 0 && !a.not_sure.flag);
check("Noor: mock evidence → provenance says mock", a.provenance.mode === "mock");

// 2) Farm B: 5 hectares of "coffee" on a ~2 ha maize plot.
const b = await buildReport(captureFrom(mockB as unknown as Mock), cardFrom(mockB as unknown as Mock));
valid("Farm B", b);
check("Farm B: crop coffee vs maize curve → contradicted", byField(b, "crop_type").status === "contradicted");
check("Farm B: 5 ha vs 2.05 ha → contradicted", byField(b, "plot_area").status === "contradicted");
check("Farm B: normal-rain bad season → unverifiable", byField(b, "bad_season").status === "unverifiable");
check("Farm B: suggests a site visit", b.narrative.some((s) => s.phrase_id === "SITE_VISIT"));

// 3) Her real answers drive the report: change the area to 3 ekari (1.21 ha vs 2.09 ha → contradicted).
const edited = captureFrom(mockA as Mock);
edited.claims = edited.claims.map((c) => (c.field === "plot_area" ? { ...c, value: 3, source: { ...c.source, type: "farmer_tap" } } : c)) as Capture["claims"];
const e = await buildReport(edited, cardFrom(mockA as Mock));
check("Edited answer: 3 ekari is what the report says", e.narrative.some((s) => s.phrase_id === "AREA_SAID" && s.audio_clips.includes("N_3")));
check("Edited answer: 3 ekari vs 2.09 ha → contradicted", byField(e, "plot_area").status === "contradicted");

// 4) Unregistered plot: no evidence card → nothing machine-verified, fail-safe raised.
const u = await buildReport(captureFrom(mockA as Mock, { plot_id: null, plot_meta: null }), null);
valid("Unregistered", u);
check("Unregistered: not-sure flag with plot_not_registered", u.not_sure.flag && u.not_sure.reasons.includes("plot_not_registered"));
check("Unregistered: area still checked against her own polygon", byField(u, "plot_area").status === "consistent");
check("Unregistered: crop cannot be verified", byField(u, "crop_type").status === "unverifiable");

// 5) Sealing on the phone + tamper detection.
const s = await seal(a, { baseUrl: "https://agrifarm-evidence.vercel.app/" });
valid("Sealed", s);
check("Sealed: approval recorded", s.consent.approved_for_sharing && !!s.consent.approved_at);
check("Sealed: hash recomputes", (await reportHash(s)) === s.integrity.report_hash);
check("Sealed: QR carries id + hash", s.integrity.qr_payload === `https://agrifarm-evidence.vercel.app/verify#r=${s.report_id}&h=${s.integrity.report_hash}`);
const tampered = structuredClone(s);
(tampered.claims[1] as { value: unknown }).value = 2;
check("Tampering with one value changes the hash", (await reportHash(tampered)) !== s.integrity.report_hash);

// 6) Every clip the engine asks for exists (so any answer in range is spoken, not silent).
const { existsSync } = await import("node:fs");
const clips = new Set([a, b, e, u].flatMap((r) => r.narrative.flatMap((x) => x.audio_clips)));
const missing = [...clips].filter((id) => !existsSync(new URL(`../public/audio/sw/${id}.mp3`, import.meta.url)));
check(`All ${clips.size} clips the engine used exist`, missing.length === 0, missing.join(", "));

// 7) The same sentences in English: clips reordered to English word order ("5 acres"), all generated.
const EN = new Map((phrases.phrases as { id: string; en?: string }[]).map((p) => [p.id, p.en ?? ""]));
const enClips = new Set([a, b, e, u].flatMap((r) => r.narrative.flatMap((x) => englishClips(x.audio_clips, EN.get(x.phrase_id ?? "") ?? ""))));
const enMissing = [...enClips].filter((id) => !existsSync(new URL(`../public/audio/en/${id}.mp3`, import.meta.url)));
check(`All ${enClips.size} English clips exist`, enMissing.length === 0, enMissing.join(", "));
const areaSaid = a.narrative.find((x) => x.phrase_id === "AREA_SAID")!;
check("English word order: number before unit", englishClips(areaSaid.audio_clips, EN.get("AREA_SAID")!).join() === "AREA_SAID,N_5,U_ACRE");

// 8) The demo plots with REAL evidence (Sentinel-2, CHIRPS, NASA POWER, SoilGrids; scripts/fetch-evidence.ts).
const realPlot = (key: "A" | "B") => evidence.plots.find((p) => p.key === key)!;
const realCapture = (m: Mock, key: "A" | "B"): Capture => {
  const p = realPlot(key);
  return captureFrom(m, { demo_farm: key, plot_id: p.plot_id, plot_meta: { country: p.country, admin_area: p.admin_area },
    plot: { geometry: { type: "Polygon", coordinates: [p.ring] }, geometry_source: "gps_walk", captured_at: m.plot.captured_at } as unknown as Capture["plot"] });
};
const realCard = (key: "A" | "B") => (evidence.cards as unknown as Record<string, EvidenceCard>)[realPlot(key).plot_id];
const ra = await buildReport(realCapture(mockA as Mock, "A"), realCard("A"));
valid("Real A", ra);
check("Real A: real data → provenance says demo, not mock", ra.provenance.mode === "demo");
check("Real A: stays green in the dry season → coffee consistent", byField(ra, "crop_type").status === "consistent");
check("Real A: 5 ekari vs the real plot → consistent", byField(ra, "plot_area").status === "consistent");
check("Real A: a bad season the rain record doesn't show → unverifiable, never contradicted", byField(ra, "bad_season", "2021/22").status !== "contradicted");
const rb = await buildReport(realCapture(mockB as unknown as Mock, "B"), realCard("B"));
valid("Real B", rb);
check("Real B: bare in the dry season → coffee contradicted", byField(rb, "crop_type").status === "contradicted");
check("Real B: 5 ha vs the real ~2 ha plot → contradicted", byField(rb, "plot_area").status === "contradicted");
check("Real B: suggests a site visit", rb.narrative.some((s) => s.phrase_id === "SITE_VISIT"));

// 9) English answers (a farmer speaking English with the app in English).
const { extractClaimsEnglish } = await import("../src/ai/extract-en.ts");
const en = async (text: string) => extractClaimsEnglish({ text, segments: [{ start: 0, end: 5, text, confidence: null }] });
const got = async (text: string, field: string) => (await en(text)).filter((c) => c.field === field).map((c) => `${c.value}${c.unit ? ` ${c.unit}` : ""}`).join(", ");
const cases: [string, string, string][] = [
  ["I grow coffee.", "crop_type", "coffee"],
  ["We grow coffee and bananas together.", "crop_type", "coffee_banana"],
  ["My farm is five acres.", "plot_area", "5 acre"],
  ["The farm is 2.5 hectares.", "plot_area", "2.5 ha"],
  ["It is five and a half acres.", "plot_area", "5.5 acre"],
  ["I have been a member of the cooperative for eleven years.", "cooperative_membership_years", "11 years"],
  ["In 2022 the rains were very poor.", "bad_season", "2021/22"],
  ["Twenty twenty-two was a bad season.", "bad_season", "2021/22"],
  ["Last year the harvest dropped and I don't know why.", "bad_season", "2024/25"],
  ["I delivered 680 kilos of parchment coffee.", "last_harvest_delivered", "680 kg_parchment"],
  ["The land is inherited, I have no title.", "land_tenure", "customary_undocumented"],
  ["I have a title deed for my farm.", "land_tenure", "titled"],
];
for (const [text, field, want] of cases) { const g = await got(text, field); check(`English: "${text}" -> ${field} ${want}`, g === want, `got "${g}"`); }
check("English: a harvest sentence is not a crop claim", (await got("I delivered 680 kilos of parchment coffee.", "crop_type")) === "");

console.log(failed ? `\n${failed} check(s) failed` : "\nAll engine checks passed");
process.exit(failed ? 1 : 0);
