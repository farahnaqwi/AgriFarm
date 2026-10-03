import { useEffect, useState, useCallback, type ReactNode } from "react";
import { t } from "../lib/phrases.ts";
import { playClips, stopAudio, audioMissing, onAudioMissing } from "../lib/audio.ts";

/** Shows phrases (Swahili large, English small) and plays their clips in order. */
export function Say({ ids, autoplay = true, onDone }: { ids: string[]; autoplay?: boolean; onDone?: () => void }) {
  const [active, setActive] = useState(-1);
  const key = ids.join("|");
  const play = useCallback(async () => {
    const done = await playClips(ids, { onClip: (_, i) => setActive(i) });
    setActive(-1);
    if (done) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (autoplay) play();
    return stopAudio;
  }, [play, autoplay]);
  return (
    <div className="say">
      {ids.map((id, i) => (
        <p key={id + i} className={i === active ? "active" : ""}>
          <span className="sw">{t(id)}</span>
          <span className="en">{t(id, "en")}</span>
        </p>
      ))}
      <button className="link" onClick={play}>🔊 Sikiliza tena <span className="en">Listen again</span></button>
    </div>
  );
}

export function YesNo({ onYes, onNo, yes = "Ndiyo", no = "Hapana", disabled }: {
  onYes: () => void; onNo: () => void; yes?: string; no?: string; disabled?: boolean;
}) {
  return (
    <div className="yesno">
      <button className="big yes" onClick={onYes} disabled={disabled} aria-label="Yes">✓<span>{yes}</span></button>
      <button className="big no" onClick={onNo} disabled={disabled} aria-label="No">✗<span>{no}</span></button>
    </div>
  );
}

export function Screen({ step, title, titleEn, children, footer }: {
  step?: number; title: string; titleEn: string; children?: ReactNode; footer?: ReactNode;
}) {
  return (
    <section className="screen">
      <header>
        {step && <div className="steps">{[1, 2, 3, 4, 5, 6].map((n) => <i key={n} className={n <= step ? "on" : ""} />)}</div>}
        <h1>{title}<span className="en">{titleEn}</span></h1>
      </header>
      <div className="body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </section>
  );
}

export function Badges({ demo }: { demo: boolean }) {
  const [missing, setMissing] = useState(audioMissing());
  useEffect(() => onAudioMissing(() => setMissing(true)), []);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return (
    <div className="badges">
      <span className={online ? "badge" : "badge offline"}>{online ? "Online" : "✈ Offline"}</span>
      {demo && <span className="badge demo">DEMO GPS</span>}
      {missing && <span className="badge muted" title="ElevenLabs clips not generated yet; text only">🔇 text only</span>}
    </div>
  );
}
