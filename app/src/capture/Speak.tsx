import { useEffect, useRef, useState } from "react";
import { Screen, Say, Next, T } from "./ui.tsx";
import { Icon } from "./icons.tsx";
import { stopAudio } from "../lib/audio.ts";
import { prepareAsr, transcribe } from "../ai/asr.ts";
import { demoOn } from "../lib/geo.ts";
import { PROBLEM } from "./labels.ts";
import { extractClaims } from "../ai/extract.ts";
import type { CandidateClaim, DemoFarm, Transcript } from "../types/index.ts";

export default function Speak({ farm, onClaims }: { farm: DemoFarm | null; onClaims: (claims: CandidateClaim[]) => void }) {
  const [phase, setPhase] = useState<"idle" | "recording" | "working" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<{ transcript: Transcript; claims: CandidateClaim[] } | null>(null);
  const rec = useRef<{ stop: () => void } | null>(null);
  const [modelReady, setModelReady] = useState(0); // 0..1 while the on-device speech model loads
  const [asrFailed, setAsrFailed] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);

  useEffect(() => {
    prepareAsr(setModelReady).then(() => setModelReady(1)).catch(() => setAsrFailed(true));
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
    // If recognition fails on this phone, carry on with nothing heard: every value can still be tapped.
    const transcript = await transcribe(blob, { demoFarm: farm }).catch((): Transcript => ({ text: "", segments: [] }));
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
      {phase === "idle" && asrFailed && (
        <p className="problem"><Icon name="warn" /><span><T sw={PROBLEM.asr_failed.sw} en={PROBLEM.asr_failed.en} /></span></p>
      )}
      {phase === "idle" && modelReady < 1 && !asrFailed && (
        <p className="working"><T sw={`Inaandaa… ${Math.round(modelReady * 100)}%`} en={`Preparing speech recognition on this phone… ${Math.round(modelReady * 100)}%`} /></p>
      )}
      {phase === "idle" && modelReady >= 1 && !micBlocked && (
        <>
          <button className="mic" onClick={start} aria-label="Record"><Icon name="mic" size={56} /></button>
          <p className="mic-caption"><T sw="Gusa uongee" en="Tap and speak in Swahili for about two minutes" /></p>
        </>
      )}
      {phase === "recording" && (
        <>
          <button className="mic live" onClick={stop} aria-label="Stop"><Icon name="stop" size={48} /></button>
          <p className="timer">{mmss}</p>
          <p className="mic-caption"><T sw="Gusa kumaliza" en="Tap when you are done" /></p>
        </>
      )}
      {phase === "working" && <p className="working"><T sw="Inasikiliza…" en="Listening on this phone. Nothing is sent anywhere." /></p>}
      {phase === "done" && result && (
        <div className="transcript">
          <h3><T sw="Tumesikia" en="What we heard" /></h3>
          <p>{result.transcript.text || "—"}</p>
          {result.claims.length === 0 && <p className="en"><T sw="Hakuna kilichotambuliwa. Unaweza kujaza kila kitu kwa kugusa kwenye skrini inayofuata." en="Nothing recognised. You can enter everything by tapping on the next screen." /></p>}
        </div>
      )}
      {micBlocked && <p className="problem"><Icon name="warn" /><span><T sw={PROBLEM.mic_denied.sw} en={PROBLEM.mic_denied.en} /></span></p>}
      {(phase === "idle" || micBlocked) && (
        <button className="link" onClick={() => onClaims([])}><Icon name="pen" size={20} /><T sw="Jaza kwa kugusa" en="Fill in by tapping instead" /></button>
      )}
    </Screen>
  );
}
