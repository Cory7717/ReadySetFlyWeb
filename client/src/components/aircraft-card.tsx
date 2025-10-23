import { Heart, Clock, CheckCircle2, Gauge } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  onCardClick,
}: AircraftCardProps) {
  return (
    <Card 
      className="overflow-hidden hover-elevate transition-all duration-200 hover:scale-[1.02] cursor-pointer" 
      onClick={onCardClick}
      data-testid={`card-aircraft-${id}`}
    >
      <div className="relative aspect-[3/2] overflow-hidden rounded-t-xl">
        <img
          src={image}
          alt={`${year} ${make} ${model}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          {certifications.map((cert) => (
            <Badge key={cert} className="bg-chart-2 text-white text-xs font-semibold" data-testid={`badge-cert-${cert}`}>
              {cert}
            </Badge>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 bg-background/80 backdrop-blur hover:bg-background"
          data-testid={`button-favorite-${id}`}
          aria-label="Add to favorites"
        >
          <Heart className="h-5 w-5" />
        </Button>
        <div className="absolute bottom-3 left-3">
          <Badge variant="outline" className="bg-background/80 backdrop-blur">
            <CheckCircle2 className="h-3 w-3 mr-1 text-chart-2" />
            Verified Owner
          </Badge>
        </div>
      </div>

      <CardContent className="p-6">
        <h3 className="font-display text-xl font-semibold mb-1 hover:text-primary transition-colors" data-testid={`title-aircraft-${id}`}>
          {year} {make} {model}
        </h3>

        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-2xl font-bold" data-testid={`text-rate-${id}`}>${hourlyRate}</span>
          <span className="text-muted-foreground text-sm">/hour</span>
          {insuranceIncluded && (
            <Badge variant="outline" className="text-xs">Insurance Included</Badge>
          )}
        </div>

        <div className="space-y-2 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            <span>{year} | {totalTime.toLocaleString()} hrs | {avionics}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{location}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
          <span>Response: {responseTime}h</span>
          <span>Acceptance: {acceptanceRate}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
