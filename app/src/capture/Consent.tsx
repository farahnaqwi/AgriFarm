import { useState } from "react";
import { Screen, Say, YesNo } from "./ui.tsx";
import { CONSENT_SCOPE, now } from "./capture.ts";
import type { Consent as ConsentRecord } from "../types/index.ts";

export default function Consent({ onAgree, onDecline }: { onAgree: (c: ConsentRecord) => void; onDecline: () => void }) {
  const [declined, setDeclined] = useState(false);

  if (declined) {
    return (
      <Screen step={1} title="Idhini" titleEn="Consent" footer={<button className="big" onClick={onDecline}>← Mwanzo<span>Home</span></button>}>
        <Say ids={["CONSENT_DECLINED"]} />
      </Screen>
    );
  }

  return (
    <Screen step={1} title="Idhini" titleEn="Consent">
      <Say ids={["CONSENT_INTRO", "CONSENT_PRIVACY", "CONSENT_DELETE", "CONSENT_ASK"]} />
      <YesNo
        onYes={() =>
          onAgree({
            given: true,
            recorded_at: now(),
            method: "tap",
            phrase_id: "CONSENT_ASK",
            scope: CONSENT_SCOPE,
            raw_audio_retention: "deleted_after_extraction",
          })
        }
        onNo={() => setDeclined(true)}
      />
    </Screen>
  );
}
