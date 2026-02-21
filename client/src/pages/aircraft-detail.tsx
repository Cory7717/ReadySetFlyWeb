import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { AircraftListing, User } from "@shared/schema";
import { MapPin, Gauge, Shield, Calendar, Heart, Share2, Star, Info, Eye } from "lucide-react";
import { RentalMessaging } from "@/components/rental-messaging";
import { StarRating } from "@/components/star-rating";
import { FavoriteButton } from "@/components/favorite-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";

export default function AircraftDetail() {
  const [, params] = useRoute("/aircraft/:id");
  const [, navigate] = useLocation();
  const [estimatedHours, setEstimatedHours] = useState("6");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showBestPractices, setShowBestPractices] = useState(false);
  const [showVerificationNotice, setShowVerificationNotice] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const verificationNoticeKey = "rsf-verification-renter-v1";
  
  // Mock active rental for demo - in real app would fetch from /api/rentals
  const [mockActiveRental] = useState({
    id: "rental-demo-123",
    status: "active" as const,
    userId: "user-123",
  });

  const { data: aircraft, isLoading, error } = useQuery<AircraftListing>({
    queryKey: ["/api/aircraft", params?.id],
    enabled: !!params?.id,
  });

  // Fetch owner's user data to show rating
  const { data: owner } = useQuery<User>({
    queryKey: ["/api/users", aircraft?.ownerId],
    enabled: !!aircraft?.ownerId,
  });

  // Redirect to 404 if aircraft not found (after loading completes)
  useEffect(() => {
    if (!isLoading && (error || !aircraft)) {
      navigate("/404");
    }
  }, [isLoading, error, aircraft, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const lastSeen = Number(window.localStorage.getItem(verificationNoticeKey) || 0);
    const thirtyDays = 1000 * 60 * 60 * 24 * 30;
    if (!lastSeen || Date.now() - lastSeen > thirtyDays) {
      setShowVerificationNotice(true);
    }
  }, []);

  // Track aircraft detail view
  useEffect(() => {
    if (!aircraft?.id) return;
    apiRequest("POST", `/api/aircraft/${aircraft.id}/view`, {}).catch(() => {
      // Silent fail
    });
    trackEvent("view_item", {
      item_id: aircraft.id,
      item_name: `${aircraft.year} ${aircraft.make} ${aircraft.model}`,
      item_category: "rental_aircraft",
      location: aircraft.location,
    });
  }, [aircraft?.id]);

  const handleVerificationNoticeClose = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(verificationNoticeKey, String(Date.now()));
    }
    setShowVerificationNotice(false);
  };

  // Rental request mutation
  const createRentalMutation = useMutation({
    mutationFn: async (rentalData: any) => {
      return await apiRequest("POST", "/api/rentals", rentalData);
    },
    onSuccess: (data: any) => {
      trackEvent("booking_request_created", {
        rental_id: data.id,
        aircraft_id: aircraft?.id,
      });
      // Redirect to payment page with the rental ID
      navigate(`/rental-payment/${data.id}`);
      toast({
        title: "Booking request created!",
        description: "Please complete payment to finalize your booking.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Booking request failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleRequestBooking = () => {
    if (!isAuthenticated || !user) {
      setLoginPromptOpen(true);
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: "Missing information",
        description: "Please select start and end dates.",
        variant: "destructive",
      });
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast({
        title: "Invalid dates",
        description: "End date must be on or after start date.",
        variant: "destructive",
      });
      return;
    }

    if (!estimatedHours || parseFloat(estimatedHours) <= 0) {
      toast({
        title: "Invalid flight hours",
        description: "Please enter estimated flight hours.",
        variant: "destructive",
      });
      return;
    }

    // Show best practices dialog before proceeding
    setShowBestPractices(true);
  };

  const handleConfirmBooking = () => {
    if (!user) return; // Safety check
    
    // Calculate all pricing fields
    const hourlyRate = parseFloat(aircraft!.hourlyRate);
    const hours = parseFloat(estimatedHours);
    const baseCost = hours * hourlyRate;
    const salesTax = baseCost * 0.0825; // 8.25%
    const platformFeeRenter = baseCost * 0.075; // 7.5% renter fee
    const platformFeeOwner = baseCost * 0.075; // 7.5% owner fee
    const subtotal = baseCost + salesTax + platformFeeRenter;
    const processingFee = subtotal * 0.03; // 3%
    const totalCostRenter = subtotal + processingFee;
    const ownerPayout = baseCost - platformFeeOwner;

    trackEvent("begin_checkout", {
      item_id: aircraft!.id,
      item_name: `${aircraft!.year} ${aircraft!.make} ${aircraft!.model}`,
      item_category: "rental_aircraft",
      value: Number(totalCostRenter.toFixed(2)),
      currency: "USD",
    });

    createRentalMutation.mutate({
      aircraftId: aircraft!.id,
      renterId: user.id,
      ownerId: aircraft!.ownerId,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      estimatedHours: estimatedHours,
      hourlyRate: aircraft!.hourlyRate,
      baseCost: baseCost.toFixed(2),
      salesTax: salesTax.toFixed(2),
      platformFeeRenter: platformFeeRenter.toFixed(2),
      platformFeeOwner: platformFeeOwner.toFixed(2),
      processingFee: processingFee.toFixed(2),
      totalCostRenter: totalCostRenter.toFixed(2),
      ownerPayout: ownerPayout.toFixed(2),
    });
    
    setShowBestPractices(false);
  };

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
  const salesTax = baseCost * 0.0825; // 8.25% sales tax
  const platformFee = baseCost * 0.075; // 7.5% platform fee
  const subtotal = baseCost + salesTax + platformFee;
  const processingFee = subtotal * 0.03; // 3% processing fee
  const total = subtotal + processingFee;

  // Ensure we always have at least one image (fallback if none uploaded)
  const displayImages = aircraft.images && aircraft.images.length > 0 
    ? aircraft.images 
    : ["https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=1200"];

  return (
    <div className="min-h-screen bg-background">
      <AlertDialog
        open={showVerificationNotice}
        onOpenChange={(open) => {
          if (!open) {
            handleVerificationNoticeClose();
          } else {
            setShowVerificationNotice(true);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verification required for rentals</AlertDialogTitle>
            <AlertDialogDescription>
              To keep Ready Set Fly safe and fraud-resistant, renters and owners must complete ID,
              pilot certificate, and insurance verification (when applicable). This protects both
              parties and helps speed up approvals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleVerificationNoticeClose}>Got it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleVerificationNoticeClose();
                navigate("/verify-identity");
              }}
            >
              Start Verification
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Image Gallery Carousel */}
      <section className="container mx-auto px-4 py-8">
        <div className="relative mb-6">
          <Carousel className="w-full">
            <CarouselContent>
              {displayImages.map((img, idx) => (
                <CarouselItem key={idx}>
                  <div className="aspect-[16/9] rounded-xl overflow-hidden bg-muted">
                    <img
                      src={img}
                      alt={`${aircraft.year} ${aircraft.make} ${aircraft.model} - Image ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {displayImages.length > 1 && (
              <>
                <CarouselPrevious className="left-4" data-testid="button-carousel-prev" />
                <CarouselNext className="right-4" data-testid="button-carousel-next" />
              </>
            )}
          </Carousel>
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
                <Eye className="h-4 w-4" />
                <span>{aircraft.viewCount || 0} views</span>
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
            <FavoriteButton 
              listingId={aircraft.id} 
              listingType="aircraft"
              variant="outline"
            />
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
                  {aircraft.minFlightHours && aircraft.minFlightHours > 0 && (
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
            {isAuthenticated && mockActiveRental && (
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
                    <AvatarImage src={owner?.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {owner?.firstName?.[0]}{owner?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1" data-testid="text-owner-name">
                      {owner?.firstName} {owner?.lastName}
                    </h3>
                    <div className="flex flex-col gap-2">
                      {owner?.averageRating && owner.totalReviews && owner.totalReviews > 0 && (
                        <StarRating 
                          rating={parseFloat(owner.averageRating)} 
                          totalReviews={owner.totalReviews || 0}
                          size="sm"
                        />
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Response time: {aircraft.responseTime}h</span>
                        <span>Acceptance rate: {aircraft.acceptanceRate}%</span>
                        {owner?.isVerified && (
                          <Badge className="bg-chart-2 text-white">Verified</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    data-testid="button-message-owner"
                    onClick={() => {
                      if (!isAuthenticated) {
                        setLoginPromptOpen(true);
                        return;
                      }
                    }}
                  >
                    Message Owner
                  </Button>
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
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
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
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || undefined}
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
                    <span className="text-muted-foreground">Sales tax (8.25%)</span>
                    <span data-testid="text-sales-tax">${salesTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform fee (7.5%)</span>
                    <span data-testid="text-platform-fee">${platformFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span data-testid="text-subtotal">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processing fee (3%)</span>
                    <span data-testid="text-processing-fee">${processingFee.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span data-testid="text-total-cost">${total.toFixed(2)}</span>
                </div>

                <Button 
                  className="w-full bg-accent text-accent-foreground hover:bg-accent" 
                  size="lg" 
                  onClick={handleRequestBooking}
                  disabled={createRentalMutation.isPending}
                  data-testid="button-request-booking"
                >
                  {createRentalMutation.isPending ? "Sending request..." : "Request to Book"}
                </Button>

                {/* Logbook Integration Hint */}
                {isAuthenticated && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-900 font-semibold mb-1">
                      ✈️ Don't forget to log your flight!
                    </p>
                    <p className="text-xs text-blue-700">
                      After your rental, visit your <a href="/logbook" className="underline font-semibold">digital logbook</a> to record flight time.
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  You won't be charged yet
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Login Prompt Dialog */}
      <AlertDialog open={loginPromptOpen} onOpenChange={setLoginPromptOpen}>
        <AlertDialogContent data-testid="dialog-login-prompt">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign in to continue</AlertDialogTitle>
            <AlertDialogDescription>
              You need to create an account or sign in to message owners and request rentals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-login">Continue Browsing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => window.location.href = apiUrl('/api/auth/google')}
              data-testid="button-go-login"
            >
              Sign In / Create Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rental Best Practices Dialog */}
      <AlertDialog open={showBestPractices} onOpenChange={setShowBestPractices}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Aircraft Rental Best Practices
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-4 pt-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Advance Notice Requirements</h4>
                  <p className="text-sm text-muted-foreground">
                    We recommend booking aircraft rentals <strong>3-5 days in advance</strong> to ensure 
                    availability and give aircraft owners adequate time to prepare the aircraft for your flight. 
                    Last-minute bookings may be subject to owner approval and availability.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground mb-2">Weather Policy & Disclaimer</h4>
                  <p className="text-sm text-muted-foreground">
                    <strong>Important:</strong> Ready Set Fly is not responsible for weather or weather-related 
                    cancellations. <strong>No refunds will be issued for weather-related cancellations.</strong> 
                    We strongly recommend checking weather forecasts 24-48 hours before your scheduled flight 
                    and coordinating with the aircraft owner. Always prioritize safety and follow all FAA regulations 
                    when making go/no-go decisions.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground mb-2">Communication</h4>
                  <p className="text-sm text-muted-foreground">
                    Please maintain open communication with the aircraft owner regarding your flight plans, 
                    any changes to your schedule, and any concerns you may have. The owner may require a 
                    pre-flight briefing or checkout depending on the aircraft and your experience level.
                  </p>
                </div>
              </div>

              <div className="bg-muted p-3 rounded-lg mt-4">
                <p className="text-xs text-muted-foreground">
                  By continuing, you acknowledge that you understand these best practices and will communicate 
                  with the aircraft owner regarding any questions or concerns.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-booking">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmBooking}
              className="bg-accent text-accent-foreground hover:bg-accent"
              data-testid="button-confirm-booking"
            >
              I Understand - Continue to Book
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
