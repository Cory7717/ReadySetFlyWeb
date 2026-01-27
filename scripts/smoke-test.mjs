import fs from "fs";
import path from "path";

const root = process.cwd();
const appPath = path.join(root, "client", "src", "App.tsx");
const landingPath = path.join(root, "client", "src", "pages", "landing.tsx");

const requiredChecks = [
  { file: appPath, needle: "/flight-planner" },
  { file: appPath, needle: "/student" },
  { file: landingPath, needle: "Student Pilot" },
];

let failed = false;

for (const check of requiredChecks) {
  if (!fs.existsSync(check.file)) {
    console.error(`Missing file: ${check.file}`);
    failed = true;
    continue;
  }
  const content = fs.readFileSync(check.file, "utf8");
  if (!content.includes(check.needle)) {
    console.error(`Missing "${check.needle}" in ${check.file}`);
    failed = true;
  }
}

if (failed) {
  console.error("Smoke test failed.");
  process.exit(1);
}

console.log("Smoke test passed.");
