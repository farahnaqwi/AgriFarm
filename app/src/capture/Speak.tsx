import { useEffect, useRef, useState } from "react";
import { Screen, Say, Next } from "./ui.tsx";
import { Icon } from "./icons.tsx";
import { stopAudio } from "../lib/audio.ts";
import { prepareAsr, transcribe } from "../ai/asr.ts";
import { demoOn } from "../lib/geo.ts";
import { PROBLEM } from "./labels.ts";
import { extractClaims } from "../ai/extract.ts";
import type { CandidateClaim, DemoFarm, Transcript } from "../types/index.ts";

export default function Speak({ farm, onClaims }: { farm: DemoFarm; onClaims: (claims: CandidateClaim[]) => void }) {
  const [phase, setPhase] = useState<"idle" | "recording" | "working" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<{ transcript: Transcript; claims: CandidateClaim[] } | null>(null);
  const rec = useRef<{ stop: () => void } | null>(null);
  const [modelReady, setModelReady] = useState(0); // 0..1 while the on-device speech model loads
  const [micBlocked, setMicBlocked] = useState(false);

  useEffect(() => {
    prepareAsr(setModelReady).then(() => setModelReady(1));
  }, []);

  useEffect(() => {
    if (phase !== "recording") return;
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => () => rec.current?.stop?.(), []);

  async function finish(blob: Blob | null) {
    setPhase("working");
    const transcript = await transcribe(blob, { demoFarm: farm });
    const claims = await extractClaims(transcript);
    // `blob` goes out of scope here: raw audio is never stored (consent: deleted_after_extraction).
    setResult({ transcript, claims });
    setPhase("done");
  }

  async function start() {
    stopAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        finish(new Blob(chunks, { type: mr.mimeType }));
      };
      mr.start();
      rec.current = mr;
    } catch {
      if (!demoOn()) {
        // Blocked or missing mic: say so, and offer tapping instead. Values are confirmed by tap either way.
        setMicBlocked(true);
        return;
      }
      rec.current = { stop: () => finish(null) }; // demo without a mic: the fake transcript stands in
    }
    setPhase("recording");
  }

  function stop() {
    const r = rec.current;
    rec.current = null;
    r?.stop();
  }

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <Screen
      title="Eleza shamba lako"
      titleEn="Tell us about your farm"
      footer={phase === "done" && result && <Next onClick={() => onClaims(result.claims)} />}
    >
      <Say ids={["CAPTURE_SPEAK"]} />
      {phase === "idle" && modelReady < 1 && (
        <p className="working">Inaandaa… {Math.round(modelReady * 100)}%<span className="en">Preparing speech recognition on this phone</span></p>
      )}
      {phase === "idle" && modelReady >= 1 && !micBlocked && (
        <>
          <button className="mic" onClick={start} aria-label="Record"><Icon name="mic" size={56} /></button>
          <p className="mic-caption">Gusa uongee<span className="en">Tap and speak for about two minutes</span></p>
        </>
      )}
      {phase === "recording" && (
        <>
          <button className="mic live" onClick={stop} aria-label="Stop"><Icon name="stop" size={48} /></button>
          <p className="timer">{mmss}</p>
          <p className="mic-caption">Gusa kumaliza<span className="en">Tap when you are done</span></p>
        </>
      )}
      {phase === "working" && <p className="working">Inasikiliza…<span className="en">Listening on this phone. Nothing is sent anywhere.</span></p>}
      {phase === "done" && result && (
        <div className="transcript">
          <h3>Tumesikia<span className="en">What we heard</span></h3>
          <p>{result.transcript.text || "—"}</p>
          {result.claims.length === 0 && <p className="en">Nothing recognised. You can enter everything by tapping on the next screen.</p>}
        </div>
      )}
      {micBlocked && <p className="problem"><Icon name="warn" /><span>{PROBLEM.mic_denied.sw}<span className="en">{PROBLEM.mic_denied.en}</span></span></p>}
      {(phase === "idle" || micBlocked) && (
        <button className="link" onClick={() => onClaims([])}><Icon name="pen" size={20} />Jaza kwa kugusa<span className="en">Fill in by tapping instead</span></button>
      )}
    </Screen>
  );
}
