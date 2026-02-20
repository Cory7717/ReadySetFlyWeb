import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeNotamMessage, ingestNotamMessage } from "../../server/notam-worker";

const canonicalXml = readFileSync(
  new URL("../../test/fixtures/notam/canonical_save.xml", import.meta.url),
  "utf-8"
);
const missingFieldsXml = readFileSync(
  new URL("../../test/fixtures/notam/missing_required_fields.xml", import.meta.url),
  "utf-8"
);
const emptyXml = readFileSync(
  new URL("../../test/fixtures/notam/empty.xml", import.meta.url),
  "utf-8"
);

test("parser detects AIXMBasicMessage and namespaces", () => {
  const result = analyzeNotamMessage(canonicalXml);
  assert.equal(result.hasAixmBasicMessage, true);
  assert.equal(result.hasFnsNamespace, true);
  assert.ok(Object.keys(result.rootNamespaces).length > 0);
});

test("extractor finds NOTAM elements in canonical fixture", () => {
  const result = analyzeNotamMessage(canonicalXml);
  assert.ok(result.parsedNotamCount > 0);
  assert.ok(result.items.length > 0);
});

test("extractor returns reasonEmpty for empty fixture", () => {
  const result = analyzeNotamMessage(emptyXml);
  assert.equal(result.items.length, 0);
  assert.equal(result.reasonEmpty, "MISSING_FNS_PAYLOAD");
});

test("missing required fields are saved as ingest events", async () => {
  let fallbackPayload: any = null;
  const fallbackWriter = async (data: any) => {
    fallbackPayload = data;
    return { id: "fallback-1" };
  };
  const result = await ingestNotamMessage(
    missingFieldsXml,
    async () => ({ savedCount: 0, errorCount: 0, errors: [] }),
    { messageId: "msg-missing", fallbackWriter }
  );
  assert.ok(result.parsedNotamCount > 0);
  assert.equal(result.canonicalWriteAttempted, false);
  assert.equal(result.fallbackWriteAttempted, true);
  assert.equal(result.fallbackWriteSucceeded, true);
  assert.ok(Array.isArray(result.missingFields) && result.missingFields.length > 0);
  assert.equal(result.reason, "MISSING_REQUIRED_FIELDS");
  assert.equal(result.reasonEmpty, undefined);
  assert.equal(fallbackPayload?.reason, "MISSING_REQUIRED_FIELDS");
  assert.ok(Array.isArray(fallbackPayload?.missingFields) && fallbackPayload.missingFields.length > 0);
});

test("canonical save does not trigger fallback", async () => {
  const result = await ingestNotamMessage(
    canonicalXml,
    async () => ({ savedCount: 1, errorCount: 0, errors: [] }),
    {
      messageId: "msg-canonical",
      fallbackWriter: async () => ({ id: "fallback-ignored" }),
    }
  );
  assert.equal(result.canonicalWriteAttempted, true);
  assert.equal(result.canonicalWriteSucceeded, true);
  assert.equal(result.fallbackWriteAttempted, false);
});

test("oversized payload is filtered and stored", async () => {
  let fallbackPayload: any = null;
  const fallbackWriter = async (data: any) => {
    fallbackPayload = data;
    return { id: "fallback-oversize" };
  };
  const oversizedXml = "<aixm:AIXMBasicMessage>" + "X".repeat(5000) + "</aixm:AIXMBasicMessage>";
  const result = await ingestNotamMessage(
    oversizedXml,
    async () => ({ savedCount: 0, errorCount: 0, errors: [] }),
    { messageId: "msg-oversize", maxXmlBytes: 100, fallbackWriter }
  );
  assert.equal(result.reasonEmpty, "FILTERED_OUT");
  assert.equal(result.reason, "FILTERED_OUT");
  assert.equal(result.fallbackWriteAttempted, true);
  assert.equal(result.fallbackWriteSucceeded, true);
  assert.equal(fallbackPayload?.reason, "FILTERED_OUT");
});

test("db failure is classified separately", async () => {
  const result = await ingestNotamMessage(
    canonicalXml,
    async () => {
      const error: any = new Error("db down");
      error.code = "DB_DOWN";
      throw error;
    },
    { messageId: "msg-db" }
  );
  assert.equal(result.dbWriteAttempted, true);
  assert.equal(result.dbWriteSucceeded, false);
  assert.equal(result.reason, "DB_ERROR");
  assert.equal(result.reasonEmpty, undefined);
  assert.equal(result.fallbackWriteAttempted, false);
});
