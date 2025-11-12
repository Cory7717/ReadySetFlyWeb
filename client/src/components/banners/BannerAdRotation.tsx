import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

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
      
      const response = await fetch(`/api/banner-ads/active?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch banner ads');
      }
      return response.json();
    },
    staleTime: 60000,
  });

  const trackImpressionMutation = useMutation({
    mutationFn: async (bannerId: string) => {
      return apiRequest(`/api/banner-ads/${bannerId}/impression`, {
        method: "POST",
      });
    },
  });

  const trackClickMutation = useMutation({
    mutationFn: async (bannerId: string) => {
      return apiRequest(`/api/banner-ads/${bannerId}/click`, {
        method: "POST",
      });
    },
  });

  const currentAd = bannerAds[currentIndex];

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

  const handleClick = () => {
    trackClickMutation.mutate(currentAd.id);
    window.open(currentAd.link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`w-full ${className}`}>
      <Card 
        className="overflow-hidden hover-elevate active-elevate-2 cursor-pointer transition-all duration-500"
        onClick={handleClick}
        data-testid={`banner-ad-${currentAd.id}`}
      >
      <div className="relative">
        {currentAd.imageUrl && (
          <div className="w-full h-32 bg-muted">
            <img 
              src={currentAd.imageUrl} 
              alt={currentAd.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <div className="absolute top-2 right-2">
          <div className="bg-background/90 backdrop-blur-sm rounded px-2 py-1 text-xs text-muted-foreground">
            Sponsored
          </div>
        </div>
        
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className="font-semibold text-sm line-clamp-1">{currentAd.title}</h3>
              {currentAd.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {currentAd.description}
                </p>
              )}
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </div>
          
          {bannerAds.length > 1 && (
            <div className="flex gap-1 pt-2">
              {bannerAds.map((_, index) => (
                <div
                  key={index}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    index === currentIndex 
                      ? 'bg-primary' 
                      : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      </Card>
    </div>
  );
}
