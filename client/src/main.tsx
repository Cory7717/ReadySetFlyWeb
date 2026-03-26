import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (typeof window !== "undefined") {
  (window as any).CESIUM_BASE_URL = `${import.meta.env.BASE_URL || "/"}cesium/`;
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    const reloadKey = "rsf-vite-preload-reload";
    const lastReloadAt = Number(sessionStorage.getItem(reloadKey) || "0");
    const now = Date.now();

    // Avoid infinite reload loops if an asset is genuinely missing after reload.
    if (!Number.isFinite(lastReloadAt) || now - lastReloadAt > 10000) {
      sessionStorage.setItem(reloadKey, String(now));
      window.location.reload();
    }
  });
}

const redirectKey = "spa-redirected-path";
const savedPath = sessionStorage.getItem(redirectKey);
if (savedPath && savedPath !== window.location.pathname) {
  sessionStorage.removeItem(redirectKey);
  window.history.replaceState(null, "", savedPath);
}

createRoot(document.getElementById("root")!).render(<App />);
