import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, MapPin, Gauge, Shield, Calendar, DollarSign, Plane, Star, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AircraftListing } from "@shared/schema";
import { VerificationBadges } from "./verification-badges";
import { Link } from "wouter";

interface AircraftDetailModalProps {
  aircraftId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AircraftDetailModal({ aircraftId, open, onOpenChange }: AircraftDetailModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    estimatedHours: "",
    message: "",
  });

  const { data: aircraft, isLoading } = useQuery<AircraftListing>({
    queryKey: ["/api/aircraft", aircraftId],
    enabled: open,
  });

  // Populate admin notes when aircraft data loads
  useEffect(() => {
    if (aircraft?.adminNotes) {
      setAdminNotes(aircraft.adminNotes);
    } else if (aircraft) {
      setAdminNotes("");
    }
  }, [aircraft?.id, aircraft?.adminNotes]);

  const requestRentalMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!aircraft) return;
      
      return await apiRequest("POST", "/api/rentals", {
        aircraftId: aircraft.id,
        ownerId: aircraft.ownerId,
        ...data,
        hourlyRate: aircraft.hourlyRate,
      });
    },
    onSuccess: () => {
      toast({
        title: "Rental Request Sent",
        description: "The aircraft owner will review your request and respond shortly.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rentals"] });
      setShowRequestForm(false);
      setFormData({ startDate: "", endDate: "", estimatedHours: "", message: "" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAircraftMutation = useMutation({
    mutationFn: async (aircraftId: string) => {
      return await apiRequest("DELETE", `/api/aircraft/${aircraftId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Aircraft Deleted",
        description: "The aircraft listing has been permanently deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/aircraft"] });
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

  const updateAircraftAdminMutation = useMutation({
    mutationFn: async (updates: any) => {
      return await apiRequest("PATCH", `/api/admin/aircraft/${aircraftId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aircraft", aircraftId] });
      queryClient.invalidateQueries({ queryKey: ["/api/aircraft"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Aircraft Updated",
        description: "Aircraft listing has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteAircraft = () => {
    if (!aircraft) return;
    if (!confirm(`Are you sure you want to permanently delete this aircraft listing (${aircraft.year} ${aircraft.make} ${aircraft.model})? This action cannot be undone.`)) {
      return;
    }
    deleteAircraftMutation.mutate(aircraft.id);
  };

  const handleToggleActive = () => {
    if (!aircraft) return;
    updateAircraftAdminMutation.mutate({ isListed: !aircraft.isListed });
  };

  const handleToggleFeatured = () => {
    if (!aircraft) return;
    updateAircraftAdminMutation.mutate({ isFeatured: !aircraft.isFeatured });
  };

  const handleSaveNotes = () => {
    updateAircraftAdminMutation.mutate({ adminNotes });
  };

  if (!aircraft && !isLoading) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="modal-aircraft-detail">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : aircraft ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-3xl">
                {aircraft.year} {aircraft.make} {aircraft.model}
              </DialogTitle>
            </DialogHeader>

            {/* Image Gallery */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 aspect-video rounded-xl overflow-hidden">
                <img
                  src={aircraft.images[0] || "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=1200"}
                  alt={`${aircraft.make} ${aircraft.model}`}
                  className="w-full h-full object-cover"
                />
              </div>
              {aircraft.images.slice(1, 5).map((img, idx) => (
                <div key={idx} className="aspect-video rounded-xl overflow-hidden">
                  <img src={img} alt={`View ${idx + 2}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            {/* Price & Quick Info */}
            <div className="flex items-center justify-between border-t border-b py-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">${aircraft.hourlyRate}</span>
                  <span className="text-muted-foreground">/hour</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{aircraft.location}</Badge>
                  {aircraft.airportCode && <Badge variant="outline">{aircraft.airportCode}</Badge>}
                </div>
              </div>
              
              {!showRequestForm && (
                <Button
                  size="lg"
                  className="bg-accent text-accent-foreground hover:bg-accent"
                  onClick={() => {
                    if (!user) {
                      setLoginPromptOpen(true);
                      return;
                    }
                    if (user.id === aircraft.ownerId) {
                      return; // Owner can't rent their own aircraft
                    }
                    setShowRequestForm(true);
                  }}
                  disabled={user?.id === aircraft.ownerId}
                  data-testid="button-request-rental"
                >
                  <Calendar className="h-5 w-5 mr-2" />
                  Request to Rent
                </Button>
              )}
            </div>

            {/* Rental Request Form */}
            {showRequestForm && (
              <div className="bg-muted/50 p-6 rounded-xl space-y-4">
                <h3 className="font-display text-xl font-semibold">Request Rental</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="estimatedHours">Estimated Flight Hours</Label>
                  <Input
                    id="estimatedHours"
                    type="number"
                    step="0.1"
                    placeholder="5.0"
                    value={formData.estimatedHours}
                    onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                    data-testid="input-estimated-hours"
                  />
                </div>

                <div>
                  <Label htmlFor="message">Message to Owner (Optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Tell the owner about your flight plans..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={3}
                    data-testid="textarea-message"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={() => requestRentalMutation.mutate(formData)}
                    disabled={!formData.startDate || !formData.endDate || !formData.estimatedHours || requestRentalMutation.isPending}
                    data-testid="button-submit-request"
                  >
                    {requestRentalMutation.isPending ? "Sending..." : "Send Request"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowRequestForm(false)}
                    data-testid="button-cancel-request"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Aircraft Details */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-display text-xl font-semibold">Aircraft Specifications</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Gauge className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Total Time</p>
                      <p className="text-sm text-muted-foreground">{aircraft.totalTime.toLocaleString()} hours</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Plane className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Registration</p>
                      <p className="text-sm text-muted-foreground">{aircraft.registration}</p>
                    </div>
                  </div>

                  {aircraft.avionicsSuite && (
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Avionics</p>
                        <p className="text-sm text-muted-foreground">{aircraft.avionicsSuite}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Insurance</p>
                      <p className="text-sm text-muted-foreground">
                        {aircraft.insuranceIncluded ? "Included in hourly rate" : "Not included"}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="font-medium mb-2">Required Certifications</p>
                  <div className="flex flex-wrap gap-2">
                    {aircraft.requiredCertifications.map((cert) => (
                      <Badge key={cert} className="bg-chart-2 text-white">
                        {cert}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-display text-xl font-semibold">Owner Information</h3>
                
                <div className="space-y-3">
                  <div>
                    <p className="font-medium mb-2">Verification Status</p>
                    <VerificationBadges
                      user={undefined}
                      aircraft={aircraft}
                      type="owner"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Response Time</p>
                      <p className="text-lg font-semibold">{aircraft.responseTime || 24}h</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Acceptance Rate</p>
                      <p className="text-lg font-semibold">{aircraft.acceptanceRate || 95}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {aircraft.description && (
              <div>
                <h3 className="font-display text-xl font-semibold mb-3">Description</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{aircraft.description}</p>
              </div>
            )}

            {/* Admin Actions */}
            {user?.isAdmin && (
              <div className="border-t pt-6 mt-6 space-y-6">
                <h3 className="font-display text-lg font-semibold">Admin Actions</h3>
                
                {/* Quick Actions */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Toggle Active */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="font-semibold">Listing Status</Label>
                      <p className="text-sm text-muted-foreground">
                        {aircraft.isListed ? "Active - visible to renters" : "Inactive - hidden from search"}
                      </p>
                    </div>
                    <Switch
                      checked={aircraft.isListed || false}
                      onCheckedChange={handleToggleActive}
                      disabled={updateAircraftAdminMutation.isPending}
                      data-testid="switch-aircraft-active"
                    />
                  </div>

                  {/* Toggle Featured */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="font-semibold">Featured/Boosted</Label>
                      <p className="text-sm text-muted-foreground">
                        {aircraft.isFeatured ? "Featured - shown at top" : "Normal priority"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {aircraft.isFeatured && <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />}
                      <Switch
                        checked={aircraft.isFeatured || false}
                        onCheckedChange={handleToggleFeatured}
                        disabled={updateAircraftAdminMutation.isPending}
                        data-testid="switch-aircraft-featured"
                      />
                    </div>
                  </div>
                </div>

                {/* Admin Notes */}
                <div className="space-y-3">
                  <Label className="font-semibold">Admin Notes (Internal Only)</Label>
                  <Textarea
                    placeholder="Add internal notes about this listing, fraud investigations, user support tickets, etc."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={4}
                    data-testid="textarea-admin-notes"
                  />
                  <Button
                    onClick={handleSaveNotes}
                    disabled={updateAircraftAdminMutation.isPending}
                    data-testid="button-save-notes"
                    size="sm"
                  >
                    Save Notes
                  </Button>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 flex-wrap">
                  <Link href={`/dashboard/aircraft/${aircraft.id}/edit`}>
                    <Button variant="outline" data-testid="button-edit-aircraft">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Listing
                    </Button>
                  </Link>
                  
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAircraft}
                    disabled={deleteAircraftMutation.isPending}
                    data-testid="button-delete-aircraft"
                  >
                    {deleteAircraftMutation.isPending ? "Deleting..." : "Delete Listing"}
                  </Button>
                </div>
              </div>
            )}

          </>
        ) : null}
      </DialogContent>
    </Dialog>

    {/* Login Prompt Dialog */}
    <AlertDialog open={loginPromptOpen} onOpenChange={setLoginPromptOpen}>
      <AlertDialogContent data-testid="dialog-login-prompt">
        <AlertDialogHeader>
          <AlertDialogTitle>Sign in to continue</AlertDialogTitle>
          <AlertDialogDescription>
            You need to create an account or sign in to request aircraft rentals and interact with owners.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-login">Continue Browsing</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-go-login"
          >
            Sign In / Create Account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
