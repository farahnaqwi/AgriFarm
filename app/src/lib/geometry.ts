import type { LonLat } from "../types/index.ts";

// Capture-side geometry for live feedback (area while drawing, geofence at the shutter).
// Farah's engine recomputes everything; these values are never trusted on their own.

const R = 6378137;
const rad = (d: number): number => (d * Math.PI) / 180;
export const HA_PER_ACRE = 0.40468564224;

/** Open path -> closed GeoJSON ring */
export const closeRing = (pts: LonLat[]): LonLat[] => (pts.length ? [...pts, pts[0]] : []);

export function areaHa(ring: number[][]): number {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lo1, la1] = ring[i];
    const [lo2, la2] = ring[i + 1];
    s += rad(lo2 - lo1) * (2 + Math.sin(rad(la1)) + Math.sin(rad(la2)));
  }
  return Math.abs((s * R * R) / 2) / 10000;
}

export function centroid(ring: number[][]): LonLat {
  const p = ring.slice(0, -1);
  return [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length];
}

export function pointInRing([x, y]: LonLat, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Metres from a point to the nearest ring edge (local equirectangular; fine at plot scale). */
export function distanceToRingM([lon, lat]: LonLat, ring: number[][]): number {
  const kx = 111320 * Math.cos(rad(lat));
  const ky = 110600;
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const ax = (ring[i][0] - lon) * kx, ay = (ring[i][1] - lat) * ky;
    const bx = (ring[i + 1][0] - lon) * kx, by = (ring[i + 1][1] - lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** R-GEO-01: inside, or within max(10 m, GPS accuracy) of the boundary. */
export function insidePlot(lonlat: LonLat, ring: number[][], accuracyM: number): boolean {
  return pointInRing(lonlat, ring) || distanceToRingM(lonlat, ring) <= Math.max(10, accuracyM || 0);
}
