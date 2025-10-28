import { MapPin, Image as ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
}

const categoryColors: Record<string, string> = {
  "aircraft-sale": "bg-primary text-primary-foreground",
  "charter": "bg-secondary text-secondary-foreground",
  "cfi": "bg-chart-2 text-white",
  "flight-school": "bg-accent text-accent-foreground",
  "mechanic": "bg-chart-4 text-white",
  "job": "bg-chart-5 text-white",
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
}: MarketplaceCardProps) {
  return (
    <Card className="overflow-hidden hover-elevate transition-all duration-200 hover:scale-[1.02]" data-testid={`card-marketplace-${id}`}>
      {isExample && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center font-semibold text-sm" data-testid="banner-example">
          EXAMPLE LISTING - For Reference Only
        </div>
      )}
      {image ? (
        <div className="relative aspect-[3/2] overflow-hidden">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 left-3">
            <Badge className={categoryColors[category]} data-testid={`badge-category-${category}`}>
              {categoryLabels[category]}
            </Badge>
          </div>
          {tier && (
            <div className="absolute top-3 right-3">
              <Badge variant="outline" className="bg-background/80 backdrop-blur capitalize">
                {tier}
              </Badge>
            </div>
          )}
          {images > 0 && (
            <div className="absolute bottom-3 right-3">
              <Badge variant="outline" className="bg-background/80 backdrop-blur">
                <ImageIcon className="h-3 w-3 mr-1" />
                {images}
              </Badge>
            </div>
          )}
        </div>
      ) : (
        <div className="relative aspect-[3/2] bg-muted flex items-center justify-center">
          <div className="absolute top-3 left-3">
            <Badge className={categoryColors[category]} data-testid={`badge-category-${category}`}>
              {categoryLabels[category]}
            </Badge>
          </div>
          <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
        </div>
      )}

      <CardContent className="p-6">
        <h3 className="font-display text-lg font-semibold mb-2 hover:text-primary transition-colors line-clamp-2" data-testid={`text-title-${id}`}>
          {title}
        </h3>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{location}</span>
          </div>
          {price && (
            <span className="font-bold text-lg" data-testid={`text-price-${id}`}>{price}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
