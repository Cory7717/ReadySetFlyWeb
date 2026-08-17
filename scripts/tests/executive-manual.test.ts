import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const content = read("client/src/content/executiveManualContent.ts");
const reader = read("client/src/components/admin/executive-manual/ExecutiveManualReader.tsx");
const page = read("client/src/pages/admin-executive-manual.tsx");
const app = read("client/src/App.tsx");
const admin = read("client/src/pages/admin.tsx");

test("executive manual contains the approved business facts and scope", () => {
  for (const expected of [
    "$4.99/month",
    "7.5% owner-side commission",
    "7.5% renter booking fee",
    "$500,000",
    "2.6K",
    "~79K",
    "3m 15s",
    "24K",
    "Jan. 1–Aug. 10, 2026",
    "$25–$250",
    "699 unique method-and-path pairs",
    "19 external service or data-integration families",
  ]) {
    assert.ok(content.includes(expected), `missing approved fact: ${expected}`);
  }
  assert.match(content, /BarLink and BarPulse metrics are not included as RSF traction/);
  assert.doesNotMatch(content, /Leidos/i);
  assert.doesNotMatch(content, /FAA[- ](?:certified|endorsed)/i);
  assert.doesNotMatch(content, /\bPro\+\b/);
});

test("architecture appendix documents the repository-derived platform snapshot", () => {
  assert.match(content, /id: "architecture-overview"/);
  assert.match(content, /id: "architecture-integrations"/);
  assert.match(content, /React, Vite, Tailwind CSS, Radix UI, TanStack Query and Wouter/);
  assert.match(content, /307 GET, 280 POST, 72 PATCH, 42 DELETE and 16 PUT/);
  assert.match(content, /non-operational validation environment/);
});

test("manual reader provides book navigation, contents, touch swipe, and progress persistence", () => {
  assert.match(reader, /executiveManualPages\.map/);
  assert.match(reader, /button-manual-previous/);
  assert.match(reader, /button-manual-next/);
  assert.match(reader, /button-manual-contents/);
  assert.match(reader, /pointerType/);
  assert.match(reader, /localStorage\.setItem/);
  assert.match(reader, /Page \{currentPage \+ 1\} of/);
});

test("manual is protected by authentication and administrator authorization", () => {
  assert.match(app, /path="\/admin\/executive-manual"[\s\S]*?component=\{AdminExecutiveManualPage\}/);
  assert.match(app, /path="\/admin\/executive-manual" component=\{RequireAuth\}/);
  assert.match(page, /!user\?\.isAdmin && !user\?\.isSuperAdmin/);
  assert.match(admin, /href="\/admin\/executive-manual"/);
  assert.match(admin, /Executive Manual/);
});
