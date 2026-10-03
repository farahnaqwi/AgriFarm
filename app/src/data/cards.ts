// OWNER: Sakeet. FAKE: evidence cards come from the mocks.
// Real version: ml/ writes one JSON per registered plot to app/public/cards/{plot_id}.json,
// which the service worker caches, so this works offline.
//
// CONTRACT
//   listRegisteredPlots() -> Promise<RegisteredPlot[]>   the cooperative's registry of member plots that have
//                                                         a precomputed evidence card (real: public/cards/index.json)
//   getEvidenceCard(plot_id: string | null) -> Promise<EvidenceCard | null>  (types/index.ts)
// The farmer's drawn plot is matched to a registered plot on the phone (lib/registry.ts). The missing registry
// is the real-world constraint the brief points at: unregistered plots get a report without satellite checks.

import mockA from "@docs/mocks/report-farm-a-consistent.json";
import mockB from "@docs/mocks/report-farm-b-contradiction.json";

import type { EvidenceCard, RegisteredPlot } from "../types/index.ts";

const CARDS: Record<string, EvidenceCard> = {
  [mockA.plot.plot_id]: mockA.evidence_summary as unknown as EvidenceCard,
  [mockB.plot.plot_id]: mockB.evidence_summary as unknown as EvidenceCard,
};

export async function getEvidenceCard(plotId: string | null): Promise<EvidenceCard | null> {
  return plotId ? (CARDS[plotId] ?? null) : null;
}

export async function listRegisteredPlots(): Promise<RegisteredPlot[]> {
  return [mockA, mockB].map((m) => ({ plot_id: m.plot.plot_id, ring: m.plot.geometry.coordinates[0] }));
}
