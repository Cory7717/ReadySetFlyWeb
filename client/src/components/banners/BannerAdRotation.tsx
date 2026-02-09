import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";

interface BannerAd {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  link: string;
  placements: string[];
  category?: string;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  impressions: number;
  clicks: number;
}

interface BannerAdRotationProps {
  placement: string;
  category?: string;
  rotationIntervalMs?: number;
  className?: string;
}

export function BannerAdRotation({ 
  placement, 
  category,
  rotationIntervalMs = 8000,
  className = ""
}: BannerAdRotationProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);

  const { data: bannerAds = [], isLoading } = useQuery<BannerAd[]>({
    queryKey: ["/api/banner-ads/active", placement, category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (placement) params.set('placement', placement);
      if (category) params.set('category', category);
      
      const response = await fetch(apiUrl(`/api/banner-ads/active?${params.toString()}`));
      if (!response.ok) {
        throw new Error('Failed to fetch banner ads');
      }
      return response.json();
    },
    staleTime: 60000,
  });

  const trackImpressionMutation = useMutation({
    mutationFn: async (bannerId: string) => {
      return apiRequest("POST", `/api/banner-ads/${bannerId}/impression`, {});
    },
  });

  const trackClickMutation = useMutation({
    mutationFn: async (bannerId: string) => {
      return apiRequest("POST", `/api/banner-ads/${bannerId}/click`, {});
    },
  });

  const currentAd = bannerAds[currentIndex];
  const isClickable = Boolean(currentAd?.link);

  // Reset index and impression tracking when banner ads change
  useEffect(() => {
    if (bannerAds.length > 0) {
      setCurrentIndex(0);
      setHasTrackedImpression(false);
    }
  }, [bannerAds]);

  // Rotate through ads
  useEffect(() => {
    if (bannerAds.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerAds.length);
      setHasTrackedImpression(false);
    }, rotationIntervalMs);

    return () => clearInterval(interval);
  }, [bannerAds.length, rotationIntervalMs]);

  // Track impression for current ad
  useEffect(() => {
    if (currentAd && !hasTrackedImpression) {
      trackImpressionMutation.mutate(currentAd.id);
      setHasTrackedImpression(true);
    }
  }, [currentAd?.id, hasTrackedImpression]);

  // Don't render anything if no ads or still loading
  if (isLoading || !currentAd || bannerAds.length === 0) {
    return null;
  }

  const buildTrackingUrl = (link: string, bannerId: string) => {
    try {
      const url = new URL(link);
      const campaignPlacement = placement || "site";
      const contentCategory = category || "general";

      url.searchParams.set("utm_source", "readysetfly");
      url.searchParams.set("utm_medium", "banner");
      url.searchParams.set("utm_campaign", `rsf-${campaignPlacement}-banner`);
      url.searchParams.set("utm_content", `${contentCategory}-${bannerId}`);

      return url.toString();
    } catch {
      return link;
    }
  };

  const handleClick = () => {
    if (!currentAd?.link) return;
    const trackingUrl = buildTrackingUrl(currentAd.link, currentAd.id);
    trackClickMutation.mutate(currentAd.id);
    window.open(trackingUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`w-full ${className}`}>
      <Card
        className={`group relative overflow-hidden border-0 bg-gradient-to-br from-amber-50 via-white to-sky-50 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)] transition-all duration-500 ${
          isClickable ? "cursor-pointer hover:-translate-y-0.5" : "cursor-default"
        }`}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (!isClickable) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleClick();
          }
        }}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : -1}
        data-testid={`banner-ad-${currentAd.id}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(90%_120%_at_0%_0%,rgba(14,165,233,0.18),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(110%_130%_at_100%_0%,rgba(249,115,22,0.22),transparent)]" />

        <div className="relative grid sm:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-between gap-3 p-5 sm:p-6">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Sponsored
            </div>

            <div>
              <h3 className="font-display text-lg sm:text-xl text-foreground line-clamp-2">
                {currentAd.title}
              </h3>
              {currentAd.description && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                  {currentAd.description}
                </p>
              )}
            </div>

            {currentAd.link && (
              <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
                <span>Visit sponsor</span>
                <ExternalLink className="h-4 w-4" />
              </div>
            )}

            {bannerAds.length > 1 && (
              <div className="flex gap-2 pt-1">
                {bannerAds.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      index === currentIndex
                        ? "bg-foreground"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="relative min-h-[150px] sm:min-h-[180px]">
            {currentAd.imageUrl ? (
              <img
                src={currentAd.imageUrl}
                alt={currentAd.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-[linear-gradient(140deg,rgba(14,165,233,0.18),rgba(249,115,22,0.2))]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-transparent" />
          </div>
        </div>
      </Card>
    </div>
  );
}
