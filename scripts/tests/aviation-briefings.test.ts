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
  assert.match(detail, /not a substitute for\s+official FAA publications/);
  assert.match(detail, /person\.aviationCredentials/);
  assert.match(detail, /aviation_briefing_opened/);
});

test("contributor photos use durable media storage and accessible fallbacks", () => {
  const editor = readFileSync(new URL("../../client/src/components/aviation-briefings/BriefingEditor.tsx", import.meta.url), "utf8");
  const detail = readFileSync(new URL("../../client/src/pages/aviation-briefing-detail.tsx", import.meta.url), "utf8");
  const routes = readFileSync(new URL("../../server/routes/aviationBriefings.ts", import.meta.url), "utf8");
  const parsed = briefingContributorSchema.parse({ name: "Cory Armer", role: "Author", profileImageUrl: "/api/aviation-briefings/media?key=aviation-briefings/photo.webp" });
  assert.match(parsed.profileImageUrl, /aviation-briefings\/media/);
  assert.match(editor, /Contributor Photo/);
  assert.match(editor, /Replace photo/);
  assert.match(editor, /Remove photo/);
  assert.match(editor, /aria-label={`Upload photo for/);
  assert.match(editor, /\/api\/admin\/aviation-briefings\/upload-direct/);
  assert.match(routes, /AWS_S3_BUCKET/);
  assert.match(routes, /express\.raw\(\{ type: \["image\/jpeg", "image\/png", "image\/webp"\], limit: "10mb" \}\)/);
  assert.match(routes, /uploadBytes/);
  assert.match(detail, /alt={`Photo of \${person\.name}`}/);
  assert.match(detail, /Default avatar for/);
  assert.match(detail, /ContributorFooter/);
});

test("saved drafts remain open and the briefing library is directly accessible", () => {
  const admin = readFileSync(new URL("../../client/src/pages/admin-aviation-briefings.tsx", import.meta.url), "utf8");
  const routes = readFileSync(new URL("../../server/routes/aviationBriefings.ts", import.meta.url), "utf8");
  assert.match(admin, /setEditingId\(saved\.id\)/);
  assert.match(admin, /Back to saved briefings/);
  assert.match(admin, /id="briefing-library"/);
  assert.match(admin, /Saved briefings \(\{data\?\.total \|\| 0\}\)/);
  assert.match(admin, /videoStorageKey: item\.videoStorageKey/);
  assert.match(routes, /videoStorageKey: row\.videoStorageKey/);
  assert.match(admin, /This briefing could not be saved/);
  assert.match(admin, /briefingValidationMessage/);
});

test("article blocks can be reordered without changing their content", () => {
  const editor = readFileSync(new URL("../../client/src/components/aviation-briefings/BriefingEditor.tsx", import.meta.url), "utf8");
  assert.match(editor, /const move = \(index: number, direction: -1 \| 1\)/);
  assert.match(editor, /Move \$\{block\.type\} block up/);
  assert.match(editor, /Move \$\{block\.type\} block down/);
  assert.match(editor, /reordered\[destination\]/);
});
