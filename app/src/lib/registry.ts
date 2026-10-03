import { centroid, insidePlot } from "./geometry.ts";
import type { RegisteredPlot } from "../types/index.ts";

/**
 * Finds the cooperative-registered plot the farmer just walked or drew, entirely on the phone.
 * Match = either plot's centre falls inside the other (20 m tolerance for GPS and drawing error).
 * No match -> no evidence card -> satellite and rain checks come back "could not be checked".
 */
export function matchRegisteredPlot(ring: number[][], registered: RegisteredPlot[]): RegisteredPlot | null {
  const mine = centroid(ring);
  const hits = registered.filter((p) => insidePlot(mine, p.ring, 20) || insidePlot(centroid(p.ring), ring, 20));
  const dist = (p: RegisteredPlot) => {
    const [x, y] = centroid(p.ring);
    return Math.hypot(x - mine[0], y - mine[1]);
  };
  hits.sort((a, b) => dist(a) - dist(b)); // nearest centre wins if plots touch
  return hits[0] ?? null;
}
