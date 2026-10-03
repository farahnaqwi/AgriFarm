// OWNER: Sakeet. FAKE until the on-device speech model (whisper-tiny via transformers.js) lands.
//
// CONTRACT
//   transcribe(audioBlob, { demoFarm }) -> Promise<Transcript>  (types/index.ts):
//     { text, segments: [{ start, end, text, confidence }] }
// Runs fully offline. The raw audio is discarded after this call (consent: deleted_after_extraction).

import type { DemoFarm, Transcript } from "../types/index.ts";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const DEMO_TRANSCRIPTS: Record<DemoFarm, Transcript> = {
  A: {
    text: "",
    segments: [
      { start: 4.1, end: 7.9, text: "Mimi nalima kahawa tu.", confidence: 0.83 },
      { start: 11.0, end: 14.6, text: "Shamba langu lina ekari tano.", confidence: 0.79 },
      { start: 19.2, end: 23.0, text: "Nimekuwa mwanachama miaka kumi na moja.", confidence: 0.81 },
      { start: 31.5, end: 38.2, text: "Mwaka elfu mbili ishirini na mbili mvua zilikuwa chache sana.", confidence: 0.72 },
      { start: 41.0, end: 46.4, text: "Mwaka jana mavuno yalishuka, sijui kwa nini.", confidence: 0.77 },
      { start: 52.3, end: 57.0, text: "Niliwasilisha kilo mia sita themanini za kahawa ya maganda.", confidence: 0.69 },
      { start: 63.8, end: 66.1, text: "Ni shamba la urithi.", confidence: 0.84 },
    ],
  },
  B: {
    text: "",
    segments: [
      { start: 3.2, end: 5.9, text: "Nina kahawa shambani.", confidence: 0.86 },
      { start: 8.4, end: 11.7, text: "Shamba ni hekta tano.", confidence: 0.88 },
      { start: 15.0, end: 19.3, text: "Msimu wa elfu mbili ishirini na nne ulikuwa mbaya.", confidence: 0.74 },
      { start: 22.1, end: 24.0, text: "Miaka sita.", confidence: 0.9 },
      { start: 27.5, end: 29.0, text: "Nina hati ya shamba.", confidence: 0.85 },
    ],
  },
};

export async function transcribe(_audioBlob: Blob | null, { demoFarm = "A" }: { demoFarm?: DemoFarm } = {}): Promise<Transcript> {
  await sleep(900);
  const { segments } = DEMO_TRANSCRIPTS[demoFarm];
  return { text: segments.map((s) => s.text).join(" "), segments };
}
