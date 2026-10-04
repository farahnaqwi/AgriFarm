import { Icon } from "./icons.tsx";
import { DEMO_FARMS } from "../lib/geo.ts";
import Install from "./Install.tsx";
import { T } from "./ui.tsx";
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
        <h1><T sw="Daftari la shamba" en="Your farm ledger" /></h1>
        <p className="lead">
          <T sw="Eleza shamba lako. Tutakagua, utasikiliza, kisha uamue kushiriki."
            en="Describe your farm. We check it against satellite and rain records, you listen, then you decide whether to share it." />
        </p>
        <button className="btn primary hero" onClick={onStart}>
          <span className="label"><T sw="Anza" en="Start" /></span>
          <Icon name="arrow" size={30} />
        </button>
      </div>
      <div className="body">
      <ol className="steps-preview">
        <li><b>1</b><span><T sw="Eleza shamba lako" en="Talk about your farm" /></span></li>
        <li><b>2</b><span><T sw="Tembea mipaka, piga picha" en="Walk the boundary, take two photos" /></span></li>
        <li><b>3</b><span><T sw="Sikiliza ripoti, amua" en="Hear your report, then decide" /></span></li>
      </ol>
      {pending > 0 && (
        <p className="pending"><Icon name="upload" size={20} />{pending} · <T sw="inasubiri mtandao" en="waiting for internet" /></p>
      )}

      <div className="quiet">
        <Install />
        <details className="demo-panel">
          <summary><T sw="Maonyesho" en="Demo" /></summary>
          <label className="row">
            <input type="checkbox" checked={demo} onChange={(e) => onDemo(e.target.checked)} />
            <T sw="GPS ya kuigiza ndani ya shamba la maonyesho (hatuko Mbozi). Inaonyeshwa kwenye kila skrini."
              en="Simulated GPS inside the demo plot (we are not in Mbozi). Badged on every screen." />
          </label>
          <div className="row">
            {(Object.entries(DEMO_FARMS) as [DemoFarm, (typeof DEMO_FARMS)[DemoFarm]][]).map(([k, f]) => (
              <button key={k} className={farm === k ? "chip on" : "chip"} onClick={() => onFarm(k)}>{f.label}</button>
            ))}
          </div>
        </details>
        <button className="link danger" onClick={onWipe}><Icon name="trash" size={20} /><T sw="Futa kila kitu" en="Delete everything" /></button>
      </div>
      </div>
    </section>
  );
}
