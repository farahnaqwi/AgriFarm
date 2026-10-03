// On-screen labels (never spoken). Swahili is DRAFT: review together with docs/phrases.json.

export const FIELD = {
  crop_type: { sw: "Zao", en: "Crop" },
  plot_area: { sw: "Ukubwa wa shamba", en: "Farm size" },
  cooperative_membership_years: { sw: "Miaka katika chama", en: "Years in cooperative" },
  bad_season: { sw: "Msimu mbaya", en: "Bad season" },
  last_harvest_delivered: { sw: "Kahawa iliyowasilishwa", en: "Coffee delivered" },
  land_tenure: { sw: "Umiliki wa ardhi", en: "Land tenure" },
};

export const CROPS = [
  { value: "coffee", icon: "☕", sw: "Kahawa", en: "Coffee" },
  { value: "maize", icon: "🌽", sw: "Mahindi", en: "Maize" },
  { value: "coffee_banana", icon: "🍌", sw: "Kahawa na migomba", en: "Coffee + banana" },
  { value: "other", icon: "🌱", sw: "Mengine", en: "Other" },
];

export const TENURE = [
  { value: "titled", sw: "Hati miliki", en: "Title deed" },
  { value: "customary_ccro", sw: "Hati ya kimila (CCRO)", en: "Customary certificate" },
  { value: "customary_undocumented", sw: "Urithi, bila hati", en: "Inherited, no document" },
  { value: "leased", sw: "Nimekodi", en: "Leased" },
  { value: "family_use", sw: "Shamba la familia", en: "Family land" },
  { value: "other", sw: "Nyingine", en: "Other" },
];

export const UNITS = { acre: { sw: "ekari", en: "acres" }, ha: { sw: "hekta", en: "hectares" } };

export const STATUS = {
  consistent: { icon: "✅", sw: "Inakubaliana", en: "Consistent" },
  contradicted: { icon: "❌", sw: "Haikubaliani", en: "Contradicted" },
  unverifiable: { icon: "⚪", sw: "Haikukaguliwa", en: "Could not be checked" },
};

export const TIER = {
  self_reported: { sw: "Ulisema", en: "Self-reported" },
  machine_verified: { sw: "Satelaiti / hali ya hewa", en: "Machine-verified" },
  attested: { sw: "Chama kimethibitisha", en: "Attested" },
};

/** Harvest year a farmer names -> rainfall season id (2022 -> "2021/22"). */
export const seasonFromYear = (y) => `${y - 1}/${String(y).slice(2)}`;
export const yearFromSeason = (s) => Number(s.slice(0, 4)) + 1;
