import { MapPin, Image as ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveImageUrl } from "@/lib/images";

interface MarketplaceCardProps {
  id: string;
  category: string;
  title: string;
  description: string;
  price?: string;
  location: string;
  image?: string;
  images: number;
  tier?: string;
  isExample?: boolean;
  viewCount?: number;
}

const categoryColors: Record<string, string> = {
  "aircraft-sale": "border-[#45658b]/40 bg-[#122030] text-[#d7e6f6]",
  "charter": "border-[#5b4f8f]/40 bg-[#17142a] text-[#e1daf7]",
  "cfi": "border-[#3a7d6e]/40 bg-[#10211d] text-[#d1ece3]",
  "flight-school": "border-[#7f6327]/40 bg-[#241c0d] text-[#f2dca4]",
  "mechanic": "border-[#864c63]/38 bg-[#23131a] text-[#f0d4df]",
  "job": "border-[#586c8b]/40 bg-[#121c2b] text-[#dce7f5]",
};

const categoryLabels: Record<string, string> = {
  "aircraft-sale": "For Sale",
  "charter": "Charter",
  "cfi": "CFI",
  "flight-school": "Flight School",
  "mechanic": "A&P Mechanic",
  "job": "Job Opening",
};

export function MarketplaceCard({
  id,
  category,
  title,
  description,
  price,
  location,
  image,
  images,
  tier,
  isExample,
  viewCount = 0,
}: MarketplaceCardProps) {
  const resolvedImage = resolveImageUrl(image);
  return (
    <Card className="group rsf-metal-panel rsf-metal-panel-interactive overflow-hidden text-[#E8EDF4] transition-all duration-200 hover:scale-[1.02]" data-testid={`card-marketplace-${id}`}>
      {isExample && (
        <div className="border-b border-[#7f6327]/40 bg-[linear-gradient(180deg,rgba(54,40,18,0.98),rgba(28,21,10,0.98))] px-4 py-2 text-center text-sm font-semibold text-[#f2dca4]" data-testid="banner-example">
          EXAMPLE LISTING - For Reference Only
        </div>
      )}
      {resolvedImage ? (
        <div className="relative aspect-[3/2] overflow-hidden bg-[linear-gradient(180deg,rgba(18,22,28,0.98),rgba(9,12,16,0.99))]">
          <img
            src={resolvedImage}
            alt={title}
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.01]"
          />
          {isExample && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/60 text-white text-xs font-semibold uppercase tracking-[0.35em] px-4 py-1 -rotate-12">
                Sample
              </div>
            </div>
          )}
          <div className="absolute top-3 left-3">
            <Badge className={`border ${categoryColors[category]}`} data-testid={`badge-category-${category}`}>
              {categoryLabels[category]}
            </Badge>
          </div>
          {tier && (
            <div className="absolute top-3 right-3">
              <Badge variant="outline" className="border-[#5d6f85]/28 bg-[#0f141a]/92 capitalize text-[#E8EDF4] backdrop-blur">
                {tier}
              </Badge>
            </div>
          )}
          {images > 0 && (
            <div className="absolute bottom-3 right-3">
              <Badge variant="outline" className="border-[#5d6f85]/28 bg-[#0f141a]/92 text-[#E8EDF4] backdrop-blur">
                <ImageIcon className="h-3 w-3 mr-1" />
                {images}
              </Badge>
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex aspect-[3/2] items-center justify-center bg-[linear-gradient(180deg,rgba(18,22,28,0.98),rgba(9,12,16,0.99))]">
          <div className="absolute top-3 left-3">
            <Badge className={`border ${categoryColors[category]}`} data-testid={`badge-category-${category}`}>
              {categoryLabels[category]}
            </Badge>
          </div>
          {isExample && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/60 text-white text-xs font-semibold uppercase tracking-[0.35em] px-4 py-1 -rotate-12">
                Sample
              </div>
            </div>
          )}
          <ImageIcon className="h-12 w-12 text-[#8fa6c0]/30" />
        </div>
      )}

      <CardContent className="p-6">
        <h3 className="mb-2 line-clamp-2 font-display text-lg font-semibold text-[#F5F8FC] transition-colors hover:text-[#9ebdff]" data-testid={`text-title-${id}`}>
          {title}
        </h3>

        <p className="mb-4 line-clamp-2 text-sm text-[#A9BBCD]">
          {description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#A9BBCD]">
            <MapPin className="h-4 w-4" />
            <span>{location}</span>
          </div>
          {price && (
            <span className="text-lg font-bold text-[#F5F8FC]" data-testid={`text-price-${id}`}>{price}</span>
          )}
        </div>
        <div className="mt-3 text-xs text-[#8fa6c0]">
          {viewCount} views
        </div>
      </CardContent>
    </Card>
  );
}
