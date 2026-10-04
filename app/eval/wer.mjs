import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline, env } from "@huggingface/transformers";

const here = dirname(fileURLToPath(import.meta.url));
env.localModelPath = join(here, "..", "public", "models") + "/";
env.allowRemoteModels = false;
env.allowLocalModels = true;

function readWav(path) {
  const b = readFileSync(path);
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString("ascii", pos, pos + 4);
    const size = b.readUInt32LE(pos + 4);
    if (id === "fmt ") fmt = { ch: b.readUInt16LE(pos + 10), rate: b.readUInt32LE(pos + 12), bits: b.readUInt16LE(pos + 22) };
    if (id === "data") { data = b.subarray(pos + 8, pos + 8 + size); break; }
    pos += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error(`${path}: not a valid WAV`);
  if (fmt.bits !== 16 || fmt.ch !== 1 || fmt.rate !== 16000)
    throw new Error(`${path}: must be 16-bit mono 16000 Hz (convert with ffmpeg)`);
  const out = new Float32Array(data.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = data.readInt16LE(i * 2) / 32768;
  return out;
}

const norm = (s) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const asr = await pipeline("automatic-speech-recognition", "whisper-tiny", { dtype: "q8" });

const refs = readFileSync(join(here, "refs.tsv"), "utf8")
  .split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split("\t"));

let wordErr = 0, wordTotal = 0, charErr = 0, charTotal = 0, exact = 0;
const rows = ["file,reference,hypothesis,wer"];
const perClip = [];

for (const [file, ref] of refs) {
  const audio = readWav(join(here, "clips16", file));
  const out = await asr(audio, {
    language: "swahili",
    task: "transcribe",
    max_new_tokens: 80,
    no_repeat_ngram_size: 3,
  });
  const hyp = String(out.text).trim();
  const r = norm(ref), h = norm(hyp);
  const we = editDistance(r, h);
  const rc = [...r.join(" ")], hc = [...h.join(" ")];
  wordErr += we; wordTotal += r.length;
  charErr += editDistance(rc, hc); charTotal += rc.length;
  if (r.join(" ") === h.join(" ")) exact++;
  const wer = we / r.length;
  perClip.push(wer);
  console.log(`${file}  WER ${wer.toFixed(2)}\n  ref: ${ref}\n  hyp: ${hyp}`);
  rows.push([file, ref, hyp, wer.toFixed(2)].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","));
}

writeFileSync(join(here, "results.csv"), rows.join("\n"));

const sorted = [...perClip].sort((a, b) => a - b);
console.log(`\nClips: ${refs.length}`);
console.log(`Word error rate: ${(100 * wordErr / wordTotal).toFixed(1)}%`);
console.log(`Character error rate: ${(100 * charErr / charTotal).toFixed(1)}%`);
console.log(`Exact matches: ${exact}/${refs.length}`);
console.log(`Median per-clip WER: ${(100 * sorted[Math.floor(sorted.length / 2)]).toFixed(0)}%`);
console.log(`Clips with WER <= 0.5: ${sorted.filter((x) => x <= 0.5).length}/${sorted.length}`);