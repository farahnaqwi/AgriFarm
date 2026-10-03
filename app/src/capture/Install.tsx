import { useEffect, useState } from "react";
import { canPromptInstall, isIOS, isStandalone, onInstallChange, promptInstall } from "../lib/install.ts";
import { Icon } from "./icons.tsx";

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
        <Icon name="download" size={20} />Weka kwenye simu<span className="en">Install on this phone</span>
      </button>
    );
  }

  return (
    <p className="install-hint">
      <Icon name="download" size={20} />
      <span>
        {isIOS() ? <>Share → Add to Home Screen</> : <>Menyu → Install app</>}
        <span className="en">{isIOS() ? "Install: tap Share, then \"Add to Home Screen\"." : "Install: open the browser menu, then \"Install app\"."}</span>
      </span>
    </p>
  );
}
