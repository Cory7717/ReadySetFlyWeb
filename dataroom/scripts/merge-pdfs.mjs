import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const dataroomDir = path.resolve(rootDir, "dataroom");
const outDir = path.resolve(dataroomDir, "out");
const mergedPath = path.resolve(outDir, "ReadySetFly_DataRoom_Packet.pdf");

if (!fs.existsSync(outDir)) {
  console.error("Missing dataroom/out. Run print-pdfs first.");
  process.exit(1);
}

const files = fs
  .readdirSync(outDir)
  .filter((file) => file.toLowerCase().endsWith(".pdf"))
  .filter((file) => file !== path.basename(mergedPath))
  .sort((a, b) => a.localeCompare(b, "en"));

if (files.length === 0) {
  console.error("No PDFs found in dataroom/out.");
  process.exit(1);
}

const merged = await PDFDocument.create();

for (const file of files) {
  const filePath = path.resolve(outDir, file);
  const bytes = fs.readFileSync(filePath);
  const doc = await PDFDocument.load(bytes);
  const pages = await merged.copyPages(doc, doc.getPageIndices());
  for (const page of pages) {
    merged.addPage(page);
  }
}

const mergedBytes = await merged.save();
fs.writeFileSync(mergedPath, mergedBytes);
console.log(`Merged PDF created: ${mergedPath}`);
