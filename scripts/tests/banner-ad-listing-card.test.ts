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
  assert.match(source, /rsf-metal-panel rsf-metal-panel-interactive/);
  assert.match(source, /data-testid=\{`banner-ad-\$\{currentAd\.id\}`\}/);
});
