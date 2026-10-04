// Supabase report storage (live tables: reports(hash, report, created_at),
// site_visit_requests(id, report_hash, lender, requested_at)). Without VITE_SUPABASE_* set, falls back to the mocks.
//
// CONTRACT
//   uploadReport(sealedReport: Report) -> Promise<{ queued: boolean; uploaded: boolean }>
//   fetchReport(hash: string)          -> Promise<Report | null>   (lender page; hash comes from the QR)
//   requestSiteVisit(hash, lender)     -> Promise<boolean>          (lender page "Request site visit")
//   pendingCount()                     -> Promise<number>  reports waiting for a connection
//   flushOutbox()                      -> Promise<{ sent: number; pending: number }>
//     called on app start and whenever the phone comes back online; removes each report once uploaded
// Only called after the farmer taps "share". Raw audio and photo pixels are never uploaded.
// The lender verifies integrity by re-hashing the fetched report against the hash in the QR,
// so a report edited in the database shows as altered.

import { load, save } from "../offline/store.ts";
import mockA from "@docs/mocks/report-farm-a-consistent.json";
import mockB from "@docs/mocks/report-farm-b-contradiction.json";
import type { Report } from "../types/index.ts";

interface Queued { hash: string; report: Report; queued_at: string }
const MOCKS = [mockA, mockB] as unknown as Report[];

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, "");
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** PostgREST call with the public (publishable) key. Times out so a weak 3G signal can't hang the app. */
async function rest(path: string, init: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      signal: ctl.signal,
      headers: { apikey: SUPABASE_KEY!, "content-type": "application/json", ...init.headers },
    });
  } finally {
    clearTimeout(timer);
  }
}

const readOutbox = async () => (await load<Queued[]>("outbox")) ?? [];

/** Queue first (works offline), then try to send right away. */
export async function uploadReport(report: Report): Promise<{ queued: boolean; uploaded: boolean }> {
  const outbox = await readOutbox();
  if (!outbox.some((q) => q.hash === report.integrity.report_hash)) {
    outbox.push({ hash: report.integrity.report_hash, report, queued_at: new Date().toISOString() });
    await save("outbox", outbox);
  }
  const { sent, pending } = await flushOutbox();
  return { queued: pending > 0, uploaded: sent > 0 };
}

export async function flushOutbox(): Promise<{ sent: number; pending: number }> {
  const outbox = await readOutbox();
  if (!supabaseConfigured || !navigator.onLine || outbox.length === 0) return { sent: 0, pending: outbox.length };
  const left: Queued[] = [];
  let sent = 0;
  for (const item of outbox) {
    try {
      const res = await rest("reports", {
        method: "POST",
        headers: { prefer: "return=minimal" },
        body: JSON.stringify({ hash: item.hash, report: item.report }),
      });
      // 409 = this exact report (same hash) is already stored: nothing left to send.
      if (res.ok || res.status === 409) sent++;
      else left.push(item);
    } catch {
      left.push(item); // offline or timed out; try again next time
    }
  }
  await save("outbox", left);
  return { sent, pending: left.length };
}

export async function pendingCount(): Promise<number> {
  return (await readOutbox()).length;
}

export async function fetchReport(hash: string): Promise<Report | null> {
  if (!/^[0-9a-f]{64}$/.test(hash)) return null;
  if (!supabaseConfigured) return MOCKS.find((r) => r.integrity.report_hash === hash) ?? null;
  // Preferred: a get_report(h) function, so the table itself never has to be readable by everyone.
  const viaFn = await rest("rpc/get_report", { method: "POST", body: JSON.stringify({ h: hash }) });
  if (viaFn.ok) return ((await viaFn.json()) as Report | null) ?? null;
  // Fallback while that function doesn't exist: read the one row by its hash.
  const res = await rest(`reports?hash=eq.${hash}&select=report&limit=1`);
  if (!res.ok) return null;
  const rows = (await res.json()) as { report: Report }[];
  return rows[0]?.report ?? null;
}

export async function requestSiteVisit(hash: string, lender: string): Promise<boolean> {
  if (!supabaseConfigured) return false;
  const res = await rest("site_visit_requests", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ report_hash: hash, lender }),
  });
  return res.ok;
}
