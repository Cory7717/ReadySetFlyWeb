import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Build target:
// - Default: Render/server build => dist/public
// - GitHub Pages build: set GITHUB_PAGES=true => docs
const isGitHubPages = process.env.GITHUB_PAGES === "true";

export default defineConfig(async () => {
  const replitPlugins =
    process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          (await import("@replit/vite-plugin-cartographer")).cartographer(),
          (await import("@replit/vite-plugin-dev-banner")).devBanner(),
        ]
      : [];

  return {
    plugins: [react(), runtimeErrorOverlay(), ...replitPlugins],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),

    // IMPORTANT:
    // Render expects dist/public (your server serves this)
    // GitHub Pages expects docs (because Pages can only serve / or /docs)
    build: {
      outDir: isGitHubPages
        ? path.resolve(import.meta.dirname, "docs")
        : path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },

    // If you are using a custom domain on GitHub Pages (readysetfly.us),
    // base should be "/" (this is correct for a root domain).
    base: "/",

    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
