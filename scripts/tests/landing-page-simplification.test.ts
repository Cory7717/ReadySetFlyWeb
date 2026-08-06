import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const landingSource = readFileSync(resolve(process.cwd(), "client/src/pages/landing.tsx"), "utf8");

test("landing page omits redundant navigation-style sections", () => {
  const removedSections = [
    "landing-workflow-section",
    "landing-quickstart-section",
    "landing-ecosystem-section",
    "LandingModuleChooser",
    "LandingEventsRail",
    "Start where pilots actually start",
    "Start with something useful",
    "Still juggling multiple aviation apps",
    "Beyond the flight plan",
    "Choose the next briefing module",
    "Weather-Aware Route Planning",
    "Check live conditions while you plan",
    "Web-to-App Continuity",
    "One flight, one workflow, one ecosystem",
    "workflowSteps",
    "Plan, train, fly, and manage your aviation workflow.",
    "Start Flight Plan",
    "landing_hero_open_planner",
    "landing_hero_explore_tools",
    "Pilots are already using RSF to plan, file, and track flights",
    "General Aviation Ecosystem",
  ];

  for (const removedSection of removedSections) {
    assert.equal(
      landingSource.includes(removedSection),
      false,
      `Landing page should not render removed redundant section: ${removedSection}`,
    );
  }
});

test("landing page keeps current conditions and featured partner modules", () => {
  assert.match(landingSource, /LandingCurrentConditions/);
  assert.match(landingSource, /FeaturedPartnerToolCard/);
  assert.match(landingSource, /Active NOTAMs/);
  assert.match(landingSource, /Featured Partner Tool/);
  assert.match(landingSource, /Av8Maps - Nationwide GA Destination Maps/);
});

test("landing hero keeps concise headline and no removed section anchor", () => {
  assert.match(landingSource, /RSF keeps the pilot workflow in one place/);
  assert.match(landingSource, /Join our fast growing community of GA pilots using RSF/);
  assert.match(landingSource, /Plan flights, review weather, track training, manage records to help stay ahead of your aircraft/);
  assert.equal(landingSource.includes("#landing-workflow-section"), false);
});

test("landing hero offers an understated Ready Set Fly Briefings link", () => {
  const heroIndex = landingSource.indexOf("RSF keeps the pilot workflow in one place");
  const weatherIndex = landingSource.indexOf("<LandingCurrentConditions");
  const briefingLinkIndex = landingSource.indexOf('href="/briefings"', heroIndex);

  assert.ok(briefingLinkIndex > heroIndex && briefingLinkIndex < weatherIndex);
  assert.match(landingSource, /Read RSF Briefings/);
  assert.match(landingSource, /landing_aviation_briefings_click/);
  assert.match(landingSource, /location: "hero_meta"/);
});

test("landing premium flat-rate banner is hidden from signed-in users", () => {
  assert.match(landingSource, /!\s*isAuthenticated\s*&&\s*\(/);
  assert.match(landingSource, /New flat rate/);
  assert.match(landingSource, /landing_premium_banner/);
});

test("landing app download badges render near the top of the page", () => {
  assert.match(landingSource, /source="landing_top_bar"/);
  assert.match(landingSource, /Ready Set Fly is available on Android/);
  assert.doesNotMatch(landingSource, /source="landing_hero"/);
  assert.doesNotMatch(landingSource, /border-b border-\[#5d6f85\]\/12 bg-\[#0a0e14\]/);
});

test("app download badge component labels Android as a test version", () => {
  const badgeSource = readFileSync(resolve(process.cwd(), "client/src/components/GooglePlayBadge.tsx"), "utf8");
  assert.match(badgeSource, /statusLabel="Test Version"/);
  assert.match(badgeSource, /Coming Soon/);
  assert.match(badgeSource, /const STATUS_PILL_CLASS/);
  assert.match(badgeSource, /imageClassName="h-10"/);
});

test("landing content order puts weather before partner offers and sponsor", () => {
  const heroIndex = landingSource.indexOf("RSF keeps the pilot workflow in one place");
  const weatherIndex = landingSource.indexOf("<LandingCurrentConditions");
  const offersIndex = landingSource.indexOf("RSF Partner Membership Offers");
  const sponsorIndex = landingSource.indexOf("Premium aviation partner placement integrated into the RSF homepage");

  assert.ok(heroIndex >= 0, "Expected hero headline to be present");
  assert.ok(weatherIndex > heroIndex, "Expected weather section after hero");
  assert.ok(offersIndex > weatherIndex, "Expected partner offers below weather");
  assert.ok(sponsorIndex > weatherIndex, "Expected featured sponsor below weather");
});

test("current conditions search controls live inside the weather card before advisories", () => {
  const conditionsSource = readFileSync(resolve(process.cwd(), "client/src/components/landing/LandingCurrentConditions.tsx"), "utf8");
  const weatherCardIndex = conditionsSource.indexOf('<Card id="airport-weather"');
  const cardContentIndex = conditionsSource.indexOf('<CardContent className="space-y-4">', weatherCardIndex);
  const inputIndex = conditionsSource.indexOf('id="landing-icao"', cardContentIndex);
  const updateIndex = conditionsSource.indexOf("Update conditions", cardContentIndex);
  const advisoryIndex = conditionsSource.indexOf("is ceiling/visibility only", cardContentIndex);

  assert.ok(weatherCardIndex >= 0, "Expected airport weather card");
  assert.ok(inputIndex > cardContentIndex, "Expected ICAO input inside weather card content");
  assert.ok(updateIndex > cardContentIndex, "Expected update button inside weather card content");
  assert.ok(inputIndex < advisoryIndex, "Expected ICAO input before VFR advisory");
  assert.ok(updateIndex < advisoryIndex, "Expected update button before VFR advisory");
  assert.match(conditionsSource, /onChange=\{\(event\) => onIcaoInputChange\(event\.target\.value\)\}/);
  assert.match(conditionsSource, /onClick=\{onRefresh\}/);
});

test("landing hero uses wingtip clouds background and constrained text width", () => {
  assert.match(landingSource, /wingtipCloudsImage/);
  assert.match(landingSource, /object-\[72%_50%\]/);
  assert.match(landingSource, /opacity-75/);
  assert.match(landingSource, /mask-image:linear-gradient/);
  assert.match(landingSource, /lg:max-w-\[52%\]/);
  assert.match(landingSource, /py-6 md:py-8 xl:py-10/);
  assert.match(landingSource, /!border-0 !shadow-none before:!hidden/);
});
