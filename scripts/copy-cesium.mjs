import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const cesiumSource = path.resolve(repoRoot, "node_modules", "cesium", "Build", "Cesium");

const outputDirs = [];
const distPublic = path.resolve(repoRoot, "dist", "public");
const docsDir = path.resolve(repoRoot, "docs");

if (fs.existsSync(distPublic)) {
  outputDirs.push(path.join(distPublic, "cesium"));
}
if (fs.existsSync(docsDir)) {
  outputDirs.push(path.join(docsDir, "cesium"));
}

if (!fs.existsSync(cesiumSource)) {
  console.warn("Cesium source not found:", cesiumSource);
  process.exit(0);
}

if (outputDirs.length === 0) {
  console.warn("No build output directory found for Cesium assets.");
  process.exit(0);
}

for (const outDir of outputDirs) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(cesiumSource, outDir, { recursive: true });
  console.log(`Copied Cesium assets to ${outDir}`);
}
