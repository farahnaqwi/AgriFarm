// OWNER: Sakeet. FAKE: evidence cards come from the mocks.
// Real version: ml/ writes one JSON per registered plot to app/public/cards/{plot_id}.json,
// which the service worker caches, so this works offline.
//
// CONTRACT
//   getEvidenceCard(plot_id: string | null) -> Promise<EvidenceCard | null>  (types/index.ts)

import mockA from "@docs/mocks/report-farm-a-consistent.json";
import mockB from "@docs/mocks/report-farm-b-contradiction.json";

import type { EvidenceCard } from "../types/index.ts";

const CARDS: Record<string, EvidenceCard> = {
  [mockA.plot.plot_id]: mockA.evidence_summary as unknown as EvidenceCard,
  [mockB.plot.plot_id]: mockB.evidence_summary as unknown as EvidenceCard,
};

export async function getEvidenceCard(plotId: string | null): Promise<EvidenceCard | null> {
  return plotId ? (CARDS[plotId] ?? null) : null;
}
