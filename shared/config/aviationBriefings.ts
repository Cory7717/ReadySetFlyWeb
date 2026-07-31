import { z } from "zod";

export const AVIATION_BRIEFING_CATEGORIES = [
  "Flight Planning", "Weather", "NOTAMs", "Airspace", "Student Pilots",
  "Safety", "Aircraft Ownership", "Training", "RSF Features",
  "Aviation Technology", "Marketplace", "Pilot Resources", "Industry Insights",
] as const;

export const AVIATION_BRIEFING_STATUSES = ["draft", "review", "scheduled", "published", "archived"] as const;
export const AVIATION_BRIEFING_CONTENT_TYPES = ["article", "video"] as const;
export const AVIATION_CONTRIBUTOR_ROLES = ["Author", "Host", "Presenter", "Guest", "Technical Reviewer", "Aviation Reviewer", "Contributor"] as const;

export const briefingBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().max(10000) }),
  z.object({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), text: z.string().max(500) }),
  z.object({ type: z.literal("quote"), text: z.string().max(3000), attribution: z.string().max(300).optional() }),
  z.object({ type: z.literal("list"), ordered: z.boolean().default(false), items: z.array(z.string().max(2000)).max(50) }),
  z.object({ type: z.literal("image"), url: z.string().url().max(2000), alt: z.string().min(1).max(500), caption: z.string().max(1000).optional() }),
  z.object({ type: z.literal("separator") }),
]);

export const briefingContributorSchema = z.object({
  name: z.string().trim().min(1).max(200),
  role: z.enum(AVIATION_CONTRIBUTOR_ROLES),
  professionalTitle: z.string().trim().max(300).optional().default(""),
  aviationCredentials: z.string().trim().max(500).optional().default(""),
  bio: z.string().trim().max(3000).optional().default(""),
  profileImageUrl: z.string().trim().max(2000).optional().default(""),
  organization: z.string().trim().max(300).optional().default(""),
  profileUrl: z.string().trim().max(2000).optional().default(""),
  credentialVerificationNote: z.string().trim().max(1000).optional().default(""),
});

export const aviationBriefingInputSchema = z.object({
  title: z.string().trim().min(3).max(300),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180),
  excerpt: z.string().trim().min(10).max(1000),
  contentType: z.enum(AVIATION_BRIEFING_CONTENT_TYPES),
  category: z.string().trim().min(2).max(120),
  status: z.enum(AVIATION_BRIEFING_STATUSES).default("draft"),
  isFeatured: z.boolean().default(false),
  featuredImageUrl: z.string().trim().max(2000).default(""),
  featuredImageStorageKey: z.string().trim().max(1000).default(""),
  featuredImageAlt: z.string().trim().max(500).default(""),
  articleContent: z.array(briefingBlockSchema).max(300).default([]),
  videoSourceType: z.enum(["youtube", "vimeo", "uploaded"]).nullable().default(null),
  videoUrl: z.string().trim().max(2000).default(""),
  videoStorageKey: z.string().trim().max(1000).default(""),
  videoThumbnailUrl: z.string().trim().max(2000).default(""),
  videoDurationSeconds: z.number().int().min(0).max(86400).nullable().default(null),
  videoTranscript: z.string().max(200000).default(""),
  supportingContent: z.array(briefingBlockSchema).max(300).default([]),
  contributors: z.array(briefingContributorSchema).max(20).default([]),
  relevantToolIds: z.array(z.string().trim().max(100)).max(30).default([]),
  seoTitle: z.string().trim().max(300).default(""),
  seoDescription: z.string().trim().max(500).default(""),
  publishedAt: z.string().datetime().nullable().default(null),
  scheduledAt: z.string().datetime().nullable().default(null),
});

export type AviationBriefingInput = z.infer<typeof aviationBriefingInputSchema>;
export type BriefingBlock = z.infer<typeof briefingBlockSchema>;
export type BriefingContributor = z.infer<typeof briefingContributorSchema>;

export function validateBriefingVideo(input: AviationBriefingInput) {
  if (input.contentType !== "video") return null;
  if (input.videoSourceType === "uploaded") {
    return input.videoStorageKey ? null : "Uploaded video storage is not configured for this briefing.";
  }
  try {
    const url = new URL(input.videoUrl);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (input.videoSourceType === "youtube" && !["youtube.com", "youtu.be"].includes(host)) return "Use a valid YouTube URL.";
    if (input.videoSourceType === "vimeo" && !["vimeo.com", "player.vimeo.com"].includes(host)) return "Use a valid Vimeo URL.";
    return null;
  } catch {
    return "A valid external video URL is required.";
  }
}
