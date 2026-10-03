import Flow from "./capture/Flow.tsx";
import Verify from "./lender/Verify.tsx";

// "/" = farmer view (offline PWA). "/verify#r=...&h=..." = lender view (opened from the QR).
export default function App() {
  return window.location.pathname.startsWith("/verify") ? <Verify /> : <Flow />;
}
