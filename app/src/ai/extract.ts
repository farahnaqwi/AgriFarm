// OWNER: Sakeet. FAKE: returns hand-written claims for the two demo transcripts.
// Real version: rule-based Swahili extraction (crop words, numbers, ekari/hekta, years), small LLM as a stretch.
//
// CONTRACT
//   extractClaims(transcript: Transcript) -> CandidateClaim[]  (types/index.ts), each:
//   { field, value, unit, value_as_spoken,
//     source: { type: "farmer_voice", ref: "audio:SS.s-SS.s", quote, asr_confidence, confirmed_by_farmer: false } }
// Candidates are NEVER used until the farmer confirms each one by tap (Confirm screen).
// Unknown speech -> return [] and the farmer enters values by tap instead.

import type { CandidateClaim, ClaimField, ClaimUnit, Transcript } from "../types/index.ts";

type Row = [field: ClaimField, value: string | number, unit: ClaimUnit, spoken: string];

const FIELDS_BY_DEMO: Record<string, Row[]> = {
  "Mimi nalima kahawa tu.": [
    ["crop_type", "coffee", null, "nalima kahawa"],
    ["plot_area", 5, "acre", "ekari tano"],
    ["cooperative_membership_years", 11, "years", "miaka kumi na moja"],
    ["bad_season", "2021/22", null, "mwaka elfu mbili ishirini na mbili mvua zilikuwa chache"],
    ["bad_season", "2024/25", null, "mwaka jana mavuno yalishuka"],
    ["last_harvest_delivered", 680, "kg_parchment", "kilo mia sita themanini"],
    ["land_tenure", "customary_undocumented", null, "shamba la urithi"],
  ],
  "Nina kahawa shambani.": [
    ["crop_type", "coffee", null, "nina kahawa"],
    ["plot_area", 5, "ha", "hekta tano"],
    ["bad_season", "2023/24", null, "msimu wa elfu mbili ishirini na nne ulikuwa mbaya"],
    ["cooperative_membership_years", 6, "years", "miaka sita"],
    ["land_tenure", "titled", null, "nina hati"],
  ],
};

export async function extractClaims({ segments }: Transcript): Promise<CandidateClaim[]> {
  const rows = FIELDS_BY_DEMO[segments[0]?.text] ?? [];
  return rows.map(([field, value, unit, spoken], i) => {
    const seg = segments[i] ?? segments[segments.length - 1];
    return {
      field, value, unit, value_as_spoken: spoken,
      source: {
        type: "farmer_voice",
        ref: `audio:${seg.start.toFixed(1)}-${seg.end.toFixed(1)}`,
        quote: seg.text,
        asr_confidence: seg.confidence,
        confirmed_by_farmer: false,
      },
    };
  });
}
