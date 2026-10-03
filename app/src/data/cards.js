// OWNER: Sakeet. FAKE: evidence cards come from the mocks.
// Real version: ml/ writes one JSON per registered plot to app/public/cards/{plot_id}.json,
// which the service worker caches, so this works offline.
//
// CONTRACT
//   getEvidenceCard(plot_id) -> evidence_summary block of docs/schema.json (without photos/tally), or null

import mockA from "@docs/mocks/report-farm-a-consistent.json";
import mockB from "@docs/mocks/report-farm-b-contradiction.json";

const CARDS = {
  [mockA.plot.plot_id]: mockA.evidence_summary,
  [mockB.plot.plot_id]: mockB.evidence_summary,
};

export async function getEvidenceCard(plotId) {
  return CARDS[plotId] ?? null;
}
