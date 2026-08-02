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
  title: "Reading a METAR Without Guesswork",
  slug: "reading-a-metar-without-guesswork",
  excerpt:
    "A practical explanation of the weather report elements pilots encounter.",
  contentType: "article",
  category: "Weather",
  status: "draft",
  isFeatured: false,
  featuredImageUrl: "",
  featuredImageStorageKey: "",
  featuredImageAlt: "",
  featuredImageCredit: "",
  featuredImageCreditUrl: "",
  articleContent: [
    { type: "heading", level: 2, text: "Start with the observation" },
    { type: "paragraph", text: "Use official weather sources." },
  ],
  videoSourceType: null,
  videoUrl: "",
  videoStorageKey: "",
  videoThumbnailUrl: "",
  videoDurationSeconds: null,
  videoTranscript: "",
  supportingContent: [],
  contributors: [],
  relevantToolIds: ["aviation-weather"],
  seoTitle: "",
  seoDescription: "",
  publishedAt: null,
  scheduledAt: null,
};

test("structured article creation accepts safe blocks and rejects arbitrary HTML fields", () => {
  assert.equal(aviationBriefingInputSchema.safeParse(base).success, true);
  assert.equal(
    aviationBriefingInputSchema.safeParse({
      ...base,
      articleContent: [{ type: "html", html: "<script>alert(1)</script>" }],
    }).success,
    false,
  );
});

test("external briefing videos accept only their declared provider", () => {
  const youtube = {
    ...base,
    contentType: "video" as const,
    videoSourceType: "youtube" as const,
    videoUrl: "https://www.youtube.com/watch?v=abc123",
  };
  assert.equal(validateBriefingVideo(youtube), null);
  assert.match(
    validateBriefingVideo({
      ...youtube,
      videoUrl: "https://attacker.example/embed/abc",
    }) || "",
    /YouTube/,
  );
  assert.equal(
    validateBriefingVideo({
      ...youtube,
      videoSourceType: "vimeo",
      videoUrl: "https://vimeo.com/12345",
    }),
    null,
  );
});

test("contributor credentials are preserved exactly and never inferred", () => {
  const entered = {
    name: "Cory Armer",
    role: "Author",
    professionalTitle: "Founder, Ready Set Fly",
    aviationCredentials: "Student pilot and aviation software builder",
  };
  const parsed = briefingContributorSchema.parse(entered);
  assert.equal(parsed.aviationCredentials, entered.aviationCredentials);
  const noCredential = briefingContributorSchema.parse({
    name: "RSF Team",
    role: "Contributor",
  });
  assert.equal(noCredential.aviationCredentials, "");
});

test("route contract protects drafts and supports due scheduled content", () => {
  const source = readFileSync(
    new URL("../../server/routes/aviationBriefings.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /eq\(aviationBriefings\.status, "published"\)/);
  assert.match(source, /eq\(aviationBriefings\.status, "scheduled"\)/);
  assert.match(source, /lte\(aviationBriefings\.scheduledAt, now\)/);
  assert.match(
    source,
    /"\/api\/admin\/aviation-briefings", isAuthenticated, isSuperAdmin/,
  );
  assert.match(source, /code === "23505"/);
});

test("public rendering includes tools, disclaimer, attribution, and analytics", () => {
  const detail = readFileSync(
    new URL(
      "../../client/src/pages/aviation-briefing-detail.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(detail, /Try It in Ready Set Fly/);
  assert.match(detail, /not a substitute for\s+official FAA publications/);
  assert.match(detail, /person\.aviationCredentials/);
  assert.match(detail, /aviation_briefing_opened/);
});

test("contributor photos use durable media storage and accessible fallbacks", () => {
  const editor = readFileSync(
    new URL(
      "../../client/src/components/aviation-briefings/BriefingEditor.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const detail = readFileSync(
    new URL(
      "../../client/src/pages/aviation-briefing-detail.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const routes = readFileSync(
    new URL("../../server/routes/aviationBriefings.ts", import.meta.url),
    "utf8",
  );
  const parsed = briefingContributorSchema.parse({
    name: "Cory Armer",
    role: "Author",
    profileImageUrl:
      "/api/aviation-briefings/media?key=aviation-briefings/photo.webp",
  });
  assert.match(parsed.profileImageUrl, /aviation-briefings\/media/);
  assert.match(editor, /Contributor Photo/);
  assert.match(editor, /Replace photo/);
  assert.match(editor, /Remove photo/);
  assert.match(editor, /aria-label={`Upload photo for/);
  assert.match(editor, /fetch\(apiUrl\("\/api\/objects\/upload"\)/);
  assert.match(editor, /fetch\(apiUrl\("\/api\/objects\/set-acl"\)/);
  assert.match(editor, /upload timed out after 60 seconds/);
  assert.match(editor, /featuredUploadError/);
  assert.match(detail, /alt={`Photo of \${person\.name}`}/);
  assert.match(detail, /Default avatar for/);
  assert.match(detail, /ContributorFooter/);
  assert.match(detail, /src=\{apiUrl\(person\.profileImageUrl\)\}/);
  assert.ok(
    routes.indexOf('app.get("/api/aviation-briefings/media"') <
      routes.indexOf('app.get("/api/aviation-briefings/:slug"'),
  );
});

test("saved drafts remain open and the briefing library is directly accessible", () => {
  const admin = readFileSync(
    new URL(
      "../../client/src/pages/admin-aviation-briefings.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const routes = readFileSync(
    new URL("../../server/routes/aviationBriefings.ts", import.meta.url),
    "utf8",
  );
  assert.match(admin, /setEditingId\(saved\.id\)/);
  assert.match(admin, /Back to saved briefings/);
  assert.match(admin, /id="briefing-library"/);
  assert.match(admin, /Saved briefings \(\{data\?\.total \|\| 0\}\)/);
  assert.match(admin, /videoStorageKey: item\.videoStorageKey/);
  assert.match(routes, /videoStorageKey: row\.videoStorageKey/);
  assert.match(admin, /This briefing could not be saved/);
  assert.match(admin, /briefingValidationMessage/);
  assert.match(admin, /fetch\(apiUrl\(path\)/);
  assert.doesNotMatch(admin, /fetch\("\/api\/admin\/aviation-briefing/);
});

test("article blocks can be reordered without changing their content", () => {
  const editor = readFileSync(
    new URL(
      "../../client/src/components/aviation-briefings/BriefingEditor.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(editor, /const move = \(index: number, direction: -1 \| 1\)/);
  assert.match(editor, /Move \$\{block\.type\} block up/);
  assert.match(editor, /Move \$\{block\.type\} block down/);
  assert.match(editor, /reordered\[destination\]/);
});

test("a completed first save can recover from a duplicate-slug retry", () => {
  const routes = readFileSync(
    new URL("../../server/routes/aviationBriefings.ts", import.meta.url),
    "utf8",
  );
  const admin = readFileSync(
    new URL(
      "../../client/src/pages/admin-aviation-briefings.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(routes, /recoveredExisting: true/);
  assert.match(routes, /aviationBriefings\.slug, slug/);
  assert.match(routes, /set\(mapInput\(recoveredInput\.data/);
  assert.match(admin, /Existing briefing reopened/);
  assert.match(admin, /setEditingId\(saved\.id\)/);
});

test("article typography preserves structured headings, quotes, and paragraph breaks", () => {
  const detail = readFileSync(
    new URL(
      "../../client/src/pages/aviation-briefing-detail.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(detail, /text-3xl font-extrabold/);
  assert.match(detail, /block\.text\.split\(\/\\n\\s\*\\n\//);
  assert.match(detail, /whitespace-pre-line/);
  assert.match(detail, /blockquote/);
});

test("featured images can carry an optional linked photo credit", () => {
  const parsed = aviationBriefingInputSchema.parse({
    ...base,
    featuredImageCredit: "Jane Pilot",
    featuredImageCreditUrl: "https://example.com/jane",
  });
  assert.equal(parsed.featuredImageCredit, "Jane Pilot");
  assert.equal(
    aviationBriefingInputSchema.safeParse({
      ...base,
      featuredImageCreditUrl: "javascript:alert(1)",
    }).success,
    false,
  );
  const editor = readFileSync(
    new URL(
      "../../client/src/components/aviation-briefings/BriefingEditor.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const detail = readFileSync(
    new URL(
      "../../client/src/pages/aviation-briefing-detail.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(editor, /Photo credit link \(optional\)/);
  assert.match(detail, /Photo credit:/);
  assert.match(detail, /featuredImageCreditUrl/);
});

test("static engagement analytics route is registered before dynamic briefing ids", () => {
  const registration = readFileSync(
    new URL("../../server/routes.ts", import.meta.url),
    "utf8",
  );
  assert.ok(
    registration.indexOf("registerAviationBriefingEngagementRoutes(app)") <
      registration.indexOf("registerAviationBriefingRoutes(app)"),
  );
});

test("Aviation Briefings suppresses the global free-account promotion bar", () => {
  const banner = readFileSync(
    new URL(
      "../../client/src/components/FreeAccountValueBar.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(banner, /"\/aviation-briefings"/);
});

test("Aviation Briefings suppresses the global weather announcement", () => {
  const announcement = readFileSync(
    new URL(
      "../../client/src/components/AiWeatherTranslatorAnnouncement.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(announcement, /"\/aviation-briefings"/);
});

test("public article links receive article-specific server-rendered social metadata", () => {
  const server = readFileSync(
    new URL("../../server/vite.ts", import.meta.url),
    "utf8",
  );
  assert.match(server, /eq\(aviationBriefings\.slug, slug\)/);
  assert.match(
    server,
    /briefing\.seoTitle \|\| `\$\{briefing\.title\} \| Ready Set Fly`/,
  );
  assert.match(server, /briefing\.seoDescription \|\| briefing\.excerpt/);
  assert.match(
    server,
    /type: briefing\.contentType === "video" \? "video\.other" : "article"/,
  );
  assert.match(server, /featuredImageStorageKey/);
});

test("private briefing performance reports anonymous readership and engagement", () => {
  const routes = readFileSync(
    new URL(
      "../../server/routes/aviationBriefingEngagement.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const panel = readFileSync(
    new URL(
      "../../client/src/components/aviation-briefings/BriefingPerformancePanel.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const admin = readFileSync(
    new URL(
      "../../client/src/pages/admin-aviation-briefings.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(routes, /\/api\/admin\/aviation-briefings\/performance/);
  assert.match(routes, /count\(DISTINCT "visitor_id"\)/);
  assert.match(routes, /aviation_briefing_tool_clicked/);
  assert.match(routes, /aviation_contributor_external_link_clicked/);
  assert.match(panel, /Briefing Performance/);
  assert.match(panel, /7 days/);
  assert.match(panel, /Lifetime/);
  assert.match(admin, /<BriefingPerformancePanel \/>/);
});

test("reader sharing identifies LinkedIn and provides an Instagram-safe fallback", () => {
  const engagement = readFileSync(
    new URL(
      "../../client/src/components/aviation-briefings/BriefingEngagement.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(engagement, /linkedin\.com\/sharing\/share-offsite/);
  assert.match(engagement, /aria-label="Share on Instagram"/);
  assert.match(engagement, /navigator\.share/);
  assert.match(engagement, /network: "instagram"/);
  assert.match(engagement, /The link is ready to paste into Instagram/);
});

test("photo submissions require a valid image, ownership, and versioned permission", () => {
  const routes = readFileSync(
    new URL(
      "../../server/routes/aviationBriefingPhotoSubmissions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const config = readFileSync(
    new URL("../../shared/config/aviationBriefings.ts", import.meta.url),
    "utf8",
  );
  assert.match(routes, /PHOTO_MAX_BYTES\s*=\s*15\s*\*\s*1024\s*\*\s*1024/);
  assert.match(routes, /ownershipConfirmed:\s*z\.literal\("true"\)/);
  assert.match(routes, /permissionAccepted:\s*z\.literal\("true"\)/);
  assert.match(routes, /detectPhoto\(req\.file\.buffer\)/);
  assert.match(routes, /uploadBuffer/);
  assert.match(routes, /deleteObject\(uploadedKey\)/);
  assert.match(config, /photo_permission_v1/);
  assert.match(routes, /permissionText:\s*AVIATION_PHOTO_PERMISSION_TEXT/);
});

test("photo workflow is public for contributors and Super Admin-only for review", () => {
  const app = readFileSync(
    new URL("../../client/src/App.tsx", import.meta.url),
    "utf8",
  );
  const routes = readFileSync(
    new URL(
      "../../server/routes/aviationBriefingPhotoSubmissions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const page = readFileSync(
    new URL(
      "../../client/src/pages/aviation-briefing-contribute.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(app, /\/aviation-briefings\/contribute/);
  assert.match(routes, /photo-submissions",\s*isAuthenticated,\s*isSuperAdmin/);
  assert.match(routes, /image",\s*isAuthenticated,\s*isSuperAdmin/);
  assert.match(page, /disabled={!canSubmit}/);
  assert.match(page, /aviation_briefings_photo_submission_completed/);
  assert.doesNotMatch(page, /contributorEmail.*trackEvent/);
});

test("Briefings subscriptions use confirmed opt-in and one-click unsubscribe", () => {
  const routes = readFileSync(new URL("../../server/routes/aviationBriefingSubscriptions.ts", import.meta.url), "utf8");
  assert.match(routes, /confirmationTokenHash/);
  assert.match(routes, /subscriptions\/confirm\/:token/);
  assert.match(routes, /subscriptions\/unsubscribe\/:token/);
  assert.match(routes, /status:\s*"active"/);
  assert.match(routes, /status:\s*"unsubscribed"/);
  assert.match(routes, /List-Unsubscribe/);
});

test("article announcement email includes image, excerpt, article link, and duplicate protection", () => {
  const routes = readFileSync(new URL("../../server/routes/aviationBriefingSubscriptions.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../../migrations/0128_add_aviation_briefing_subscribers.sql", import.meta.url), "utf8");
  assert.match(routes, /articleImage\(briefing/);
  assert.match(routes, /briefing\.excerpt/);
  assert.match(routes, /Read the full briefing/);
  assert.match(routes, /existing\?\.status\s*===\s*"sent"/);
  assert.match(migration, /UNIQUE\(briefing_id, subscriber_id\)/);
});

test("publishing can notify subscribers or explicitly suppress the announcement", () => {
  const routes = readFileSync(new URL("../../server/routes/aviationBriefings.ts", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../../client/src/pages/admin-aviation-briefings.tsx", import.meta.url), "utf8");
  assert.match(routes, /req\.body\?\.notifySubscribers\s*!==\s*false/);
  assert.match(routes, /sendAviationBriefingAnnouncement/);
  assert.match(admin, /Publish \+ email/);
  assert.match(admin, /Publish only/);
  assert.match(admin, /notifySubscribers:\s*false/);
});

test("subscription analytics exclude subscriber identity", () => {
  const component = readFileSync(new URL("../../client/src/components/aviation-briefings/BriefingSubscribe.tsx", import.meta.url), "utf8");
  assert.match(component, /aviation_briefings_subscription_requested/);
  assert.doesNotMatch(component, /trackEvent\([^)]*email/s);
  assert.doesNotMatch(component, /trackEvent\([^)]*name/s);
});
