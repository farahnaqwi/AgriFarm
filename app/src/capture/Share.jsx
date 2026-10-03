import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Screen, Say, YesNo } from "./ui.jsx";
import { seal } from "../engine.js";
import { uploadReport } from "../data/reports.js";

export default function Share({ report, sealed, onSealed, onHome }) {
  const [phase, setPhase] = useState(sealed ? "done" : "ask"); // ask | sealing | done | declined
  const [qr, setQr] = useState(null);
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
      <Say ids={["DISCLAIMER", "SHARE_ASK"]} />
      <YesNo disabled={phase === "sealing"} onYes={approve} onNo={() => setPhase("declined")} />
    </Screen>
  );
}
