import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Screen, Say } from "./ui.jsx";
import { DEMO_FARMS, watchWalk } from "../lib/geo.js";
import { areaHa, centroid, closeRing, HA_PER_ACRE } from "../lib/geometry.js";
import { now } from "./capture.js";

export default function Plot({ farm, onDone }) {
  const mapEl = useRef(null);
  const layer = useRef(null);
  const modeRef = useRef(null);
  const stopWalk = useRef(null);
  const [mode, setModeState] = useState(null); // "walk" | "draw" | null
  const [pts, setPts] = useState([]);
  const setMode = (m) => { modeRef.current = m; setModeState(m); };

  useEffect(() => {
    const ring = DEMO_FARMS[farm]?.ring;
    const [lon, lat] = ring ? centroid(ring) : [32.93, -9.11];
    const map = L.map(mapEl.current, { attributionControl: true }).setView([lat, lon], 17);
    if (navigator.onLine) {
      // Online-only reference layer. Offline basemap = Sentinel-2 RGB overlay from ml/ (TODO Sakeet: /map/{plot_id}.png).
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
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
    const latlngs = pts.map(([lo, la]) => [la, lo]);
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

  const ha = pts.length >= 3 ? areaHa(closeRing(pts)) : 0;

  return (
    <Screen step={4} title="Mipaka ya shamba" titleEn="Your farm boundary"
      footer={
        <button className="big primary" disabled={pts.length < 3 || mode === "walk"}
          onClick={() => onDone({
            geometry: { type: "Polygon", coordinates: [closeRing(pts)] },
            geometry_source: mode === "draw" ? "drawn_on_map" : "gps_walk",
            captured_at: now(),
          })}>
          Endelea →<span>Continue</span>
        </button>
      }>
      <Say ids={["CAPTURE_WALK", "CAPTURE_DRAW"]} />
      <div className="map" ref={mapEl} />
      <div className="map-tools">
        {mode === "walk"
          ? <button className="chip on" onClick={finishWalk}>⏹ Nimemaliza <span className="en">Done walking</span></button>
          : <button className="chip" onClick={walk}>🚶 Tembea <span className="en">Walk</span></button>}
        <button className={mode === "draw" ? "chip on" : "chip"} onClick={draw}>✏️ Chora <span className="en">Draw</span></button>
        <button className="chip" disabled={!pts.length || mode === "walk"} onClick={() => setPts((p) => p.slice(0, -1))}>↶</button>
      </div>
      {ha > 0 && (
        <p className="area">≈ {ha.toFixed(2)} ha · {(ha / HA_PER_ACRE).toFixed(1)} ekari</p>
      )}
    </Screen>
  );
}
