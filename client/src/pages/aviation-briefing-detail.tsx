import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  PlayCircle,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { BriefingSeo } from "@/components/aviation-briefings/BriefingSeo";
import { BriefingCard } from "@/components/aviation-briefings/BriefingCard";
import {
  AviationBriefing,
  briefingImage,
  durationLabel,
} from "@/components/aviation-briefings/types";
import type { BriefingBlock } from "@shared/config/aviationBriefings";
import { RSF_TOOLS } from "@/lib/tool-registry";
import { trackEvent } from "@/lib/analytics";
import { apiUrl } from "@/lib/api";
import { BriefingEngagement } from "@/components/aviation-briefings/BriefingEngagement";

function RichText({ text }: { text: string }) {
  const tokens = text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g)
    .filter(Boolean);
  return (
    <>
      {tokens.map((token, index) => {
        if (token.startsWith("**") && token.endsWith("**"))
          return (
            <strong key={index} className="font-bold text-white">
              {token.slice(2, -2)}
            </strong>
          );
        if (token.startsWith("*") && token.endsWith("*"))
          return <em key={index}>{token.slice(1, -1)}</em>;
        const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
        if (link)
          return (
            <a
              key={index}
              href={link[2]}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#8dbbfa] underline underline-offset-2"
            >
              {link[1]}
            </a>
          );
        return token;
      })}
    </>
  );
}

function Blocks({ blocks }: { blocks: BriefingBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, index) => {
        if (block.type === "heading")
          return block.level === 2 ? (
            <h2 key={index} className="pt-4 text-3xl font-bold text-white">
              <RichText text={block.text} />
            </h2>
          ) : (
            <h3 key={index} className="pt-3 text-2xl font-bold text-white">
              <RichText text={block.text} />
            </h3>
          );
        if (block.type === "quote")
          return (
            <blockquote
              key={index}
              className="border-l-4 border-[#5595ea] bg-[#111e30] px-6 py-5 text-xl italic leading-8 text-[#dbe7f5]"
            >
              <p>
                <RichText text={block.text} />
              </p>
              {block.attribution && (
                <footer className="mt-3 text-sm not-italic text-[#91a6be]">
                  — {block.attribution}
                </footer>
              )}
            </blockquote>
          );
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag
              key={index}
              className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-2 pl-7 text-lg leading-8 text-[#d0dbe8]`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <RichText text={item} />
                </li>
              ))}
            </Tag>
          );
        }
        if (block.type === "image")
          return (
            <figure key={index}>
              <img
                src={block.url}
                alt={block.alt}
                className="w-full rounded-xl border border-[#506b91]/35"
              />
              {block.caption && (
                <figcaption className="mt-2 text-center text-sm text-[#91a4bc]">
                  {block.caption}
                </figcaption>
              )}
            </figure>
          );
        if (block.type === "separator")
          return <hr key={index} className="border-[#526c8f]/40" />;
        return (
          <p key={index} className="text-lg leading-8 text-[#d0dbe8]">
            <RichText text={block.text} />
          </p>
        );
      })}
    </div>
  );
}

function videoEmbed(briefing: AviationBriefing) {
  try {
    const url = new URL(briefing.videoUrl || "");
    if (briefing.videoSourceType === "youtube") {
      const id = url.hostname.includes("youtu.be")
        ? url.pathname.slice(1)
        : url.searchParams.get("v") || url.pathname.split("/").pop();
      return id
        ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`
        : "";
    }
    if (briefing.videoSourceType === "vimeo") {
      const id = url.pathname.split("/").filter(Boolean).pop();
      return id
        ? `https://player.vimeo.com/video/${encodeURIComponent(id)}`
        : "";
    }
  } catch {}
  return "";
}

function ContributorAvatar({
  person,
  size = "large",
}: {
  person: any;
  size?: "small" | "large";
}) {
  const [failed, setFailed] = useState(false);
  const dimensions =
    size === "large" ? "h-24 w-24 sm:h-28 sm:w-28" : "h-11 w-11";
  if (person.profileImageUrl && !failed)
    return (
      <img
        src={apiUrl(person.profileImageUrl)}
        alt={`Photo of ${person.name}`}
        className={`${dimensions} shrink-0 rounded-full border border-[#6683a8]/70 object-cover`}
        onError={() => setFailed(true)}
      />
    );
  return (
    <div
      className={`${dimensions} flex shrink-0 items-center justify-center rounded-full border border-[#6683a8]/70 bg-[#18283c] text-[#9db3cb]`}
      role="img"
      aria-label={`Default avatar for ${person.name}`}
    >
      <UserRound
        className={size === "large" ? "h-12 w-12" : "h-6 w-6"}
        aria-hidden="true"
      />
    </div>
  );
}

function ContributorFooter({ contributors }: { contributors: any[] }) {
  if (!contributors.length) return null;
  return (
    <footer
      className="mt-14 border-t border-[#526d94]/35 pt-8"
      aria-label="About the contributors"
    >
      <h2 className="text-sm font-bold uppercase tracking-[.16em] text-[#8ebeff]">
        About the contributor{contributors.length === 1 ? "" : "s"}
      </h2>
      <div className="mt-5 space-y-6">
        {contributors.map((person, index) => (
          <article
            key={`${person.name}-${index}`}
            className="flex flex-col gap-5 rounded-2xl border border-[#526d94]/35 bg-[#0d1929] p-6 sm:flex-row"
          >
            <ContributorAvatar person={person} />
            <div>
              <h3 className="text-2xl font-bold text-white">{person.name}</h3>
              {(person.professionalTitle || person.organization) && (
                <p className="mt-1 text-[#a9c9ef]">
                  {[person.professionalTitle, person.organization]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              {person.aviationCredentials && (
                <p className="mt-1 text-sm text-[#8fb8ed]">
                  {person.aviationCredentials}
                </p>
              )}
              {person.bio && (
                <p className="mt-4 leading-7 text-[#c3d0df]">{person.bio}</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </footer>
  );
}

export default function AviationBriefingDetailPage() {
  const params = useParams<{ slug?: string; id?: string }>();
  const [location] = useLocation();
  const isPreview = location.startsWith("/aviation-briefings/preview/");
  const slug = params.slug || params.id || "";
  const { data, isLoading } = useQuery<{
    briefing: AviationBriefing;
    related: AviationBriefing[];
  }>({
    queryKey: [
      isPreview ? "/api/admin/aviation-briefings" : "/api/aviation-briefings",
      slug,
    ],
    queryFn: async () => {
      const response = await fetch(
        apiUrl(
          isPreview
            ? `/api/admin/aviation-briefings/${encodeURIComponent(slug)}`
            : `/api/aviation-briefings/${encodeURIComponent(slug)}`,
        ),
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Briefing not found");
      const payload = await response.json();
      return { briefing: payload.briefing, related: payload.related || [] };
    },
  });
  useEffect(() => {
    if (!isPreview) return;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [isPreview]);
  useEffect(() => {
    if (data?.briefing)
      trackEvent("aviation_briefing_opened", {
        briefingId: data.briefing.id,
        slug,
        title: data.briefing.title,
        category: data.briefing.category,
        contentType: data.briefing.contentType,
      });
  }, [data?.briefing?.id, slug]);
  if (isLoading)
    return (
      <div className="min-h-screen bg-[#07101c] py-24 text-center text-white">
        Loading briefing…
      </div>
    );
  if (!data)
    return (
      <div className="min-h-screen bg-[#07101c] py-24 text-center text-white">
        Briefing not found.
      </div>
    );
  const { briefing } = data;
  const image = briefingImage(briefing);
  const tools = RSF_TOOLS.filter((tool) =>
    briefing.relevantToolIds.includes(tool.id),
  );
  const embed = videoEmbed(briefing);
  return (
    <main className="min-h-screen bg-[#07101c] text-[#eef5ff]">
      {!isPreview && <BriefingSeo briefing={briefing} />}
      <article>
        <header className="border-b border-[#526d94]/30 bg-[radial-gradient(circle_at_top_right,rgba(36,103,197,.25),transparent_45%)]">
          <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 lg:py-20">
            <Link
              href={
                isPreview ? "/admin/aviation-briefings" : "/aviation-briefings"
              }
              className="inline-flex items-center text-sm font-semibold text-[#8dbbfa] hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {isPreview ? "Return to editor" : "All Aviation Briefings"}
            </Link>
            {isPreview && (
              <div className="mt-6 inline-flex rounded-full border border-amber-400/50 bg-amber-950/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-200">
                Private draft preview · {briefing.status}
              </div>
            )}
            <div className="mt-8 text-sm font-bold uppercase tracking-[.18em] text-[#8ebeff]">
              {briefing.category} ·{" "}
              {briefing.contentType === "video" ? "Video" : "Article"} ·{" "}
              {durationLabel(briefing)}
            </div>
            <h1 className="mt-4 text-4xl font-black leading-tight text-white sm:text-6xl">
              {briefing.title}
            </h1>
            <p className="mt-6 max-w-4xl text-xl leading-8 text-[#c3d0df]">
              {briefing.excerpt}
            </p>
            <div className="mt-8 flex flex-wrap gap-6">
              {briefing.contributors.map((person: any, index) => (
                <div
                  key={`${person.name}-${index}`}
                  className="flex items-center gap-3"
                >
                  <ContributorAvatar person={person} size="small" />
                  <div>
                    <div className="text-xs uppercase tracking-wider text-[#8ca4c0]">
                      {person.role}
                    </div>
                    <div className="font-semibold">{person.name}</div>
                    {person.professionalTitle && (
                      <div className="text-sm text-[#a9b9cb]">
                        {person.professionalTitle}
                      </div>
                    )}
                    {person.aviationCredentials && (
                      <div className="text-sm text-[#8fb8ed]">
                        {person.aviationCredentials}
                      </div>
                    )}
                    {person.credentialVerificationNote && (
                      <div className="mt-1 text-xs text-[#91a4bb]">
                        {person.credentialVerificationNote}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {[
                        ["Website", person.websiteUrl],
                        ["YouTube", person.youtubeUrl],
                        ["Vimeo", person.vimeoUrl],
                        ["LinkedIn", person.linkedinUrl],
                      ]
                        .filter((x: any) => x[1])
                        .map((x: any) => (
                          <a
                            key={x[0]}
                            href={x[1]}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#8dbbfa] underline"
                            onClick={() =>
                              trackEvent(
                                "aviation_contributor_external_link_clicked",
                                { briefingId: briefing.id, network: x[0] },
                              )
                            }
                          >
                            {x[0]}
                          </a>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {briefing.publishedAt && (
              <time
                className="mt-7 block text-sm text-[#91a4bb]"
                dateTime={briefing.publishedAt}
              >
                Published{" "}
                {new Date(briefing.publishedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            )}
            <button
              className="mt-4 inline-flex items-center text-sm text-[#8dbbfa]"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                trackEvent("aviation_briefing_shared", {
                  briefingId: briefing.id,
                });
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy link
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
          {briefing.contentType === "video" && embed ? (
            <div className="mb-10 aspect-video overflow-hidden rounded-2xl border border-[#58759b]/40 bg-black">
              <iframe
                src={embed}
                title={briefing.title}
                className="h-full w-full"
                allow="accelerometer; encrypted-media; picture-in-picture"
                allowFullScreen
                onLoad={() =>
                  trackEvent("aviation_briefing_video_started", {
                    briefingId: briefing.id,
                    slug: briefing.slug,
                  })
                }
              />
            </div>
          ) : image ? (
            <img
              src={image}
              alt={briefing.featuredImageAlt || ""}
              className="mb-10 max-h-[36rem] w-full rounded-2xl border border-[#58759b]/40 object-cover"
            />
          ) : null}
          <div className="mx-auto max-w-3xl">
            <Blocks
              blocks={
                briefing.contentType === "article"
                  ? briefing.articleContent
                  : briefing.supportingContent
              }
            />
            {briefing.contentType === "video" && briefing.videoTranscript && (
              <details className="mt-10 rounded-xl border border-[#526d94]/40 bg-[#0d1827] p-5">
                <summary className="cursor-pointer font-semibold">
                  Video transcript
                </summary>
                <p className="mt-4 whitespace-pre-wrap leading-7 text-[#c5d1df]">
                  {briefing.videoTranscript}
                </p>
              </details>
            )}
          </div>
          {tools.length > 0 && (
            <section className="mt-14 rounded-2xl border border-[#56749c]/40 bg-[#0d1929] p-6 sm:p-8">
              <h2 className="text-2xl font-bold">Try It in Ready Set Fly</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {tools.map((tool) => (
                  <Link
                    key={tool.id}
                    href={tool.path}
                    onClick={() =>
                      trackEvent("aviation_briefing_tool_clicked", {
                        briefingId: briefing.id,
                        toolId: tool.id,
                      })
                    }
                    className="rounded-xl border border-[#58749a]/35 bg-[#111f32] p-5 hover:border-[#76aaf0]"
                  >
                    <h3 className="font-bold text-white">{tool.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#aebdce]">
                      {tool.description}
                    </p>
                    <span className="mt-4 inline-flex items-center text-sm font-semibold text-[#86b7f8]">
                      Open tool <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {!isPreview && (
            <BriefingEngagement briefing={briefing} related={data.related} />
          )}
          <aside className="mt-12 flex gap-3 rounded-xl border border-[#6f7d90]/35 bg-[#111923] p-5 text-sm leading-6 text-[#aebbc9]">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#90a6bf]" />
            <p>
              Aviation Briefings are provided for general educational and
              informational purposes only. They are not a substitute for
              official FAA publications, approved weather briefings, qualified
              flight instruction, aircraft documentation, regulatory guidance,
              or pilot-in-command decision-making.
            </p>
          </aside>
          <ContributorFooter contributors={briefing.contributors} />
          {briefing.contributors.some(
            (person: any) => person.credentialVerificationNote,
          ) && (
            <aside className="mt-4 rounded-xl border border-[#536d8e]/35 bg-[#0e1722] p-4 text-sm leading-6 text-[#aebbc9]">
              This briefing was created by an independent contributor. The views
              expressed are those of the contributor and do not necessarily
              represent Ready Set Fly.
            </aside>
          )}
          {data.related.length > 0 && briefing.id && (
            <section className="mt-16">
              <h2 className="mb-6 text-3xl font-bold">Related Briefings</h2>
              <div className="grid gap-6 md:grid-cols-3">
                {data.related.map((item) => (
                  <BriefingCard key={item.id} briefing={item} />
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
    </main>
  );
}
