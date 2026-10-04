// Rule-based ENGLISH claim extraction: the same fields and output as extract.ts (Swahili), for a farmer who
// answers in English. Used when the app is set to English (Speak.tsx).
//
// CONTRACT
//   extractClaimsEnglish(transcript: Transcript) -> CandidateClaim[]   same shape as extractClaims()
// Candidates are NEVER used until the farmer confirms each one by tap (Confirm screen).
// Unknown speech -> [] and she enters values by tap instead.

import type { CandidateClaim, ClaimField, ClaimUnit, Transcript } from "../types/index.ts";

const LAST_YEAR = 2025; // same as extract.ts: "last year" = the 2024/25 season

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const isDigits = (w: string) => /^\d+(\.\d+)?$/.test(w);

const tokenize = (s: string): string[] =>
  s.toLowerCase()
    .replace(/(\d),(\d{3})/g, "$1$2") // 1,000 -> 1000
    .replace(/(\d)\s*(ha|kg)\b/g, "$1 $2") // 5ha -> 5 ha
    .replace(/[-–]/g, " ")
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/\.(?!\d)/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Up to 99 in words ("twenty two", "eleven"), or digits. */
function small(t: string[], i: number): { value: number; next: number } | null {
  const w = t[i];
  if (w === undefined) return null;
  if (isDigits(w)) return { value: Number(w), next: i + 1 };
  if (w in UNITS) return { value: UNITS[w], next: i + 1 };
  if (w in TENS) return t[i + 1] in UNITS && UNITS[t[i + 1]] < 10 ? { value: TENS[w] + UNITS[t[i + 1]], next: i + 2 } : { value: TENS[w], next: i + 1 };
  return null;
}

/** "two thousand and twenty two", "twenty twenty two", "2022", "five and a half", "half" (an acre). */
function parseNumber(t: string[], i: number): { value: number; next: number } | null {
  if ((t[i] === "a" && t[i + 1] === "half") || t[i] === "half") return { value: 0.5, next: i + (t[i] === "a" ? 2 : 1) };
  let n = small(t, i);
  if (!n) return null;
  let { value, next } = n;
  if (!isDigits(t[i])) {
    if (t[next] === "thousand") {
      value *= 1000; next++;
      if (t[next] === "and") next++;
      const rest = small(t, next);
      if (rest) { value += rest.value; next = rest.next; }
    } else if (t[next] === "hundred") {
      value *= 100; next++;
      if (t[next] === "and") next++;
      const rest = small(t, next);
      if (rest) { value += rest.value; next = rest.next; }
    } else if (value >= 19 && value <= 21) {
      const yy = small(t, next); // "twenty twenty two" -> 2022
      if (yy && !isDigits(t[next]) && yy.value >= 0 && yy.value < 100) { value = value * 100 + yy.value; next = yy.next; }
    }
  }
  if (t[next] === "and" && t[next + 1] === "a" && t[next + 2] === "half") { value += 0.5; next += 3; }
  else if (t[next] === "and" && t[next + 1] === "half") { value += 0.5; next += 2; }
  n = { value, next };
  return n;
}

/** The number phrase that ends right before index k ("five and a half" acres). */
function numberBefore(t: string[], k: number): { value: number; start: number } | null {
  for (let i = Math.max(0, k - 5); i < k; i++) {
    const n = parseNumber(t, i);
    if (n && n.next === k) return { value: n.value, start: i };
  }
  return null;
}

const SEASON = (year: number) => `${year - 1}/${String(year).slice(2)}`;

export async function extractClaimsEnglish({ segments }: Transcript): Promise<CandidateClaim[]> {
  const out: CandidateClaim[] = [];
  for (const seg of segments) {
    const t = tokenize(seg.text);
    const has = (...w: string[]) => w.some((x) => t.includes(x));
    const push = (field: ClaimField, value: string | number, unit: ClaimUnit, spoken: string) =>
      out.push({
        field, value, unit, value_as_spoken: spoken,
        source: { type: "farmer_voice", ref: `audio:${seg.start.toFixed(1)}-${seg.end.toFixed(1)}`, quote: seg.text, asr_confidence: seg.confidence ?? null, confirmed_by_farmer: false },
      });
    const isHarvest = has("kilo", "kilos", "kg", "kilograms", "delivered", "sold");

    // Crop
    if (!isHarvest) {
      if (has("coffee") && has("banana", "bananas", "plantain", "plantains")) push("crop_type", "coffee_banana", null, "coffee and bananas");
      else if (has("coffee")) push("crop_type", "coffee", null, "coffee");
      else if (has("maize", "corn")) push("crop_type", "maize", null, has("corn") ? "corn" : "maize");
    }

    // Plot area: number BEFORE the unit in English ("five acres", "2.5 hectares")
    for (const [words, unit] of [[["acre", "acres"], "acre"], [["hectare", "hectares", "ha"], "ha"]] as const) {
      const k = t.findIndex((w) => (words as readonly string[]).includes(w));
      const n = k > 0 ? numberBefore(t, k) : null;
      if (n && n.value > 0 && n.value < 1000) push("plot_area", n.value, unit, t.slice(n.start, k + 1).join(" "));
    }

    // Harvest delivered: "delivered 680 kilos of parchment coffee"
    if (isHarvest) {
      const k = t.findIndex((w) => ["kilo", "kilos", "kg", "kilograms"].includes(w));
      const n = k > 0 ? numberBefore(t, k) : null;
      const unit: ClaimUnit = has("parchment") ? "kg_parchment" : has("cherry", "cherries") ? "kg_cherry" : null;
      if (n && unit) push("last_harvest_delivered", n.value, unit, t.slice(n.start, k + 1).join(" "));
    }

    // Cooperative membership: "a member for eleven years", "11 years in the cooperative"
    if (has("member", "cooperative", "coop", "co") && has("year", "years") && !isHarvest) {
      const k = t.findIndex((w) => w === "years" || w === "year");
      const n = k > 0 ? numberBefore(t, k) : null;
      if (n && n.value <= 80) push("cooperative_membership_years", n.value, "years", t.slice(n.start, k + 1).join(" "));
    }

    // Bad season: a year (2022 -> "2021/22"), or "last year"
    if (has("bad", "drought", "dry", "poor", "little", "failed", "dropped", "fell", "low", "lost")) {
      let found = false;
      for (let i = 0; i < t.length && !found; i++) {
        const n = parseNumber(t, i);
        if (n && n.value >= 1990 && n.value <= 2100) { push("bad_season", SEASON(n.value), null, t.slice(i, n.next).join(" ")); found = true; }
      }
      if (!found && t.some((w, k) => w === "year" && t[k - 1] === "last")) push("bad_season", SEASON(LAST_YEAR), null, "last year");
    }

    // Land tenure
    if (has("title", "deed", "document", "documents", "papers") && has("no", "not", "dont", "don", "without")) push("land_tenure", "customary_undocumented", null, "no title");
    else if (has("ccro", "customary")) push("land_tenure", "customary_ccro", null, "customary certificate");
    else if (has("title", "deed")) push("land_tenure", "titled", null, "title deed");
    else if (has("inherited", "inheritance")) push("land_tenure", "customary_undocumented", null, "inherited");
    else if (has("rent", "rented", "renting", "lease", "leased")) push("land_tenure", "leased", null, "leased");
  }
  return out;
}
