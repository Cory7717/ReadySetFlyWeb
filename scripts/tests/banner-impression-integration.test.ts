import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("banner impressions require viewport and document visibility qualification", () => {
  const hookSource = readSource("client/src/hooks/useQualifiedBannerImpression.ts");

  assert.match(hookSource, /DEFAULT_VISIBLE_RATIO\s*=\s*0\.5/);
  assert.match(hookSource, /DEFAULT_VISIBLE_DURATION_MS\s*=\s*1000/);
  assert.match(hookSource, /document\.visibilityState\s*===\s*"visible"/);
  assert.match(hookSource, /entry\?\.intersectionRatio[^\n]+>=\s*minimumVisibleRatio/);
  assert.match(hookSource, /observer\.disconnect\(\)/);
  assert.match(hookSource, /tracker\.cancelPending\(\)/);
});

test("banner rotation pauses while the page is hidden and avoids refetch resets", () => {
  const rotationSource = readSource("client/src/components/banners/BannerAdRotation.tsx");

  assert.match(rotationSource, /bannerAds\.length\s*<=\s*1\s*\|\|\s*!isDocumentVisible/);
  assert.match(rotationSource, /document\.visibilityState\s*!==\s*"visible"/);
  assert.match(rotationSource, /const bannerIds = bannerAds\.map/);
  assert.match(rotationSource, /\}, \[bannerIds\]\);/);
  assert.doesNotMatch(rotationSource, /\}, \[bannerAds\]\);/);
});

test("server impression protections and click tracking contracts remain present", () => {
  const routesSource = readSource("server/routes.ts");
  const middlewareSource = readSource("server/middleware/impressionMiddleware.ts");
  const rotationSource = readSource("client/src/components/banners/BannerAdRotation.tsx");

  assert.match(
    routesSource,
    /"\/api\/banner-ads\/:id\/impression",\s*bannerImpressionRateLimiter,\s*impressionRateLimiter,\s*impressionDedup,/s,
  );
  assert.match(middlewareSource, /const DEDUP_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(rotationSource, /"POST", `\/api\/banner-ads\/\$\{bannerId\}\/click`/);
  assert.match(rotationSource, /trackEvent\("banner_ad_click"/);
});
