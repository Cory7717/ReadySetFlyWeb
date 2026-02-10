import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const dataroomDir = path.resolve(rootDir, "dataroom");
const shotsDir = path.resolve(dataroomDir, "screenshots");
const desktopDir = path.resolve(shotsDir, "desktop");
const mobileDir = path.resolve(shotsDir, "mobile");
const configPath = path.resolve(dataroomDir, "screenshots.json");

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const baseUrl = config.baseUrl?.replace(/\/$/, "");
const routes = Array.isArray(config.routes) ? config.routes : [];

if (!baseUrl || routes.length === 0) {
  console.error("Missing baseUrl or routes in dataroom/screenshots.json");
  process.exit(1);
}

const sanitize = (input) => input.replace(/^\//, "").replace(/[^a-z0-9-_]/gi, "-") || "home";

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

ensureDir(desktopDir);
ensureDir(mobileDir);

let playwright;
try {
  playwright = await import("playwright");
} catch (error) {
  console.error("Playwright is required. Install with: npm install -D playwright");
  process.exit(1);
}

const { chromium } = playwright;

const captureVariant = async ({ label, viewport, outputDir, deviceScaleFactor }) => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
  });
  const page = await context.newPage();

  for (const route of routes) {
    const url = `${baseUrl}${route}`;
    const name = sanitize(route);
    const filePath = path.resolve(outputDir, `${name}.png`);

    console.log(`[${label}] ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: filePath, fullPage: true });
  }

  await browser.close();
};

await captureVariant({
  label: "desktop",
  viewport: { width: 1400, height: 900 },
  outputDir: desktopDir,
  deviceScaleFactor: 1,
});

await captureVariant({
  label: "mobile",
  viewport: { width: 390, height: 844 },
  outputDir: mobileDir,
  deviceScaleFactor: 2,
});

console.log("Screenshots saved to dataroom/screenshots");
