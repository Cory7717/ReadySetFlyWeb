import { useQuery, useMutation } from "@tanstack/react-query";
import { X, MapPin, Mail, Phone, Calendar, DollarSign, Briefcase, Plane, Award, Wrench, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { MarketplaceListing } from "@shared/schema";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { formatPrice, formatPhoneNumber } from "@/lib/formatters";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface MarketplaceListingModalProps {
  listingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryIcons: Record<string, any> = {
  "aircraft-sale": Plane,
  "job": Briefcase,
  "cfi": Award,
  "flight-school": Building2,
  "mechanic": Wrench,
  "charter": Plane,
};

const categoryLabels: Record<string, string> = {
  "aircraft-sale": "Aircraft For Sale",
  "charter": "Charter Services",
  "cfi": "CFI Services",
  "flight-school": "Flight School",
  "mechanic": "A&P Mechanic",
  "job": "Job Opening",
};

export function MarketplaceListingModal({ listingId, open, onOpenChange }: MarketplaceListingModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: listing, isLoading } = useQuery<MarketplaceListing>({
    queryKey: ["/api/marketplace", listingId],
    enabled: open && !!listingId,
  });

  const deleteListingMutation = useMutation({
    mutationFn: async (listingId: string) => {
      return await apiRequest("DELETE", `/api/marketplace/${listingId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Listing Deleted",
        description: "The marketplace listing has been permanently deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteListing = () => {
    if (!listing) return;
    if (!confirm(`Are you sure you want to permanently delete this ${categoryLabels[listing.category]} listing (${listing.title})? This action cannot be undone.`)) {
      return;
    }
    deleteListingMutation.mutate(listing.id);
  };

  if (!listing && !isLoading) return null;

  const Icon = listing ? categoryIcons[listing.category] : Plane;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="modal-marketplace-listing">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : listing ? (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="capitalize" data-testid="badge-category">
                      {categoryLabels[listing.category]}
                    </Badge>
                    {listing.tier && (
                      <Badge variant="outline" className="capitalize">
                        {listing.tier} Tier
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="font-display text-3xl pr-8">
                    {listing.title}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    {categoryLabels[listing.category]} listing for {listing.title}
                  </DialogDescription>
                  {listing.location && (
                    <div className="flex items-center gap-2 text-muted-foreground mt-2">
                      <MapPin className="h-4 w-4" />
                      <span>{listing.location}</span>
                    </div>
                  )}
                </div>
                {listing.price && (
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary">
                      ${parseFloat(listing.price).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </DialogHeader>

            {/* Image Gallery */}
            {listing.images && listing.images.length > 0 && (
              <div className="relative">
                <Carousel className="w-full">
                  <CarouselContent>
                    {listing.images.map((img, idx) => (
                      <CarouselItem key={idx}>
                        <div className="aspect-video rounded-xl overflow-hidden bg-muted">
                          <img
                            src={img}
                            alt={`${listing.title} - Image ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {listing.images.length > 1 && (
                    <>
                      <CarouselPrevious className="left-4" />
                      <CarouselNext className="right-4" />
                    </>
                  )}
                </Carousel>
              </div>
            )}

            {/* Description */}
            <div>
              <h3 className="font-display text-xl font-semibold mb-3">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
            </div>

            <Separator />

            {/* Category-Specific Details */}
            {listing.details && (
              <div className="space-y-6">
                <h3 className="font-display text-xl font-semibold">Details</h3>

                {/* Aircraft Sale Details */}
                {listing.category === "aircraft-sale" && (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-lg">Aircraft Information</h4>
                      {(listing.details as any).make && (
                        <div>
                          <p className="text-sm text-muted-foreground">Make</p>
                          <p className="font-medium">{(listing.details as any).make}</p>
                        </div>
                      )}
                      {(listing.details as any).model && (
                        <div>
                          <p className="text-sm text-muted-foreground">Model</p>
                          <p className="font-medium">{(listing.details as any).model}</p>
                        </div>
                      )}
                      {(listing.details as any).year && (
                        <div>
                          <p className="text-sm text-muted-foreground">Year</p>
                          <p className="font-medium">{(listing.details as any).year}</p>
                        </div>
                      )}
                      {(listing.details as any).registration && (
                        <div>
                          <p className="text-sm text-muted-foreground">Registration</p>
                          <p className="font-medium">{(listing.details as any).registration}</p>
                        </div>
                      )}
                      {(listing.details as any).seats && (
                        <div>
                          <p className="text-sm text-muted-foreground">Seats</p>
                          <p className="font-medium">{(listing.details as any).seats}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold text-lg">Specifications</h4>
                      {(listing.details as any).totalTime && (
                        <div>
                          <p className="text-sm text-muted-foreground">Total Time</p>
                          <p className="font-medium">{(listing.details as any).totalTime} hours</p>
                        </div>
                      )}
                      {(listing.details as any).engineTime && (
                        <div>
                          <p className="text-sm text-muted-foreground">Engine Time</p>
                          <p className="font-medium">{(listing.details as any).engineTime} hours</p>
                        </div>
                      )}
                      {(listing.details as any).usefulLoad && (
                        <div>
                          <p className="text-sm text-muted-foreground">Useful Load</p>
                          <p className="font-medium">{(listing.details as any).usefulLoad} lbs</p>
                        </div>
                      )}
                      {(listing.details as any).annualDue && (
                        <div>
                          <p className="text-sm text-muted-foreground">Annual Due</p>
                          <p className="font-medium">{(listing.details as any).annualDue}</p>
                        </div>
                      )}
                    </div>

                    {(listing.details as any).avionics && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">Avionics Package</p>
                        <p className="font-medium">{(listing.details as any).avionics}</p>
                      </div>
                    )}

                    {((listing.details as any).interiorCondition || (listing.details as any).exteriorCondition) && (
                      <div className="md:col-span-2 grid md:grid-cols-2 gap-4">
                        {(listing.details as any).interiorCondition && (
                          <div>
                            <p className="text-sm text-muted-foreground">Interior Condition</p>
                            <Badge variant="outline" className="capitalize mt-1">
                              {(listing.details as any).interiorCondition}
                            </Badge>
                          </div>
                        )}
                        {(listing.details as any).exteriorCondition && (
                          <div>
                            <p className="text-sm text-muted-foreground">Exterior/Paint Condition</p>
                            <Badge variant="outline" className="capitalize mt-1">
                              {(listing.details as any).exteriorCondition}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}

                    {(listing.details as any).damageHistory && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">Damage History</p>
                        <p className="font-medium">{(listing.details as any).damageHistory}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Job Details */}
                {listing.category === "job" && (
                  <div className="grid md:grid-cols-2 gap-6">
                    {(listing.details as any).jobTitle && (
                      <div>
                        <p className="text-sm text-muted-foreground">Position</p>
                        <p className="font-medium">{(listing.details as any).jobTitle}</p>
                      </div>
                    )}
                    {(listing.details as any).company && (
                      <div>
                        <p className="text-sm text-muted-foreground">Company</p>
                        <p className="font-medium">{(listing.details as any).company}</p>
                      </div>
                    )}
                    {(listing.details as any).employmentType && (
                      <div>
                        <p className="text-sm text-muted-foreground">Employment Type</p>
                        <Badge variant="outline" className="capitalize mt-1">
                          {(listing.details as any).employmentType}
                        </Badge>
                      </div>
                    )}
                    {(listing.details as any).salaryRange && (
                      <div>
                        <p className="text-sm text-muted-foreground">Salary Range</p>
                        <p className="font-medium">{(listing.details as any).salaryRange}</p>
                      </div>
                    )}
                    {(listing.details as any).requirements && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">Requirements</p>
                        <p className="font-medium whitespace-pre-wrap">{(listing.details as any).requirements}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* CFI Details */}
                {listing.category === "cfi" && (
                  <div className="grid md:grid-cols-2 gap-6">
                    {(listing.details as any).instructorName && (
                      <div>
                        <p className="text-sm text-muted-foreground">Instructor Name</p>
                        <p className="font-medium">{(listing.details as any).instructorName}</p>
                      </div>
                    )}
                    {(listing.details as any).hourlyRate && (
                      <div>
                        <p className="text-sm text-muted-foreground">Hourly Rate</p>
                        <p className="font-medium">${(listing.details as any).hourlyRate}/hr</p>
                      </div>
                    )}
                    {(listing.details as any).certifications && (listing.details as any).certifications.length > 0 && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground mb-2">Certifications</p>
                        <div className="flex flex-wrap gap-2">
                          {(listing.details as any).certifications.map((cert: string, idx: number) => (
                            <Badge key={idx} variant="secondary">{cert}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {(listing.details as any).specialties && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">Specialties</p>
                        <p className="font-medium">{(listing.details as any).specialties}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Flight School Details */}
                {listing.category === "flight-school" && (
                  <div className="grid md:grid-cols-2 gap-6">
                    {(listing.details as any).schoolName && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground">School Name</p>
                        <p className="font-medium text-lg">{(listing.details as any).schoolName}</p>
                      </div>
                    )}
                    {(listing.details as any).aircraftFleet && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">Aircraft Fleet</p>
                        <p className="font-medium">{(listing.details as any).aircraftFleet}</p>
                      </div>
                    )}
                    {(listing.details as any).programsOffered && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">Programs Offered</p>
                        <p className="font-medium whitespace-pre-wrap">{(listing.details as any).programsOffered}</p>
                      </div>
                    )}
                    {(listing.details as any).pricingInfo && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">Pricing</p>
                        <p className="font-medium">{(listing.details as any).pricingInfo}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Mechanic Details */}
                {listing.category === "mechanic" && (
                  <div className="grid md:grid-cols-2 gap-6">
                    {(listing.details as any).businessName && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground">Business Name</p>
                        <p className="font-medium text-lg">{(listing.details as any).businessName}</p>
                      </div>
                    )}
                    {(listing.details as any).specialties && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">Specialties</p>
                        <p className="font-medium">{(listing.details as any).specialties}</p>
                      </div>
                    )}
                    {(listing.details as any).serviceArea && (
                      <div>
                        <p className="text-sm text-muted-foreground">Service Area</p>
                        <p className="font-medium">{(listing.details as any).serviceArea}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Charter Details */}
                {listing.category === "charter" && (
                  <div className="grid md:grid-cols-2 gap-6">
                    {(listing.details as any).companyName && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground">Company Name</p>
                        <p className="font-medium text-lg">{(listing.details as any).companyName}</p>
                      </div>
                    )}
                    {(listing.details as any).aircraftAvailable && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">Aircraft Available</p>
                        <p className="font-medium">{(listing.details as any).aircraftAvailable}</p>
                      </div>
                    )}
                    {(listing.details as any).serviceArea && (
                      <div>
                        <p className="text-sm text-muted-foreground">Service Area</p>
                        <p className="font-medium">{(listing.details as any).serviceArea}</p>
                      </div>
                    )}
                    {(listing.details as any).pricingStructure && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">Pricing Structure</p>
                        <p className="font-medium">{(listing.details as any).pricingStructure}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Contact Information */}
            <div>
              <h3 className="font-display text-xl font-semibold mb-4">Contact Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {listing.contactEmail && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <a href={`mailto:${listing.contactEmail}`} className="font-medium hover:text-primary">
                        {listing.contactEmail}
                      </a>
                    </div>
                  </div>
                )}
                {listing.contactPhone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <a href={`tel:${listing.contactPhone}`} className="font-medium hover:text-primary">
                        {formatPhoneNumber(listing.contactPhone)}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              {listing.contactEmail && (
                <Button
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent"
                  onClick={() => {
                    const subject = listing.category === "job" 
                      ? `Application: ${listing.title}`
                      : undefined;
                    const mailtoLink = subject 
                      ? `mailto:${listing.contactEmail}?subject=${encodeURIComponent(subject)}`
                      : `mailto:${listing.contactEmail}`;
                    window.location.href = mailtoLink;
                  }}
                  data-testid={listing.category === "job" ? "button-apply" : "button-contact-seller"}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {listing.category === "job" ? "Apply" : "Contact Seller"}
                </Button>
              )}
              {listing.contactPhone && (
                <Button
                  variant="outline"
                  onClick={() => window.location.href = `tel:${listing.contactPhone}`}
                  data-testid="button-call-seller"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
              )}
            </div>

            {/* Admin Actions */}
            {user?.isAdmin && (
              <div className="border-t pt-4 mt-6">
                <h3 className="font-display text-lg font-semibold mb-3 text-destructive">Admin Actions</h3>
                <Button
                  variant="destructive"
                  onClick={handleDeleteListing}
                  disabled={deleteListingMutation.isPending}
                  data-testid="button-delete-listing"
                >
                  {deleteListingMutation.isPending ? "Deleting..." : "Delete Marketplace Listing"}
                </Button>
              </div>
            )}

          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
