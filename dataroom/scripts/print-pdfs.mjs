import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const dataroomDir = path.resolve(rootDir, "dataroom");
const outDir = path.resolve(dataroomDir, "out");

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
ensureDir(outDir);

let playwright;
try {
  playwright = await import("playwright");
} catch (error) {
  console.error("Playwright is required. Install with: npm install -D playwright");
  process.exit(1);
}

const markdownFiles = fs
  .readdirSync(dataroomDir)
  .filter((file) => file.endsWith(".md"))
  .map((file) => path.resolve(dataroomDir, file));

const buildHtml = (title, markdown) => {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; line-height: 1.4; }
      h1, h2, h3 { margin-top: 24px; }
      pre { background: #f5f5f5; padding: 12px; overflow-x: auto; }
      code { font-family: Consolas, Monaco, monospace; }
      ul { padding-left: 20px; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  </head>
  <body>
    <div id="content"></div>
    <script>
      const markdown = ${JSON.stringify(escaped)};
      document.getElementById('content').innerHTML = marked.parse(markdown);
    </script>
  </body>
</html>`;
};

const { chromium } = playwright;
const browser = await chromium.launch();
const page = await browser.newPage();

for (const filePath of markdownFiles) {
  const markdown = fs.readFileSync(filePath, "utf8");
  const title = path.basename(filePath, ".md");
  const html = buildHtml(title, markdown);

  await page.setContent(html, { waitUntil: "networkidle" });
  const outPath = path.resolve(outDir, `${title}.pdf`);
  await page.pdf({ path: outPath, format: "A4", printBackground: true });
  console.log(`PDF created: ${outPath}`);
}

await browser.close();
