import data from "@docs/phrases.json";

export type Lang = "sw" | "en";
export interface Phrase {
  id: string;
  sw?: string;
  en?: string;
  value?: number | string;
  section?: string;
  slots?: string[];
  note?: string;
}

const all: Phrase[] = [
  ...data.phrases, ...data.units, ...data.numbers_n, ...data.numbers_mi,
  ...data.tens, ...data.years, ...data.lender_only,
];

export const PHRASES: Record<string, Phrase> = Object.fromEntries(all.map((p) => [p.id, p]));

// Text for a phrase id. Slot clips (numbers, years) only have Swahili; English falls back to the value.
export const t = (id: string, lang: Lang = "sw"): string => {
  const p = PHRASES[id];
  if (!p) return id;
  return p[lang] ?? (p.value !== undefined ? String(p.value) : (p.sw ?? id));
};
