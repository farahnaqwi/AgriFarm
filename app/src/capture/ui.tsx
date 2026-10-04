import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { t } from "../lib/phrases.ts";
import { playClips, stopAudio, audioMissing, onAudioMissing, audioBlocked, onAudioBlocked } from "../lib/audio.ts";
import { LANGUAGES, setLang, useLang } from "../lib/lang.ts";
import type { Lang } from "../lib/phrases.ts";
import { Icon } from "./icons.tsx";

const BARS = 30;

/** Deterministic waveform shape per phrase, so the same message always "looks" the same. */
function waveform(seed: string): number[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return Array.from({ length: BARS }, () => {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    return 0.22 + ((h >>> 8) % 1000) / 1280;
  });
}

/** Text in the chosen language. In Swahili, the English follows as the quiet second line. */
export function T({ sw, en }: { sw: ReactNode; en: ReactNode }) {
  return useLang() === "sw" ? <>{sw}<span className="en">{en}</span></> : <>{en}</>;
}

/** True while the browser refuses sound until the farmer taps. */
export function useAudioBlocked(): boolean {
  const [blocked, setBlocked] = useState(audioBlocked());
  useEffect(() => onAudioBlocked(setBlocked), []);
  return blocked;
}

/** The voice-note bubble: play/pause and a waveform that fills as it plays. */
export function VoiceNote({ seed, playing, progress, onToggle }: { seed: string; playing: boolean; progress: number; onToggle: () => void }) {
  const bars = useMemo(() => waveform(seed), [seed]);
  const blocked = useAudioBlocked();
  return (
    <div className={blocked && !playing ? "note nudge" : "note"}>
      <button className="note-btn" onClick={onToggle} aria-label={playing ? "Pause" : "Play"}>
        <Icon name={playing ? "pause" : "play"} size={22} />
      </button>
      <div className="wave" aria-hidden="true">
        {bars.map((b, i) => <i key={i} style={{ height: `${b * 100}%` }} className={i / BARS < progress ? "on" : ""} />)}
      </div>
      {blocked && !playing && <span className="nudge-label"><T sw="Gusa ▶ usikilize" en="Tap ▶ to listen" /></span>}
    </div>
  );
}

/** A voice note (the WhatsApp idiom she already knows) with its transcript underneath. */
export function Say({ ids, autoplay = true, onDone }: { ids: string[]; autoplay?: boolean; onDone?: () => void }) {
  const [active, setActive] = useState(-1);
  const lang = useLang();
  const key = ids.join("|");
  const play = useCallback(async () => {
    const done = await playClips(ids, { lang, onClip: (_, i) => setActive(i) });
    setActive(-1);
    if (done) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lang]);
  useEffect(() => {
    if (autoplay) play();
    return stopAudio;
  }, [play, autoplay]);

  const playing = active >= 0;
  const progress = playing ? (active + 1) / ids.length : 0;

  return (
    <div className={playing ? "say playing" : "say"}>
      <VoiceNote seed={key} playing={playing} progress={progress} onToggle={playing ? stopAudio : play} />
      <div className="said">
        {ids.map((id, i) => (
          <p key={id + i} className={i === active ? "now" : ""}>
            <T sw={t(id)} en={t(id, "en")} />
          </p>
        ))}
      </div>
    </div>
  );
}

/** Rubber stamp, like the cooperative's ledger. */
export function Stamp({ tone, children, en, tilt = -4 }: { tone: "green" | "red" | "grey" | "ink"; children: ReactNode; en?: string; tilt?: number }) {
  return (
    <span className={`stamp ${tone}`} style={{ "--tilt": `${tilt}deg` } as React.CSSProperties}>
      {children}
      {en && <small>{en}</small>}
    </span>
  );
}

export function YesNo({ onYes, onNo, disabled }: { onYes: () => void; onNo: () => void; disabled?: boolean }) {
  const sw = useLang() === "sw";
  return (
    <div className="yesno">
      <button className="yes" onClick={onYes} disabled={disabled}><Icon name="check" size={40} />{sw ? <>Ndiyo<span>Yes</span></> : "Yes"}</button>
      <button className="no" onClick={onNo} disabled={disabled}><Icon name="cross" size={40} />{sw ? <>Hapana<span>No</span></> : "No"}</button>
    </div>
  );
}

export function Screen({ title, titleEn, children, footer, className }: {
  title: string; titleEn: string; children?: ReactNode; footer?: ReactNode; className?: string;
}) {
  return (
    <section className={className ? `screen ${className}` : "screen"}>
      <h1><T sw={title} en={titleEn} /></h1>
      <div className="body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </section>
  );
}

/** Primary action: the chosen language large (Swahili with English small underneath). */
export function Next({ onClick, disabled, sw = "Endelea", en = "Continue" }: { onClick: () => void; disabled?: boolean; sw?: string; en?: string }) {
  return (
    <button className="btn primary" onClick={onClick} disabled={disabled}>
      <span className="label"><T sw={sw} en={en} /></span>
      <Icon name="arrow" />
    </button>
  );
}

export function TopBar({ step, total, demo, onHome }: { step: number | null; total: number; demo: boolean; onHome?: () => void }) {
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
    <div className="topbar">
      {step ? (
        <div className="pages" aria-label={`Step ${step} of ${total}`}>
          <span className="page">{step}<span>/{total}</span></span>
          <span className="ticks">{Array.from({ length: total }, (_, i) => <i key={i} className={i < step ? "on" : ""} />)}</span>
        </div>
      ) : <span className="wordmark">AgriFarm</span>}
      <div className="tags">
        {!online && <span className="tag solid">Offline</span>}
        {demo && <span className="tag">Demo GPS</span>}
        {missing && <span className="tag" title="ElevenLabs clips not generated yet">Text only</span>}
        <LanguagePicker />
        {onHome && <button className="icon-btn" onClick={onHome} aria-label="Home"><Icon name="home" size={20} /></button>}
      </div>
    </div>
  );
}

/** Language picker in the top bar. Native select, so phones show their own big picker. */
function LanguagePicker() {
  const lang = useLang();
  return (
    <label className="lang">
      <span className="sr-only">Language</span>
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
        {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    </label>
  );
}
