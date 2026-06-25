import test from "node:test";
import assert from "node:assert/strict";
import { formatArtccInfo, formatProviderNotificationValue, sanitizeNotificationMessage } from "../../shared/provider-notification-format";

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
