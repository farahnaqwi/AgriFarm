// Plain-English wording for the lender page. Values come straight from the report; nothing is inferred here.

import { CROPS, FIELD, TENURE } from "../capture/labels.ts";
import type { Check, Claim, Report } from "../types/index.ts";

type NotSureReason = Report["not_sure"]["reasons"][number];
type Status = Claim["status"];

export const STATUS_EN: Record<Status, string> = {
  contradicted: "Contradicted",
  consistent: "Consistent",
  unverifiable: "Not checked",
};

export const TIER_EN: Record<Claim["tier"], string> = {
  self_reported: "Farmer said",
  machine_verified: "Satellite / weather",
  attested: "Co-signed",
};

/** Problems first, then what holds up, then what nothing could check. */
export const STATUS_ORDER: Record<Status, number> = { contradicted: 0, consistent: 1, unverifiable: 2 };

export const NOT_SURE_EN: Record<NotSureReason, string> = {
  low_classifier_confidence: "The crop classifier was not confident enough to decide.",
  too_few_cloud_free_months: "Too few cloud-free satellite months to judge the crop.",
  plot_too_small_for_satellite: "The plot is too small for 10 m satellite pixels.",
  plot_not_registered: "The plot is not in the cooperative registry, so no satellite or weather checks ran.",
  low_asr_confidence: "Speech recognition was unsure of what the farmer said.",
  unit_ambiguous: "It is unclear whether the farmer meant acres or hectares.",
  possible_duplicate_photo: "A photo may be a copy of an earlier one.",
  plot_overlaps_other_plot: "The plot overlaps another farmer's plot.",
  freshness_challenge_failed: "The turn-around photo check failed.",
  photo_outside_plot: "A photo was taken outside the plot.",
};

const CLASS_EN: Record<string, string> = {
  coffee: "coffee (green all year)",
  seasonal_crop: "a seasonal crop such as maize",
  other: "not cropland",
  uncertain: "unclear",
};

export const fieldName = (field: string): string => FIELD[field]?.en ?? field.replace(/_/g, " ");

export function claimValue(c: Claim): string {
  const v = String(c.value);
  switch (c.field) {
    case "crop_type": return CROPS.find((x) => x.value === v)?.en ?? v;
    case "land_tenure": return TENURE.find((x) => x.value === v)?.en ?? v;
    case "bad_season": return `${v} season`;
    case "cooperative_membership_years": return `${v} ${c.value === 1 ? "year" : "years"}`;
    case "plot_area": {
      if (c.unit === "acre") {
        const n = c.value_normalized;
        const ha = n?.unit === "ha" && typeof n.value === "number" ? ` (${fmt(n.value)} ha)` : "";
        return `${v} ${c.value === 1 ? "acre" : "acres"}${ha}`;
      }
      return `${v} ${c.unit ?? ""}`.trim();
    }
    default: return `${v}${c.unit ? ` ${c.unit}` : ""}`;
  }
}

export const sourceEn = (c: Claim): string =>
  `${c.source.type === "farmer_voice" ? "Spoken" : "Tapped"}${c.source.confirmed_by_farmer ? ", confirmed by the farmer" : ""}`;

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));
const signed = (n: number) => `${n > 0 ? "+" : ""}${fmt(n)}`;
const ordinal = (n: number) => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
};

/** One line per check: what it was compared against, and what that source shows. */
export function explainCheck(check: Check): { against: string; finding: string } {
  const o = (check.observed ?? {}) as Record<string, unknown>;
  const num = (k: string) => Number(o[k]);
  switch (check.rule_id) {
    case "R-CROP-01":
      return { against: "Satellite crop classifier", finding: `Looks like ${CLASS_EN[String(o.predicted_class)] ?? String(o.predicted_class)} (p = ${fmt(num("p"))}).` };
    case "R-CROP-02":
      return { against: "Photo crop check", finding: `${num("coffee")} of ${num("photos")} photos look like coffee.` };
    case "R-AREA-01": {
      const ratio = num("ratio");
      return {
        against: "Plot mapped on the phone",
        finding: `${fmt(num("ha"))} ha on the map. The claim is ${fmt(ratio)}× that${check.result === "consistent" ? ", within the allowed range" : ""}.`,
      };
    }
    case "R-RAIN-01":
      return {
        against: "Rainfall record (CHIRPS)",
        finding: `${String(o.season)}: ${signed(num("anomaly_pct"))}% vs the 1991–2020 average (${ordinal(num("percentile"))} percentile).${check.result === "consistent" ? "" : " Normal rain doesn't disprove a bad harvest."}`,
      };
    default:
      return { against: check.rule_id, finding: JSON.stringify(check.observed) };
  }
}

export const dateTime = (iso: string | null | undefined): string =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso)) : "—";

/** First 16 hex characters, grouped: the same code the farmer's phone shows under the QR. */
export const groupCode = (hash: string): string => hash.slice(0, 16).toUpperCase().match(/.{4}/g)!.join(" ");
