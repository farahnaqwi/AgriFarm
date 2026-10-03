import { Screen } from "./ui.jsx";
import { DEMO_FARMS } from "../lib/geo.js";

export default function Home({ demo, onDemo, farm, onFarm, onStart, onWipe }) {
  return (
    <Screen title="AgriFarm" titleEn="Farm evidence report">
      <p className="lead">
        Ripoti ya ushahidi kuhusu shamba lako.
        <span className="en">An evidence report about your farm. Works without internet.</span>
      </p>
      <button className="big primary" onClick={onStart}>▶ Anza<span>Start</span></button>

      <details className="panel">
        <summary>Demo settings</summary>
        <label className="row">
          <input type="checkbox" checked={demo} onChange={(e) => onDemo(e.target.checked)} />
          Simulated GPS inside the demo plot (we are not in Mbozi). Shown as a badge on every screen.
        </label>
        <div className="row">
          Demo farm:
          {Object.entries(DEMO_FARMS).map(([k, f]) => (
            <button key={k} className={farm === k ? "chip on" : "chip"} onClick={() => onFarm(k)}>{f.label}</button>
          ))}
        </div>
      </details>

      <button className="link danger" onClick={onWipe}>🗑 Futa kila kitu <span className="en">Delete everything on this phone</span></button>
    </Screen>
  );
}
