// OWNER: Farah. FAKE: returns the matching mock report and ignores the capture.
// When backend/engine is ready, replace this whole file with:
//   export { buildReport, seal } from "@engine";
//
// CONTRACT (types in types/index.ts)
//   buildReport(capture: Capture, evidenceCard: EvidenceCard | null) -> Promise<Report>  (integrity still empty)
//   seal(report: Report) -> Promise<Report>
//     sets consent.reviewed_report_audio / approved_for_sharing / approved_at = now,
//     then fills integrity (JCS + SHA-256), ON THE PHONE, at the moment she approves
// Both run offline. No network calls.

import mockA from "@docs/mocks/report-farm-a-consistent.json";
import mockB from "@docs/mocks/report-farm-b-contradiction.json";
import type { Capture, EvidenceCard, Report } from "./types/index.ts";

export async function buildReport(capture: Capture, _evidenceCard: EvidenceCard | null): Promise<Report> {
  const report = structuredClone((capture.demo_farm === "B" ? mockB : mockA) as unknown as Report);
  report.provenance.notes = "FAKE ENGINE: this is the mock report, not computed from the capture.";
  return report;
}

export async function seal(report: Report): Promise<Report> {
  return report; // mocks are already sealed
}
