import { useCallback, useEffect, useMemo, useState } from "react";
import { Screen } from "./ui.tsx";
import { playClips, stopAudio } from "../lib/audio.ts";
import { t } from "../lib/phrases.ts";
import { STATUS, TIER } from "./labels.ts";
import type { Claim, Report, Sentence } from "../types/index.ts";

export default function Review({ report, onNext }: { report: Report; onNext: () => void }) {
  const [active, setActive] = useState(-1);
  const [heard, setHeard] = useState(false);

  // Fail-safe first: if the machine is unsure, she hears that before anything else.
  const sentences = useMemo((): Sentence[] => {
    const ns = report.not_sure.flag
      ? [{ sentence_id: "ns", phrase_id: "NOT_SURE", generated_by: "template" as const, text: { sw: t("NOT_SURE"), en: t("NOT_SURE", "en") }, audio_clips: ["NOT_SURE"], claim_refs: [], grounding_passed: true as const }]
      : [];
    return [...ns, ...report.narrative];
  }, [report]);

  const claims = useMemo((): Record<string, Claim> => Object.fromEntries(report.claims.map((c) => [c.claim_id, c])), [report]);

  const playAll = useCallback(async () => {
    for (let i = 0; i < sentences.length; i++) {
      setActive(i);
      const finished = await playClips(sentences[i].audio_clips);
      if (!finished) return;
    }
    setActive(-1);
    setHeard(true);
  }, [sentences]);

  useEffect(() => {
    playAll();
    return stopAudio;
  }, [playAll]);

  const tally = report.evidence_summary.tally;

  return (
    <Screen step={6} title="Ripoti yako" titleEn="Your evidence report"
      footer={<button className="big primary" onClick={() => { stopAudio(); onNext(); }}>Endelea →<span>{heard ? "Continue" : "Skip to sharing"}</span></button>}>
      {report.provenance.mode !== "live" && (
        <p className="banner">{report.provenance.mode.toUpperCase()} DATA · {report.provenance.notes}</p>
      )}
      {report.not_sure.flag && <p className="banner warn">⚠ {t("NOT_SURE", "en")}</p>}
      <div className="tally">
        <span>✅ {tally.consistent}</span>
        <span>❌ {tally.contradicted}</span>
        <span>⚪ {tally.unverifiable}</span>
      </div>
      <ol className="sentences">
        {sentences.map((s, i) => {
          const claim = claims[s.claim_refs[0]];
          const firstOfClaim = claim && sentences[i - 1]?.claim_refs[0] !== claim.claim_id;
          return (
            <li key={s.sentence_id} className={i === active ? "active" : ""} onClick={() => playClips(s.audio_clips)}>
              {firstOfClaim && (
                <span className={`status ${claim.status}`}>
                  {STATUS[claim.status].icon} {STATUS[claim.status].en} · {TIER[claim.tier].en}
                </span>
              )}
              <span className="sw">{s.text.sw}</span>
              <span className="en">{s.text.en}</span>
            </li>
          );
        })}
      </ol>
      <button className="link" onClick={playAll}>🔊 Sikiliza tena <span className="en">Listen again</span></button>
    </Screen>
  );
}
