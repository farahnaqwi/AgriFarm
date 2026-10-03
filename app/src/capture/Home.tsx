import { Screen } from "./ui.tsx";
import { Icon } from "./icons.tsx";
import { DEMO_FARMS } from "../lib/geo.ts";
import Install from "./Install.tsx";
import type { DemoFarm } from "../types/index.ts";

interface Props {
  demo: boolean;
  onDemo: (on: boolean) => void;
  farm: DemoFarm;
  onFarm: (farm: DemoFarm) => void;
  onStart: () => void;
  onWipe: () => void;
  pending: number;
}

export default function Home({ demo, onDemo, farm, onFarm, onStart, onWipe, pending }: Props) {
  return (
    <Screen className="home" title="Daftari la shamba" titleEn="Your farm ledger">
      <p className="lead">
        Eleza shamba lako. Tutakagua, utasikiliza, kisha uamue kushiriki.
        <span className="en">Describe your farm. We check it against satellite and rain records, you listen, then you decide whether to share it.</span>
      </p>

      <button className="btn primary hero" onClick={onStart}>
        <span className="label">Anza<span className="en">Start</span></span>
        <Icon name="arrow" size={30} />
      </button>

      {pending > 0 && (
        <p className="pending"><Icon name="upload" size={20} />{pending} · inasubiri mtandao / waiting for internet</p>
      )}

      <div className="quiet">
        <Install />
        <details className="demo-panel">
          <summary>Demo</summary>
          <label className="row">
            <input type="checkbox" checked={demo} onChange={(e) => onDemo(e.target.checked)} />
            Simulated GPS inside the demo plot (we are not in Mbozi). Badged on every screen.
          </label>
          <div className="row">
            {(Object.entries(DEMO_FARMS) as [DemoFarm, (typeof DEMO_FARMS)[DemoFarm]][]).map(([k, f]) => (
              <button key={k} className={farm === k ? "chip on" : "chip"} onClick={() => onFarm(k)}>{f.label}</button>
            ))}
          </div>
        </details>
        <button className="link danger" onClick={onWipe}><Icon name="trash" size={20} />Futa kila kitu<span className="en">Delete everything</span></button>
      </div>
    </Screen>
  );
}
