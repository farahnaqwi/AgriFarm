// OWNER: Nick.
//
// CONTRACT (Nick -> Farah): the object the phone hands to buildReport(capture, evidenceCard).
// Field shapes match docs/schema.json; the engine adds tier/status/checks/confidence and everything else.
//
// {
//   capture_id, farmer_language: "sw", device_id_hash, demo_farm: "A"|"B"|null,
//   plot_id,                         // registered plot whose evidence card was side-loaded
//   consent: { given, recorded_at, method, phrase_id, scope[], raw_audio_retention },
//   claims: [{ claim_id, field, value, unit, value_as_spoken, source{...confirmed_by_farmer:true}, timestamp }],
//   plot:   { geometry: GeoJSON Polygon, geometry_source, captured_at },
//   photos: [{ photo_id, captured_at, lat, lon, gps_accuracy_m, heading_deg, inside_plot, phash, freshness, demo }]
//   // photo pixels stay in IndexedDB on the phone (photoBlobs), never in the capture object
// }

import { deviceIdHash } from "../offline/store.js";
import { DEMO_FARMS } from "../lib/geo.js";

export async function newCapture(demoFarm) {
  return {
    capture_id: crypto.randomUUID(),
    farmer_language: "sw",
    device_id_hash: await deviceIdHash(),
    demo_farm: demoFarm,
    plot_id: DEMO_FARMS[demoFarm]?.plot_id ?? null,
    consent: null,
    claims: [],
    plot: null,
    photos: [],
  };
}

export const CONSENT_SCOPE = ["record_voice", "capture_photos", "capture_location", "use_satellite_and_weather", "share_report_with_lender"];

export const now = () => new Date().toISOString();
