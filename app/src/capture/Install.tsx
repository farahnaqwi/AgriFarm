import { useEffect, useState } from "react";
import { canPromptInstall, isIOS, isStandalone, onInstallChange, promptInstall } from "../lib/install.ts";
import { Icon } from "./icons.tsx";
import { T } from "./ui.tsx";

/** "Install on this phone": hidden once the app runs from the home-screen icon. */
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
      <button className="link" onClick={() => promptInstall()}>
        <Icon name="download" size={20} /><T sw="Weka kwenye simu" en="Install on this phone" />
      </button>
    );
  }

  return (
    <p className="install-hint">
      <Icon name="download" size={20} />
      <span>
        <T sw={isIOS() ? "Shiriki → Ongeza kwenye Skrini ya Mwanzo" : "Menyu → Sakinisha programu"}
          en={isIOS() ? "Install: tap Share, then \"Add to Home Screen\"." : "Install: open the browser menu, then \"Install app\"."} />
      </span>
    </p>
  );
}
