import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Screen, Say, YesNo, Next, Stamp, T } from "./ui.tsx";
import { useLang } from "../lib/lang.ts";
import { Icon } from "./icons.tsx";
import { seal } from "../engine.ts";
import { uploadReport } from "../data/reports.ts";
import type { Report } from "../types/index.ts";

interface Props {
  report: Report;
  sealed: Report | null;
  onSealed: (sealed: Report) => void;
  onHome: () => void;
}

/** First 16 hex characters of the hash, grouped like a mobile-money transaction ID. */
const groupCode = (hash: string) => hash.slice(0, 16).toUpperCase().match(/.{4}/g)!.join(" ");

export default function Share({ report, sealed, onSealed, onHome }: Props) {
  const [phase, setPhase] = useState<"ask" | "sealing" | "done" | "declined">(sealed ? "done" : "ask");
  const [qr, setQr] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  const sw = useLang() === "sw";

  useEffect(() => {
    if (sealed) QRCode.toDataURL(sealed.integrity.qr_payload, { margin: 0, width: 520, errorCorrectionLevel: "M", color: { dark: "#1b2333", light: "#fbf8f1" } }).then(setQr);
  }, [sealed]);

  async function approve() {
    setPhase("sealing");
    const s = await seal(report); // hash computed here, on the phone, at the moment she approves
    const { queued } = await uploadReport(s); // sends when a connection exists; queued offline
    setQueued(queued);
    onSealed(s);
    setPhase("done");
  }

  const home = <Next onClick={onHome} sw="Mwanzo" en="Back to start" />;

  if (phase === "declined") {
    return <Screen title="Haijashirikiwa" titleEn="Not shared" footer={home}><Say ids={["SHARE_DECLINED"]} /></Screen>;
  }

  if (phase === "done" && sealed) {
    return (
      <Screen className="sealed" title="Imefungwa" titleEn="Sealed. Show this to the loan officer." footer={home}>
        <Stamp tone="green" en="Unchanged since you approved it" tilt={-3}>{sw ? "Ripoti ya ushahidi" : "Evidence report"}</Stamp>
        {qr && <div className="qr-frame"><img className="qr" src={qr} alt="QR code for the loan officer" /></div>}
        <p className="code"><b>{groupCode(sealed.integrity.report_hash)}</b><span className="en">Report code · SHA-256</span></p>
        {queued && <p className="pending"><Icon name="upload" size={20} /><T sw="Itatumwa ukipata mtandao" en="Sends when the phone is online" /></p>}
        <Say ids={["SHARE_DONE", "DISCLAIMER"]} />
      </Screen>
    );
  }

  return (
    <Screen title="Ushiriki?" titleEn="Share it with the loan officer?"
      footer={<YesNo disabled={phase === "sealing"} onYes={approve} onNo={() => setPhase("declined")} />}>
      {report.not_sure.flag && (
        <p className="banner warn"><Icon name="warn" /><span><T sw="Hatuna uhakika kuhusu baadhi ya sehemu." en="Some parts are uncertain. Talk to your extension officer or cooperative before sharing." /></span></p>
      )}
      <Say ids={report.not_sure.flag ? ["NOT_SURE", "DISCLAIMER", "SHARE_ASK"] : ["DISCLAIMER", "SHARE_ASK"]} />
    </Screen>
  );
}
