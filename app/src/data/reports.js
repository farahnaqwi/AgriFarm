// OWNER: Sakeet. FAKE: "upload" queues the report on this phone; nothing leaves the device yet.
// Real version: Supabase insert into `reports` (key = report hash) when a connection exists.
//
// CONTRACT
//   uploadReport(sealedReport) -> Promise<{ queued: boolean, uploaded: boolean }>
//   fetchReport(hash)          -> Promise<report | null>   (lender page; hash comes from the QR)
// Only called after the farmer taps "share". Raw audio is never uploaded.

import { load, save } from "../offline/store.js";
import mockA from "@docs/mocks/report-farm-a-consistent.json";
import mockB from "@docs/mocks/report-farm-b-contradiction.json";

export async function uploadReport(report) {
  const outbox = (await load("outbox")) ?? [];
  outbox.push({ hash: report.integrity.report_hash, report, queued_at: new Date().toISOString() });
  await save("outbox", outbox);
  return { queued: true, uploaded: false };
}

export async function fetchReport(hash) {
  return [mockA, mockB].find((r) => r.integrity.report_hash === hash) ?? null;
}
