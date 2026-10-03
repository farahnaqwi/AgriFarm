import { get, set, clear, createStore } from "idb-keyval";

// Everything the farmer captures stays in IndexedDB on this phone until she taps "share".
const db = createStore("agrifarm", "kv");

export const load = <T>(key: string): Promise<T | undefined> => get<T>(key, db);
export const save = (key: string, value: unknown): Promise<void> => set(key, value, db);
export const wipeAll = (): Promise<void> => clear(db);

/** SHA-256 of a random per-install ID. Never an IMEI or phone number. */
export async function deviceIdHash(): Promise<string> {
  let id: string | null;
  try {
    id = localStorage.getItem("agrifarm-device");
    if (!id) localStorage.setItem("agrifarm-device", (id = crypto.randomUUID()));
  } catch {
    id = crypto.randomUUID();
  }
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
