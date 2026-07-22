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

test("landing hero tools CTA points to a live route instead of a removed section anchor", () => {
  assert.match(landingSource, /href="\/tool-hub"/);
  assert.match(landingSource, /landing_hero_explore_tools/);
  assert.equal(landingSource.includes("#landing-workflow-section"), false);
});
