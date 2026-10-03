// OWNER: Farah. FAKE: returns the matching mock report and ignores the capture.
// When backend/engine is ready, replace this whole file with:
//   export { buildReport, seal } from "@engine";
//
// CONTRACT
//   buildReport(capture, evidenceCard) -> report (docs/schema.json, integrity: null)
//     capture      = see app/src/capture/capture.js
//     evidenceCard = the evidence_summary block for capture.plot_id (app/src/data/cards.js)
//   seal(report) -> sets consent.reviewed_report_audio / approved_for_sharing / approved_at = now,
//                   then fills integrity (JCS + SHA-256), ON THE PHONE, at the moment she approves
// Both run offline. No network calls.

import mockA from "@docs/mocks/report-farm-a-consistent.json";
import mockB from "@docs/mocks/report-farm-b-contradiction.json";

export async function buildReport(capture, _evidenceCard) {
  const report = structuredClone(capture.demo_farm === "B" ? mockB : mockA);
  report.provenance.notes = "FAKE ENGINE: this is the mock report, not computed from the capture.";
  return report;
}

export async function seal(report) {
  return report; // mocks are already sealed
}
