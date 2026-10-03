// "Install to home screen" support. Android/desktop Chrome fire `beforeinstallprompt`, which we keep
// and replay from our own big button. iOS Safari has no prompt: the user must use Share -> Add to Home Screen.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // keep it for our own button instead of the browser's mini-bar
  deferred = e as BeforeInstallPromptEvent;
  notify();
});
window.addEventListener("appinstalled", () => {
  deferred = null;
  notify();
});

export const onInstallChange = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Running from the home-screen icon (no browser UI). */
export const isStandalone = (): boolean =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIOS = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent);

export const canPromptInstall = (): boolean => deferred !== null;

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  notify();
  return outcome === "accepted";
}
