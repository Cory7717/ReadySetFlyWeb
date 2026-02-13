import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (typeof window !== "undefined") {
  (window as any).CESIUM_BASE_URL = `${import.meta.env.BASE_URL || "/"}cesium/`;
}

const redirectKey = "spa-redirected-path";
const savedPath = sessionStorage.getItem(redirectKey);
if (savedPath && savedPath !== window.location.pathname) {
  sessionStorage.removeItem(redirectKey);
  window.history.replaceState(null, "", savedPath);
}

createRoot(document.getElementById("root")!).render(<App />);
