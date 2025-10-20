import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { AircraftListing } from "@shared/schema";
import { MapPin, Gauge, Shield, Calendar, Heart, Share2, Star } from "lucide-react";
import { RentalMessaging } from "@/components/rental-messaging";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AircraftDetail() {
  const [, params] = useRoute("/aircraft/:id");
  const [estimatedHours, setEstimatedHours] = useState("6");
  
  // Mock active rental for demo - in real app would fetch from /api/rentals
  const [mockActiveRental] = useState({
    id: "rental-demo-123",
    status: "active" as const,
    userId: "user-123",
  });

  const { data: aircraft, isLoading } = useQuery<AircraftListing>({
    queryKey: ["/api/aircraft", params?.id],
    enabled: !!params?.id,
  });

  if (isLoading || !aircraft) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading aircraft details...</p>
        </div>
      </div>
    );
  }

  const hourlyRate = parseFloat(aircraft.hourlyRate);
  const baseCost = parseFloat(estimatedHours) * hourlyRate;
  const platformFee = baseCost * 0.075; // 7.5%
  const total = baseCost + platformFee;

  return (
    <div className="min-h-screen bg-background">
      {/* Image Gallery */}
      <section className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="col-span-4 md:col-span-2 md:row-span-2 rounded-xl overflow-hidden aspect-[3/2]">
            <img
              src={aircraft.images[0] || "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=1200"}
              alt={`${aircraft.year} ${aircraft.make} ${aircraft.model}`}
              className="w-full h-full object-cover"
            />
          </div>
          {aircraft.images.slice(1, 5).map((img, i) => (
            <div key={i} className="rounded-xl overflow-hidden aspect-[3/2]">
              <img
                src={img}
                alt={`${aircraft.make} ${aircraft.model} view ${i + 2}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-4xl font-bold mb-2" data-testid="text-aircraft-title">
              {aircraft.year} {aircraft.make} {aircraft.model}
            </h1>
            <div className="flex items-center gap-4 text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{aircraft.location}{aircraft.airportCode ? ` (${aircraft.airportCode})` : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-current text-accent" />
                <span className="font-semibold text-foreground">4.95</span>
                <span>(24 reviews)</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" data-testid="button-share" aria-label="Share listing">
              <Share2 className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" data-testid="button-favorite-detail" aria-label="Add to favorites">
              <Heart className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Specifications */}
            <Card>
              <CardHeader>
                <CardTitle>Aircraft Specifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Make & Model</div>
                    <div className="font-semibold">{aircraft.make} {aircraft.model}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Year</div>
                    <div className="font-semibold">{aircraft.year}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Registration</div>
                    <div className="font-semibold">{aircraft.registration}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Total Time</div>
                    <div className="font-semibold">{aircraft.totalTime.toLocaleString()} hours</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Engine</div>
                    <div className="font-semibold">{aircraft.engine || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Avionics</div>
                    <div className="font-semibold">{aircraft.avionicsSuite || "N/A"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Required Certifications */}
            <Card>
              <CardHeader>
                <CardTitle>Required Certifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {aircraft.requiredCertifications.map((cert) => (
                    <Badge key={cert} className="bg-primary text-primary-foreground px-4 py-2">{cert}</Badge>
                  ))}
                  {aircraft.minFlightHours > 0 && (
                    <Badge variant="outline" className="px-4 py-2">
                      Minimum {aircraft.minFlightHours} flight hours
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>{aircraft.description}</p>
              </CardContent>
            </Card>

            {/* Messaging (if user has active rental) */}
            {mockActiveRental && (
              <RentalMessaging
                rentalId={mockActiveRental.id}
                userId={mockActiveRental.userId}
                rentalStatus={mockActiveRental.status}
              />
            )}

            {/* Owner Info */}
            <Card>
              <CardHeader>
                <CardTitle>Aircraft Owner</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100" />
                    <AvatarFallback>JS</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">John Smith</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Response time: 12h</span>
                      <span>Acceptance rate: 95%</span>
                      <Badge className="bg-chart-2 text-white">Verified</Badge>
                    </div>
                  </div>
                  <Button variant="outline" data-testid="button-message-owner">Message Owner</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Booking Card (Sticky) */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 shadow-xl">
              <CardHeader>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold" data-testid="text-booking-rate">${hourlyRate.toFixed(0)}</span>
                  <span className="text-muted-foreground">/hour</span>
                </div>
                {aircraft.insuranceIncluded && (
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-chart-2" />
                    <span className="text-muted-foreground">Insurance included</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="start-date"
                      type="date"
                      className="pl-10"
                      data-testid="input-start-date"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="end-date"
                      type="date"
                      className="pl-10"
                      data-testid="input-end-date"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hours">Estimated Flight Hours</Label>
                  <Input
                    id="hours"
                    type="number"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    min="1"
                    step="0.5"
                    data-testid="input-estimated-hours"
                  />
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      ${hourlyRate} × {estimatedHours} hours
                    </span>
                    <span data-testid="text-base-cost">${baseCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform fee (7.5%)</span>
                    <span data-testid="text-platform-fee">${platformFee.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span data-testid="text-total-cost">${total.toFixed(2)}</span>
                </div>

                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent" size="lg" data-testid="button-request-booking">
                  Request to Book
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  You won't be charged yet
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
