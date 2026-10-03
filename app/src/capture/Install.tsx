import { useEffect, useState } from "react";
import { canPromptInstall, isIOS, isStandalone, onInstallChange, promptInstall } from "../lib/install.ts";

/** Big "install" card on the home screen. Hidden once the app runs from the home-screen icon. */
export default function Install() {
  const [canPrompt, setCanPrompt] = useState(canPromptInstall());
  const [standalone, setStandalone] = useState(isStandalone());

  useEffect(() => onInstallChange(() => {
    setCanPrompt(canPromptInstall());
    setStandalone(isStandalone());
  }), []);

  if (standalone) return null;

  if (canPrompt) {
    return (
      <button className="big install" onClick={() => promptInstall()}>
        📲 Weka kwenye simu<span>Install on this phone. Works without internet afterwards.</span>
      </button>
    );
  }

  return (
    <p className="install-hint">
      📲 {isIOS()
        ? <>Bonyeza <b>Share</b> kisha <b>Add to Home Screen</b>.<span className="en">Tap Share, then "Add to Home Screen", to install.</span></>
        : <>Fungua menyu ya kivinjari, chagua <b>Install app</b>.<span className="en">Open the browser menu and choose "Install app" or "Add to Home screen".</span></>}
    </p>
  );
}
