import { useState } from "react";
import { Screen, Say, Stamp, Next } from "./ui.tsx";
import { Icon } from "./icons.tsx";
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

/** The value, written large, the way it will appear in the report. */
function Value({ claim }: { claim: Draft }) {
  const { field, value, unit } = claim;
  const num = Number(value);
  switch (field) {
    case "crop_type": {
      const c = CROPS.find((x) => x.value === value);
      return <p className="value">{c?.sw ?? String(value)}<span className="en">{c?.en}</span></p>;
    }
    case "plot_area": {
      const u = UNITS[unit === "ha" ? "ha" : "acre"];
      return <p className="value">{num}<small>{u.sw}</small><span className="en">{num} {u.en} = {(unit === "acre" ? num * HA_PER_ACRE : num).toFixed(2)} ha</span></p>;
    }
    case "cooperative_membership_years":
      return <p className="value">{num}<small>miaka</small><span className="en">years</span></p>;
    case "bad_season":
      return <p className="value">{yearFromSeason(String(value))}<span className="en">Harvest year · rain season {String(value)}</span></p>;
    case "last_harvest_delivered":
      return <p className="value">{num}<small>kg</small><span className="en">parchment coffee delivered</span></p>;
    case "land_tenure": {
      const o = TENURE.find((x) => x.value === value);
      return <p className="value" style={{ fontSize: "1.7rem" }}>{o?.sw ?? String(value)}<span className="en">{o?.en}</span></p>;
    }
    default:
      return <p className="value">{String(value)}</p>;
  }
}

function Stepper({ value, step = 1, min = 0, onChange }: { value: number; step?: number; min?: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))} aria-label="Less">−</button>
      <button onClick={() => onChange(+(value + step).toFixed(1))} aria-label="More">+</button>
    </div>
  );
}

function Editor({ claim, set }: { claim: Draft; set: (patch: Partial<Editable>) => void }) {
  const { field, value, unit } = claim;
  const num = Number(value);
  switch (field) {
    case "crop_type":
      return (
        <div className="seg">
          {CROPS.map((c) => (
            <button key={c.value} className={value === c.value ? "on" : ""} onClick={() => set({ value: c.value })}>{c.sw}<span className="en">{c.en}</span></button>
          ))}
        </div>
      );
    case "plot_area":
      return (
        <>
          <Stepper value={num} step={0.5} onChange={(v) => set({ value: v })} />
          <div className="seg">
            {(Object.keys(UNITS) as (keyof typeof UNITS)[]).map((u) => (
              <button key={u} className={unit === u ? "on" : ""} onClick={() => set({ unit: u })}>{UNITS[u].sw}<span className="en">{UNITS[u].en}</span></button>
            ))}
          </div>
        </>
      );
    case "cooperative_membership_years":
      return <Stepper value={num} onChange={(v) => set({ value: v })} />;
    case "last_harvest_delivered":
      return <input type="number" inputMode="numeric" value={num} onChange={(e) => set({ value: Number(e.target.value) })} aria-label="Kilograms" />;
    case "bad_season":
      return (
        <div className="seg years">
          {YEARS.map((y) => (
            <button key={y} className={yearFromSeason(String(value)) === y ? "on" : ""} onClick={() => set({ value: seasonFromYear(y) })}>{y}</button>
          ))}
        </div>
      );
    case "land_tenure":
      return (
        <div className="seg">
          {TENURE.map((o) => (
            <button key={o.value} className={value === o.value ? "on" : ""} onClick={() => set({ value: o.value })}>{o.sw}<span className="en">{o.en}</span></button>
          ))}
        </div>
      );
    default:
      return null;
  }
}

export default function Confirm({ candidates, onDone }: { candidates: CandidateClaim[]; onDone: (claims: ConfirmedClaim[]) => void }) {
  const [claims, setClaims] = useState<Draft[]>(() => candidates.map((c, i) => ({ ...c, key: i, confirmed: false })));

  const update = (key: number, patch: Partial<Editable>) =>
    setClaims((cs) => cs.map((c) => (c.key === key ? {
      ...c, ...patch, confirmed: false,
      source: { ...c.source, type: "farmer_tap" as const }, // value now comes from her tap, the quote stays for audit
    } : c)));
  const setConfirmed = (key: number, confirmed: boolean) => setClaims((cs) => cs.map((c) => (c.key === key ? { ...c, confirmed } : c)));
  const remove = (key: number) => setClaims((cs) => cs.filter((c) => c.key !== key));
  const add = (field: ClaimField) =>
    setClaims((cs) => [...cs, {
      field, ...BLANK[field]!, value_as_spoken: null, key: Date.now(), confirmed: false,
      source: { type: "farmer_tap", ref: null, quote: null, asr_confidence: null, confirmed_by_farmer: false },
    }]);

  const left = claims.filter((c) => !c.confirmed).length;
  const ready = claims.length > 0 && left === 0;

  function finish() {
    onDone(claims.map(({ key: _key, confirmed: _confirmed, ...c }, i) => ({
      claim_id: `c${i + 1}`,
      ...c,
      source: { ...c.source, confirmed_by_farmer: true },
      timestamp: now(),
    })));
  }

  return (
    <Screen title="Je, ni sahihi?" titleEn="Is this what you said?"
      footer={<Next onClick={finish} disabled={!ready} en={ready ? "Continue" : `${left} left to confirm`} />}>
      <Say ids={["CAPTURE_CONFIRM"]} />
      <div className="entries">
        {claims.map((c) => (
          <article key={c.key} className="entry">
            <div className="entry-head">
              <span className="entry-label">{FIELD[c.field].sw}<span className="en">{FIELD[c.field].en}</span></span>
              {!c.confirmed && <button className="link danger" onClick={() => remove(c.key)}>Ondoa<span className="en">Remove</span></button>}
            </div>
            {c.source.quote && <p className="quote">“{c.source.quote}”</p>}
            <Value claim={c} />
            {!c.confirmed && <Editor claim={c} set={(p) => update(c.key, p)} />}
            <div className="entry-actions">
              {c.confirmed ? (
                <>
                  <Stamp tone="green" en="Confirmed" tilt={-5}>Sahihi ✓</Stamp>
                  <button className="link" onClick={() => setConfirmed(c.key, false)}><Icon name="pen" size={18} />Badilisha<span className="en">Change</span></button>
                </>
              ) : (
                <button className="confirm-btn" onClick={() => setConfirmed(c.key, true)}><Icon name="check" />Sahihi<span className="en">&nbsp;Correct</span></button>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="add">
        <span className="en">Something missing? Add it:</span>
        {(Object.keys(BLANK) as ClaimField[]).map((f) => (
          <button key={f} className="chip" onClick={() => add(f)}>+ {FIELD[f].sw}</button>
        ))}
      </div>
    </Screen>
  );
}
