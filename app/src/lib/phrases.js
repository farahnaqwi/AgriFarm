import data from "@docs/phrases.json";

const all = [
  ...data.phrases, ...data.units, ...data.numbers_n, ...data.numbers_mi,
  ...data.tens, ...data.years, ...data.lender_only,
];

export const PHRASES = Object.fromEntries(all.map((p) => [p.id, p]));

// Text for a phrase id. Slot clips (numbers, years) only have Swahili; English falls back to the value.
export const t = (id, lang = "sw") => {
  const p = PHRASES[id];
  if (!p) return id;
  return p[lang] ?? (p.value !== undefined ? String(p.value) : p.sw);
};
