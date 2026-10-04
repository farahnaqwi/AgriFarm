// First run: the phone downloads everything the farmer flow needs offline (~78 MB: app, speech model, voice
// clips, satellite map). The service worker (Workbox) caches every file before it activates but reports no
// progress, so this reads its cache and weighs each stored file by its size from /offline-manifest.json
// (written at build time, vite.config.ts). An active service worker = every file is stored = wifi no longer needed.

export type OfflineStatus =
  | { state: "checking" }
  | { state: "downloading"; bytes: number; total: number } // total 0 = sizes unknown
  | { state: "ready" }
  | { state: "unsupported" };

const ACK_KEY = "agrifarm-offline-ack";
const READY_EVENT = "agrifarm:offline-ready";

/** Called from registerSW's onOfflineReady (main.tsx): the last file is in the cache. */
export const announceOfflineReady = (): void => { window.dispatchEvent(new Event(READY_EVENT)); };

/** She has seen "you can turn off wifi now" and tapped Start. */
export function offlineAcknowledged(): boolean {
  try { return localStorage.getItem(ACK_KEY) === "1"; } catch { return false; }
}
export function acknowledgeOffline(): void {
  try { localStorage.setItem(ACK_KEY, "1"); } catch { /* private mode: the screen shows again next time */ }
}

async function manifestSizes(): Promise<{ sizes: Map<string, number>; total: number } | null> {
  try {
    const res = await fetch("/offline-manifest.json", { cache: "no-store" });
    if (!res.ok) return null;
    const m = (await res.json()) as { files: { url: string; bytes: number }[]; bytes: number };
    return { sizes: new Map(m.files.map((f) => [new URL(f.url, `${location.origin}/`).pathname, f.bytes])), total: m.bytes };
  } catch {
    return null; // offline, or an older build without the file
  }
}

async function cachedBytes(sizes: Map<string, number> | undefined): Promise<number> {
  let bytes = 0;
  for (const name of await caches.keys()) {
    if (!name.startsWith("workbox-precache")) continue;
    for (const req of await (await caches.open(name)).keys()) bytes += sizes?.get(new URL(req.url).pathname) ?? 0;
  }
  return bytes;
}

export function watchOffline(onStatus: (s: OfflineStatus) => void): () => void {
  if (import.meta.env.DEV) { onStatus({ state: "ready" }); return () => {}; } // no service worker in `npm run dev`
  if (!("serviceWorker" in navigator) || !("caches" in window)) { onStatus({ state: "unsupported" }); return () => {}; }

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ready = () => { stopped = true; clearTimeout(timer); onStatus({ state: "ready" }); };
  window.addEventListener(READY_EVENT, ready);
  onStatus({ state: "checking" });

  (async () => {
    const manifest = await manifestSizes();
    const tick = async () => {
      if (stopped) return;
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.active) return ready(); // Workbox only activates once every file is cached
      onStatus({ state: "downloading", bytes: await cachedBytes(manifest?.sizes), total: manifest?.total ?? 0 });
      timer = setTimeout(tick, 600);
    };
    tick();
  })();

  return () => { stopped = true; clearTimeout(timer); window.removeEventListener(READY_EVENT, ready); };
}
