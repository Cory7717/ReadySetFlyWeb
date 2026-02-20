import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeNotamMessage, ingestNotamMessage } from "../../server/notam-worker";

const savedXml = readFileSync(
  new URL("../../test/fixtures/notam/saved.xml", import.meta.url),
  "utf-8"
);
const emptyXml = readFileSync(
  new URL("../../test/fixtures/notam/empty.xml", import.meta.url),
  "utf-8"
);

test("parser detects AIXMBasicMessage and namespaces", () => {
  const result = analyzeNotamMessage(savedXml);
  assert.equal(result.hasAixmBasicMessage, true);
  assert.equal(result.hasFnsNamespace, true);
  assert.ok(Object.keys(result.rootNamespaces).length > 0);
});

test("extractor finds NOTAM elements in saved fixture", () => {
  const result = analyzeNotamMessage(savedXml);
  assert.ok(result.parsedNotamCount > 0);
  assert.ok(result.items.length > 0);
});

test("extractor returns reasonEmpty for empty fixture", () => {
  const result = analyzeNotamMessage(emptyXml);
  assert.equal(result.items.length, 0);
  assert.equal(result.reasonEmpty, "MISSING_FNS_PAYLOAD");
});

test("db failure does not count as empty", async () => {
  const result = await ingestNotamMessage(savedXml, async () => {
    throw new Error("db down");
  });
  assert.equal(result.dbWriteAttempted, true);
  assert.equal(result.dbWriteSucceeded, false);
  assert.equal(result.reasonEmpty, undefined);
});
