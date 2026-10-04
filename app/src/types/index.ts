// Shared contracts between Nick (capture), Farah (engine/lender) and Sakeet (AI/data).
// Report types are generated from docs/schema.json (report.ts). Change the schema, then `npm run types`.

import type { FarmEvidenceReport, Claim, Photo } from "./report.ts";

export type { Claim, Check, Attestation, Photo, Sentence } from "./report.ts";
export type Report = FarmEvidenceReport;
// Pick (not Omit): generated types have index signatures, and Omit would erase the known keys.
export type EvidenceCard = Pick<Report["evidence_summary"], "evidence_card_id" | "computed_at" | "ndvi" | "rainfall" | "temperature" | "soil">;
export type Consent = Pick<Report["consent"], "given" | "recorded_at" | "method" | "phrase_id" | "scope" | "raw_audio_retention">;
export type ClaimField = Claim["field"];
export type ClaimUnit = Claim["unit"];
export type DemoFarm = "A" | "B";

/** What Sakeet's extractClaims() returns. Never used until the farmer confirms each one by tap. */
export type CandidateClaim = Pick<Claim, "field" | "value" | "unit" | "value_as_spoken" | "source">;

/** A claim after the farmer confirmed it. The engine adds tier/status/checks/confidence/attestation_refs. */
export type ConfirmedClaim = CandidateClaim & { claim_id: string; timestamp: string };

/** A photo as captured. The engine re-checks the geofence and fills duplicate_of / crop_check. */
export type CapturePhoto = Photo & { demo: boolean };

export interface PlotCapture {
  geometry: Report["plot"]["geometry"];
  geometry_source: Report["plot"]["geometry_source"];
  captured_at: string;
}

/** CONTRACT (Nick -> Farah): what the phone hands to buildReport(capture, evidenceCard). */
export interface Capture {
  capture_id: string;
  farmer_language: "sw" | "en";
  device_id_hash: string;
  demo_farm: DemoFarm | null;
  /** Registered plot whose evidence card was side-loaded onto the phone (null = not in the registry). */
  plot_id: string | null;
  /** Where that registered plot is. Comes from the registry, never hardcoded. */
  plot_meta?: PlotMeta | null;
  consent: Consent | null;
  claims: ConfirmedClaim[];
  plot: PlotCapture | null;
  /** Pixels stay in IndexedDB (`photo:{photo_id}`), never in the capture object. */
  photos: CapturePhoto[];
}

export interface Transcript {
  text: string;
  segments: { start: number; end: number; text: string; confidence: number | null }[];
}

export type LonLat = [number, number];

/** A plot in the cooperative's registry, with a precomputed evidence card bundled on the phone. */
export interface PlotMeta {
  country: string; // ISO 3166-1 alpha-2
  admin_area: string;
}

export interface RegisteredPlot extends PlotMeta {
  plot_id: string;
  ring: number[][];
}
