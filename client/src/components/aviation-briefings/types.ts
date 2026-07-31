import type { BriefingBlock, BriefingContributor } from "@shared/config/aviationBriefings";
import { apiUrl } from "@/lib/api";

export type AviationBriefing = {
  id: string; title: string; slug: string; excerpt: string;
  contentType: "article" | "video"; category: string; status: string;
  isFeatured: boolean; featuredImageUrl?: string | null; featuredImageStorageKey?: string | null;
  featuredImageAlt?: string | null; featuredImageCredit?: string | null; featuredImageCreditUrl?: string | null; articleContent: BriefingBlock[];
  videoSourceType?: "youtube" | "vimeo" | "uploaded" | null; videoUrl?: string | null; videoStorageKey?: string | null;
  videoThumbnailUrl?: string | null; videoDurationSeconds?: number | null; videoTranscript?: string | null;
  supportingContent: BriefingBlock[]; contributors: BriefingContributor[];
  relevantToolIds: string[]; seoTitle?: string | null; seoDescription?: string | null;
  publishedAt?: string | null; scheduledAt?: string | null; createdAt?: string | null; updatedAt?: string | null;
};

export function briefingImage(briefing: AviationBriefing) {
  if (briefing.featuredImageStorageKey) return apiUrl(`/api/aviation-briefings/media?key=${encodeURIComponent(briefing.featuredImageStorageKey)}`);
  const image = briefing.featuredImageUrl || briefing.videoThumbnailUrl || "";
  return image ? apiUrl(image) : "";
}

export function primaryContributor(briefing: AviationBriefing) {
  return briefing.contributors.find((item) => ["Author", "Host", "Presenter"].includes(item.role)) || briefing.contributors[0];
}

export function durationLabel(briefing: AviationBriefing) {
  if (briefing.contentType === "video") {
    const minutes = Math.max(1, Math.ceil((briefing.videoDurationSeconds || 0) / 60));
    return `${minutes} min video`;
  }
  const words = [...briefing.articleContent, ...briefing.supportingContent].reduce((total, block) => {
    if ("text" in block) return total + block.text.trim().split(/\s+/).filter(Boolean).length;
    if (block.type === "list") return total + block.items.join(" ").trim().split(/\s+/).filter(Boolean).length;
    return total;
  }, 0);
  return `${Math.max(1, Math.ceil(words / 220))} min read`;
}
