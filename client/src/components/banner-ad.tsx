import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { BannerAd } from "@shared/schema";

interface BannerAdProps {
  banner: BannerAd;
  className?: string;
}

export function BannerAd({ banner, className = "" }: BannerAdProps) {
  const [, setLocation] = useLocation();
  const [impressionTracked, setImpressionTracked] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Track impression when banner is visible
  useEffect(() => {
    if (impressionTracked) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !impressionTracked) {
          try {
            await apiRequest("POST", `/api/banner-ads/${banner.id}/impression`, {});
            setImpressionTracked(true);
          } catch (error) {
            console.error("Failed to track banner impression:", error);
          }
        }
      },
      { threshold: 0.5 } // Trigger when 50% of banner is visible
    );

    const currentRef = bannerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      // Disconnect observer to stop all observations
      observer.disconnect();
    };
  }, [banner.id, impressionTracked]);

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
      <img
        src={banner.imageUrl}
        alt={banner.title}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
