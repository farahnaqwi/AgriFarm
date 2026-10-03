import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-700.css";
import "@fontsource/atkinson-hyperlegible-next/latin-800.css";
import "@fontsource/atkinson-hyperlegible-mono/latin-500.css";
import "./styles.css";

registerSW({ immediate: true });
createRoot(document.getElementById("root")!).render(<App />);
