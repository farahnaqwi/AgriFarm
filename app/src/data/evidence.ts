// Evidence cards the phone carries for the cooperative's registered plots: REAL satellite, rain, temperature and
// soil data for the two demo plots, pulled by `node scripts/fetch-evidence.ts` (sources in that file and
// docs/EVIDENCE.md). Bundled into the app, so it works offline. Same contract as cards.ts, which serves the mocks.
//
//   listRegisteredPlots() -> Promise<RegisteredPlot[]>
//   getEvidenceCard(plot_id: string | null) -> Promise<EvidenceCard | null>

import data from "./evidence/demo-plots.json";
import type { DemoFarm, EvidenceCard, RegisteredPlot } from "../types/index.ts";

interface DemoPlot extends RegisteredPlot { key: DemoFarm; label: string; pattern: string }

export const DEMO_PLOTS = data.plots as DemoPlot[];
const CARDS = data.cards as unknown as Record<string, EvidenceCard>;

export async function getEvidenceCard(plotId: string | null): Promise<EvidenceCard | null> {
  return plotId ? (CARDS[plotId] ?? null) : null;
}

export async function listRegisteredPlots(): Promise<RegisteredPlot[]> {
  return DEMO_PLOTS.map(({ plot_id, ring, country, admin_area }) => ({ plot_id, ring, country, admin_area }));
}
