import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

type SeoMeta = {
  title: string;
  description: string;
  image: string;
};

const defaultSeo: SeoMeta = {
  title: "Ready Set Fly - All-in-One Hub for Pilot Tools",
  description: "Ready Set Fly - Professional aviation marketplace and aircraft rental platform for licensed pilots",
  image: "/RSFOpaqueLogo.png",
};

const routeSeo: Record<string, SeoMeta> = {
  "/coryarmer": {
    title: "Cory Armer | Writer & Creator Portfolio",
    description: "Prestige television and elevated genre storytelling centered on legacy, identity, obsession, and the human cost of ambition.",
    image: "/downloads/coryarmer-portfolio-background.png",
  },
  "/noiseandfury": {
    title: "Noise & Fury | Prestige Anthology Drama Series",
    description: "A prestige anthology drama series exploring the artists who defined a generation and the personal cost of fame, addiction, creativity, and legacy.",
    image: "/downloads/noise-and-fury-hero.jpg",
  },
  "/thegrasp": {
    title: "The Grasp | A Psychological Folk Horror Feature",
    description: "Seeking freedom from a life dictated by time, Jonas and Lena relocate to the Norwegian island of Sommaroy, where clocks and schedules have been abandoned. What begins as liberation slowly reveals itself to be something far darker.",
    image: "/downloads/the-grasp-concept-art.png",
  },
  "/graveside": {
    title: "Graveside | A Television Series",
    description: "A trauma surgeon and a genealogist unlock the truth about the dead—and discover The Harrow Group will do almost anything to keep powerful families' history buried.",
    image: "/downloads/graveside-hero.png",
  },
  "/patriotprotocol": {
    title: "The Patriot Protocol | A Television Series",
    description: "A political conspiracy thriller centered on a decades-long plan to execute a bloodless coup against American democracy and the covert network formed to stop it.",
    image: "/downloads/patriot-protocol-concept-art.png",
  },
};

function absoluteUrl(req: { protocol?: string; get?: (header: string) => string | undefined; originalUrl?: string }, pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const host = req.get?.("host") || "readysetfly.us";
  const proto = req.get?.("x-forwarded-proto") || req.protocol || "https";
  return `${proto}://${host}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function seoForPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return routeSeo[normalized] || defaultSeo;
}

function injectSeoMeta(html: string, req: { path?: string; protocol?: string; get?: (header: string) => string | undefined; originalUrl?: string }) {
  const pathname = new URL(req.originalUrl || req.path || "/", "https://readysetfly.us").pathname;
  const meta = seoForPath(pathname);
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = escapeHtml(absoluteUrl(req, meta.image));
  const url = escapeHtml(absoluteUrl(req, pathname));
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Ready Set Fly" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ].join("\n    ");

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name=["']description["'][^>]*>\s*/i, "")
    .replace("</head>", `    ${tags}\n  </head>`);
}

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
      template = injectSeoMeta(template, req);
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
  app.use("*", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    const indexPath = path.resolve(distPath, "index.html");
    fs.promises.readFile(indexPath, "utf-8")
      .then((html) => res.status(200).set({ "Content-Type": "text/html" }).end(injectSeoMeta(html, req)))
      .catch(() => res.sendFile(indexPath));
  });
}
