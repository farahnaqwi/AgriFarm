// On-screen labels (never spoken). Swahili is DRAFT: review together with docs/phrases.json.

export const FIELD: Record<string, { sw: string; en: string }> = {
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

export const UNITS: Record<"acre" | "ha", { sw: string; en: string }> = { acre: { sw: "ekari", en: "acres" }, ha: { sw: "hekta", en: "hectares" } };

export const STATUS: Record<"consistent" | "contradicted" | "unverifiable", { icon: string; sw: string; en: string }> = {
  consistent: { icon: "✅", sw: "Inakubaliana", en: "Consistent" },
  contradicted: { icon: "❌", sw: "Haikubaliani", en: "Contradicted" },
  unverifiable: { icon: "⚪", sw: "Haikukaguliwa", en: "Could not be checked" },
};

export const TIER: Record<"self_reported" | "machine_verified" | "attested", { sw: string; en: string }> = {
  self_reported: { sw: "Ulisema", en: "Self-reported" },
  machine_verified: { sw: "Satelaiti / hali ya hewa", en: "Machine-verified" },
  attested: { sw: "Chama kimethibitisha", en: "Attested" },
};

/** Harvest year a farmer names -> rainfall season id (2022 -> "2021/22"). */
export const seasonFromYear = (y: number): string => `${y - 1}/${String(y).slice(2)}`;
export const yearFromSeason = (s: string): number => Number(s.slice(0, 4)) + 1;

/** On-screen problems and what to do about them (not spoken). Swahili is DRAFT. */
export const PROBLEM = {
  camera_denied: { sw: "Kamera imezuiwa. Ruhusu kamera kwenye mipangilio ya kivinjari, kisha jaribu tena.", en: "The camera is blocked. Allow camera access in the browser settings, then try again." },
  camera_missing: { sw: "Simu hii haina kamera inayopatikana.", en: "No camera is available on this device." },
  insecure: { sw: "Fungua programu kupitia kiungo cha https.", en: "Open the app from its https link: camera, microphone and GPS only work over a secure connection." },
  asr_failed: { sw: "Kusikiliza hakufanyi kazi kwenye simu hii. Jaza kwa kugusa.", en: "Speech recognition can't run on this phone. Fill in by tapping instead." },
  mic_denied: { sw: "Kipaza sauti kimezuiwa. Unaweza kuendelea kwa kugusa badala ya kuongea.", en: "The microphone is blocked. You can continue by tapping instead of speaking." },
  gps_denied: { sw: "Mahali (GPS) pamezuiwa. Ruhusu mahali kwenye mipangilio, kisha jaribu tena. Bado unaweza kuchora shamba.", en: "Location is blocked. Allow location in the settings, then try again. You can still draw your farm." },
  gps_unavailable: { sw: "Simu haipati mahali. Nenda mahali pa wazi na usubiri kidogo.", en: "The phone can't get a location. Move to an open place and wait a moment." },
  not_registered: { sw: "Shamba hili halijasajiliwa na chama, kwa hiyo picha za satelaiti haziwezi kukagua madai yako bado.", en: "This plot isn't in the cooperative's registry yet, so satellite and rain checks will say \"could not be checked\". The cooperative can register it." },
} as const;
