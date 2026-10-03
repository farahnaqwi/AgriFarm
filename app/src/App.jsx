import Flow from "./capture/Flow.jsx";
import Verify from "./lender/Verify.jsx";

// "/" = farmer view (offline PWA). "/verify#r=...&h=..." = lender view (opened from the QR).
export default function App() {
  return window.location.pathname.startsWith("/verify") ? <Verify /> : <Flow />;
}
