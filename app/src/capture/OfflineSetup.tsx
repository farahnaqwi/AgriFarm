import { useEffect, useState } from "react";
import { Screen, Next, T } from "./ui.tsx";
import { Icon } from "./icons.tsx";
import { watchOffline, type OfflineStatus } from "../lib/offline.ts";

const mb = (bytes: number) => Math.round(bytes / 1e6);

/** First run: real download progress, then an explicit "you can turn off wifi now". */
export default function OfflineSetup({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = useState<OfflineStatus>({ state: "checking" });
  useEffect(() => watchOffline(setStatus), []);

  if (status.state === "ready") {
    return (
      <Screen className="setup" title="Tayari" titleEn="Ready" footer={<Next onClick={onDone} sw="Anza" en="Start" />}>
        <img className="setup-logo" src="/logo.webp" alt="AgriFarm" />
        <div className="setup-done">
          <Icon name="check" size={36} />
          <p><b><T sw="Unaweza kuzima wifi sasa." en="You can turn off wifi now." /></b>
            <span><T sw="Kila kitu kimehifadhiwa kwenye simu hii. Programu inafanya kazi bila mtandao, hata ukiwa kwenye hali ya ndege."
              en="Everything is saved on this phone. The app works with no internet, even in airplane mode." /></span></p>
        </div>
      </Screen>
    );
  }

  if (status.state === "unsupported") {
    return (
      <Screen className="setup" title="Kivinjari hiki hakitoshi" titleEn="This browser can't work offline"
        footer={<Next onClick={onDone} sw="Endelea mtandaoni" en="Continue online" />}>
        <img className="setup-logo" src="/logo.webp" alt="AgriFarm" />
        <p className="problem"><Icon name="warn" /><span><T sw="Fungua kiungo hiki kwenye Chrome (Android) au Safari (iPhone) ili programu ifanye kazi bila mtandao."
          en="Open this link in Chrome (Android) or Safari (iPhone) so the app can work without internet." /></span></p>
      </Screen>
    );
  }

  const bytes = status.state === "downloading" ? status.bytes : 0;
  const total = status.state === "downloading" ? status.total : 0;
  const pct = total ? Math.min(99, Math.floor((bytes / total) * 100)) : null; // 100% is "ready", not a number

  return (
    <Screen className="setup" title="Inaandaa simu yako" titleEn="Getting this phone ready">
      <img className="setup-logo" src="/logo.webp" alt="AgriFarm" />
      <p className="setup-lead"><T sw="Inapakua kila kitu ili programu ifanye kazi bila mtandao: sauti, ramani na kusikiliza."
        en="Downloading everything the app needs to work without internet: the voice, the map and speech recognition." /></p>
      <div className={pct === null ? "setup-bar busy" : "setup-bar"} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}>
        <i style={pct === null ? undefined : { width: `${pct}%` }} />
      </div>
      <p className="setup-numbers">{total ? `${mb(bytes)} / ${mb(total)} MB · ${pct}%` : <T sw="Inaanza…" en="Starting…" />}</p>
      <p className="setup-keep"><Icon name="wifi" size={24} /><span><T sw="Usizime wifi. Acha programu hii wazi." en="Keep wifi on and keep this app open." /></span></p>
      <button className="link" onClick={onDone}><T sw="Endelea bila kusubiri (inahitaji mtandao)" en="Continue without waiting (needs internet)" /></button>
    </Screen>
  );
}
