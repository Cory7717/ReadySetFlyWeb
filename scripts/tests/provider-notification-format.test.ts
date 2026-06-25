import test from "node:test";
import assert from "node:assert/strict";
import { formatArtccInfo, formatProviderNotificationValue, sanitizeNotificationMessage, summarizeProviderChangeDetails } from "../../shared/provider-notification-format";

test("formatArtccInfo handles null and empty object", () => {
  assert.equal(formatArtccInfo(null), "");
  assert.equal(formatArtccInfo({}), "");
});

test("formatArtccInfo returns strings as-is", () => {
  assert.equal(formatArtccInfo("ZFW"), "ZFW");
});

test("formatArtccInfo formats useful object fields", () => {
  assert.equal(
    formatArtccInfo({ facilityId: "ZFW", name: "Fort Worth Center" }),
    "ZFW / Fort Worth Center",
  );
});

test("provider notification formatting never returns object placeholder", () => {
  assert.equal(formatProviderNotificationValue({ facilityId: "ZFW", name: "Fort Worth Center" }), "ZFW / Fort Worth Center");
  assert.equal(formatProviderNotificationValue({ unknown: { nested: true } }), "");
  assert.equal(formatProviderNotificationValue({}).includes("[object Object]"), false);
});

test("notification sanitizer removes legacy object placeholder", () => {
  const message = sanitizeNotificationMessage("Provider flight state: PROPOSED. ARTCC state: ROGERED. ARTCC info: [object Object].");
  assert.equal(message, "Provider flight state: PROPOSED. ARTCC state: ROGERED.");
  assert.equal(message.includes("[object Object]"), false);
});

test("provider change summary separates added and unchanged ICAO Other Info fields", () => {
  const summary = summarizeProviderChangeDetails(
    "Flight Service changed this plan: Other Information changed from PBN/A1 RMK/TEST VFR TO CHECK to PBN/A1 EET/KZMA0257 RMK/TEST VFR TO CHECK.",
  );

  assert.ok(summary);
  assert.deepEqual(summary.added, ["EET/KZMA0257"]);
  assert.deepEqual(summary.removed, []);
  assert.deepEqual(summary.modified, []);
  assert.deepEqual(summary.unchanged, ["PBN/A1", "RMK/TEST VFR TO CHECK"]);
  assert.equal(summary.technicalDetails[0].previous, "PBN/A1 RMK/TEST VFR TO CHECK");
  assert.equal(summary.technicalDetails[0].current, "PBN/A1 EET/KZMA0257 RMK/TEST VFR TO CHECK");
});

test("provider change summary suppresses whitespace-only changes", () => {
  const summary = summarizeProviderChangeDetails(
    "Flight Service changed this plan: Other Information changed from PBN/A1  RMK/TEST to PBN/A1 RMK/TEST.",
  );
  assert.equal(summary, null);
});
