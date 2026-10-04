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
  // Noun-class agreement forms used with "miaka" (years): miaka mitatu = 3 years
  mmoja: 1, miwili: 2, mitatu: 3, minne: 4, mitano: 5, minane: 8,
};
const TENS: Record<string, number> = {
  kumi: 10, ishirini: 20, thelathini: 30, arobaini: 40, hamsini: 50,
  sitini: 60, sabini: 70, themanini: 80, tisini: 90,
};

const isDigits = (w: string) => /^\d+([.]\d+)?$/.test(w);
const isNumWord = (w: string) =>
  isDigits(w) || w in UNITS || w in TENS || w === "mia" || w === "elfu";

// ---- Cleaning up speech-recognition output ----

// Other words farmers (or the speech model) use for the same unit.
const ALIASES: Record<string, string> = {
  heka: "ekari", eka: "ekari", acre: "ekari", acres: "ekari",
  hektari: "hekta", hectare: "hekta", hectares: "hekta",
  kilogramu: "kilo", kg: "kilo",
};

// Words worth correcting when misheard by one letter (e.g. "tanu" -> "tano").
const FUZZY_TARGETS = [
  ...Object.keys(UNITS), ...Object.keys(TENS),
  "ekari", "hekta", "kahawa", "mahindi", "maganda",
].filter((w) => w.length >= 4);

// Common words that are one letter away from a target and must never be "corrected"
// (sasa~saba, nani~nane, hata~hati, kila~kilo, mwaka~miaka).
// "mwaka jana" = last year. Fixed for the demo: calendar year 2025 -> season 2024/25 (Nov 2024 - Apr 2025).
const LAST_YEAR = 2025;

const NEVER_FUZZ = new Set(["sasa", "nani", "hata", "kila", "tena", "sana", "mwaka", "miaka", "kama", "hapa", "bado", "jana"]);

// Unit words the speech model sometimes glues to the following number ("ekaritanu").
const GLUED_PREFIXES = ["ekari", "hekta", "miaka", "kilo"];

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

// vowelSwapCost < 1 makes o<->u, e<->i swaps (common speech-recognition slips) count as more likely.
function editDistance(a: string, b: string, vowelSwapCost = 1): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const x = a[i - 1], y = b[j - 1];
      const sub = x === y ? 0 : VOWELS.has(x) && VOWELS.has(y) ? vowelSwapCost : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + sub);
    }
  return d[a.length][b.length];
}

// Correct a word only when exactly one known word is the clear best match within one edit.
// If two candidates are equally likely (a tie), leave the word alone: no guess, the farmer taps instead.
const nearest = (w: string): string => {
  if (w.length < 4 || NEVER_FUZZ.has(w) || isNumWord(w) || FUZZY_TARGETS.includes(w)) return w;
  const candidates = FUZZY_TARGETS.filter((k) => editDistance(w, k) === 1);
  if (candidates.length === 0) return w;
  const scored = candidates
    .map((k) => ({ k, cost: editDistance(w, k, 0.5) }))
    .sort((p, q) => p.cost - q.cost);
  if (scored.length > 1 && scored[0].cost === scored[1].cost) return w;
  return scored[0].k;
};

// Split "ekaritanu" into ["ekari", "tano"], but only when the rest is really a number word.
const splitGlued = (w: string): string[] => {
  for (const p of GLUED_PREFIXES) {
    if (w.startsWith(p) && w.length > p.length) {
      const rest = nearest(w.slice(p.length));
      if (isNumWord(rest)) return [p, rest];
    }
  }
  return [w];
};

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[!?;:"]/g, " ")
    .replace(/[.,](?!\d)/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ALIASES[w] ?? w)
    .flatMap(splitGlued)
    .map(nearest);

// ---- Number parsing ----

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
  if (k < 0) return null;
  // Allow one short junk token between the unit and the number ("ekari di tano").
  return parseNumber(t, k + 1) ?? ((t[k + 1]?.length ?? 9) <= 2 ? parseNumber(t, k + 2) : null);
};

// Number words, longest first, for matching inside text with the spaces removed.
const NUMBER_WORDS = [...Object.keys(UNITS), ...Object.keys(TENS), "mia", "elfu", "na"]
  .sort((a, b) => b.length - a.length);

// "ekari tano" / "ekaritano" / "ekarita no" -> 5. Ignores where the speech model put spaces.
function looseNumberAfter(text: string, unitWord: string): number | null {
  const s = text.toLowerCase().replace(/[^a-z]/g, "");
  const k = s.indexOf(unitWord);
  if (k < 0) return null;
  let i = k + unitWord.length;
  const words: string[] = [];
  while (i < s.length) {
    const w = NUMBER_WORDS.find((n) => s.startsWith(n, i));
    if (!w) break;
    words.push(w);
    i += w.length;
  }
  while (words.length && words[words.length - 1] === "na") words.pop();
  const n = parseNumber(words, 0);
  return n ? n.value : null;
}

// ---- Claim extraction ----

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

    // Plot area: "ekari tano" / "hekta tano"; falls back to ignoring spaces ("ekarita no").
    for (const [word, unit] of [["ekari", "acre"], ["hekta", "ha"]] as const) {
      const after = has(word) ? numberAfter(t, word) : null;
      if (after) {
        const k = t.indexOf(word);
        push("plot_area", after.value, unit, t.slice(k, after.next).join(" "));
      } else {
        const loose = looseNumberAfter(seg.text, word);
        if (loose !== null) push("plot_area", loose, unit, seg.text);
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

    // Cooperative membership years: "miaka kumi na moja", "miaka mitatu"
    if (has("miaka") && !isHarvest && !has("mavuno")) {
      const n = numberAfter(t, "miaka");
      if (n && n.value <= 80) {
        const k = t.indexOf("miaka");
        push("cooperative_membership_years", n.value, "years", t.slice(k, n.next).join(" "));
      }
    }

    // Bad season: a year ending the season (2022 -> "2021/22"), or "mwaka jana" (last year)
    if (has("mvua", "ukame", "mbaya", "chache", "msimu", "yalishuka", "yameshuka")) {
      let found = false;
      for (let i = 0; i < t.length; i++) {
        if (!isNumWord(t[i])) continue;
        const n = parseNumber(t, i);
        if (n && n.value >= 1990 && n.value <= 2100) {
          push("bad_season", `${n.value - 1}/${String(n.value).slice(2)}`, null, t.slice(i, n.next).join(" "));
          found = true;
          break;
        }
        if (n) i = n.next - 1;
      }
      if (!found) {
        const j = t.findIndex((w, k) => w === "jana" && t[k - 1] === "mwaka");
        if (j > 0) {
          push("bad_season", `${LAST_YEAR - 1}/${String(LAST_YEAR).slice(2)}`, null, "mwaka jana");
        }
      }
    }

    // Land tenure
    if (has("sina", "hakuna") && has("hati")) push("land_tenure", "customary_undocumented", null, "sina hati");
    else if (has("hati")) push("land_tenure", "titled", null, "hati");
    else if (has("urithi")) push("land_tenure", "customary_undocumented", null, "urithi");
    else if (has("kukodi", "nimekodi", "ninakodi", "nakodi", "kodi")) push("land_tenure", "leased", null, "kukodi");
  }

  return out;
}