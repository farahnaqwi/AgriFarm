// OWNER: Nick.
//
// CONTRACT (Nick -> Farah): the `Capture` object in types/index.ts is what the phone hands to
// buildReport(capture, evidenceCard). Field shapes match docs/schema.json; the engine adds
// tier/status/checks/confidence and everything else. Photo pixels stay in IndexedDB.

import { deviceIdHash } from "../offline/store.ts";
import { DEMO_FARMS } from "../lib/geo.ts";
import type { Capture, Consent, DemoFarm } from "../types/index.ts";

export async function newCapture(demoFarm: DemoFarm | null): Promise<Capture> {
  return {
    capture_id: crypto.randomUUID(),
    farmer_language: "sw",
    device_id_hash: await deviceIdHash(),
    demo_farm: demoFarm,
    plot_id: demoFarm ? DEMO_FARMS[demoFarm].plot_id : null,
    consent: null,
    claims: [],
    plot: null,
    photos: [],
  };
}

export const CONSENT_SCOPE: Consent["scope"] = ["record_voice", "capture_photos", "capture_location", "use_satellite_and_weather", "share_report_with_lender"];

export const now = (): string => new Date().toISOString();
