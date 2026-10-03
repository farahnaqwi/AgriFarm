/// <reference types="node" />
// Downloads the offline map background: one cloud-free dry-season Sentinel-2 true-colour image of the
// cooperative's area, bundled into the app so the farmer can draw her plot in airplane mode.
//
//   npm run basemap                                   default area: Vwawa/Mlowo, Mbozi (16 x 16 km)
//   npm run basemap -- --bbox 32.85,-9.20,33.00,-9.05 --from 2025-07-01 --to 2025-10-31
//
// Source: Microsoft Planetary Computer (no account needed), collection sentinel-2-l2a, asset "visual"
// (10 m true colour). Copernicus Sentinel data are free and open; attribution is shown on the map.
// Output: app/public/map/{id}.jpg + app/public/map/basemap.json (bounds for the map overlay).

import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface StacItem { id: string; bbox: number[]; properties: { datetime: string; "eo:cloud_cover": number } }
interface Basemap { id: string; file: string; bounds: [[number, number], [number, number]]; scene: string; date: string; cloud_cover_pct: number; attribution: string; source: string }

const here = dirname(fileURLToPath(import.meta.url));
const mapDir = join(here, "..", "public", "map");
const args = process.argv.slice(2);
const opt = (name: string, dflt: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const [minx, miny, maxx, maxy] = opt("bbox", "32.85,-9.20,33.00,-9.05").split(",").map(Number);
const from = opt("from", "2025-07-01");
const to = opt("to", "2025-10-31");
const PC = "https://planetarycomputer.microsoft.com/api";

async function main() {
  const search = await fetch(`${PC}/stac/v1/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      collections: ["sentinel-2-l2a"],
      bbox: [minx, miny, maxx, maxy],
      datetime: `${from}T00:00:00Z/${to}T23:59:59Z`,
      query: { "eo:cloud_cover": { lt: 5 } },
      sortby: [{ field: "eo:cloud_cover", direction: "asc" }],
      limit: 50,
    }),
  });
  if (!search.ok) throw new Error(`STAC search ${search.status}: ${await search.text()}`);
  const items = ((await search.json()) as { features: StacItem[] }).features
    .sort((a, b) => a.properties["eo:cloud_cover"] - b.properties["eo:cloud_cover"]); // the API ignores sortby
  // One scene must cover the whole area (no seams); lowest cloud first.
  const item = items.find((f) => f.bbox[0] <= minx && f.bbox[1] <= miny && f.bbox[2] >= maxx && f.bbox[3] >= maxy);
  if (!item) throw new Error(`No single clear scene covers ${[minx, miny, maxx, maxy]} between ${from} and ${to}. Try a smaller --bbox or wider dates.`);

  const date = item.properties.datetime.slice(0, 10);
  const id = `s2-${date}-${[minx, miny, maxx, maxy].map((n) => n.toFixed(2)).join("_")}`;
  const url = `${PC}/data/v1/item/bbox/${minx},${miny},${maxx},${maxy}.jpg?collection=sentinel-2-l2a&item=${item.id}&assets=visual&asset_bidx=visual%7C1,2,3&nodata=0`;
  const img = await fetch(url);
  if (!img.ok) throw new Error(`crop ${img.status}: ${await img.text()}`);
  const bytes = Buffer.from(await img.arrayBuffer());

  mkdirSync(mapDir, { recursive: true });
  writeFileSync(join(mapDir, `${id}.jpg`), bytes);

  const manifestPath = join(mapDir, "basemap.json");
  const all: Basemap[] = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : [];
  const entry: Basemap = {
    id,
    file: `/map/${id}.jpg`,
    bounds: [[miny, minx], [maxy, maxx]], // Leaflet order: [[south, west], [north, east]]
    scene: item.id,
    date,
    cloud_cover_pct: item.properties["eo:cloud_cover"],
    attribution: `Contains modified Copernicus Sentinel data ${date.slice(0, 4)}`,
    source: "Microsoft Planetary Computer, sentinel-2-l2a, asset visual (10 m)",
  };
  // Re-running for the same area replaces the old image instead of piling up files.
  const sameArea = (b: Basemap) => JSON.stringify(b.bounds) === JSON.stringify(entry.bounds);
  for (const old of all.filter((b) => sameArea(b) && b.id !== id)) rmSync(join(mapDir, `${old.id}.jpg`), { force: true });
  writeFileSync(manifestPath, JSON.stringify([...all.filter((b) => !sameArea(b)), entry], null, 2) + "\n");
  console.log(`✓ ${item.id} (${date}, ${item.properties["eo:cloud_cover"].toFixed(3)}% cloud) -> public/map/${id}.jpg, ${(bytes.length / 1024).toFixed(0)} KB`);
}

main().catch((e: unknown) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
