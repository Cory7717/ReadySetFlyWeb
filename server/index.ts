import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { fork } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Loads ReadySetFly/server/.env no matter where you run from
dotenv.config({ path: join(__dirname, ".env") });

const isProd = process.env.NODE_ENV === "production";
if (!isProd) {
  console.log("DATABASE_URL loaded?", !!process.env.DATABASE_URL);
}
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startFinanceAlertsJob } from "./jobs/financeAlerts";
import { buildCorsOptions } from "./corsOptions";

const app = express();
// Behind Render's proxy; required for secure cookies/session in OAuth flows
app.set("trust proxy", 1);

// CORS configuration - allow same-origin production traffic and explicit web origins.
app.use(cors(buildCorsOptions()));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (!isProd && capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    startFinanceAlertsJob();
    const swimRunMode = String(process.env.SWIM_RUN_MODE ?? "").toLowerCase();
    const shouldStartSwim = swimRunMode !== "worker" && swimRunMode !== "disabled" && swimRunMode !== "off";
    const swimRunInApi = String(process.env.SWIM_RUN_IN_API ?? "").toLowerCase();
    const nmsEnabled = String(process.env.NMS_ENABLED ?? "").toLowerCase() === "true";
    const nmsRunMode = String(process.env.NMS_RUN_MODE ?? "").toLowerCase();
    const nmsRunInApi = String(process.env.NMS_RUN_IN_API ?? "").toLowerCase();
    const shouldStartNms =
      nmsEnabled &&
      nmsRunMode !== "worker" &&
      (nmsRunInApi === "true" || (!isProd && nmsRunInApi !== "false"));

    if (shouldStartNms) {
      try {
        const { startNmsNotamWorker } = await import("./nms-notam-worker");
        const started = startNmsNotamWorker();
        if (started) {
          log("NMS NOTAM worker running inside API process");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`NMS NOTAM worker failed to start: ${message}`);
      }
    }

    if (!shouldStartSwim || swimRunInApi === "false") return;

    const startInProcess = swimRunInApi === "true" || !isProd;
    if (startInProcess) {
      try {
        const { startSwimNotamWorker } = await import("./notam-worker");
        const started = startSwimNotamWorker();
        if (started) {
          log("SWIM NOTAM worker running inside API process");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`SWIM NOTAM worker failed to start: ${message}`);
      }
      return;
    }

    let swimRestarts = 0;
    const maxSwimRestarts = 5;
    const spawnWorker = () => {
      const workerPath = join(__dirname, "notam-worker.js");
      const child = fork(workerPath, [], {
        env: { ...process.env, SWIM_RUN_MODE: "worker" },
        stdio: "inherit",
      });
      log("SWIM NOTAM worker running in child process");

      child.on("exit", (code, signal) => {
        const reason = signal ? `signal ${signal}` : `exit code ${code}`;
        log(`SWIM NOTAM worker exited (${reason}).`);
        if (swimRestarts >= maxSwimRestarts) {
          log("SWIM NOTAM worker restart limit reached; not restarting.");
          return;
        }
        swimRestarts += 1;
        const delayMs = 5000 * swimRestarts;
        setTimeout(spawnWorker, delayMs);
      });
    };

    spawnWorker();
  });
})();
