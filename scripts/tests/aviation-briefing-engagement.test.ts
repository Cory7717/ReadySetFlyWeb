import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const routes = read("server/routes/aviationBriefingEngagement.ts");
const component = read("client/src/components/aviation-briefings/BriefingEngagement.tsx");
const app = read("client/src/App.tsx");
const migration = read("migrations/0125_add_aviation_briefing_engagement.sql");

test("feedback is private, replaceable, and deduplicated per reader", () => {
  assert.match(routes, /readerHash:hash/);
  assert.match(routes, /onConflictDoUpdate/);
  assert.match(migration, /UNIQUE INDEX[^;]+\(briefing_id, reader_hash\)/i);
  assert.match(routes, /res\.json\(\{feedback:feedback\?\.responseType\|\|null,saved:Boolean\(saved\),authenticated:Boolean\(user\)\}\)/);
  assert.doesNotMatch(component, /helpfulCount|learnMoreCount|reactionCount/);
});

test("engagement is restricted to publicly visible briefings", () => {
  assert.match(routes, /const publicVisibility/);
  assert.match(routes, /eq\(aviationBriefings\.status, "published"\)/);
  assert.match(routes, /eq\(aviationBriefings\.status, "scheduled"\)/);
});

test("save workflow requires authentication and has a non-shadowed route", () => {
  assert.match(routes, /\/save",isAuthenticated/);
  assert.match(routes, /saved\/me",isAuthenticated/);
  assert.ok(app.indexOf('path="/briefings/saved"') < app.indexOf('path="/briefings/:slug"'));
});

test("suggestions include anti-abuse controls and admin-only review", () => {
  assert.match(routes, /suggestionLimit/);
  assert.match(routes, /company:z\.string\(\)\.max\(0\)/);
  assert.match(routes, /duplicate:true/);
  assert.match(routes, /aviation-briefing-suggestions",isAuthenticated,isSuperAdmin/);
  assert.match(routes, /convert-to-invitation/);
});

test("reader tools include learn-more discovery, sharing, printing, and suggestions", () => {
  assert.match(component, /Was this briefing helpful\?/);
  assert.match(component, /Show me more like this/);
  assert.match(component, /window\.print/);
  assert.match(component, /linkedin\.com|facebook\.com|twitter\.com/);
  assert.match(component, /Suggest a Future Briefing/i);
});
