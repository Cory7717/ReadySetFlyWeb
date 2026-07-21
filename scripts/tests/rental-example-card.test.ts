import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

test("example rental card uses owner urgency image while normal cards keep listing image", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/components/aircraft-card.tsx"), "utf8");

  assert.match(source, /EXAMPLE_RENTAL_CARD_IMAGE = "\/assets\/rental-default-image\.png"/);
  assert.match(source, /const cardImage = isExample \? EXAMPLE_RENTAL_CARD_IMAGE : image/);
  assert.match(source, /src=\{cardImage\}/);
  assert.match(source, /Be the first in your area to list your aircraft/);
  assert.match(source, /Sample listing preview/);
  assert.doesNotMatch(source, />\s*Sample\s*</);
  assert.ok(existsSync(resolve(process.cwd(), "client/public/assets/rental-default-image.png")));
});
