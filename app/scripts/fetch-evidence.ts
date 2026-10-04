/// <reference types="node" />
// Real evidence cards for the two demo plots: what the engine checks a farmer's claims against.
//
//   node scripts/fetch-evidence.ts        (needs internet, a few minutes; nothing needs an account)
//
// Plots: two real fields near Vwawa, Mbozi, picked from Sentinel-2 by their greenness pattern and checked on the
// true-colour basemap. A = a dark-green block that stays green through the dry season (tree crop, the pattern
// coffee shows); B = bare in the dry season, green in the rains (the pattern maize shows). Nobody visited them:
// the pattern is what the satellite sees, not a ground-truthed crop label. The farmers are fictional.
//
// Sources
//   Greenness: Sentinel-2 L2A via Microsoft Planetary Computer (STAC + data API statistics over the plot polygon).
//     NDVI = (B08 − B04) / (B08 + B04 − 2000) (baseline ≥ 04.00 carries a +1000 offset). A scene counts for a month
//     only if ≥ 90% of the plot is clear in its scene classification (SCL 4 vegetation, 5 bare). Month = mean of
//     up to two clear scenes; no clear scene = null.
//   Crop pattern: a transparent rule, NOT a trained classifier (model_id says so; no accuracy is claimed).
//     coffee = share of cloud-free dry-season months (Jun–Oct) with NDVI ≥ 0.45 ("stays green");
//     seasonal_crop = share of those months with NDVI < 0.30, if the plot greened up to ≥ 0.55 in the rains;
//     other = the rest. The engine's thresholds then apply (agree ≥ 0.70, contradict ≥ 0.80 with ≥ 12 clear months).
//   Rain: CHIRPS v2.0 daily via NASA/USAID SERVIR ClimateSERV, averaged over the plot; Nov–Apr totals vs 1990/91–2019/20.
//   Temperature: NASA POWER daily T2M_MAX at the plot centroid; Nov–Apr mean, as an anomaly vs the same baseline.
//   Soil: ISRIC SoilGrids 2.0 (250 m) at the centroid, depth-weighted 0–30 cm. A model estimate, context only.
//
// Output: src/data/evidence/demo-plots.json  { plots: [...], cards: { [plot_id]: EvidenceCard } }

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EvidenceCard } from "../src/types/index.ts";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "evidence", "demo-plots.json");
const PC = "https://planetarycomputer.microsoft.com/api";
const CS = "https://climateserv.servirglobal.net/api";

interface Plot { key: "A" | "B"; label: string; plot_id: string; country: string; admin_area: string; pattern: string; ring: number[][] }
const PLOTS: Plot[] = [
  {
    key: "A", label: "Noor (A)", plot_id: "P-MBZ-A101", country: "TZ", admin_area: "Mbozi District, Songwe Region",
    pattern: "Tree-crop block: green through the dry season",
    ring: [[32.90678, -9.09289], [32.90813, -9.09286], [32.90817, -9.09419], [32.90675, -9.09416], [32.90678, -9.09289]],
  },
  {
    key: "B", label: "Farm B", plot_id: "P-MBZ-B102", country: "TZ", admin_area: "Mbozi District, Songwe Region",
    pattern: "Seasonal field: bare in the dry season, green in the rains",
    ring: [[32.91515, -9.08786], [32.91648, -9.08789], [32.91646, -9.08917], [32.91512, -9.08914], [32.91515, -9.08786]],
  },
];

const MONTHS = Array.from({ length: 24 }, (_, i) => { const d = new Date(Date.UTC(2024, 9 + i, 1)); return d.toISOString().slice(0, 7); });
const DRY = new Set([6, 7, 8, 9, 10]);
const round = (n: number, d = 2) => +n.toFixed(d);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function json<T>(url: string, init?: RequestInit, tries = 4): Promise<T> {
  for (let a = 1; ; a++) {
    const res = await fetch(url, init).catch((e: unknown) => ({ ok: false, status: 0, text: async () => String(e) }) as Response);
    if (res.ok) return (await res.json()) as T;
    if (a >= tries) throw new Error(`${res.status} from ${url.slice(0, 120)}: ${(await res.text()).slice(0, 200)}`);
    await sleep(1500 * a);
  }
}

// ---------- Sentinel-2 greenness ----------
interface StacItem { id: string; properties: { "eo:cloud_cover": number; "s2:processing_baseline"?: string } }
interface Stat { median?: number; valid_pixels?: number; count?: number; histogram?: [number[], number[]] }
const feature = (ring: number[][]) => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } });

async function stat(item: string, query: string, ring: number[][]): Promise<Stat> {
  const r = await json<{ properties: { statistics: Record<string, Stat> } }>(
    `${PC}/data/v1/item/statistics?collection=sentinel-2-l2a&item=${item}&${query}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(feature(ring)) },
  );
  return Object.values(r.properties.statistics)[0];
}

async function monthNdvi(ring: number[][], month: string): Promise<{ ndvi: number | null; pixels: number }> {
  const [y, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const search = await json<{ features: StacItem[] }>(`${PC}/stac/v1/search`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ collections: ["sentinel-2-l2a"], intersects: feature(ring).geometry, datetime: `${month}-01T00:00:00Z/${end}T23:59:59Z`, query: { "eo:cloud_cover": { lt: 80 } }, limit: 60 }),
  });
  const items = search.features.sort((a, b) => a.properties["eo:cloud_cover"] - b.properties["eo:cloud_cover"]);
  const clear: number[] = [];
  let pixels = 0;
  for (const it of items.slice(0, 6)) {
    const scl = await stat(it.id, "assets=SCL&categorical=true", ring);
    const [counts, classes] = scl.histogram ?? [[], []];
    const total = counts.reduce((a, c, i) => a + (classes[i] === 0 ? 0 : c), 0);
    const good = counts.reduce((a, c, i) => a + ([4, 5].includes(classes[i]) ? c : 0), 0);
    if (!total || good / total < 0.9) continue;
    const offset = Number(it.properties["s2:processing_baseline"] ?? "5") >= 4 ? 2000 : 0;
    const expr = encodeURIComponent(`(B08-B04)/(B08+B04-${offset})`);
    const s = await stat(it.id, `assets=B04&assets=B08&asset_as_band=true&expression=${expr}`, ring);
    if (typeof s.median === "number") { clear.push(s.median); pixels = Math.max(pixels, s.valid_pixels ?? s.count ?? 0); }
    if (clear.length === 2) break;
  }
  return { ndvi: clear.length ? round(clear.reduce((a, b) => a + b, 0) / clear.length) : null, pixels };
}

function cropRule(monthly: { month: string; ndvi: number | null }[]) {
  const dry = monthly.filter((p) => p.ndvi !== null && DRY.has(Number(p.month.slice(5)))).map((p) => p.ndvi!);
  const peak = Math.max(...monthly.map((p) => p.ndvi ?? -1));
  const n = Math.max(1, dry.length);
  const coffee = dry.filter((v) => v >= 0.45).length / n;
  const seasonal = peak >= 0.55 ? dry.filter((v) => v < 0.3).length / n : 0;
  const probabilities = { coffee: round(coffee), seasonal_crop: round(seasonal), other: round(Math.max(0, 1 - coffee - seasonal)) };
  const [best, p] = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0];
  return { predicted_class: (p >= 0.5 ? best : "uncertain") as "coffee" | "seasonal_crop" | "other" | "uncertain", probabilities };
}

// ---------- CHIRPS rainfall + NASA POWER temperature ----------
const seasonOf = (d: Date): string | null => {
  const m = d.getUTCMonth() + 1, y = d.getUTCFullYear();
  if (m >= 11) return `${y}/${String(y + 1).slice(2)}`;
  if (m <= 4) return `${y - 1}/${String(y).slice(2)}`;
  return null;
};
const BASELINE = (s: string) => { const y = Number(s.slice(0, 4)); return y >= 1990 && y <= 2019; };
const REPORT_SEASONS = ["2021/22", "2022/23", "2023/24", "2024/25", "2025/26"];

async function chirpsDaily(ring: number[][]): Promise<Map<string, number>> {
  const geometry = encodeURIComponent(JSON.stringify(feature(ring).geometry));
  const totals = new Map<string, number>();
  for (const [from, to] of [["11/01/1990", "04/30/2008"], ["11/01/2008", "04/30/2026"]]) {
    const [id] = await json<string[]>(`${CS}/submitDataRequest/?datatype=0&begintime=${from}&endtime=${to}&intervaltype=0&operationtype=5&dateType_Category=default&isZip_CurrentDataType=false&geometry=${geometry}`);
    for (let i = 0; i < 120; i++) {
      const [p] = await json<number[]>(`${CS}/getDataRequestProgress/?id=${id}`);
      if (p >= 100) break;
      if (p < 0) throw new Error("ClimateSERV request failed");
      await sleep(3000);
    }
    const { data } = await json<{ data: { year: number; month: number; day: number; value: { avg: number } }[] }>(`${CS}/getDataFromRequest/?id=${id}`);
    for (const d of data) {
      const s = seasonOf(new Date(Date.UTC(d.year, d.month - 1, d.day)));
      if (s && d.value.avg >= 0) totals.set(s, (totals.get(s) ?? 0) + d.value.avg);
    }
  }
  return totals;
}

async function powerTmax(lon: number, lat: number): Promise<Map<string, number>> {
  const r = await json<{ properties: { parameter: { T2M_MAX: Record<string, number> } } }>(
    `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX&community=AG&longitude=${lon}&latitude=${lat}&start=19901101&end=20260430&format=JSON`,
  );
  const sum = new Map<string, [number, number]>();
  for (const [day, v] of Object.entries(r.properties.parameter.T2M_MAX)) {
    if (v <= -900) continue;
    const s = seasonOf(new Date(Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8))));
    if (!s) continue;
    const [a, n] = sum.get(s) ?? [0, 0];
    sum.set(s, [a + v, n + 1]);
  }
  return new Map([...sum].map(([s, [a, n]]) => [s, a / n]));
}

async function soil(lon: number, lat: number) {
  type Layer = { name: string; depths: { label: string; values: { mean: number | null } }[] };
  const r = await json<{ properties: { layers: Layer[] } }>(
    `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=phh2o&property=soc&property=nitrogen&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean`,
  );
  const w: Record<string, number> = { "0-5cm": 5, "5-15cm": 10, "15-30cm": 15 };
  const avg = (name: string, scale: number) => {
    const l = r.properties.layers.find((x) => x.name === name);
    const vals = (l?.depths ?? []).filter((d) => d.values.mean !== null);
    if (!vals.length) return null;
    const tw = vals.reduce((a, d) => a + w[d.label], 0);
    return round(vals.reduce((a, d) => a + (d.values.mean! / scale) * w[d.label], 0) / tw, 1);
  };
  return { ph: avg("phh2o", 10), organic_carbon_g_kg: avg("soc", 10), nitrogen_total_g_kg: avg("nitrogen", 100) };
}

// ---------- one card ----------
const centroid = (ring: number[][]) => {
  const p = ring.slice(0, -1);
  return [round(p.reduce((a, q) => a + q[0], 0) / p.length, 5), round(p.reduce((a, q) => a + q[1], 0) / p.length, 5)];
};

async function card(plot: Plot): Promise<EvidenceCard> {
  const [lon, lat] = centroid(plot.ring);
  const monthly: { month: string; ndvi: number | null }[] = [];
  let pixels = 0;
  for (const month of MONTHS) {
    const m = await monthNdvi(plot.ring, month);
    monthly.push({ month, ndvi: m.ndvi });
    pixels = Math.max(pixels, m.pixels);
    process.stdout.write(`  ${plot.key} ${month} ${m.ndvi ?? "cloudy"}\n`);
  }
  const clearMonths = monthly.filter((p) => p.ndvi !== null);
  const dry = clearMonths.filter((p) => DRY.has(Number(p.month.slice(5)))).map((p) => p.ndvi!);
  const rule = cropRule(monthly);

  const [rain, tmax, soilVals] = await Promise.all([chirpsDaily(plot.ring), powerTmax(lon, lat), soil(lon, lat)]);
  const baseRain = [...rain].filter(([s]) => BASELINE(s)).map(([, v]) => v);
  const baseMean = baseRain.reduce((a, b) => a + b, 0) / baseRain.length;
  const baseT = [...tmax].filter(([s]) => BASELINE(s)).map(([, v]) => v);
  const baseTMean = baseT.reduce((a, b) => a + b, 0) / baseT.length;

  return {
    evidence_card_id: `EC-${plot.plot_id}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
    computed_at: new Date().toISOString(),
    ndvi: {
      source: "Sentinel-2 L2A (Microsoft Planetary Computer), B04/B08, SCL cloud mask, monthly mean of up to 2 clear scenes",
      period_start: `${MONTHS[0]}-01`,
      period_end: "2026-09-30",
      months_total: MONTHS.length,
      months_cloud_free: clearMonths.length,
      pixels_in_plot: pixels,
      monthly,
      dry_season_mean: dry.length ? round(dry.reduce((a, b) => a + b, 0) / dry.length) : null,
      wet_season_peak: clearMonths.length ? Math.max(...clearMonths.map((p) => p.ndvi!)) : null,
      classifier: {
        model_id: "ndvi-dry-season-rule-v1",
        predicted_class: rule.predicted_class,
        probabilities: rule.probabilities,
        heldout_accuracy: null,
        heldout_n_fields: null,
      },
    },
    rainfall: {
      source: "CHIRPS v2.0 daily, 0.05 deg (via NASA/USAID SERVIR ClimateSERV)",
      season_window: "Nov-Apr",
      baseline_period: "1990/91-2019/20",
      seasons: REPORT_SEASONS.filter((s) => rain.has(s)).map((s) => {
        const total = rain.get(s)!;
        return {
          season: s,
          total_mm: Math.round(total),
          baseline_mean_mm: Math.round(baseMean),
          anomaly_pct: round(((total - baseMean) / baseMean) * 100, 1),
          percentile: Math.round((baseRain.filter((v) => v <= total).length / baseRain.length) * 100),
        };
      }),
    },
    temperature: {
      source: "NASA POWER daily T2M_MAX (MERRA-2, 0.5 x 0.625 deg), Nov-Apr mean vs 1990/91-2019/20",
      seasons: REPORT_SEASONS.filter((s) => tmax.has(s)).map((s) => ({ season: s, mean_tmax_anomaly_c: round(tmax.get(s)! - baseTMean, 1) })),
    },
    soil: { source: "ISRIC SoilGrids 2.0 (250 m), depth-weighted mean", depth_cm: "0-30", ...soilVals, is_model_estimate: true },
  } as EvidenceCard;
}

const cards: Record<string, EvidenceCard> = {};
for (const plot of PLOTS) {
  console.log(`${plot.key} ${plot.plot_id}`);
  cards[plot.plot_id] = await card(plot);
  const c = cards[plot.plot_id];
  console.log(`  -> ${c.ndvi.classifier.predicted_class} ${JSON.stringify(c.ndvi.classifier.probabilities)}, ${c.ndvi.months_cloud_free}/24 clear months, ${c.ndvi.pixels_in_plot} px`);
  console.log(`  -> rain ${JSON.stringify(c.rainfall.seasons.map((s) => [s.season, s.total_mm, s.anomaly_pct, s.percentile]))}`);
  console.log(`  -> soil ${JSON.stringify(c.soil)}`);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({
  generated_by: "app/scripts/fetch-evidence.ts",
  generated_at: new Date().toISOString(),
  plots: PLOTS.map(({ key, label, plot_id, country, admin_area, pattern, ring }) => ({ key, label, plot_id, country, admin_area, pattern, ring })),
  cards,
}, null, 2) + "\n");
console.log(`\nWrote ${out}`);
