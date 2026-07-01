import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const testDir = "tests/flight-service";
const matrixPath = "docs/flight-service-certification-matrix.md";
const checklistPath = "docs/sean-feedback-remediation-checklist.md";

const testFiles = existsSync(testDir)
  ? readdirSync(testDir).filter((file) => file.endsWith(".test.ts")).sort()
  : [];

const matrix = existsSync(matrixPath) ? readFileSync(matrixPath, "utf8") : "";
const checklist = existsSync(checklistPath) ? readFileSync(checklistPath, "utf8") : "";
const manualCaseCount = (matrix.match(/\| TC-FS-\d{3} \|/g) ?? []).length;
const checklistItemCount = (checklist.match(/\| SF-\d{2} \|/g) ?? []).length;

console.log("Flight Service certification summary");
console.log(`Manual certification cases: ${manualCaseCount}`);
console.log(`Sean feedback items mapped: ${checklistItemCount}`);
console.log(`Automated test files: ${testFiles.length}`);
for (const file of testFiles) {
  console.log(`- ${join(testDir, file)}`);
}

const result = spawnSync("npx", ["tsx", "--test", ...testFiles.map((file) => join(testDir, file))], {
  stdio: "inherit",
  shell: true,
});

process.exitCode = result.status ?? 1;
