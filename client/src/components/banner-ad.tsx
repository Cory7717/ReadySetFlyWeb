import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { BannerAd } from "@shared/schema";
import {
  useDocumentVisibility,
  useQualifiedBannerImpression,
} from "@/hooks/useQualifiedBannerImpression";

interface BannerAdProps {
  banner: BannerAd;
  className?: string;
}

export function BannerAd({ banner, className = "" }: BannerAdProps) {
  const [, setLocation] = useLocation();
  const isDocumentVisible = useDocumentVisibility();
  const bannerRef = useQualifiedBannerImpression({
    exposureKey: banner.id,
    isDocumentVisible,
    onQualified: async () => {
      await apiRequest("POST", `/api/banner-ads/${banner.id}/impression`, {});
    },
  });
  const hasVideo = Boolean(banner.videoUrl);
  const isVideoMuted = banner.videoMuted !== false;

  const handleClick = async () => {
    // Track click
    try {
      await apiRequest("POST", `/api/banner-ads/${banner.id}/click`, {});
    } catch (error) {
      console.error("Failed to track banner click:", error);
    }

    // Navigate to target URL
    if (banner.link) {
      if (banner.link.startsWith('http')) {
        window.open(banner.link, '_blank', 'noopener,noreferrer');
      } else {
        setLocation(banner.link);
      }
    }
  };

  return (
    <div 
      ref={bannerRef}
      className={`relative overflow-hidden rounded-lg cursor-pointer hover-elevate ${className}`}
      onClick={handleClick}
      data-testid={`banner-ad-${banner.id}`}
    >
      {hasVideo ? (
        <video
          src={banner.videoUrl ?? undefined}
          className="w-full h-full object-cover"
          autoPlay={isVideoMuted}
          loop={isVideoMuted}
          muted={isVideoMuted}
          poster={banner.imageUrl || undefined}
          playsInline
          controls={!isVideoMuted}
        />
      ) : (
        <img
          src={banner.imageUrl}
          alt={banner.title}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}
