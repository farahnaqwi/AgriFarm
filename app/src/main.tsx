import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import { unlockAudio } from "./lib/audio.ts";
import { announceOfflineReady, resetApp } from "./lib/offline.ts";
import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-700.css";
import "@fontsource/atkinson-hyperlegible-next/latin-800.css";
import "@fontsource/atkinson-hyperlegible-mono/latin-500.css";
import "./styles.css";

if (new URLSearchParams(window.location.search).get("fresh") === "1") {
  // ?fresh=1: wipe this phone's copy and come back to the first-run screen (resetApp reloads without the flag).
  resetApp();
} else {
  // The offline cache (app + speech model, ~78 MB) is for the farmer's phone; a lender opening a QR link doesn't need it.
  if (!window.location.pathname.startsWith("/verify")) registerSW({ immediate: true, onOfflineReady: announceOfflineReady });
  // Browsers allow sound only after a tap: unlock it inside the very first one, wherever it lands.
  for (const type of ["pointerdown", "keydown"] as const) document.addEventListener(type, unlockAudio, { capture: true });
  createRoot(document.getElementById("root")!).render(<App />);
}
