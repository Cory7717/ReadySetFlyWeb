import { type ReactNode, useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export type FeaturedPartnerTile = {
  title: string;
  description: string;
  slug: string;
  dest?: string;
  icon?: ReactNode;
};

interface FeaturedPartnerToolCardProps {
  partnerKey: string;
  title: string;
  description: string;
  logoSrc: string;
  ctaLabel: string;
  outboundPath: string;
  placement: string;
  source?: string;
  embedEnabled?: boolean;
  embedUrl?: string;
  tiles?: FeaturedPartnerTile[];
  className?: string;
  badgeLabel?: string;
}

const DEFAULT_SOURCE = "home_featured_partner";
const IMPRESSION_THRESHOLD = 0.35;
const EMBED_TIMEOUT_MS = 4500;

const sanitizeParam = (value: string | undefined, fallback: string) => {
  const trimmed = (value || "").trim().toLowerCase();
  const cleaned = trimmed.replace(/[^a-z0-9_-]/g, "");
  return cleaned || fallback;
};

const buildOutboundUrl = (outboundPath: string, src: string, utmContent: string, dest?: string) => {
  const base = apiUrl(outboundPath);
  const params = new URLSearchParams();
  params.set("src", src);
  params.set("utm_content", utmContent);
  if (dest) {
    params.set("dest", dest);
  }
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${params.toString()}`;
};

export function FeaturedPartnerToolCard({
  partnerKey,
  title,
  description,
  logoSrc,
  ctaLabel,
  outboundPath,
  placement,
  source,
  embedEnabled = false,
  embedUrl,
  tiles = [],
  className,
  badgeLabel = "Featured Partner",
}: FeaturedPartnerToolCardProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const impressionLogged = useRef(false);
  const [embedStatus, setEmbedStatus] = useState<"idle" | "loaded" | "failed">("idle");
  const [tilesExpanded, setTilesExpanded] = useState(false);

  const normalizedSource = sanitizeParam(source, DEFAULT_SOURCE);
  const impressionKey = `rsf_partner_impression_${partnerKey}`;
  const ctaHref = buildOutboundUrl(outboundPath, normalizedSource, "cta");
  const showEmbed = Boolean(embedEnabled && embedUrl && embedStatus !== "failed");
  const showTiles = !showEmbed;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (impressionLogged.current) return;
    try {
      if (window.sessionStorage.getItem(impressionKey)) {
        impressionLogged.current = true;
        return;
      }
    } catch {}

    const node = rootRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || impressionLogged.current) return;
        impressionLogged.current = true;
        try {
          window.sessionStorage.setItem(impressionKey, "1");
        } catch {}
        trackEvent("featured_partner_impression", {
          partner: partnerKey,
          placement,
          source: normalizedSource,
        });
      },
      { threshold: IMPRESSION_THRESHOLD }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [impressionKey, normalizedSource, partnerKey, placement]);

  useEffect(() => {
    if (!embedEnabled || !embedUrl) return;
    if (embedStatus !== "idle") return;
    const timer = setTimeout(() => {
      setEmbedStatus("failed");
    }, EMBED_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [embedEnabled, embedUrl, embedStatus]);

  const handleCtaClick = () => {
    trackEvent("featured_partner_cta_click", {
      partner: partnerKey,
      placement,
      source: normalizedSource,
    });
  };

  const handleEmbedInteraction = (context: string, content?: string) => {
    trackEvent("featured_partner_embed_interaction", {
      partner: partnerKey,
      placement,
      context,
      content,
    });
  };

  return (
    <div ref={rootRef} className={cn("w-full", className)}>
      <Card className="border-muted-foreground/20 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <Badge variant="secondary">{badgeLabel}</Badge>
            <span>External resource · Opens in new tab</span>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
              <div className="flex items-center justify-center rounded-md border bg-white/95 px-4 py-3 shadow-sm">
                <img
                  src={logoSrc}
                  alt={`${title} logo`}
                  className="h-20 sm:h-24 w-auto object-contain"
                  loading="lazy"
                />
              </div>
              <div className="space-y-2">
                <div className="text-center sm:text-left">
                  <div className="text-xl sm:text-2xl font-semibold">Av8Maps</div>
                  <div className="text-sm sm:text-base text-muted-foreground">
                    Nationwide Fly-in Destination Maps
                  </div>
                </div>
                <CardDescription className="text-sm text-muted-foreground">
                  {description}
                </CardDescription>
              </div>
            </div>
            <Button asChild onClick={handleCtaClick} className="w-fit">
              <a href={ctaHref} target="_blank" rel="noreferrer noopener">
                {ctaLabel}
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-background/60">
            {showEmbed ? (
              <div className="relative">
                <div className="absolute left-3 top-3 z-10 rounded-full bg-background/90 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
                  Preview (opens Av8Maps in a new tab)
                </div>
                <iframe
                  title={`${title} preview`}
                  src={embedUrl || ""}
                  loading="lazy"
                  onLoad={() => setEmbedStatus("loaded")}
                  onError={() => setEmbedStatus("failed")}
                  onClick={() => handleEmbedInteraction("iframe")}
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  className="h-[260px] w-full rounded-lg border-0"
                />
              </div>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                Explore Av8Maps categories to plan your next destination.
              </div>
            )}
          </div>

          {showTiles && tiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  Explore Av8Maps categories
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-expanded={tilesExpanded}
                  onClick={() => setTilesExpanded((prev) => !prev)}
                >
                  {tilesExpanded ? "Hide categories" : "Show categories"}
                </Button>
              </div>
              {tilesExpanded && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {tiles.map((tile) => {
                    const href = buildOutboundUrl(
                      outboundPath,
                      "home_featured_partner_tile",
                      sanitizeParam(tile.slug, "tile"),
                      tile.dest
                    );
                    return (
                      <a
                        key={tile.slug}
                        href={href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="group rounded-lg border bg-background p-4 transition hover:border-primary/40 hover:shadow-sm"
                        onClick={() => handleEmbedInteraction("tile", tile.slug)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 text-primary">{tile.icon}</div>
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-foreground">
                              {tile.title}
                            </div>
                            <p className="text-xs text-muted-foreground">{tile.description}</p>
                            <div className="text-xs text-primary font-semibold">
                              Explore →
                            </div>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
