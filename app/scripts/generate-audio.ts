/// <reference types="node" />
// Generates the fixed-phrase audio clips with ElevenLabs. Build-time only: the API key never ships in the app.
//
//   npm run audio -- --dry-run                     list clips + characters to spend, no API calls, no key needed
//   npm run audio -- --only CONSENT_ASK,U_HA,N_5   audition a few clips (try a voice before spending credits)
//   npm run audio                                  generate every missing or changed Swahili clip
//   npm run audio -- --lang en                     English clips (same ids; number sentences in English order, see src/lib/clips.ts)
//   npm run audio -- --force                       regenerate even unchanged clips
//
// Needs ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID_SW (or _EN) in the repo-root .env.
// Optional ELEVENLABS_MODEL_ID; otherwise the first model whose language list includes Swahili.
// app/public/audio/manifest.json remembers what each clip was made from, so re-running after the
// native-speaker review only spends credits on lines that changed.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterSlots } from "../src/lib/clips.ts";

type Lang = "sw" | "en";
interface Entry { id: string; sw?: string; en?: string; value?: number | string; slots?: string[] }
interface Clip { id: string; text: string }
interface ManifestEntry { sha: string; text: string; model: string; voice: string }
interface Model { model_id: string; can_do_text_to_speech?: boolean; languages?: { language_id: string; name: string }[] }

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const audioDir = join(here, "..", "public", "audio");
const manifestPath = join(audioDir, "manifest.json");
const API = "https://api.elevenlabs.io/v1";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const lang: Lang = opt("lang") === "en" ? "en" : "sw";
const only = opt("only")?.split(",");
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");

try { process.loadEnvFile(join(root, ".env")); } catch { /* no .env yet: --dry-run still works */ }
const key = process.env.ELEVENLABS_API_KEY ?? "";
const voice = (lang === "sw" ? process.env.ELEVENLABS_VOICE_ID_SW : process.env.ELEVENLABS_VOICE_ID_EN) ?? "";

// ---- Which clips ----
const phrases = JSON.parse(readFileSync(join(root, "docs", "phrases.json"), "utf8"));
if (lang === "sw" && String(phrases.status).startsWith("DRAFT")) {
  console.warn("⚠ docs/phrases.json is still DRAFT: Swahili not yet reviewed by a native speaker. Edited lines can be regenerated cheaply later.\n");
}
const groups: Entry[][] = [phrases.phrases, phrases.units, phrases.numbers_n, phrases.numbers_mi, phrases.tens, phrases.years];

/** Phrase text up to its slot. "…lina {unit} {number}." -> "…lina" (no period, so the voice doesn't fall before the number). */
function clipText(e: Entry, l: Lang): string | null {
  // English numbers and years have no text of their own: the voice reads the digits ("5", "2022").
  const text = e[l] ?? (l === "en" && e.value !== undefined ? String(e.value) : undefined);
  if (!text) return null;
  if (!text.includes("{")) return text;
  if (l === "en") return text.slice(0, text.indexOf("{")).trim(); // words before the first slot
  return text.replace(/\s*\{[a-z_]+\}/g, "").replace(/[.,]\s*$/, "").trim();
}

let clips: Clip[] = groups.flat().flatMap((e) => {
  const text = clipText(e, lang);
  // English words after the last slot ("…member for {number} years.") get their own clip, {id}__END.
  const end = lang === "en" && e.en ? afterSlots(e.en) : "";
  return [...(text ? [{ id: e.id, text }] : []), ...(end ? [{ id: `${e.id}__END`, text: `${end}.` }] : [])];
});
if (only) clips = clips.filter((c) => only.includes(c.id));

// ---- What changed ----
const manifest: Record<string, ManifestEntry> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
const shaOf = (c: Clip, model: string) => createHash("sha256").update(`${c.text}|${voice}|${model}`).digest("hex").slice(0, 16);

function needs(c: Clip, model: string): boolean {
  const file = join(audioDir, lang, `${c.id}.mp3`);
  return force || !existsSync(file) || manifest[`${lang}/${c.id}`]?.sha !== shaOf(c, model);
}

async function pickModel(): Promise<string> {
  if (process.env.ELEVENLABS_MODEL_ID) return process.env.ELEVENLABS_MODEL_ID;
  const res = await fetch(`${API}/models`, { headers: { "xi-api-key": key } });
  if (!res.ok) throw new Error(`GET /models -> ${res.status} ${await res.text()}`);
  const models = (await res.json()) as Model[];
  const want = lang === "sw" ? /swahili/i : /english/i;
  const ok = models.filter((m) => m.can_do_text_to_speech !== false && m.languages?.some((l) => want.test(l.name) || l.language_id === lang));
  const preferred = ["eleven_v4", "eleven_v3", "eleven_multilingual_v2", "eleven_turbo_v2_5", "eleven_flash_v2_5"];
  const pick = preferred.find((id) => ok.some((m) => m.model_id === id)) ?? ok[0]?.model_id;
  if (!pick) throw new Error(`No ElevenLabs model lists ${lang}. Available: ${models.map((m) => m.model_id).join(", ")}`);
  return pick;
}

async function tts(text: string, model: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/text-to-speech/${voice}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: model }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    throw new Error(`TTS ${res.status}: ${await res.text()}`);
  }
}

async function main() {
  if (dryRun) {
    const model = process.env.ELEVENLABS_MODEL_ID ?? "(auto)";
    const todo = clips.filter((c) => needs(c, model));
    for (const c of clips) console.log(`${todo.includes(c) ? "+" : "="} ${lang}/${c.id.padEnd(26)} ${c.text}`);
    console.log(`\n${todo.length} of ${clips.length} clips to generate, ${todo.reduce((a, c) => a + c.text.length, 0)} characters.`);
    return;
  }
  if (!key || !voice) {
    throw new Error(`Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID_${lang.toUpperCase()} in ${join(root, ".env")} (see .env.example).`);
  }
  const model = await pickModel();
  const todo = clips.filter((c) => needs(c, model));
  console.log(`Model ${model}, voice ${voice}: ${todo.length} of ${clips.length} clips to generate.`);
  mkdirSync(join(audioDir, lang), { recursive: true });

  let done = 0, chars = 0;
  const queue = [...todo];
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const mp3 = await tts(c.text, model);
      writeFileSync(join(audioDir, lang, `${c.id}.mp3`), mp3);
      manifest[`${lang}/${c.id}`] = { sha: shaOf(c, model), text: c.text, model, voice };
      chars += c.text.length;
      console.log(`  ✓ ${++done}/${todo.length} ${c.id} (${(mp3.length / 1024).toFixed(0)} KB)`);
    }
  };
  try {
    await Promise.all([worker(), worker(), worker()]);
  } finally {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }
  console.log(`\nDone: ${done} clips, ${chars} characters. Files in app/public/audio/${lang}/`);
}

main().catch((e: unknown) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
