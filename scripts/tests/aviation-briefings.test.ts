import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  aviationBriefingInputSchema,
  briefingContributorSchema,
  validateBriefingVideo,
  type AviationBriefingInput,
} from "../../shared/config/aviationBriefings";

const base: AviationBriefingInput = {
  title: "Reading a METAR Without Guesswork", slug: "reading-a-metar-without-guesswork",
  excerpt: "A practical explanation of the weather report elements pilots encounter.",
  contentType: "article", category: "Weather", status: "draft", isFeatured: false,
  featuredImageUrl: "", featuredImageStorageKey: "", featuredImageAlt: "",
  articleContent: [{ type: "heading", level: 2, text: "Start with the observation" }, { type: "paragraph", text: "Use official weather sources." }],
  videoSourceType: null, videoUrl: "", videoStorageKey: "", videoThumbnailUrl: "",
  videoDurationSeconds: null, videoTranscript: "", supportingContent: [], contributors: [],
  relevantToolIds: ["aviation-weather"], seoTitle: "", seoDescription: "", publishedAt: null, scheduledAt: null,
};

test("structured article creation accepts safe blocks and rejects arbitrary HTML fields", () => {
  assert.equal(aviationBriefingInputSchema.safeParse(base).success, true);
  assert.equal(aviationBriefingInputSchema.safeParse({ ...base, articleContent: [{ type: "html", html: "<script>alert(1)</script>" }] }).success, false);
});

test("external briefing videos accept only their declared provider", () => {
  const youtube = { ...base, contentType: "video" as const, videoSourceType: "youtube" as const, videoUrl: "https://www.youtube.com/watch?v=abc123" };
  assert.equal(validateBriefingVideo(youtube), null);
  assert.match(validateBriefingVideo({ ...youtube, videoUrl: "https://attacker.example/embed/abc" }) || "", /YouTube/);
  assert.equal(validateBriefingVideo({ ...youtube, videoSourceType: "vimeo", videoUrl: "https://vimeo.com/12345" }), null);
});

test("contributor credentials are preserved exactly and never inferred", () => {
  const entered = { name: "Cory Armer", role: "Author", professionalTitle: "Founder, Ready Set Fly", aviationCredentials: "Student pilot and aviation software builder" };
  const parsed = briefingContributorSchema.parse(entered);
  assert.equal(parsed.aviationCredentials, entered.aviationCredentials);
  const noCredential = briefingContributorSchema.parse({ name: "RSF Team", role: "Contributor" });
  assert.equal(noCredential.aviationCredentials, "");
});

test("route contract protects drafts and supports due scheduled content", () => {
  const source = readFileSync(new URL("../../server/routes/aviationBriefings.ts", import.meta.url), "utf8");
  assert.match(source, /eq\(aviationBriefings\.status, "published"\)/);
  assert.match(source, /eq\(aviationBriefings\.status, "scheduled"\)/);
  assert.match(source, /lte\(aviationBriefings\.scheduledAt, now\)/);
  assert.match(source, /"\/api\/admin\/aviation-briefings", isAuthenticated, isSuperAdmin/);
  assert.match(source, /code === "23505"/);
});

test("public rendering includes tools, disclaimer, attribution, and analytics", () => {
  const detail = readFileSync(new URL("../../client/src/pages/aviation-briefing-detail.tsx", import.meta.url), "utf8");
  assert.match(detail, /Try It in Ready Set Fly/);
  assert.match(detail, /not a substitute for official FAA publications/);
  assert.match(detail, /person\.aviationCredentials/);
  assert.match(detail, /aviation_briefing_opened/);
});
