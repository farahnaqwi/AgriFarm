// Small hand-drawn charts for the lender page. Shapes are SVG stretched to the box; every label is HTML,
// so text stays readable at phone width.

import type { Report } from "../types/index.ts";

type Ndvi = Report["evidence_summary"]["ndvi"];
type Rain = Report["evidence_summary"]["rainfall"];

const WET = new Set([11, 12, 1, 2, 3, 4]); // Nov–Apr: Mbozi's rainy season
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

/** [start, length] of each run of rainy months, so the shading is one block per season (no seams). */
function wetRuns(wet: boolean[]): [number, number][] {
  const runs: [number, number][] = [];
  wet.forEach((w, i) => {
    if (!w) return;
    const last = runs.at(-1);
    if (last && last[0] + last[1] === i) last[1]++;
    else runs.push([i, 1]);
  });
  return runs;
}

/** Monthly greenness on a fixed 0–1 scale, so two farms can be compared by eye. Gaps are cloudy months. */
export function NdviChart({ ndvi }: { ndvi: Ndvi }) {
  const m = ndvi.monthly;
  if (!m.length) return <p className="l-empty">No satellite history for this plot.</p>;
  const n = m.length;
  const x = (i: number) => (i + 0.5) / n;
  const segments: string[] = [];
  let run: string[] = [];
  m.forEach((p, i) => {
    if (p.ndvi == null) { if (run.length) segments.push(run.join(" ")); run = []; return; }
    run.push(`${i + 0.5},${1 - p.ndvi}`);
  });
  if (run.length) segments.push(run.join(" "));

  return (
    <figure className="l-chart">
      <div className="l-plot">
        <svg viewBox={`0 0 ${n} 1`} preserveAspectRatio="none" aria-hidden="true">
          {wetRuns(m.map((p) => WET.has(Number(p.month.slice(5))))).map(([start, len]) => <rect key={start} className="wet" x={start} y={0} width={len} height={1} />)}
          {[0.25, 0.5, 0.75].map((g) => <line key={g} className="grid" x1={0} x2={n} y1={1 - g} y2={1 - g} />)}
          {segments.map((pts) => <polyline key={pts} className="line" points={pts} />)}
        </svg>
        {m.map((p, i) => p.ndvi != null && <i key={p.month} className="dot" style={{ left: pct(x(i)), top: pct(1 - p.ndvi) }} />)}
        {[0.25, 0.5, 0.75].map((g) => <span key={g} className="ylab" style={{ top: pct(1 - g) }}>{g}</span>)}
      </div>
      <div className="l-months" aria-hidden="true">
        {m.map((p) => <span key={p.month}>{p.month.endsWith("-01") ? p.month.slice(0, 4) : ""}</span>)}
      </div>
      <figcaption>
        Shaded: rainy season (Nov–Apr). Gaps: cloudy months. Coffee stays green all year; maize greens up in the rains
        and drops after harvest.
      </figcaption>
    </figure>
  );
}

/** Season rainfall totals, each with its own 1991–2020 average marked. */
export function RainChart({ rain, saidBad }: { rain: Rain; saidBad: string[] }) {
  const s = rain.seasons;
  if (!s.length) return <p className="l-empty">No rainfall record for this plot.</p>;
  const max = Math.max(...s.flatMap((x) => [x.total_mm, x.baseline_mean_mm])) * 1.08;
  return (
    <figure className="l-chart">
      <div className="l-rain">
        {s.map((x) => {
          const dry = x.anomaly_pct <= -15 || x.percentile <= 20; // R-RAIN-01's "below normal"
          return (
            <div key={x.season} className={dry ? "col dry" : "col"}>
              <span className="val"><b>{x.anomaly_pct > 0 ? "+" : ""}{x.anomaly_pct}%</b>{x.total_mm} mm</span>
              <div className="track">
                <div className="bar" style={{ height: pct(x.total_mm / max) }} />
                <i className="base" style={{ bottom: pct(x.baseline_mean_mm / max) }} />
              </div>
              <span className="season">{x.season}</span>
              {saidBad.includes(x.season) && <span className="said">Farmer: bad</span>}
            </div>
          );
        })}
      </div>
      <figcaption>Nov–Apr totals. Dashed line: that season's 1991–2020 average. Red: well below normal.</figcaption>
    </figure>
  );
}

/** The mapped outline, to scale (longitude shrunk by cos(latitude)). */
export function PlotShape({ ring }: { ring: number[][] }) {
  if (ring.length < 4) return null;
  const k = Math.cos((ring[0][1] * Math.PI) / 180);
  const pts = ring.map(([lon, lat]) => [lon * k, -lat]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const span = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) || 1;
  const d = pts.map(([px, py]) => `${(((px - x0) / span) * 90 + 5).toFixed(2)},${(((py - y0) / span) * 90 + 5).toFixed(2)}`).join(" ");
  return (
    <svg className="l-shape" viewBox="0 0 100 100" role="img" aria-label="Outline of the mapped plot">
      <polygon points={d} />
    </svg>
  );
}
