import { useState } from "react";
import { Screen, Say } from "./ui.tsx";
import { FIELD, CROPS, TENURE, UNITS, seasonFromYear, yearFromSeason } from "./labels.ts";
import { HA_PER_ACRE } from "../lib/geometry.ts";
import { now } from "./capture.ts";
import type { CandidateClaim, ClaimField, ConfirmedClaim } from "../types/index.ts";

type Draft = CandidateClaim & { key: number; confirmed: boolean };
type Editable = Pick<CandidateClaim, "value" | "unit">;

const YEARS = Array.from({ length: 10 }, (_, i) => 2017 + i);

const BLANK: Partial<Record<ClaimField, Editable>> = {
  crop_type: { value: "coffee", unit: null },
  plot_area: { value: 1, unit: "acre" },
  cooperative_membership_years: { value: 1, unit: "years" },
  bad_season: { value: seasonFromYear(2025), unit: null },
  last_harvest_delivered: { value: 100, unit: "kg_parchment" },
  land_tenure: { value: "customary_undocumented", unit: null },
};

function Stepper({ value, step = 1, min = 0, onChange }: { value: number; step?: number; min?: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))}>−</button>
      <output>{value}</output>
      <button onClick={() => onChange(+(value + step).toFixed(1))}>+</button>
    </div>
  );
}

function Editor({ claim, set }: { claim: Draft; set: (patch: Partial<Editable>) => void }) {
  const { field, value, unit } = claim;
  const num = Number(value);
  switch (field) {
    case "crop_type":
      return (
        <div className="choices">
          {CROPS.map((c) => (
            <button key={c.value} className={value === c.value ? "choice on" : "choice"} onClick={() => set({ value: c.value })}>
              <b>{c.icon}</b>{c.sw}<span className="en">{c.en}</span>
            </button>
          ))}
        </div>
      );
    case "plot_area":
      return (
        <>
          <Stepper value={num} step={0.5} onChange={(v) => set({ value: v })} />
          <div className="choices two">
            {(Object.keys(UNITS) as (keyof typeof UNITS)[]).map((u) => (
              <button key={u} className={unit === u ? "choice on" : "choice"} onClick={() => set({ unit: u })}>{UNITS[u].sw}<span className="en">{UNITS[u].en}</span></button>
            ))}
          </div>
          <p className="en">= {(unit === "acre" ? num * HA_PER_ACRE : num).toFixed(2)} ha</p>
        </>
      );
    case "cooperative_membership_years":
      return <Stepper value={num} onChange={(v) => set({ value: v })} />;
    case "last_harvest_delivered":
      return (
        <label className="row">
          <input type="number" inputMode="numeric" value={num} onChange={(e) => set({ value: Number(e.target.value) })} /> kg
        </label>
      );
    case "bad_season":
      return (
        <div className="choices years">
          {YEARS.map((y) => (
            <button key={y} className={yearFromSeason(String(value)) === y ? "choice on" : "choice"} onClick={() => set({ value: seasonFromYear(y) })}>{y}</button>
          ))}
        </div>
      );
    case "land_tenure":
      return (
        <div className="choices">
          {TENURE.map((o) => (
            <button key={o.value} className={value === o.value ? "choice on" : "choice"} onClick={() => set({ value: o.value })}>{o.sw}<span className="en">{o.en}</span></button>
          ))}
        </div>
      );
    default:
      return <p>{String(value)}</p>;
  }
}

export default function Confirm({ candidates, onDone }: { candidates: CandidateClaim[]; onDone: (claims: ConfirmedClaim[]) => void }) {
  const [claims, setClaims] = useState<Draft[]>(() => candidates.map((c, i) => ({ ...c, key: i, confirmed: false })));

  const update = (key: number, patch: Partial<Editable>) =>
    setClaims((cs) => cs.map((c) => (c.key === key ? {
      ...c, ...patch, confirmed: false,
      source: { ...c.source, type: "farmer_tap" as const }, // value now comes from her tap, the quote stays for audit
    } : c)));
  const confirm = (key: number) => setClaims((cs) => cs.map((c) => (c.key === key ? { ...c, confirmed: true } : c)));
  const remove = (key: number) => setClaims((cs) => cs.filter((c) => c.key !== key));
  const add = (field: ClaimField) =>
    setClaims((cs) => [...cs, {
      field, ...BLANK[field]!, value_as_spoken: null, key: Date.now(), confirmed: false,
      source: { type: "farmer_tap", ref: null, quote: null, asr_confidence: null, confirmed_by_farmer: false },
    }]);

  const ready = claims.length > 0 && claims.every((c) => c.confirmed);

  function finish() {
    onDone(claims.map(({ key: _key, confirmed: _confirmed, ...c }, i) => ({
      claim_id: `c${i + 1}`,
      ...c,
      source: { ...c.source, confirmed_by_farmer: true },
      timestamp: now(),
    })));
  }

  return (
    <Screen step={3} title="Thibitisha" titleEn="Confirm what you said"
      footer={<button className="big primary" disabled={!ready} onClick={finish}>Endelea →<span>{ready ? "Continue" : "Confirm every card"}</span></button>}>
      <Say ids={["CAPTURE_CONFIRM"]} />
      {claims.map((c) => (
        <article key={c.key} className={c.confirmed ? "card confirmed" : "card"}>
          <h3>{FIELD[c.field].sw}<span className="en">{FIELD[c.field].en}</span></h3>
          {c.source.quote && <blockquote>“{c.source.quote}”</blockquote>}
          <Editor claim={c} set={(p) => update(c.key, p)} />
          <div className="card-actions">
            <button className={c.confirmed ? "ok on" : "ok"} onClick={() => confirm(c.key)}>✓ Sahihi<span className="en">Correct</span></button>
            <button className="link danger" onClick={() => remove(c.key)}>Ondoa<span className="en">Remove</span></button>
          </div>
        </article>
      ))}
      <div className="add">
        <span className="en">Add something we missed:</span>
        {(Object.keys(BLANK) as ClaimField[]).map((f) => (
          <button key={f} className="chip" onClick={() => add(f)}>+ {FIELD[f].sw}</button>
        ))}
      </div>
    </Screen>
  );
}
