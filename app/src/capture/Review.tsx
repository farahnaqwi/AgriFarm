import { useCallback, useEffect, useMemo, useState } from "react";
import { Screen, Stamp, VoiceNote, Next } from "./ui.tsx";
import { Icon } from "./icons.tsx";
import { playClips, stopAudio } from "../lib/audio.ts";
import { t } from "../lib/phrases.ts";
import { STATUS, TIER } from "./labels.ts";
import type { Claim, Report, Sentence } from "../types/index.ts";

const TONE = { consistent: "green", contradicted: "red", unverifiable: "grey" } as const;

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

  const playFrom = useCallback(async (start: number) => {
    for (let i = start; i < sentences.length; i++) {
      setActive(i);
      const finished = await playClips(sentences[i].audio_clips);
      if (!finished) return;
    }
    setActive(-1);
    setHeard(true);
  }, [sentences]);

  useEffect(() => {
    playFrom(0);
    return stopAudio;
  }, [playFrom]);

  const tally = report.evidence_summary.tally;
  const playing = active >= 0;

  return (
    <Screen title="Ripoti yako" titleEn="Your evidence report"
      footer={<Next onClick={() => { stopAudio(); onNext(); }} en={heard ? "Continue" : "Skip to sharing"} />}>
      {report.provenance.mode !== "live" && <p className="banner">{report.provenance.mode} data · not a real farmer</p>}
      {report.not_sure.flag && (
        <p className="banner warn"><Icon name="warn" /><span>Hatuna uhakika kuhusu baadhi ya sehemu.<span className="en">{t("NOT_SURE", "en")}</span></span></p>
      )}

      <div className="tally">
        <div><b>{tally.consistent}</b><Stamp tone="green" tilt={-3}>{STATUS.consistent.sw}</Stamp></div>
        <div><b>{tally.contradicted}</b><Stamp tone="red" tilt={2}>{STATUS.contradicted.sw}</Stamp></div>
        <div><b>{tally.unverifiable}</b><Stamp tone="grey" tilt={-2}>{STATUS.unverifiable.sw}</Stamp></div>
      </div>

      <VoiceNote seed={report.report_id} playing={playing} progress={playing ? (active + 1) / sentences.length : heard ? 1 : 0}
        onToggle={playing ? stopAudio : () => playFrom(0)} />

      <ol className="ledger">
        {sentences.map((s, i) => {
          const claim = claims[s.claim_refs[0]];
          const firstOfClaim = claim && sentences[i - 1]?.claim_refs[0] !== claim.claim_id;
          return (
            <li key={s.sentence_id} className={i === active ? "now" : ""} onClick={() => playFrom(i)}>
              {firstOfClaim && (
                <Stamp tone={TONE[claim.status]} en={TIER[claim.tier].en} tilt={i % 2 ? 3 : -4}>
                  {STATUS[claim.status].sw}
                </Stamp>
              )}
              <span className="sw">{s.text.sw}</span>
              <span className="en">{s.text.en}</span>
            </li>
          );
        })}
      </ol>
    </Screen>
  );
}
