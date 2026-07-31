import { Link } from "wouter";
import { ArrowRight, PlayCircle, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AviationBriefing, briefingImage, durationLabel, primaryContributor } from "./types";

export function BriefingCard({ briefing, featured = false }: { briefing: AviationBriefing; featured?: boolean }) {
  const contributor = primaryContributor(briefing);
  const image = briefingImage(briefing);
  return (
    <article className={`group overflow-hidden rounded-2xl border border-[#526d94]/35 bg-[#0c1522] text-[#eef5ff] shadow-[0_16px_45px_rgba(0,0,0,.22)] ${featured ? "lg:grid lg:grid-cols-[1.15fr_.85fr]" : ""}`}>
      <div className={`relative overflow-hidden bg-[#15243a] ${featured ? "min-h-64" : "aspect-[16/9]"}`}>
        {image ? <img src={image} alt={briefing.featuredImageAlt || ""} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /> : <div className="flex h-full min-h-48 items-center justify-center text-5xl font-black tracking-[.18em] text-[#7fa7df]/35">RSF</div>}
        <div className="absolute inset-0 bg-gradient-to-t from-[#07101c]/70 to-transparent" />
        <Badge className="absolute left-4 top-4 border border-[#aac5ec]/40 bg-[#102a50] text-white">{briefing.contentType === "video" ? <PlayCircle className="mr-1 h-3.5 w-3.5" /> : null}{briefing.contentType === "video" ? "Video" : "Article"}</Badge>
      </div>
      <div className={`flex flex-col ${featured ? "p-7 lg:p-9" : "p-5"}`}>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-[#9fc3f3]">
          <span>{briefing.category}</span><span aria-hidden="true">•</span><span>{durationLabel(briefing)}</span>
          {briefing.isFeatured && <span className="inline-flex items-center"><Star className="mr-1 h-3 w-3 fill-current" />Featured</span>}
        </div>
        <h2 className={`${featured ? "text-3xl" : "text-xl"} font-bold leading-tight text-white`}>{briefing.title}</h2>
        <p className="mt-3 line-clamp-3 leading-7 text-[#c3d0df]">{briefing.excerpt}</p>
        <div className="mt-5 text-sm text-[#9eafc2]">
          {contributor && <div><span className="text-[#dbe8f7]">{contributor.name}</span>{contributor.professionalTitle ? ` · ${contributor.professionalTitle}` : ""}</div>}
          {briefing.publishedAt && <time dateTime={briefing.publishedAt}>{new Date(briefing.publishedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</time>}
        </div>
        <Link href={`/aviation-briefings/${briefing.slug}`} className="mt-6 inline-flex items-center font-semibold text-[#88b8ff] hover:text-white">
          {briefing.contentType === "video" ? "Watch Briefing" : "Read Briefing"}<ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
