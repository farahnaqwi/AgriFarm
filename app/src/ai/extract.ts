// OWNER: Sakeet. Rule-based Swahili claim extraction (crop words, numbers, ekari/hekta, years).
//
// CONTRACT
//   extractClaims(transcript: Transcript) -> CandidateClaim[]  (types/index.ts), each:
//   { field, value, unit, value_as_spoken,
//     source: { type: "farmer_voice", ref: "audio:SS.s-SS.s", quote, asr_confidence, confirmed_by_farmer: false } }
// Candidates are NEVER used until the farmer confirms each one by tap (Confirm screen).
// Unknown speech -> return [] and the farmer enters values by tap instead.

import type { CandidateClaim, ClaimField, ClaimUnit, Transcript } from "../types/index.ts";

const UNITS: Record<string, number> = {
  moja: 1, mbili: 2, tatu: 3, nne: 4, tano: 5, sita: 6, saba: 7, nane: 8, tisa: 9,
};
const TENS: Record<string, number> = {
  kumi: 10, ishirini: 20, thelathini: 30, arobaini: 40, hamsini: 50,
  sitini: 60, sabini: 70, themanini: 80, tisini: 90,
};

const isDigits = (w: string) => /^\d+([.]\d+)?$/.test(w);
const isNumWord = (w: string) =>
  isDigits(w) || w in UNITS || w in TENS || w === "mia" || w === "elfu";

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[!?;:"]/g, " ")
    .replace(/[.,](?!\d)/g, " ")
    .split(/\s+/)
    .filter(Boolean);

// Parses Swahili number words starting at index i.
//   "elfu mbili ishirini na mbili" -> 2022
//   "mia sita themanini"           -> 680
//   "kumi na moja"                 -> 11
function parseNumber(t: string[], i: number): { value: number; next: number } | null {
  let total = 0;
  let mult = 1;
  let used = false;
  let j = i;
  for (; j < t.length; j++) {
    const w = t[j];
    if (isDigits(w)) { total += parseFloat(w) * mult; mult = 1; used = true; }
    else if (w === "elfu") { mult = 1000; used = true; }
    else if (w === "mia") { mult = 100; used = true; }
    else if (w in TENS) { total += TENS[w] * mult; mult = 1; used = true; }
    else if (w in UNITS) { total += UNITS[w] * mult; mult = 1; used = true; }
    else if (w === "na" && used && j + 1 < t.length && isNumWord(t[j + 1])) continue;
    else break;
  }
  return used && total > 0 ? { value: total, next: j } : null;
}

const numberAfter = (t: string[], word: string) => {
  const k = t.indexOf(word);
  return k >= 0 ? parseNumber(t, k + 1) : null;
};

export async function extractClaims({ segments }: Transcript): Promise<CandidateClaim[]> {
  const out: CandidateClaim[] = [];

  for (const seg of segments) {
    const t = tokenize(seg.text);
    const has = (...w: string[]) => w.some((x) => t.includes(x));

    const push = (field: ClaimField, value: string | number, unit: ClaimUnit, spoken: string) =>
      out.push({
        field,
        value,
        unit,
        value_as_spoken: spoken,
        source: {
          type: "farmer_voice",
          ref: `audio:${seg.start.toFixed(1)}-${seg.end.toFixed(1)}`,
          quote: seg.text,
          asr_confidence: seg.confidence ?? null,
          confirmed_by_farmer: false,
        },
      });

    const isHarvest = has("kilo");

    // Crop
    if (!isHarvest) {
      if (has("kahawa") && has("ndizi")) push("crop_type", "coffee_banana", null, "kahawa na ndizi");
      else if (has("kahawa")) push("crop_type", "coffee", null, "kahawa");
      else if (has("mahindi")) push("crop_type", "maize", null, "mahindi");
    }

    // Plot area: "ekari tano" / "hekta tano"
    for (const [word, unit] of [["ekari", "acre"], ["hekta", "ha"]] as const) {
      if (!has(word)) continue;
      const after = numberAfter(t, word);
      if (after) {
        const k = t.indexOf(word);
        push("plot_area", after.value, unit, t.slice(k, after.next).join(" "));
      }
    }

    // Harvest delivered: only when she says which kind (maganda = parchment, mbichi = cherry)
    if (isHarvest) {
      const n = numberAfter(t, "kilo");
      const unit: ClaimUnit = has("maganda") ? "kg_parchment" : has("mbichi") ? "kg_cherry" : null;
      if (n && unit) {
        const k = t.indexOf("kilo");
        push("last_harvest_delivered", n.value, unit, t.slice(k, n.next).join(" "));
      }
    }

    // Cooperative membership years: "miaka kumi na moja"
    if (has("miaka") && !isHarvest && !has("mavuno")) {
      const n = numberAfter(t, "miaka");
      if (n && n.value <= 80) {
        const k = t.indexOf("miaka");
        push("cooperative_membership_years", n.value, "years", t.slice(k, n.next).join(" "));
      }
    }

    // Bad season: a year ending the season (2022 -> "2021/22")
    if (has("mvua", "ukame", "mbaya", "chache", "msimu")) {
      for (let i = 0; i < t.length; i++) {
        if (!isNumWord(t[i])) continue;
        const n = parseNumber(t, i);
        if (n && n.value >= 1990 && n.value <= 2100) {
          push("bad_season", `${n.value - 1}/${String(n.value).slice(2)}`, null, t.slice(i, n.next).join(" "));
          break;
        }
        if (n) i = n.next - 1;
      }
    }

    // Land tenure
    if (has("sina", "hakuna") && has("hati")) push("land_tenure", "customary_undocumented", null, "sina hati");
    else if (has("hati")) push("land_tenure", "titled", null, "hati");
    else if (has("urithi")) push("land_tenure", "customary_undocumented", null, "urithi");
    else if (has("kukodi", "nimekodi", "kodi")) push("land_tenure", "leased", null, "kukodi");
  }

  return out;
}
