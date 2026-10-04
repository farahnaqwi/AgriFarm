// The language the farmer app shows and speaks. English by default; the top-bar picker switches it, and a
// link with ?lang=sw opens in Swahili. In Swahili, English stays underneath as the quiet second line.
// Adding a language = a column in docs/phrases.json, its clips in public/audio/{id}/, and a row here.

import { useSyncExternalStore } from "react";
import type { Lang } from "./phrases.ts";

export const LANGUAGES: { id: Lang; name: string }[] = [
  { id: "en", name: "English" },
  { id: "sw", name: "Kiswahili" },
];

const KEY = "agrifarm-lang";
const isLang = (v: unknown): v is Lang => LANGUAGES.some((l) => l.id === v);
const listeners = new Set<() => void>();

function remember(lang: Lang) {
  try { localStorage.setItem(KEY, lang); } catch { /* private mode: still works for this visit */ }
}

function initial(): Lang {
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  if (isLang(fromUrl)) { remember(fromUrl); return fromUrl; }
  try {
    const saved = localStorage.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch { /* storage blocked */ }
  return "en";
}

let current: Lang = initial();
document.documentElement.lang = current;

export const getLang = (): Lang => current;

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  remember(lang);
  document.documentElement.lang = lang;
  listeners.forEach((fn) => fn());
}

export const useLang = (): Lang =>
  useSyncExternalStore((fn) => (listeners.add(fn), () => { listeners.delete(fn); }), getLang);
