// OWNER: Sakeet. FAKE: "upload" queues the report on this phone; nothing leaves the device yet.
// Real version: Supabase insert into `reports` (key = report hash) when a connection exists.
//
// CONTRACT
//   uploadReport(sealedReport: Report) -> Promise<{ queued: boolean; uploaded: boolean }>
//   fetchReport(hash: string)       -> Promise<Report | null>   (lender page; hash comes from the QR)
//   pendingCount()                  -> Promise<number>  reports waiting for a connection
//   flushOutbox()                   -> Promise<{ sent: number; pending: number }>
//     called on app start and whenever the phone comes back online; removes each report once uploaded
// Only called after the farmer taps "share". Raw audio is never uploaded.

import { load, save } from "../offline/store.ts";
import mockA from "@docs/mocks/report-farm-a-consistent.json";
import mockB from "@docs/mocks/report-farm-b-contradiction.json";
import type { Report } from "../types/index.ts";

interface Queued { hash: string; report: Report; queued_at: string }
const MOCKS = [mockA, mockB] as unknown as Report[];

export async function uploadReport(report: Report): Promise<{ queued: boolean; uploaded: boolean }> {
  const outbox = (await load<Queued[]>("outbox")) ?? [];
  outbox.push({ hash: report.integrity.report_hash, report, queued_at: new Date().toISOString() });
  await save("outbox", outbox);
  return { queued: true, uploaded: false };
}

export async function fetchReport(hash: string): Promise<Report | null> {
  return MOCKS.find((r) => r.integrity.report_hash === hash) ?? null;
}

export async function pendingCount(): Promise<number> {
  return ((await load<Queued[]>("outbox")) ?? []).length;
}

export async function flushOutbox(): Promise<{ sent: number; pending: number }> {
  // FAKE: there is no server yet, so everything stays queued. Real: upload each, drop it from the outbox on success.
  return { sent: 0, pending: await pendingCount() };
}
