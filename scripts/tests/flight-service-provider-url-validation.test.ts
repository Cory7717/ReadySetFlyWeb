import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateLeidosProviderUrl } from "../../server/services/flight-plan-filing/provider";

const providerSource = readFileSync("server/services/flight-plan-filing/provider.ts", "utf8");

test("Leidos URL validation accepts only documented HTTPS LAB and production REST origins", () => {
  assert.equal(validateLeidosProviderUrl("https://ffspelabs.leidos.com/Website2/rest/FP/file", "lab").ok, true);
  assert.equal(validateLeidosProviderUrl("https://www.lmfsweb.afss.com/Website/rest/FP/file", "production").ok, true);
  assert.equal(validateLeidosProviderUrl("https://www.1800wxbrief.com/Website/rest/FP/file", "production").ok, true);
});

test("Leidos URL validation rejects non-HTTPS and unexpected provider origins", () => {
  assert.deepEqual(validateLeidosProviderUrl("http://ffspelabs.leidos.com/Website2/rest/FP/file", "lab"), {
    ok: false,
    reason: "non_https_provider_url",
    safeUrl: "http://ffspelabs.leidos.com/Website2/rest/FP/file",
  });
  assert.equal(validateLeidosProviderUrl("https://example.com/Website2/rest/FP/file", "lab").ok, false);
  assert.equal((validateLeidosProviderUrl("https://example.com/Website2/rest/FP/file", "lab") as any).reason, "unexpected_provider_host");
});

test("Leidos URL validation rejects protocol-relative, credentialed, unexpected-port, and path-escape URLs", () => {
  assert.equal((validateLeidosProviderUrl("//ffspelabs.leidos.com/Website2/rest/FP/file", "lab") as any).reason, "protocol_relative_provider_url");
  assert.equal((validateLeidosProviderUrl("https://user:pass@ffspelabs.leidos.com/Website2/rest/FP/file", "lab") as any).reason, "provider_url_embedded_credentials");
  assert.equal((validateLeidosProviderUrl("https://ffspelabs.leidos.com:8443/Website2/rest/FP/file", "lab") as any).reason, "unexpected_provider_port");
  assert.equal((validateLeidosProviderUrl("https://ffspelabs.leidos.com/Website2/resources/doc/WebService.xml", "lab") as any).reason, "unexpected_provider_path");
});

test("Leidos request code validates final URL before constructing Authorization", () => {
  const actionIndex = providerSource.indexOf("const requestUrl = resolveValidatedActionPath");
  const basicIndex = providerSource.indexOf("const basic = Buffer.from(`${config.username}:${config.password}`)", actionIndex);
  assert.ok(actionIndex > 0);
  assert.ok(basicIndex > actionIndex, "Authorization should be built after action URL validation");
  assert.match(providerSource, /const req = httpsRequest\(/);
  assert.doesNotMatch(providerSource, /url\.protocol === "http:"/);
  assert.match(providerSource, /event: "leidos_provider_url_rejected"/);
  assert.match(providerSource, /cross-origin|redirected instead of returning a REST response|Location:/i);
});
