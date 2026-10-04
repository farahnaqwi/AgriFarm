// Which voice clips speak a report sentence. Shared by the player and scripts/generate-audio.ts.
//   Swahili: phrase clip, then slot clips (slots always end a Swahili phrase: "…lina ekari tano").
//   English: phrase clip (words up to the first slot), slot clips in English order ("five acres"),
//            then "{id}__END" for words after the last slot ("…for eleven years").

/** Words after the last {slot} in a template, or "" when only punctuation follows. */
export const afterSlots = (template: string): string =>
  template.includes("{") ? template.slice(template.lastIndexOf("}") + 1).replace(/[\s.,]+$/, "").trim() : "";

const slotOf = (clipId: string) =>
  clipId.startsWith("U_") ? "unit" : clipId.startsWith("Y_") ? "year" : clipId.startsWith("T_") ? "percent" : "number";

/** Reorders a sentence's Swahili clip list (phrase + slot clips) into the English template's order. */
export function englishClips(swClips: string[], enTemplate: string): string[] {
  const order = [...enTemplate.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  if (!order.length) return swClips;
  const [phrase, ...slots] = swClips;
  const out = [phrase, ...order.flatMap((k) => slots.filter((c) => slotOf(c) === k))];
  return afterSlots(enTemplate) ? [...out, `${phrase}__END`] : out;
}
