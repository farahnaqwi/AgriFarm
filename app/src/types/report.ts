// GENERATED from docs/schema.json by `npm run types`. Do not edit by hand.

export type Claim = {
  claim_id: string;
  field:
    | "crop_type"
    | "plot_area"
    | "bad_season"
    | "cooperative_membership_years"
    | "last_harvest_delivered"
    | "coffee_tree_count"
    | "land_tenure";
  /**
   * crop_type: coffee|maize|coffee_banana|other. bad_season: 'YYYY/YY'. land_tenure: titled|customary_ccro|customary_undocumented|leased|family_use|other. Numbers as numbers.
   */
  value: string | number;
  unit: "ha" | "acre" | "years" | "kg_parchment" | "kg_cherry" | "trees" | null;
  /**
   * Words she used, original language, e.g. 'ekari tano'. Lets a person audit unit/number extraction.
   */
  value_as_spoken?: string | null;
  /**
   * e.g. 5 acre -> 2.02 ha. Deterministic conversion, not AI.
   */
  value_normalized?: {
    value?: number;
    unit?: string;
    [k: string]: unknown;
  } | null;
  /**
   * Precedence attested > machine_verified > self_reported.
   */
  tier: "self_reported" | "machine_verified" | "attested";
  source: {
    type:
      | "farmer_voice"
      | "farmer_tap"
      | "ledger_ocr"
      | "cooperative_cosign"
      | "extension_officer_cosign"
      | "document_upload";
    /**
     * e.g. audio:00:41.2-00:47.9 (audio itself stays on device).
     */
    ref?: string | null;
    quote?: string | null;
    asr_confidence?: number | null;
    /**
     * She confirmed the extracted value via fixed-choice tap. Unconfirmed values never enter a report.
     */
    confirmed_by_farmer: boolean;
  };
  /**
   * Confidence of the status decision when it rests on a model (e.g. classifier probability). null when the decision is deterministic or nothing could be checked.
   */
  confidence: number | null;
  status: "consistent" | "contradicted" | "unverifiable";
  checks: Check[];
  attestation_refs: string[];
  timestamp: string;
} & {
  claim_id: string;
  field:
    | "crop_type"
    | "plot_area"
    | "bad_season"
    | "cooperative_membership_years"
    | "last_harvest_delivered"
    | "coffee_tree_count"
    | "land_tenure";
  /**
   * crop_type: coffee|maize|coffee_banana|other. bad_season: 'YYYY/YY'. land_tenure: titled|customary_ccro|customary_undocumented|leased|family_use|other. Numbers as numbers.
   */
  value: string | number;
  unit: "ha" | "acre" | "years" | "kg_parchment" | "kg_cherry" | "trees" | null;
  /**
   * Words she used, original language, e.g. 'ekari tano'. Lets a person audit unit/number extraction.
   */
  value_as_spoken?: string | null;
  /**
   * e.g. 5 acre -> 2.02 ha. Deterministic conversion, not AI.
   */
  value_normalized?: {
    value?: number;
    unit?: string;
    [k: string]: unknown;
  } | null;
  /**
   * Precedence attested > machine_verified > self_reported.
   */
  tier: "self_reported" | "machine_verified" | "attested";
  source: {
    type:
      | "farmer_voice"
      | "farmer_tap"
      | "ledger_ocr"
      | "cooperative_cosign"
      | "extension_officer_cosign"
      | "document_upload";
    /**
     * e.g. audio:00:41.2-00:47.9 (audio itself stays on device).
     */
    ref?: string | null;
    quote?: string | null;
    asr_confidence?: number | null;
    /**
     * She confirmed the extracted value via fixed-choice tap. Unconfirmed values never enter a report.
     */
    confirmed_by_farmer: boolean;
  };
  /**
   * Confidence of the status decision when it rests on a model (e.g. classifier probability). null when the decision is deterministic or nothing could be checked.
   */
  confidence: number | null;
  status: "consistent" | "contradicted" | "unverifiable";
  checks: Check[];
  attestation_refs: string[];
  timestamp: string;
};

/**
 * Evidence about one plot, built from the farmer's own statements and checked against sources she cannot edit. It is an evidence report, not proof: it never approves a loan and never asserts land ownership. Each claim has a tier (what supports it) and a status (whether independent data agrees). integrity.report_hash = SHA-256 (hex) of the RFC 8785 (JCS) canonical JSON of the whole report with the `integrity` member removed. The hash is computed on the farmer's device when she approves sharing.
 */
export interface FarmEvidenceReport {
  schema_version: "1.0.0";
  report_id: string;
  created_at: string;
  provenance: {
    /**
     * mock = invented values; demo = real data, fictional farmer; live = real farmer. Lender view shows a banner unless live.
     */
    mode: "mock" | "demo" | "live";
    app_version: string;
    /**
     * SHA-256 of a per-install random ID. Never a raw IMEI or phone number.
     */
    device_id_hash: string;
    notes?: string;
    [k: string]: unknown;
  };
  /**
   * Language the farmer used and heard the report in.
   */
  farmer_language: "sw" | "en";
  farmer: {
    /**
     * Pseudonymous. No national ID, no phone number.
     */
    farmer_id: string;
    /**
     * Only present if consent.scope includes share_name.
     */
    display_name?: string | null;
    /**
     * As stated by the farmer. Membership itself is a claim, not metadata.
     */
    cooperative_name?: string | null;
  };
  consent: {
    /**
     * No report exists without consent.
     */
    given: true;
    recorded_at: string;
    method: "tap" | "voice" | "assisted_by_officer";
    /**
     * Exact consent phrase she heard (docs/phrases.json).
     */
    phrase_id: string;
    /**
     * @minItems 1
     */
    scope: [
      (
        | "record_voice"
        | "capture_photos"
        | "capture_location"
        | "use_satellite_and_weather"
        | "share_report_with_lender"
        | "share_name"
      ),
      ...(
        | "record_voice"
        | "capture_photos"
        | "capture_location"
        | "use_satellite_and_weather"
        | "share_report_with_lender"
        | "share_name"
      )[]
    ];
    /**
     * Raw audio never leaves the device.
     */
    raw_audio_retention: "deleted_after_extraction" | "kept_on_device";
    reviewed_report_audio: boolean;
    approved_for_sharing: boolean;
    approved_at?: string | null;
  };
  plot: {
    plot_id: string;
    country: string;
    admin_area: string;
    /**
     * GeoJSON Polygon, [lon, lat], WGS84, ring closed.
     */
    geometry: {
      type: "Polygon";
      /**
       * @minItems 1
       */
      coordinates: [
        [[number, number], [number, number], [number, number], [number, number], ...[number, number][]],
        ...[[number, number], [number, number], [number, number], [number, number], ...[number, number][]][]
      ];
      [k: string]: unknown;
    };
    geometry_source: "gps_walk" | "drawn_on_map" | "gps_walk_and_drawn";
    captured_at: string;
    /**
     * Geodesic area of geometry. Deterministic.
     */
    area_ha: number;
    /**
     * @minItems 2
     * @maxItems 2
     */
    centroid: [number, number];
    /**
     * Counts only; other farmers' IDs are never exposed.
     */
    overlap: {
      checked: boolean;
      overlapping_plot_count: number;
      max_overlap_fraction: number;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
  /**
   * @minItems 1
   */
  claims: [Claim, ...Claim[]];
  attestations: Attestation[];
  evidence_summary: {
    evidence_card_id: string;
    /**
     * When the online precompute ran. Everything after this ran offline.
     */
    computed_at: string;
    ndvi: {
      source: string;
      period_start: string;
      period_end: string;
      months_total: number;
      months_cloud_free: number;
      /**
       * 10 m pixels fully inside the polygon.
       */
      pixels_in_plot: number;
      monthly: {
        month: string;
        /**
         * Median over plot pixels; null = no cloud-free scene.
         */
        ndvi: number | null;
        [k: string]: unknown;
      }[];
      dry_season_mean?: number | null;
      wet_season_peak?: number | null;
      classifier: {
        model_id: string;
        predicted_class: "coffee" | "seasonal_crop" | "other" | "uncertain";
        probabilities: {
          coffee: number;
          seasonal_crop: number;
          other: number;
          [k: string]: unknown;
        };
        heldout_accuracy: number | null;
        heldout_n_fields: number | null;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    };
    rainfall: {
      source: string;
      /**
       * e.g. Nov-Apr (unimodal). Season '2021/22' = Nov 2021 - Apr 2022.
       */
      season_window: string;
      baseline_period: string;
      seasons: {
        season: string;
        total_mm: number;
        baseline_mean_mm: number;
        anomaly_pct: number;
        percentile: number;
        [k: string]: unknown;
      }[];
      [k: string]: unknown;
    };
    temperature: {
      source: string;
      seasons: {
        season: string;
        /**
         * Anomaly only. Absolute temps from a ~50 km cell are not meaningful at farm elevation.
         */
        mean_tmax_anomaly_c: number;
        [k: string]: unknown;
      }[];
      [k: string]: unknown;
    };
    /**
     * Context for 'why did yields slip', never used to verify or contradict a claim.
     */
    soil: {
      source: string;
      depth_cm: string;
      ph?: number | null;
      organic_carbon_g_kg?: number | null;
      nitrogen_total_g_kg?: number | null;
      is_model_estimate?: true;
      [k: string]: unknown;
    };
    photos: Photo[];
    tally: {
      self_reported: number;
      machine_verified: number;
      attested: number;
      consistent: number;
      contradicted: number;
      unverifiable: number;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
  /**
   * Report sentences. Farmer hears them in farmer_language via pre-generated clips; lender reads text.en. Sentences failing the grounding check are dropped, never shipped.
   */
  narrative: Sentence[];
  not_sure: {
    /**
     * True = machine could not decide something important. Farmer is told to ask a person before sharing; lender sees a banner and the site-visit button first.
     */
    flag: boolean;
    reasons: (
      | "low_classifier_confidence"
      | "too_few_cloud_free_months"
      | "plot_too_small_for_satellite"
      | "low_asr_confidence"
      | "unit_ambiguous"
      | "possible_duplicate_photo"
      | "plot_overlaps_other_plot"
      | "freshness_challenge_failed"
      | "photo_outside_plot"
    )[];
    phrase_id: string | null;
  };
  /**
   * Fixed list. Lender view renders each from docs/phrases.json (LIMIT_*).
   *
   * @minItems 1
   */
  limitations: [
    (
      | "ownership_not_shown"
      | "gps_can_be_spoofed"
      | "photos_can_be_faked"
      | "rainfall_is_5km_average"
      | "temperature_is_50km_average"
      | "satellite_misses_shaded_or_intercropped_coffee"
      | "soil_values_are_model_estimates"
      | "speech_recognition_can_mishear"
      | "yield_not_measured"
    ),
    ...(
      | "ownership_not_shown"
      | "gps_can_be_spoofed"
      | "photos_can_be_faked"
      | "rainfall_is_5km_average"
      | "temperature_is_50km_average"
      | "satellite_misses_shaded_or_intercropped_coffee"
      | "soil_values_are_model_estimates"
      | "speech_recognition_can_mishear"
      | "yield_not_measured"
    )[]
  ];
  disclaimer: "This is an evidence report, not proof. It does not approve or refuse a loan. A person makes the decision.";
  human_decision_required: true;
  integrity: {
    canonicalization: "RFC8785-JCS";
    hash_alg: "SHA-256";
    report_hash: string;
    /**
     * Moment the farmer approved sharing (on device).
     */
    hashed_at: string;
    /**
     * null until the report syncs; the hash alone already lets a lender detect edits.
     */
    signature: {
      alg: "ES256";
      key_id: string;
      signed_by: "backend" | "device" | "cooperative";
      /**
       * base64url signature over the raw 32-byte report hash.
       */
      value: string;
    } | null;
    /**
     * {VITE_PUBLIC_BASE_URL}/verify#r={report_id}&h={report_hash}. Fragment keeps the hash out of server logs.
     */
    qr_payload: string;
  };
}
export interface Check {
  /**
   * See docs/RULES.md.
   */
  rule_id: string;
  against:
    | "polygon_area"
    | "sentinel2_ndvi_classifier"
    | "photo_crop_check"
    | "chirps_rainfall"
    | "nasa_power_temperature"
    | "geofence";
  expected: unknown;
  observed: unknown;
  result: "consistent" | "contradicted" | "inconclusive";
  phrase_id?: string | null;
}
export interface Attestation {
  attestation_id: string;
  role: "cooperative" | "extension_officer";
  org_name: string;
  method: "in_app_cosign" | "signed_paper_upload";
  signed_at: string;
  /**
   * @minItems 1
   */
  covers_claims: [string, ...string[]];
  note?: string | null;
}
export interface Photo {
  photo_id: string;
  captured_at: string;
  lat: number;
  lon: number;
  gps_accuracy_m: number;
  heading_deg?: number | null;
  inside_plot: boolean;
  /**
   * 64-bit perceptual hash.
   */
  phash: string;
  /**
   * photo_id of a near-duplicate (Hamming <= 6) in any report.
   */
  duplicate_of: string | null;
  freshness: {
    challenge?: "turn_around";
    paired_photo_id?: string;
    heading_delta_deg?: number;
    seconds_elapsed?: number;
    passed?: boolean;
    [k: string]: unknown;
  } | null;
  crop_check?: {
    model_id?: string;
    label?: "coffee" | "not_coffee" | "uncertain";
    probability?: number;
    [k: string]: unknown;
  } | null;
  [k: string]: unknown;
}
export interface Sentence {
  sentence_id: string;
  phrase_id: string | null;
  generated_by: "template" | "llm";
  slots?: {
    [k: string]: unknown;
  };
  text: {
    en: string;
    sw: string;
    [k: string]: unknown;
  };
  claim_refs: string[];
  /**
   * Clip IDs played in order (phrase + slot clips).
   */
  audio_clips: string[];
  /**
   * Every number/claim in text appears in referenced claims or evidence_summary (R-NARR-01).
   */
  grounding_passed: true;
}
