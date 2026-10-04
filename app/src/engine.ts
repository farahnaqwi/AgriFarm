// OWNER: Farah. Adapter to the real report engine in backend/engine (v1 written so the app works for any
// farmer's real input; extend the rules there, this file stays a thin wrapper).
//
// CONTRACT (types in types/index.ts)
//   buildReport(capture: Capture, evidenceCard: EvidenceCard | null) -> Promise<Report>  (not yet approved)
//   seal(report: Report) -> Promise<Report>  approval + SHA-256 + QR payload, ON THE PHONE
// Both run offline. No network calls.

import { buildReport as build, seal as sealReport } from "@engine";
import type { Capture, EvidenceCard, Report } from "./types/index.ts";

export const buildReport = (capture: Capture, evidenceCard: EvidenceCard | null): Promise<Report> => build(capture, evidenceCard);

export const seal = (report: Report): Promise<Report> => sealReport(report, { baseUrl: import.meta.env.VITE_PUBLIC_BASE_URL });
