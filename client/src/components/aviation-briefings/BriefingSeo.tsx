import { useEffect } from "react";
import type { AviationBriefing } from "./types";
import { briefingImage, primaryContributor } from "./types";

export function BriefingSeo({ briefing }: { briefing: AviationBriefing }) {
  useEffect(() => {
    const title = briefing.seoTitle || `${briefing.title} | Ready Set Fly Briefings`;
    const description = briefing.seoDescription || briefing.excerpt;
    const canonical = `${window.location.origin}/briefings/${briefing.slug}`;
    document.title = title;
    const setMeta = (selector: string, attributes: Record<string, string>) => {
      let node = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!node) { node = document.createElement("meta"); document.head.appendChild(node); }
      Object.entries(attributes).forEach(([key, value]) => node!.setAttribute(key, value));
    };
    setMeta('meta[name="description"]', { name: "description", content: description });
    setMeta('meta[property="og:title"]', { property: "og:title", content: title });
    setMeta('meta[property="og:description"]', { property: "og:description", content: description });
    setMeta('meta[property="og:type"]', { property: "og:type", content: briefing.contentType === "video" ? "video.other" : "article" });
    setMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
    if (briefingImage(briefing)) setMeta('meta[property="og:image"]', { property: "og:image", content: new URL(briefingImage(briefing), window.location.origin).href });
    let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = canonical;
    const contributor = primaryContributor(briefing);
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.aviationBriefing = "true";
    script.text = JSON.stringify({
      "@context": "https://schema.org", "@type": briefing.contentType === "video" ? "VideoObject" : "Article",
      headline: briefing.title, description, datePublished: briefing.publishedAt, dateModified: briefing.updatedAt,
      author: contributor ? { "@type": "Person", name: contributor.name, jobTitle: contributor.professionalTitle || undefined } : { "@type": "Organization", name: "Ready Set Fly" },
      image: briefingImage(briefing) || undefined, url: canonical,
    });
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, [briefing]);
  return null;
}
