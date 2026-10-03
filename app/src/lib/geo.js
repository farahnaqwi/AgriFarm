import mockA from "@docs/mocks/report-farm-a-consistent.json";
import mockB from "@docs/mocks/report-farm-b-contradiction.json";
import { centroid } from "./geometry.js";

// Real GPS on a phone in Mbozi. DEMO mode simulates positions inside the demo plot because the
// team is not in Tanzania. The UI shows a "DEMO GPS" badge whenever it is on. This is exactly
// the GPS-spoofing limit we disclose, so the video must say it.

const KEY = "agrifarm-demo";
export function demoOn() {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}
export function setDemo(on) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* private mode */ }
}

export const DEMO_FARMS = {
  A: { label: "Noor (A)", plot_id: mockA.plot.plot_id, ring: mockA.plot.geometry.coordinates[0] },
  B: { label: "Farm B", plot_id: mockB.plot.plot_id, ring: mockB.plot.geometry.coordinates[0] },
};

const M_PER_DEG_LAT = 110600;
const jitter = (m) => ((Math.random() - 0.5) * 2 * m) / M_PER_DEG_LAT;

/** @returns {Promise<{lat:number, lon:number, accuracy:number, demo:boolean}>} */
export function getPosition({ farm = "A", outside = false } = {}) {
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

/** Streams [lon,lat] points while the farmer walks her boundary. Returns a stop() function. */
export function watchWalk(onPoint, { farm = "A" } = {}) {
  if (demoOn()) {
    const ring = DEMO_FARMS[farm].ring;
    const pts = [];
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
  let last = null;
  const id = navigator.geolocation.watchPosition(
    (p) => {
      if (p.coords.accuracy > 20) return;
      const pt = [p.coords.longitude, p.coords.latitude];
      const moved = last ? Math.hypot((pt[0] - last[0]) * 109900, (pt[1] - last[1]) * M_PER_DEG_LAT) : Infinity;
      if (moved >= 5) onPoint((last = pt));
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 0 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

// Compass heading for the turn-around freshness challenge (R-FRESH-01).
let heading = null;
let listening = false;
export async function startCompass() {
  if (listening) return;
  listening = true;
  try {
    if (typeof DeviceOrientationEvent?.requestPermission === "function") await DeviceOrientationEvent.requestPermission();
  } catch { /* iOS denied: heading stays null */ }
  const onOrient = (e) => {
    if (typeof e.webkitCompassHeading === "number") heading = e.webkitCompassHeading;
    else if (e.absolute && typeof e.alpha === "number") heading = (360 - e.alpha) % 360;
  };
  window.addEventListener("deviceorientationabsolute", onOrient);
  window.addEventListener("deviceorientation", onOrient);
}

/** Demo mode: first photo faces 40°, the turn-around photo 218°. */
export function getHeading(photoIndex = 0) {
  if (demoOn()) return photoIndex % 2 ? 218 : 40;
  return heading;
}
