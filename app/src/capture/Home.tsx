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
    <section className="screen home">
      <div className="home-hero">
        <h1>Daftari la shamba<span className="en">Your farm ledger</span></h1>
        <p className="lead">
          Eleza shamba lako. Tutakagua, utasikiliza, kisha uamue kushiriki.
          <span className="en">Describe your farm. We check it against satellite and rain records, you listen, then you decide whether to share it.</span>
        </p>
        <button className="btn primary hero" onClick={onStart}>
          <span className="label">Anza<span className="en">Start</span></span>
          <Icon name="arrow" size={30} />
        </button>
      </div>
      <div className="body">
      <ol className="steps-preview">
        <li><b>1</b><span>Eleza shamba lako<span className="en">Talk about your farm</span></span></li>
        <li><b>2</b><span>Tembea mipaka, piga picha<span className="en">Walk the boundary, take two photos</span></span></li>
        <li><b>3</b><span>Sikiliza ripoti, amua<span className="en">Hear your report, then decide</span></span></li>
      </ol>
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
      </div>
    </section>
  );
}
