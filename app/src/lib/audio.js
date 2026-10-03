import { PHRASES } from "./phrases.js";

// Plays pre-generated phrase clips in order from /audio/{lang}/{id}.mp3.
// Until the ElevenLabs clips exist, a missing clip becomes a timed pause so the flow still runs.

let token = 0;
let audio = null;
let timer = null;
let wake = null;
const missing = new Set();
const listeners = new Set();

export const audioMissing = () => missing.size > 0;
export const onAudioMissing = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export function stopAudio() {
  token++;
  audio?.pause();
  audio = null;
  clearTimeout(timer);
  wake?.();
  wake = null;
}

function wait(ms) {
  return new Promise((resolve) => {
    wake = resolve;
    timer = setTimeout(resolve, ms);
  });
}

function playUrl(url) {
  return new Promise((resolve) => {
    const a = new Audio(url);
    audio = a;
    wake = () => resolve(null);
    a.onended = () => resolve(true);
    a.onerror = () => resolve(false);
    a.play().catch(() => resolve(false));
  });
}

const fallbackMs = (id, lang) => Math.max(450, (PHRASES[id]?.[lang] ?? PHRASES[id]?.sw ?? "").length * 55);

/** Resolves true when all clips finished, false if stopped or superseded. */
export async function playClips(ids, { lang = "sw", onClip } = {}) {
  stopAudio();
  const mine = ++token;
  for (let i = 0; i < ids.length; i++) {
    if (mine !== token) return false;
    onClip?.(ids[i], i);
    const key = `${lang}/${ids[i]}`;
    const ok = missing.has(key) ? false : await playUrl(`/audio/${key}.mp3`);
    if (mine !== token) return false;
    if (!ok) {
      if (!missing.has(key)) {
        missing.add(key);
        listeners.forEach((fn) => fn());
      }
      await wait(fallbackMs(ids[i], lang));
    }
  }
  return mine === token;
}
