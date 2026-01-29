import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const redirectKey = "spa-redirected-path";
const savedPath = sessionStorage.getItem(redirectKey);
if (savedPath && savedPath !== window.location.pathname) {
  sessionStorage.removeItem(redirectKey);
  window.history.replaceState(null, "", savedPath);
}

createRoot(document.getElementById("root")!).render(<App />);
