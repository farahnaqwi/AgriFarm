import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Candidates to try: "Xenova/whisper-tiny" or "onnx-community/whisper-tiny".
// Override from the terminal with:  $env:MODEL_ID="onnx-community/whisper-tiny"
const MODEL_ID = process.env.MODEL_ID || "onnx-community/whisper-tiny";
const FILES = [
  "onnx/encoder_model_quantized.onnx",
  "onnx/decoder_model_merged_quantized.onnx",
];

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "public", "models", "whisper-tiny");
const verifyOnly = process.argv.includes("--verify");

async function sha256(path) {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(path)) h.update(chunk);
  return h.digest("hex");
}

async function remoteHashes() {
  const res = await fetch(`https://huggingface.co/api/models/${MODEL_ID}/tree/main/onnx`);
  if (!res.ok) throw new Error(`Could not list ${MODEL_ID}: HTTP ${res.status}`);
  const map = {};
  for (const f of await res.json()) if (f.lfs?.oid) map[f.path] = f.lfs.oid;
  return map;
}

const remote = await remoteHashes();
let allMatch = true;

for (const file of FILES) {
  const dest = join(root, file);
  const want = remote[file];
  if (!want) {
    console.log(`MISSING in ${MODEL_ID}: ${file}`);
    allMatch = false;
    continue;
  }
  if (existsSync(dest) && (await sha256(dest)) === want) {
    console.log(`OK (matches ${MODEL_ID}): ${file}`);
    continue;
  }
  if (verifyOnly) {
    console.log(`DIFFERENT or absent locally: ${file}`);
    allMatch = false;
    continue;
  }
  console.log(`Downloading ${file} ...`);
  const res = await fetch(`https://huggingface.co/${MODEL_ID}/resolve/main/${file}`);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  if ((await sha256(dest)) !== want) throw new Error(`Hash mismatch after download: ${file}`);
  console.log(`Saved ${file}`);
}

console.log(allMatch || !verifyOnly ? `Done (${MODEL_ID}).` : `Not a full match for ${MODEL_ID}.`);
process.exit(verifyOnly && !allMatch ? 1 : 0);