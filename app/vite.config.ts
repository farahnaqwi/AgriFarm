import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

const fromRoot = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Shared contracts live outside app/ (docs/), Farah's engine in backend/engine.
      "@docs": fromRoot("../docs"),
      "@engine": fromRoot("../backend/engine"),
    },
  },
  server: { fs: { allow: [".."] } },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "AgriFarm",
        short_name: "AgriFarm",
        description: "Farm evidence report, works offline",
        lang: "sw",
        start_url: "/",
        display: "standalone",
        background_color: "#f6f3ea",
        theme_color: "#2f6b3a",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        // Everything the farmer flow needs offline: app shell, phrase audio, evidence cards, map overlay.
        globPatterns: ["**/*.{js,css,html,png,svg,json,mp3,webp}"],
        maximumFileSizeToCacheInBytes: 60 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
