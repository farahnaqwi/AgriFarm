import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Screen, Say } from "./ui.tsx";
import { DEMO_FARMS, GOOD_FIX_M, watchFix, watchWalk, type FixState } from "../lib/geo.ts";
import { matchRegisteredPlot } from "../lib/registry.ts";
import { listRegisteredPlots } from "../data/cards.ts";
import { PROBLEM } from "./labels.ts";
import type { DemoFarm, LonLat, PlotCapture, RegisteredPlot } from "../types/index.ts";
import { areaHa, centroid, closeRing, HA_PER_ACRE } from "../lib/geometry.ts";
import { now } from "./capture.ts";

type Mode = "walk" | "draw" | "walked" | null;

/** Written by `npm run basemap` (app/public/map/basemap.json); precached, so it works offline. */
interface Basemap { file: string; bounds: L.LatLngBoundsLiteral; attribution: string }

export default function Plot({ farm, onDone }: { farm: DemoFarm; onDone: (plot: PlotCapture, plotId: string | null) => void }) {
  const mapEl = useRef<HTMLDivElement>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const modeRef = useRef<Mode>(null);
  const stopWalk = useRef<(() => void) | null>(null);
  const [mode, setModeState] = useState<Mode>(null);
  const [pts, setPts] = useState<LonLat[]>([]);
  const [fix, setFix] = useState<FixState>({ status: "searching" });
  const [registry, setRegistry] = useState<RegisteredPlot[]>([]);
  const setMode = (m: Mode) => { modeRef.current = m; setModeState(m); };
  const goodFix = fix.status === "fix" && fix.accuracy <= GOOD_FIX_M;

  // GPS needs no internet, but without it the first satellite lock can take minutes.
  useEffect(() => watchFix(setFix), []);
  useEffect(() => { listRegisteredPlots().then(setRegistry); }, []);

  useEffect(() => {
    const ring = DEMO_FARMS[farm]?.ring;
    const [lon, lat] = ring ? centroid(ring) : [32.93, -9.11];
    const map = L.map(mapEl.current!, { attributionControl: true, maxZoom: 18 }).setView([lat, lon], 16);

    // Offline background: bundled dry-season Sentinel-2 image (coffee stays green, maize fields are bare).
    const satellite = L.layerGroup().addTo(map);
    fetch("/map/basemap.json")
      .then((r) => (r.ok ? (r.json() as Promise<Basemap[]>) : []))
      .then((maps) => maps.forEach((b) => L.imageOverlay(b.file, b.bounds, { attribution: b.attribution, pane: "tilePane" }).addTo(satellite)))
      .catch(() => { /* no basemap bundled */ });
    if (navigator.onLine) {
      // Street map only as an optional online layer; its tile servers don't allow offline bundling.
      const streets = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" });
      L.control.layers({ "🛰 Satelaiti": satellite, "🗺 Ramani (online)": streets }, undefined, { position: "topright" }).addTo(map);
    }
    layer.current = L.layerGroup().addTo(map);
    map.on("click", (e) => {
      if (modeRef.current === "draw") setPts((p) => [...p, [e.latlng.lng, e.latlng.lat]]);
    });
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      stopWalk.current?.();
      map.remove();
    };
  }, [farm]);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const latlngs = pts.map(([lo, la]): L.LatLngTuple => [la, lo]);
    if (latlngs.length >= 3) L.polygon(latlngs, { color: "#2f6b3a", weight: 3, fillOpacity: 0.25 }).addTo(g);
    else if (latlngs.length === 2) L.polyline(latlngs, { color: "#2f6b3a", weight: 3 }).addTo(g);
    latlngs.forEach((ll) => L.circleMarker(ll, { radius: 5, color: "#1d3b22", fillOpacity: 1 }).addTo(g));
  }, [pts]);

  function walk() {
    stopWalk.current?.();
    setPts([]);
    setMode("walk");
    stopWalk.current = watchWalk((p) => setPts((ps) => [...ps, p]), { farm });
  }
  function draw() {
    stopWalk.current?.();
    setPts([]);
    setMode("draw");
  }
  function finishWalk() {
    stopWalk.current?.();
    stopWalk.current = null;
    setMode("walked");
  }

  const ring = pts.length >= 3 ? closeRing(pts) : null;
  const ha = ring ? areaHa(ring) : 0;
  const match = ring ? matchRegisteredPlot(ring, registry) : null;

  return (
    <Screen step={4} title="Mipaka ya shamba" titleEn="Your farm boundary"
      footer={
        <button className="big primary" disabled={pts.length < 3 || mode === "walk"}
          onClick={() => ring && onDone({
            geometry: { type: "Polygon", coordinates: [ring as PlotCapture["geometry"]["coordinates"][0]] }, // ≥3 points + closing point = schema minItems 4
            geometry_source: mode === "draw" ? "drawn_on_map" : "gps_walk",
            captured_at: now(),
          }, match?.plot_id ?? null)}>
          Endelea →<span>Continue</span>
        </button>
      }>
      <Say ids={["CAPTURE_WALK", "CAPTURE_DRAW"]} />
      <p className={goodFix ? "gps ok" : fix.status === "denied" || fix.status === "unavailable" ? "gps bad" : "gps"}>
        {fix.status === "searching" && <>📡 Inatafuta satelaiti… <span className="en">Searching for satellites. Without internet the first lock can take a few minutes. Stand in the open.</span></>}
        {fix.status === "fix" && !goodFix && <>📡 ±{fix.accuracy} m · subiri kidogo <span className="en">Not accurate enough yet, wait a moment</span></>}
        {goodFix && <>📡 ±{fix.accuracy} m ✓ <span className="en">GPS ready</span></>}
        {fix.status === "denied" && <>⚠ {PROBLEM.gps_denied.sw}<span className="en">{PROBLEM.gps_denied.en}</span></>}
        {fix.status === "unavailable" && <>⚠ {PROBLEM.gps_unavailable.sw}<span className="en">{PROBLEM.gps_unavailable.en}</span></>}
      </p>
      <div className="map" ref={mapEl} />
      <div className="map-tools">
        {mode === "walk"
          ? <button className="chip on" onClick={finishWalk}>⏹ Nimemaliza <span className="en">Done walking</span></button>
          : <button className="chip" disabled={!goodFix} onClick={walk}>🚶 Tembea <span className="en">Walk</span></button>}
        <button className={mode === "draw" ? "chip on" : "chip"} onClick={draw}>✏️ Chora <span className="en">Draw</span></button>
        <button className="chip" disabled={!pts.length || mode === "walk"} onClick={() => setPts((p) => p.slice(0, -1))}>↶</button>
      </div>
      {ha > 0 && (
        <p className="area">≈ {ha.toFixed(2)} ha · {(ha / HA_PER_ACRE).toFixed(1)} ekari</p>
      )}
      {ring && mode !== "walk" && (match
        ? <p className="registry ok">✓ Shamba limesajiliwa na chama <span className="en">Matches registered plot {match.plot_id}, so satellite checks will run</span></p>
        : <p className="registry">⚠ {PROBLEM.not_registered.sw}<span className="en">{PROBLEM.not_registered.en}</span></p>)}
    </Screen>
  );
}
