import { useEffect, useState, type ReactNode } from "react";
import { load, save, wipeAll } from "../offline/store.ts";
import { demoOn, setDemo } from "../lib/geo.ts";
import { playClips } from "../lib/audio.ts";
import { buildReport } from "../engine.ts";
import { getEvidenceCard } from "../data/cards.ts";
import { flushOutbox } from "../data/reports.ts";
import { newCapture } from "./capture.ts";
import { Screen, Say, TopBar } from "./ui.tsx";
import Home from "./Home.tsx";
import Consent from "./Consent.tsx";
import Speak from "./Speak.tsx";
import Confirm from "./Confirm.tsx";
import Plot from "./Plot.tsx";
import Photos from "./Photos.tsx";
import Review from "./Review.tsx";
import Share from "./Share.tsx";
import type { CandidateClaim, Capture, DemoFarm, Report } from "../types/index.ts";

// Farmer flow: home -> consent -> speak -> confirm -> plot -> photos -> review -> share.
// State is saved to IndexedDB after every change, so closing the app loses nothing.

type Step = "home" | "consent" | "speak" | "confirm" | "plot" | "photos" | "review" | "share";

interface FlowState {
  step: Step;
  farm: DemoFarm;
  capture: Capture | null;
  candidates: CandidateClaim[];
  report: Report | null;
  sealed: Report | null;
}

const STEP_NUMBER: Record<Step, number | null> = { home: null, consent: 1, speak: 2, confirm: 3, plot: 4, photos: 5, review: 6, share: 6 };

const FRESH: FlowState = { step: "home", farm: "A", capture: null, candidates: [], report: null, sealed: null };

export default function Flow() {
  const [st, setSt] = useState<FlowState | null>(null);
  const [demo, setDemoState] = useState(demoOn());

  useEffect(() => {
    load<FlowState>("flow").then((s) => setSt(s ?? FRESH));
  }, []);
  useEffect(() => {
    if (st) save("flow", st);
  }, [st]);

  // Shared reports wait on the phone; send them on start and whenever a connection comes back.
  const [pending, setPending] = useState(0);
  useEffect(() => {
    const flush = () => flushOutbox().then(({ pending }) => setPending(pending));
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [st?.sealed]);

  const patch = (p: Partial<FlowState>) => setSt((s) => (s ? { ...s, ...p } : s));
  const go = (step: Step, extra: Partial<FlowState> = {}) => patch({ ...extra, step });
  const setCapture = (p: Partial<Capture>) => setSt((s) => (s?.capture ? { ...s, capture: { ...s.capture, ...p } } : s));

  // Build the report (offline) when entering review.
  useEffect(() => {
    if (st?.step !== "review" || st.report || !st.capture) return;
    const capture = st.capture;
    (async () => {
      const card = await getEvidenceCard(capture.plot_id);
      const report = await buildReport(capture, card);
      patch({ report });
    })();
  }, [st?.step, st?.report, st?.capture]);

  // Screens alternate surfaces so the flow has rhythm: ink for permission and camera, green when sealed.
  const theme = !st ? "paper"
    : st.step === "home" ? "home"
    : st.step === "consent" || st.step === "photos" ? "ink"
    : st.step === "share" && st.sealed ? "green"
    : "paper";
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  if (!st) return null;
  const { capture } = st;
  const home = () => setSt({ ...FRESH, farm: st.farm });

  async function wipe() {
    await wipeAll();
    home();
    playClips(["DELETE_DONE"]);
  }

  let view: ReactNode;
  if (st.step !== "home" && !capture) {
    view = null; // capture is created on "Start"; any other step without one is unreachable
    home();
  } else if (st.step === "consent") {
    view = <Consent onAgree={(consent) => (setCapture({ consent }), go("speak"))} onDecline={() => go("home")} />;
  } else if (st.step === "speak") {
    view = <Speak farm={capture?.demo_farm ?? null} onClaims={(candidates) => go("confirm", { candidates })} />;
  } else if (st.step === "confirm") {
    view = <Confirm candidates={st.candidates} onDone={(claims) => (setCapture({ claims }), go("plot"))} />;
  } else if (st.step === "plot") {
    view = <Plot farm={st.farm} onDone={(plot, match) => (setCapture({ plot, plot_id: match?.plot_id ?? null, plot_meta: match ? { country: match.country, admin_area: match.admin_area } : null }), go("photos"))} />;
  } else if (st.step === "photos" && capture?.plot) {
    view = (
      <Photos
        farm={st.farm}
        ring={capture.plot.geometry.coordinates[0]}
        photos={capture.photos}
        onAdd={(p) => setSt((s) => (s?.capture ? { ...s, capture: { ...s.capture, photos: [...s.capture.photos, p] } } : s))}
        onDone={() => go("review", { report: null })}
      />
    );
  } else if (st.step === "review") {
    view = st.report
      ? <Review report={st.report} onNext={() => go("share")} />
      : <Screen title="Ripoti" titleEn="Report"><Say ids={["CAPTURE_DONE"]} /></Screen>;
  } else if (st.step === "share" && st.report) {
    view = <Share report={st.report} sealed={st.sealed} onSealed={(sealed) => patch({ sealed })} onHome={home} />;
  } else {
    view = (
      <Home
        demo={demo}
        onDemo={(on) => (setDemo(on), setDemoState(on))}
        farm={st.farm}
        onFarm={(farm) => patch({ farm })}
        onStart={async () => go("consent", { capture: await newCapture(demo ? st.farm : null), candidates: [], report: null, sealed: null })}
        onWipe={wipe}
        pending={pending}
      />
    );
  }

  return (
    <div className="app">
      <TopBar step={STEP_NUMBER[st.step]} total={6} demo={demo} onHome={st.step !== "home" ? () => go("home") : undefined} />
      {view}
    </div>
  );
}
