import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Screen, Say, YesNo } from "./ui.tsx";
import { seal } from "../engine.ts";
import { uploadReport } from "../data/reports.ts";
import type { Report } from "../types/index.ts";

interface Props {
  report: Report;
  sealed: Report | null;
  onSealed: (sealed: Report) => void;
  onHome: () => void;
}

export default function Share({ report, sealed, onSealed, onHome }: Props) {
  const [phase, setPhase] = useState<"ask" | "sealing" | "done" | "declined">(sealed ? "done" : "ask");
  const [qr, setQr] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    if (sealed) QRCode.toDataURL(sealed.integrity.qr_payload, { margin: 1, width: 320, errorCorrectionLevel: "M" }).then(setQr);
  }, [sealed]);

  async function approve() {
    setPhase("sealing");
    const s = await seal(report); // hash computed here, on the phone, at the moment she approves
    const { queued } = await uploadReport(s); // sends when a connection exists; queued offline
    setQueued(queued);
    onSealed(s);
    setPhase("done");
  }

  const home = <button className="big" onClick={onHome}>⌂ Mwanzo<span>Home</span></button>;

  if (phase === "declined") {
    return <Screen title="Ripoti" titleEn="Report" footer={home}><Say ids={["SHARE_DECLINED"]} /></Screen>;
  }
  if (phase === "done" && sealed) {
    return (
      <Screen title="Imefungwa" titleEn="Sealed" footer={home}>
        <Say ids={["SHARE_DONE", "DISCLAIMER"]} />
        {qr && <img className="qr" src={qr} alt="QR code for the loan officer" />}
        <p className="hash">SHA-256 {sealed.integrity.report_hash.slice(0, 16)}…</p>
        {queued && <p className="en">Saved on this phone. It uploads the next time there is a connection.</p>}
      </Screen>
    );
  }
  return (
    <Screen step={6} title="Shiriki?" titleEn="Share?">
      {report.not_sure.flag && <p className="banner warn">⚠ Hatuna uhakika kuhusu baadhi ya sehemu. <span className="en">Some parts are uncertain. Talk to your extension officer or cooperative before sharing.</span></p>}
      <Say ids={report.not_sure.flag ? ["NOT_SURE", "DISCLAIMER", "SHARE_ASK"] : ["DISCLAIMER", "SHARE_ASK"]} />
      <YesNo disabled={phase === "sealing"} onYes={approve} onNo={() => setPhase("declined")} />
    </Screen>
  );
}
