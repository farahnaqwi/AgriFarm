import { useEffect, useState } from "react";
import { load, save, wipeAll } from "../offline/store.js";
import { demoOn, setDemo } from "../lib/geo.js";
import { playClips } from "../lib/audio.js";
import { buildReport } from "../engine.js";
import { getEvidenceCard } from "../data/cards.js";
import { newCapture } from "./capture.js";
import { Badges, Screen, Say } from "./ui.jsx";
import Home from "./Home.jsx";
import Consent from "./Consent.jsx";
import Speak from "./Speak.jsx";
import Confirm from "./Confirm.jsx";
import Plot from "./Plot.jsx";
import Photos from "./Photos.jsx";
import Review from "./Review.jsx";
import Share from "./Share.jsx";

// Farmer flow: home -> consent -> speak -> confirm -> plot -> photos -> review -> share.
// State is saved to IndexedDB after every change, so closing the app loses nothing.

const FRESH = { step: "home", farm: "A", capture: null, candidates: [], report: null, sealed: null };

export default function Flow() {
  const [st, setSt] = useState(null);
  const [demo, setDemoState] = useState(demoOn());

  useEffect(() => {
    load("flow").then((s) => setSt(s ?? FRESH));
  }, []);
  useEffect(() => {
    if (st) save("flow", st);
  }, [st]);

  const go = (step, extra = {}) => setSt((s) => ({ ...s, ...extra, step }));
  const setCapture = (patch) => setSt((s) => ({ ...s, capture: { ...s.capture, ...patch } }));

  // Build the report (offline) when entering review.
  useEffect(() => {
    if (st?.step !== "review" || st.report) return;
    (async () => {
      const card = await getEvidenceCard(st.capture.plot_id);
      const report = await buildReport(st.capture, card);
      setSt((s) => ({ ...s, report }));
    })();
  }, [st?.step, st?.report, st?.capture]);

  if (!st) return null;

  async function wipe() {
    await wipeAll();
    setSt({ ...FRESH, farm: st.farm });
    playClips(["DELETE_DONE"]);
  }

  let view;
  switch (st.step) {
    case "consent":
      view = <Consent onAgree={(consent) => (setCapture({ consent }), go("speak"))} onDecline={() => go("home")} />;
      break;
    case "speak":
      view = <Speak farm={st.farm} onClaims={(candidates) => go("confirm", { candidates })} />;
      break;
    case "confirm":
      view = <Confirm candidates={st.candidates} onDone={(claims) => (setCapture({ claims }), go("plot"))} />;
      break;
    case "plot":
      view = <Plot farm={st.farm} onDone={(plot) => (setCapture({ plot }), go("photos"))} />;
      break;
    case "photos":
      view = (
        <Photos
          farm={st.farm}
          ring={st.capture.plot.geometry.coordinates[0]}
          photos={st.capture.photos}
          onAdd={(p) => setSt((s) => ({ ...s, capture: { ...s.capture, photos: [...s.capture.photos, p] } }))}
          onDone={() => go("review", { report: null })}
        />
      );
      break;
    case "review":
      view = st.report
        ? <Review report={st.report} onNext={() => go("share")} />
        : <Screen title="Ripoti" titleEn="Report"><Say ids={["CAPTURE_DONE"]} /></Screen>;
      break;
    case "share":
      view = <Share report={st.report} sealed={st.sealed} onSealed={(sealed) => setSt((s) => ({ ...s, sealed }))} onHome={() => setSt({ ...FRESH, farm: st.farm })} />;
      break;
    default:
      view = (
        <Home
          demo={demo}
          onDemo={(on) => (setDemo(on), setDemoState(on))}
          farm={st.farm}
          onFarm={(farm) => setSt((s) => ({ ...s, farm }))}
          onStart={async () => go("consent", { capture: await newCapture(st.farm), candidates: [], report: null, sealed: null })}
          onWipe={wipe}
        />
      );
  }

  return (
    <div className="app">
      <Badges demo={demo} />
      {st.step !== "home" && (
        <button className="home-btn" onClick={() => go("home")} aria-label="Home">⌂</button>
      )}
      {view}
    </div>
  );
}
