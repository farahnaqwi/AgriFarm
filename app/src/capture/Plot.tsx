import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Screen, Say, Next, T } from "./ui.tsx";
import { getLang, useLang } from "../lib/lang.ts";
import { Icon } from "./icons.tsx";
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

export default function Plot({ farm, onDone }: { farm: DemoFarm; onDone: (plot: PlotCapture, match: RegisteredPlot | null) => void }) {
  const mapEl = useRef<HTMLDivElement>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const modeRef = useRef<Mode>(null);
  const stopWalk = useRef<(() => void) | null>(null);
  const [mode, setModeState] = useState<Mode>(null);
  const [pts, setPts] = useState<LonLat[]>([]);
  const [fix, setFix] = useState<FixState>({ status: "searching" });
  const [registry, setRegistry] = useState<RegisteredPlot[]>([]);
  const setMode = (m: Mode) => { modeRef.current = m; setModeState(m); };
  const goodFix = fix.status === "fix" && fix.accuracy <= GOOD_FIX_M;
  const sw = useLang() === "sw";

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
      const sw = getLang() === "sw";
      L.control.layers({ [sw ? "🛰 Satelaiti" : "🛰 Satellite"]: satellite, [sw ? "🗺 Ramani (online)" : "🗺 Map (online)"]: streets }, undefined, { position: "topright" }).addTo(map);
    }
    layer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
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
    // Paper-white line on a dark halo: readable over both bare soil and green canopy.
    const halo = { color: "#1b2333", weight: 6, opacity: 0.8 };
    const line = { color: "#fbf8f1", weight: 2.5, opacity: 1 };
    if (latlngs.length >= 3) {
      L.polygon(latlngs, { ...halo, fill: false }).addTo(g);
      L.polygon(latlngs, { ...line, fillColor: "#fbf8f1", fillOpacity: 0.18 }).addTo(g);
    } else if (latlngs.length === 2) {
      L.polyline(latlngs, halo).addTo(g);
      L.polyline(latlngs, line).addTo(g);
    }
    const dot = (ll: L.LatLngTuple, r: number) => L.circleMarker(ll, { radius: r, color: "#1b2333", weight: 2, fillColor: "#fbf8f1", fillOpacity: 1 }).addTo(g);
    if (mode === "draw") latlngs.forEach((ll) => dot(ll, 5)); // corners she can see and undo
    else if (mode === "walk" && latlngs.length) dot(latlngs[latlngs.length - 1], 7); // where she is now
  }, [pts, mode]);

  // Once the boundary is complete, frame it.
  useEffect(() => {
    if (mode !== "walked" || pts.length < 3) return;
    mapRef.current?.fitBounds(L.latLngBounds(pts.map(([lo, la]): L.LatLngTuple => [la, lo])), { padding: [48, 48], maxZoom: 17 });
  }, [mode, pts]);

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

  const gpsClass = goodFix ? "gps ok" : fix.status === "denied" || fix.status === "unavailable" ? "gps bad" : "gps searching";

  return (
    <Screen title="Mipaka ya shamba" titleEn="Your farm's boundary"
      footer={
        <Next disabled={!ring || mode === "walk"}
          onClick={() => ring && onDone({
            geometry: { type: "Polygon", coordinates: [ring as PlotCapture["geometry"]["coordinates"][0]] }, // ≥3 points + closing point = schema minItems 4
            geometry_source: mode === "draw" ? "drawn_on_map" : "gps_walk",
            captured_at: now(),
          }, match)} />
      }>
      <Say ids={["CAPTURE_WALK", "CAPTURE_DRAW"]} />
      <p className={gpsClass}>
        <i className="dot" />
        <span>
          {fix.status === "searching" && <><T sw="Inatafuta satelaiti…" en="Searching for GPS satellites. Without internet the first lock can take a few minutes; stand in the open." /></>}
          {fix.status === "fix" && !goodFix && <T sw={`±${fix.accuracy} m · subiri kidogo`} en={`±${fix.accuracy} m · not accurate enough yet, wait a moment`} />}
          {goodFix && fix.status === "fix" && <T sw={`GPS tayari · ±${fix.accuracy} m`} en={`GPS ready · ±${fix.accuracy} m`} />}
          {fix.status === "denied" && <><T sw={PROBLEM.gps_denied.sw} en={PROBLEM.gps_denied.en} /></>}
          {fix.status === "unavailable" && <><T sw={PROBLEM.gps_unavailable.sw} en={PROBLEM.gps_unavailable.en} /></>}
        </span>
      </p>
      <div className="map" ref={mapEl} />
      <div className="seg three">
        {mode === "walk"
          ? <button className="on" onClick={finishWalk}><Icon name="stop" size={20} /><T sw="Maliza" en="Done" /></button>
          : <button disabled={!goodFix} onClick={walk}><Icon name="route" size={20} /><T sw="Tembea" en="Walk" /></button>}
        <button className={mode === "draw" ? "on" : ""} onClick={draw}><Icon name="pencil" size={20} /><T sw="Chora" en="Draw" /></button>
        <button disabled={!pts.length || mode === "walk"} onClick={() => setPts((p) => p.slice(0, -1))} aria-label="Undo last point"><Icon name="undo" size={20} /></button>
      </div>
      {ha > 0 && (
        <p className="area"><b>{ha.toFixed(2)} ha</b><span>{(ha / HA_PER_ACRE).toFixed(1)} {sw ? "ekari" : "acres"}</span></p>
      )}
      {ring && mode !== "walk" && (match
        ? <p className="registry ok"><Icon name="check" /><span><T sw="Shamba limesajiliwa na chama" en={`Matches registered plot ${match.plot_id}, so satellite and rain checks will run.`} /></span></p>
        : <p className="registry"><Icon name="warn" /><span><T sw={PROBLEM.not_registered.sw} en={PROBLEM.not_registered.en} /></span></p>)}
    </Screen>
  );
}
