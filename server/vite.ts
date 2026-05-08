import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const cesiumStaticPath = path.resolve(
    import.meta.dirname,
    "..",
    "node_modules",
    "cesium",
    "Build",
    "Cesium",
  );
  if (fs.existsSync(cesiumStaticPath)) {
    app.use("/cesium", express.static(cesiumStaticPath, { dotfiles: "deny" }));
  }

  const resolvedConfig =
    typeof viteConfig === "function"
      ? await viteConfig({ command: "serve", mode: process.env.NODE_ENV || "development" })
      : viteConfig;
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...resolvedConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  const cesiumDistPath = path.resolve(distPath, "cesium");
  const cesiumNodePath = path.resolve(
    import.meta.dirname,
    "..",
    "node_modules",
    "cesium",
    "Build",
    "Cesium",
  );

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  if (fs.existsSync(cesiumDistPath)) {
    app.use("/cesium", express.static(cesiumDistPath, { dotfiles: "deny" }));
  } else if (fs.existsSync(cesiumNodePath)) {
    app.use("/cesium", express.static(cesiumNodePath, { dotfiles: "deny" }));
  }

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    const hasExtension = path.extname(req.path);
    if (!hasExtension) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    }
    return next();
  });

  app.use(
    express.static(distPath, {
      dotfiles: "deny",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
          return;
        }
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
