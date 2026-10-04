import { PHRASES, type Lang } from "./phrases.ts";
import { getLang } from "./lang.ts";

// Plays pre-generated phrase clips in order from /audio/{lang}/{id}.mp3.
// Browsers (iPhones especially) only allow sound after a tap, so:
//   - ONE shared <audio> element is reused for every clip, and
//   - unlockAudio() plays a tiny silent sound inside the very first tap (wired up in main.tsx).
// If a play is still refused, playback stops and the UI shows "tap to listen" instead of going silent.
// A missing clip (not generated yet) becomes a timed pause so the flow still runs.

let token = 0;
let el: HTMLAudioElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let wake: (() => void) | null = null;
let unlocked = false;
let blocked = false;
const missing = new Set<string>();
const missingListeners = new Set<() => void>();
const blockedListeners = new Set<(blocked: boolean) => void>();

const player = (): HTMLAudioElement => (el ??= Object.assign(new Audio(), { preload: "auto" }));

export const audioMissing = (): boolean => missing.size > 0;
export const onAudioMissing = (fn: () => void): (() => void) => {
  missingListeners.add(fn);
  return () => missingListeners.delete(fn);
};

/** True while the browser is refusing to play until the user taps. */
export const audioBlocked = (): boolean => blocked;
export const onAudioBlocked = (fn: (blocked: boolean) => void): (() => void) => {
  blockedListeners.add(fn);
  return () => blockedListeners.delete(fn);
};
function setBlocked(value: boolean) {
  if (blocked === value) return;
  blocked = value;
  blockedListeners.forEach((fn) => fn(value));
}

/** 0.1 s of silence as a WAV blob URL (built here, so nothing is downloaded). */
function silentWavUrl(): string {
  const samples = 800, buf = new ArrayBuffer(44 + samples), v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + samples, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, "data"); v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

/** Call synchronously inside a user tap. After this, clips can start on their own (e.g. on the next screen). */
export function unlockAudio(): void {
  if (unlocked) return;
  const a = player();
  a.src = silentWavUrl();
  a.play().then(() => { unlocked = true; setBlocked(false); }).catch(() => { /* try again on the next tap */ });
}

export function stopAudio(): void {
  token++;
  el?.pause();
  clearTimeout(timer);
  wake?.();
  wake = null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    wake = resolve;
    timer = setTimeout(resolve, ms);
  });
}

/**
 * "ended" = played through; "missing" = file failed to load (not generated yet);
 * "blocked" = play() refused (autoplay policy), file may be fine; "stopped" = stopAudio() called.
 */
type PlayResult = "ended" | "missing" | "blocked" | "stopped";
function playUrl(url: string): Promise<PlayResult> {
  return new Promise((resolve) => {
    const a = player();
    wake = () => resolve("stopped");
    a.onended = () => resolve("ended");
    a.onerror = () => resolve("missing");
    a.src = url;
    a.play()
      .then(() => setBlocked(false))
      .catch((e: unknown) => resolve(e instanceof DOMException && e.name === "NotAllowedError" ? "blocked" : a.error ? "missing" : "blocked"));
  });
}

const fallbackMs = (id: string, lang: Lang): number =>
  Math.max(450, (PHRASES[id]?.[lang] ?? PHRASES[id]?.sw ?? "").length * 55);

/** Resolves true when all clips finished; false if stopped, superseded, or blocked until a tap. */
export async function playClips(
  ids: string[],
  { lang = getLang(), onClip }: { lang?: Lang; onClip?: (id: string, index: number) => void } = {},
): Promise<boolean> {
  stopAudio();
  const mine = ++token;
  for (let i = 0; i < ids.length; i++) {
    if (mine !== token) return false;
    onClip?.(ids[i], i);
    const key = `${lang}/${ids[i]}`;
    const result: PlayResult = missing.has(key) ? "missing" : await playUrl(`/audio/${key}.mp3`);
    if (mine !== token) return false;
    if (result === "blocked") {
      setBlocked(true); // the UI now asks for a tap; don't pretend to be speaking
      return false;
    }
    if (result === "missing" && !missing.has(key)) {
      missing.add(key); // only a real load failure is remembered
      missingListeners.forEach((fn) => fn());
    }
    if (result !== "ended") await wait(fallbackMs(ids[i], lang));
  }
  return mine === token;
}
