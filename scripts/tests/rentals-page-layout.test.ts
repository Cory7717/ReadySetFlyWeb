import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const source = () => readFileSync(resolve(process.cwd(), "client/src/pages/home.tsx"), "utf8");

test("rentals page leads with search instead of the old explainer hero", () => {
  const homeSource = source();

  assert.doesNotMatch(homeSource, />1\. Search by mission</);
  assert.doesNotMatch(homeSource, />2\. Check the aircraft</);
  assert.doesNotMatch(homeSource, />3\. Plan the trip</);
  assert.doesNotMatch(homeSource, /Find rental aircraft without leaving the rest of your planning behind/);
  assert.match(homeSource, /title="Search rentals"/);

  const searchIndex = homeSource.indexOf('title="Search rentals"');
  const resultsIndex = homeSource.indexOf("Available aircraft");
  assert.ok(searchIndex >= 0 && resultsIndex > searchIndex, "search should appear before available aircraft");
});

test("rental sponsored ads are inserted in the listing stream every 15 listings", () => {
  const homeSource = source();

  assert.match(homeSource, /const RENTAL_LISTING_AD_INTERVAL = 15/);
  assert.match(homeSource, /shouldShowRentalAdAfterListing = \(listingIndex: number\)/);
  assert.match(homeSource, /\(listingIndex \+ 1\) % RENTAL_LISTING_AD_INTERVAL === 0/);

  const listingMapIndex = homeSource.indexOf("filteredAircraft.map((listing, index)");
  const inlineAdIndex = homeSource.indexOf('data-testid={`rental-listing-ad-slot-', listingMapIndex);
  const bannerIndex = homeSource.indexOf('<BannerAdRotation', inlineAdIndex);
  assert.ok(listingMapIndex >= 0, "listing map should be present");
  assert.ok(inlineAdIndex > listingMapIndex, "ad slot should be inside the listing stream");
  assert.ok(bannerIndex > inlineAdIndex, "banner rotation should render inside the inline ad slot");
});

test("owner listing prompt is below browse results instead of blocking the first listings", () => {
  const homeSource = source();

  const resultsIndex = homeSource.indexOf("Browse aircraft that match your mission");
  const ownerPromptIndex = homeSource.indexOf("List your aircraft on RSF rentals");
  assert.ok(resultsIndex >= 0, "results heading should be present");
  assert.ok(ownerPromptIndex > resultsIndex, "owner prompt should be after the browse results section");
});
