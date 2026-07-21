import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

test("banner ads support a rental-listing card variant", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/components/banners/BannerAdRotation.tsx"), "utf8");

  assert.match(source, /variant\?: "default" \| "compact" \| "listingCard"/);
  assert.match(source, /const isListingCard = variant === "listingCard"/);
  assert.match(source, /Sponsored Partner/);
  assert.match(source, /aspect-\[3\/2\]/);
  assert.match(source, /object-contain/);
  assert.match(source, /rsf-metal-panel rsf-metal-panel-interactive/);
  assert.match(source, /data-testid=\{`banner-ad-\$\{currentAd\.id\}`\}/);
});

test("listing-card banner rotation can merge all active sponsor ads", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/components/banners/BannerAdRotation.tsx"), "utf8");

  assert.match(source, /includeAllActiveFallback\?: boolean/);
  assert.match(source, /const primaryAds = await fetchAds\(placement\)/);
  assert.match(source, /const fallbackAds = await fetchAds\(undefined\)/);
  assert.match(source, /const adsById = new Map<string, BannerAd>\(\)/);
});
