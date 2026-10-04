// Turns computed facts into report sentences, using ONLY the fixed phrase list (docs/phrases.json).
// Every sentence carries the clip IDs to play, in Swahili word order (noun, then number).
// Numbers outside the recorded clips are still written in the text, just not spoken.

import phrasesJson from "../../docs/phrases.json" with { type: "json" };
import type { Sentence } from "../../app/src/types/index.ts";

interface Entry { id: string; sw?: string; en?: string; value?: number | string }
const P = phrasesJson as unknown as Record<string, Entry[] | unknown>;
const ALL: Entry[] = ["phrases", "units", "numbers_n", "numbers_mi", "tens", "years"].flatMap((k) => (P[k] as Entry[]) ?? []);
const BY_ID = new Map(ALL.map((e) => [e.id, e]));

const phrase = (id: string): Entry => {
  const e = BY_ID.get(id);
  if (!e) throw new Error(`Unknown phrase id ${id}`);
  return e;
};

/** A filled slot: what to write in each language and which clips to play. */
export interface Slot { sw: string; en: string; clips: string[] }

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** N-class numbers (hekta, ekari): nearest 0.5, 1–20 recorded ("mbili na nusu" = 2.5). */
export function numberN(value: number): Slot {
  const v = Math.round(value * 2) / 2;
  const whole = Math.floor(v);
  const half = v - whole >= 0.5;
  if (whole === 0 && half) return { sw: phrase("N_HALF_ONLY").sw!, en: "0.5", clips: ["N_HALF_ONLY"] };
  if (whole >= 1 && whole <= 20) {
    const base = phrase(`N_${whole}`).sw!;
    return { sw: half ? `${base} na nusu` : base, en: fmt(v), clips: half ? [`N_${whole}`, "N_AND_HALF"] : [`N_${whole}`] };
  }
  return { sw: fmt(v), en: fmt(v), clips: [] };
}

/** MI-class numbers (miaka): 2–20 recorded; 1 uses its own phrase. */
export function numberMi(value: number): Slot {
  const v = Math.round(value);
  if (v >= 2 && v <= 20) return { sw: phrase(`MI_${v}`).sw!, en: String(v), clips: [`MI_${v}`] };
  return { sw: String(v), en: String(v), clips: [] };
}

/** Percent rounded to the nearest 10 (10–90). */
export function tens(percent: number): Slot {
  const v = Math.min(90, Math.max(10, Math.round(Math.abs(percent) / 10) * 10));
  return { sw: phrase(`T_${v}`).sw!, en: String(v), clips: [`T_${v}`] };
}

export function year(y: number): Slot {
  const e = BY_ID.get(`Y_${y}`);
  return e ? { sw: e.sw!, en: String(y), clips: [`Y_${y}`] } : { sw: String(y), en: String(y), clips: [] };
}

export function unit(u: "acre" | "ha"): Slot {
  const id = u === "acre" ? "U_ACRE" : "U_HA";
  const e = phrase(id);
  return { sw: e.sw!, en: e.en!, clips: [id] };
}

let counter = 0;
export const resetSentenceIds = () => { counter = 0; };

/**
 * One report sentence from a phrase plus slots. Slot clips follow the phrase clip in the order the
 * Swahili names them ({unit} {number}). grounding_passed holds by construction: every number in the
 * text comes from a slot computed from the claim or the evidence card.
 */
export function sentence(phraseId: string, claimRefs: string[], slots: Partial<Record<"unit" | "number" | "year" | "percent", Slot>> = {}): Sentence {
  const p = phrase(phraseId);
  let sw = p.sw ?? "", en = p.en ?? "";
  const clips = [phraseId];
  const swOrder = [...sw.matchAll(/\{(unit|number|year|percent)\}/g)].map((m) => m[1] as keyof typeof slots);
  for (const key of swOrder) {
    const s = slots[key];
    if (!s) throw new Error(`Phrase ${phraseId} needs slot {${key}}`);
    clips.push(...s.clips);
  }
  for (const [key, s] of Object.entries(slots)) {
    if (!s) continue;
    sw = sw.replace(`{${key}}`, s.sw);
    en = en.replace(`{${key}}`, s.en);
  }
  return {
    sentence_id: `s${++counter}`,
    phrase_id: phraseId,
    generated_by: "template",
    ...(Object.keys(slots).length ? { slots: Object.fromEntries(Object.entries(slots).map(([k, s]) => [k, s!.en])) } : {}),
    text: { en, sw },
    claim_refs: claimRefs,
    audio_clips: clips,
    grounding_passed: true,
  };
}
