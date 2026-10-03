import { PHRASES, type Lang } from "./phrases.ts";

// Plays pre-generated phrase clips in order from /audio/{lang}/{id}.mp3.
// Until the ElevenLabs clips exist, a missing clip becomes a timed pause so the flow still runs.

let token = 0;
let audio: HTMLAudioElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let wake: (() => void) | null = null;
const missing = new Set<string>();
const listeners = new Set<() => void>();

export const audioMissing = (): boolean => missing.size > 0;
export const onAudioMissing = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function stopAudio(): void {
  token++;
  audio?.pause();
  audio = null;
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
 * "blocked" = play() refused (e.g. autoplay policy), file may be fine; "stopped" = stopAudio() called.
 */
type PlayResult = "ended" | "missing" | "blocked" | "stopped";
function playUrl(url: string): Promise<PlayResult> {
  return new Promise((resolve) => {
    const a = new Audio(url);
    audio = a;
    wake = () => resolve("stopped");
    a.onended = () => resolve("ended");
    a.onerror = () => resolve("missing");
    a.play().catch(() => resolve(a.error ? "missing" : "blocked"));
  });
}

const fallbackMs = (id: string, lang: Lang): number =>
  Math.max(450, (PHRASES[id]?.[lang] ?? PHRASES[id]?.sw ?? "").length * 55);

/** Resolves true when all clips finished, false if stopped or superseded. */
export async function playClips(
  ids: string[],
  { lang = "sw", onClip }: { lang?: Lang; onClip?: (id: string, index: number) => void } = {},
): Promise<boolean> {
  stopAudio();
  const mine = ++token;
  for (let i = 0; i < ids.length; i++) {
    if (mine !== token) return false;
    onClip?.(ids[i], i);
    const key = `${lang}/${ids[i]}`;
    const result: PlayResult = missing.has(key) ? "missing" : await playUrl(`/audio/${key}.mp3`);
    if (mine !== token) return false;
    if (result === "missing" && !missing.has(key)) {
      missing.add(key); // only a real load failure is remembered; a blocked play() is retried next time
      listeners.forEach((fn) => fn());
    }
    if (result !== "ended") await wait(fallbackMs(ids[i], lang));
  }
  return mine === token;
}
