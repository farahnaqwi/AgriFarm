// OWNER: Sakeet. On-device speech recognition: whisper-tiny (q8) via transformers.js.
// Model files live in app/public/models/whisper-tiny, runtime in app/public/ort,
// so it works fully offline. Raw audio is discarded after transcribe().
//
// CONTRACT
//   transcribe(audioBlob, { demoFarm, language }) -> Promise<Transcript>  (types/index.ts); language defaults to "swahili":
//     { text, segments: [{ start, end, text, confidence }] }
//   prepareAsr(onProgress?: (fraction 0..1) => void) -> Promise<void>
//     loads the model from the app's own offline cache (bundled at install, never downloaded on first use).
//     The Speak screen shows progress and keeps the mic button disabled until it resolves.

import type { DemoFarm, Transcript } from "../types/index.ts";

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

let asr: any = null;

export async function prepareAsr(onProgress?: (fraction: number) => void): Promise<void> {
  if (asr) { onProgress?.(1); return; }
  const { pipeline, env } = await import("@huggingface/transformers");

  env.allowRemoteModels = false;        // never download in the field
  env.allowLocalModels = true;
  env.localModelPath = "/models/";      // app/public/models/whisper-tiny/...
  env.useBrowserCache = false;          // files come from the app's own cache
  const wasm = env.backends.onnx.wasm as any;
  wasm.wasmPaths = {
    mjs: "/ort/ort-wasm-simd-threaded.asyncify.mjs",
    wasm: "/ort/ort-wasm-simd-threaded.asyncify.wasm",
  };
  wasm.numThreads = 1;                // avoids needing cross-origin isolation

  asr = await pipeline("automatic-speech-recognition", "whisper-tiny", {
    dtype: "q8",                        // uses the *_quantized.onnx files
    device: "wasm",
    progress_callback: (p: any) => {
      if (p?.status === "progress" && typeof p.progress === "number") onProgress?.(p.progress / 100);
    },
  });
  onProgress?.(1);
}

async function toFloat32(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    return buf.getChannelData(0);
  } finally {
    await ctx.close();
  }
}

export async function transcribe(
  audioBlob: Blob | null,
  { demoFarm = null, language = "swahili" }: { demoFarm?: DemoFarm | null; language?: "swahili" | "english" } = {},
): Promise<Transcript> {
  // No audio: the hand-written transcript stands in only in demo mode. Otherwise silence, and the farmer taps.
  if (!audioBlob) {
    if (!demoFarm) return { text: "", segments: [] };
    const { segments } = DEMO_TRANSCRIPTS[demoFarm];
    return { text: segments.map((s) => s.text).join(" "), segments };
  }
  if (!asr) throw new Error("Call prepareAsr() first");

  const out = await asr(await toFloat32(audioBlob), {
    language,
    task: "transcribe",
    return_timestamps: true,
  });

  const segments = (out.chunks ?? []).map((c: any) => ({
    start: c.timestamp?.[0] ?? 0,
    end: c.timestamp?.[1] ?? c.timestamp?.[0] ?? 0,
    text: String(c.text).trim(),
    confidence: null, // Whisper gives no trustworthy per-segment score
  }));
  return { text: String(out.text).trim(), segments };
}
