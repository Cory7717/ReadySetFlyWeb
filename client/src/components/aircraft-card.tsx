import React from "react";
import { Clock, CheckCircle2, Gauge } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/favorite-button";

const EXAMPLE_RENTAL_CARD_IMAGE = "/assets/rental-default-image.png";

interface AircraftCardProps {
  id: string;
  make: string;
  model: string;
  year: number;
  hourlyRate: string;
  image: string;
  location: string;
  certifications: string[];
  totalTime: number;
  avionics: string;
  insuranceIncluded: boolean;
  responseTime: number;
  acceptanceRate: number;
  viewCount?: number;
  isExample?: boolean;
  onCardClick?: () => void;
}

export function AircraftCard({
  id,
  make,
  model,
  year,
  hourlyRate,
  image,
  location,
  certifications,
  totalTime,
  avionics,
  insuranceIncluded,
  responseTime,
  acceptanceRate,
  viewCount = 0,
  isExample,
  onCardClick,
}: AircraftCardProps) {
  const cardImage = isExample ? EXAMPLE_RENTAL_CARD_IMAGE : image;
  const imageAlt = isExample
    ? "Be the first in your area to list your aircraft"
    : `${year} ${make} ${model}`;

  return (
    <Card 
      className="group rsf-metal-panel rsf-metal-panel-interactive overflow-hidden cursor-pointer text-[#E8EDF4] transition-all duration-200 hover:scale-[1.02]" 
      onClick={onCardClick}
      data-testid={`card-aircraft-${id}`}
    >
      <div className="relative aspect-[3/2] overflow-hidden rounded-t-xl bg-[linear-gradient(180deg,rgba(18,22,28,0.98),rgba(9,12,16,0.99))]">
        <img
          src={cardImage}
          alt={imageAlt}
          className={`h-full w-full transition-transform duration-300 group-hover:scale-[1.01] ${isExample ? "object-contain" : "object-cover"}`}
        />
        {isExample && (
          <div className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-[#8db8ff]/35 bg-[#07111f]/85 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#dceaff] backdrop-blur">
            Sample listing preview
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-2">
          {certifications.map((cert) => (
            <Badge key={cert} className="border border-[#3a7d6e]/40 bg-[#10211d] text-xs font-semibold text-[#d1ece3]" data-testid={`badge-cert-${cert}`}>
              {cert}
            </Badge>
          ))}
        </div>
        <FavoriteButton
          listingId={id}
          listingType="aircraft"
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 border border-[#5d6f85]/24 bg-[#0f141a]/92 text-[#E8EDF4] backdrop-blur hover:bg-[#17202a]"
        />
        <div className="absolute bottom-3 left-3">
          <Badge variant="outline" className="border-[#5d6f85]/24 bg-[#0f141a]/92 text-[#E8EDF4] backdrop-blur">
            <CheckCircle2 className="mr-1 h-3 w-3 text-[#6dc8ab]" />
            Verified Owner
          </Badge>
        </div>
      </div>

      <CardContent className="p-6">
        <h3 className="mb-1 font-display text-xl font-semibold text-[#F5F8FC] transition-colors hover:text-[#9ebdff]" data-testid={`title-aircraft-${id}`}>
          {year} {make} {model}
        </h3>

        <div className="mb-4 flex items-baseline gap-2">
          <span className="text-2xl font-bold" data-testid={`text-rate-${id}`}>${hourlyRate}</span>
          <span className="text-sm text-[#A9BBCD]">/hour</span>
          {insuranceIncluded && (
            <Badge variant="outline" className="border-[#5d6f85]/24 bg-[#141b24] text-xs text-[#E8EDF4]">Insurance Included</Badge>
          )}
        </div>

        <div className="mb-4 space-y-2 text-sm text-[#A9BBCD]">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            <span>{year} | {totalTime.toLocaleString()} hrs | {avionics}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{location}</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#5d6f85]/16 pt-4 text-xs text-[#8fa6c0]">
          <span>{viewCount} views</span>
          <span>Response: {responseTime}h</span>
          <span>Acceptance: {acceptanceRate}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
