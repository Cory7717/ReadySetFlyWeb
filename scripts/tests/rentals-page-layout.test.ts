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
  const inlineAdCallIndex = homeSource.indexOf("shouldShowRentalAdAfterListing(index)", listingMapIndex);
  const bannerIndex = homeSource.indexOf("<BannerAdRotation");
  assert.ok(listingMapIndex >= 0, "listing map should be present");
  assert.ok(inlineAdCallIndex > listingMapIndex, "ad slot should be inserted from inside the listing stream");
  assert.ok(bannerIndex >= 0, "banner rotation should render inside the inline ad slot helper");
  assert.match(homeSource, /variant="listingCard"/);
  assert.doesNotMatch(homeSource, /md:col-span-2 lg:col-span-3/);
  assert.match(homeSource, /filteredAircraft\.length < RENTAL_LISTING_AD_INTERVAL/);
  assert.match(homeSource, /renderRentalInlineAd\(1\)/);
});

test("unverified authenticated owners get a top-level verification action", () => {
  const homeSource = source();

  const actionsIndex = homeSource.indexOf('actions={');
  const verifyIndex = homeSource.indexOf("Complete Verification", actionsIndex);
  const createIndex = homeSource.indexOf("Create Rental Listing", actionsIndex);
  assert.ok(actionsIndex >= 0, "page actions should be present");
  assert.ok(verifyIndex > actionsIndex, "verification CTA should be in page actions");
  assert.ok(createIndex > verifyIndex, "create listing remains the primary next action after verification CTA");
  assert.match(homeSource, /isAuthenticated && !isVerifiedOwner/);
  assert.match(homeSource, /<Link href=\{verificationHref\}>Complete Verification<\/Link>/);
});

test("owner listing prompt is below browse results instead of blocking the first listings", () => {
  const homeSource = source();

  const resultsIndex = homeSource.indexOf("Browse aircraft that match your mission");
  const ownerPromptIndex = homeSource.indexOf("List your aircraft on RSF rentals");
  assert.ok(resultsIndex >= 0, "results heading should be present");
  assert.ok(ownerPromptIndex > resultsIndex, "owner prompt should be after the browse results section");
});
