import mockA from "@docs/mocks/report-farm-a-consistent.json";
import mockB from "@docs/mocks/report-farm-b-contradiction.json";
import { centroid } from "./geometry.ts";
import type { DemoFarm, LonLat } from "../types/index.ts";

// Real GPS on a phone in Mbozi. DEMO mode simulates positions inside the demo plot because the
// team is not in Tanzania. The UI shows a "DEMO GPS" badge whenever it is on. This is exactly
// the GPS-spoofing limit we disclose, so the video must say it.

const KEY = "agrifarm-demo";
export function demoOn(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}
export function setDemo(on: boolean): void {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* private mode */ }
}

export const DEMO_FARMS: Record<DemoFarm, { label: string; plot_id: string; ring: number[][] }> = {
  A: { label: "Noor (A)", plot_id: mockA.plot.plot_id, ring: mockA.plot.geometry.coordinates[0] },
  B: { label: "Farm B", plot_id: mockB.plot.plot_id, ring: mockB.plot.geometry.coordinates[0] },
};

export interface Position { lat: number; lon: number; accuracy: number; demo: boolean }

const M_PER_DEG_LAT = 110600;
const jitter = (m: number): number => ((Math.random() - 0.5) * 2 * m) / M_PER_DEG_LAT;

export function getPosition({ farm = "A", outside = false }: { farm?: DemoFarm; outside?: boolean } = {}): Promise<Position> {
  if (demoOn()) {
    const [lon, lat] = centroid(DEMO_FARMS[farm].ring);
    const north = outside ? 150 / M_PER_DEG_LAT : 0;
    return Promise.resolve({ lat: lat + north + jitter(3), lon: lon + jitter(3), accuracy: 6, demo: true });
  }
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, demo: false }),
      reject,
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    ),
  );
}

export const GOOD_FIX_M = 20;
export interface Fix { accuracy: number; demo: boolean }

/** Reports GPS lock quality: onFix({ accuracy, demo }) or onFix(null) while searching. Returns stop(). */
export function watchFix(onFix: (fix: Fix | null) => void): () => void {
  if (demoOn()) {
    onFix({ accuracy: 6, demo: true });
    return () => {};
  }
  if (!navigator.geolocation) return () => {};
  onFix(null);
  const id = navigator.geolocation.watchPosition(
    (p) => onFix({ accuracy: Math.round(p.coords.accuracy), demo: false }),
    () => onFix(null),
    { enableHighAccuracy: true, maximumAge: 0 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Streams [lon,lat] points while the farmer walks her boundary. Returns a stop() function. */
export function watchWalk(onPoint: (p: LonLat) => void, { farm = "A" }: { farm?: DemoFarm } = {}): () => void {
  if (demoOn()) {
    const ring = DEMO_FARMS[farm].ring;
    const pts: LonLat[] = [];
    for (let i = 0; i < ring.length - 1; i++) {
      for (let k = 0; k < 4; k++) {
        const f = k / 4;
        pts.push([ring[i][0] + (ring[i + 1][0] - ring[i][0]) * f, ring[i][1] + (ring[i + 1][1] - ring[i][1]) * f]);
      }
    }
    let i = 0;
    const id = setInterval(() => (i < pts.length ? onPoint(pts[i++]) : clearInterval(id)), 350);
    return () => clearInterval(id);
  }
  let last: LonLat | null = null;
  const id = navigator.geolocation.watchPosition(
    (p) => {
      if (p.coords.accuracy > GOOD_FIX_M) return;
      const pt: LonLat = [p.coords.longitude, p.coords.latitude];
      const moved = last ? Math.hypot((pt[0] - last[0]) * 109900, (pt[1] - last[1]) * M_PER_DEG_LAT) : Infinity;
      if (moved >= 5) onPoint((last = pt));
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 0 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

// Compass heading for the turn-around freshness challenge (R-FRESH-01).
type OrientationEventWithCompass = DeviceOrientationEvent & { webkitCompassHeading?: number };
type OrientationPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

let heading: number | null = null;
let listening = false;
export async function startCompass(): Promise<void> {
  if (listening) return;
  listening = true;
  try {
    const DOE = window.DeviceOrientationEvent as unknown as OrientationPermission | undefined;
    if (typeof DOE?.requestPermission === "function") await DOE.requestPermission();
  } catch { /* iOS denied: heading stays null */ }
  const onOrient = (e: Event): void => {
    const o = e as OrientationEventWithCompass;
    if (typeof o.webkitCompassHeading === "number") heading = o.webkitCompassHeading;
    else if (o.absolute && typeof o.alpha === "number") heading = (360 - o.alpha) % 360;
  };
  window.addEventListener("deviceorientationabsolute", onOrient);
  window.addEventListener("deviceorientation", onOrient);
}

/** Demo mode: first photo faces 40°, the turn-around photo 218°. */
export function getHeading(photoIndex = 0): number | null {
  if (demoOn()) return photoIndex % 2 ? 218 : 40;
  return heading;
}
