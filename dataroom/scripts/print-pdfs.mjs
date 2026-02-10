import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import MarkdownIt from "markdown-it";

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

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

const buildHtml = (title, markdown) => {
  const rendered = md.render(markdown);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; line-height: 1.5; }
      h1, h2, h3 { margin-top: 24px; }
      pre { background: #f5f5f5; padding: 12px; overflow-x: auto; }
      code { font-family: Consolas, Monaco, monospace; }
      ul { padding-left: 20px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      blockquote { color: #555; border-left: 4px solid #ddd; margin: 16px 0; padding-left: 12px; }
    </style>
  </head>
  <body>
    ${rendered}
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
