import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";

const fromRoot = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // One .env at the repo root (shared with scripts/). Only VITE_* values reach the browser.
  envDir: fromRoot(".."),
  resolve: {
    alias: {
      // Shared contracts live outside app/ (docs/), Farah's engine in backend/engine.
      "@docs": fromRoot("../docs"),
      "@engine": fromRoot("../backend/engine"),
    },
  },
  // ADDED: don't pre-bundle the huge speech library; it ships its own bundle.
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  server: {
    fs: { allow: [".."] },
    // ADDED: stop the file watcher locking the big model files (the EBUSY errors).
    watch: { ignored: ["**/public/models/**", "**/public/ort/**"] },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        id: "/",
        name: "AgriFarm",
        short_name: "AgriFarm",
        description: "Farm evidence report, works offline",
        lang: "sw",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        categories: ["productivity", "utilities"],
        background_color: "#f6f3ea",
        theme_color: "#2f6b3a",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // ADDED onnx, wasm, mjs, txt so the speech model is cached for airplane mode.
        globPatterns: ["**/*.{js,css,html,png,jpg,jpeg,svg,json,mp3,webp,woff2,onnx,wasm,mjs,txt}"],
        // The build also emits its own copy of the ONNX runtime; asr.ts loads the one in /ort/, so don't download this twice.
        globIgnores: ["**/assets/ort-wasm-*"],
        maximumFileSizeToCacheInBytes: 60 * 1024 * 1024,
        // The size of every precached file, so the first-run screen shows real download progress (lib/offline.ts).
        manifestTransforms: [async (entries) => {
          const files = entries.map((e) => ({ url: e.url, bytes: e.size }));
          mkdirSync(fromRoot("dist"), { recursive: true });
          writeFileSync(fromRoot("dist/offline-manifest.json"), JSON.stringify({ files, bytes: files.reduce((a, f) => a + f.bytes, 0) }));
          return { manifest: entries, warnings: [] };
        }],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
