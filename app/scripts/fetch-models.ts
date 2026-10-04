/// <reference types="node" />
// Puts the on-device speech model and its runtime inside the app, so speech recognition works in airplane mode.
// Runs before every build (npm "prebuild"), including on Vercel. Already-present files are skipped.
//
//   npm run models
//
// 1) whisper-tiny (8-bit) from Hugging Face, pinned to one revision -> app/public/models/whisper-tiny/
// 2) the ONNX Runtime WebAssembly files transformers.js loads, copied from node_modules -> app/public/ort/
//    (same version as the installed library, so they always match)
// Both folders are git-ignored and precached by the service worker (vite.config.ts globPatterns).

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, "..", "public");

const REPO = "onnx-community/whisper-tiny";
const REVISION = "ff4177021cc41f7db950912b73ea4fdf7d01d8e7";
// What transformers.js requests for pipeline("automatic-speech-recognition", "whisper-tiny", { dtype: "q8" }).
const MODEL_FILES: Record<string, number> = {
  "config.json": 2243,
  "generation_config.json": 3772,
  "preprocessor_config.json": 339,
  "tokenizer.json": 2480466,
  "tokenizer_config.json": 282683,
  "onnx/encoder_model_quantized.onnx": 10124990,
  "onnx/decoder_model_merged_quantized.onnx": 30719241,
};
// transformers.js imports onnxruntime-web/webgpu, which runs on the "asyncify" WebAssembly build.
const ORT_FILES = ["ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm"];

const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`;

async function fetchModel() {
  const dir = join(pub, "models", "whisper-tiny");
  for (const [file, size] of Object.entries(MODEL_FILES)) {
    const out = join(dir, file);
    if (existsSync(out) && statSync(out).size === size) continue;
    const url = `https://huggingface.co/${REPO}/resolve/${REVISION}/${file}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status} from ${url}`);
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length !== size) throw new Error(`${file}: expected ${size} bytes, got ${body.length}`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, body);
    console.log(`  downloaded ${file} (${mb(size)})`);
  }
  const total = Object.values(MODEL_FILES).reduce((a, b) => a + b, 0);
  console.log(`✓ whisper-tiny q8 (${REPO}@${REVISION.slice(0, 7)}), ${mb(total)}`);
}

function copyRuntime() {
  // Resolve onnxruntime-web the way transformers.js does, so a nested copy would win over a hoisted one.
  const fromTransformers = createRequire(createRequire(import.meta.url).resolve("@huggingface/transformers"));
  const ortDist = dirname(fromTransformers.resolve("onnxruntime-web"));
  const dir = join(pub, "ort");
  mkdirSync(dir, { recursive: true });
  for (const file of ORT_FILES) {
    const from = join(ortDist, file), to = join(dir, file);
    if (!existsSync(to) || statSync(to).size !== statSync(from).size) copyFileSync(from, to);
  }
  const { version } = JSON.parse(readFileSync(join(ortDist, "..", "package.json"), "utf8")) as { version: string };
  console.log(`✓ onnxruntime-web ${version} runtime, ${mb(ORT_FILES.reduce((a, f) => a + statSync(join(dir, f)).size, 0))}`);
}

copyRuntime();
await fetchModel();
