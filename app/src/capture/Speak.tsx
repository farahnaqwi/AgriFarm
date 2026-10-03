import { useEffect, useRef, useState } from "react";
import { Screen, Say } from "./ui.tsx";
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

  return (
    <Screen
      step={2}
      title="Eleza kuhusu shamba"
      titleEn="Tell us about your farm"
      footer={phase === "done" && (
        <button className="big primary" onClick={() => result && onClaims(result.claims)}>Endelea →<span>Continue</span></button>
      )}
    >
      <Say ids={["CAPTURE_SPEAK"]} />
      {phase === "idle" && modelReady < 1 && (
        <p className="working">Inaandaa… {Math.round(modelReady * 100)}% <span className="en">Preparing speech recognition on this phone</span></p>
      )}
      {phase === "idle" && modelReady >= 1 && !micBlocked && (
        <button className="mic" onClick={start} aria-label="Record">🎙<span>Bonyeza uongee</span></button>
      )}
      {micBlocked && <p className="problem">⚠ {PROBLEM.mic_denied.sw}<span className="en">{PROBLEM.mic_denied.en}</span></p>}
      {(phase === "idle" || micBlocked) && (
        <button className="link" onClick={() => onClaims([])}>✍ Jaza kwa kugusa <span className="en">Fill in by tapping instead</span></button>
      )}
      {phase === "recording" && (
        <button className="mic live" onClick={stop} aria-label="Stop">⏹<span>{seconds}s · Simamisha</span></button>
      )}
      {phase === "working" && <p className="working">Inasikiliza… <span className="en">Listening on this phone…</span></p>}
      {phase === "done" && result && (
        <div className="transcript">
          <h3>Tumesikia: <span className="en">What we heard</span></h3>
          <p>{result.transcript.text || "—"}</p>
          {result.claims.length === 0 && <p className="en">Nothing recognised. You can enter everything by tapping on the next screen.</p>}
        </div>
      )}
    </Screen>
  );
}
