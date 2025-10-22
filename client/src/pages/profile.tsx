import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import { Shield, Award, Plane, Clock, CheckCircle2, Edit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { VerificationBadges } from "@/components/verification-badges";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const certifications = [
  { name: "PPL", date: "Jun 2015", verified: true },
  { name: "IR", date: "Mar 2016", verified: true },
  { name: "CPL", date: "Nov 2017", verified: true },
  { name: "Multi-Engine", date: "Feb 2018", verified: true },
];

const aircraftTypes = [
  "Cessna 172", "Cessna 182", "Piper Cherokee", "Cirrus SR22", "Diamond DA40"
];

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  
  // Fetch full user data
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/users", authUser?.id],
    enabled: !!authUser?.id,
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (updates: Partial<User>) => {
      return await apiRequest("PATCH", `/api/users/${authUser?.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", authUser?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    // In real app, would gather form data
    updateUserMutation.mutate({
      name: "John Smith",
      phone: "+1 (555) 123-4567",
      totalFlightHours: 2500,
    });
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Profile Header */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <Avatar className="h-24 w-24" data-testid="avatar-profile">
                <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200" />
                <AvatarFallback>JS</AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="font-display text-3xl font-bold mb-1" data-testid="text-profile-name">
                      {user.firstName} {user.lastName}
                    </h1>
                    <p className="text-muted-foreground mb-3">{user.email}</p>
                    
                    {/* Verification Badges */}
                    <VerificationBadges user={user} type="renter" size="md" />
                  </div>
                  <Dialog open={isEditing} onOpenChange={setIsEditing}>
                    <DialogTrigger asChild>
                      <Button variant="outline" data-testid="button-edit-profile">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Profile
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Profile</DialogTitle>
                        <DialogDescription>
                          Update your profile information
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <Input id="name" defaultValue="John Smith" data-testid="input-edit-name" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <Input id="phone" defaultValue="+1 (555) 123-4567" data-testid="input-edit-phone" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="hours">Total Flight Hours</Label>
                          <Input id="hours" type="number" defaultValue="2500" data-testid="input-edit-hours" />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsEditing(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={updateUserMutation.isPending} data-testid="button-save-profile">
                          {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Clock className="h-4 w-4" />
                      Total Hours
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-total-hours">2,500</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Award className="h-4 w-4" />
                      Certifications
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-cert-count">4</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Plane className="h-4 w-4" />
                      Rentals
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-rental-count">23</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Shield className="h-4 w-4" />
                      Verification
                    </div>
                    <Badge className="bg-chart-2 text-white">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-background">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-chart-2" />
                    ID Verified
                  </Badge>
                  <Badge variant="outline" className="bg-background">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-chart-2" />
                    License Verified
                  </Badge>
                  <Badge variant="outline" className="bg-background">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-chart-2" />
                    Background Check
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="certifications" className="space-y-6">
          <TabsList data-testid="tabs-profile">
            <TabsTrigger value="certifications" data-testid="tab-certifications">Certifications</TabsTrigger>
            <TabsTrigger value="aircraft" data-testid="tab-aircraft-types">Aircraft Types</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-rental-history">Rental History</TabsTrigger>
            <TabsTrigger value="reviews" data-testid="tab-reviews">Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="certifications">
            <Card>
              <CardHeader>
                <CardTitle>Pilot Certifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {certifications.map((cert) => (
                    <div
                      key={cert.name}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                      data-testid={`cert-${cert.name}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Award className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{cert.name}</h3>
                          <p className="text-sm text-muted-foreground">Issued {cert.date}</p>
                        </div>
                      </div>
                      {cert.verified && (
                        <Badge className="bg-chart-2 text-white">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="aircraft">
            <Card>
              <CardHeader>
                <CardTitle>Aircraft Types Flown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {aircraftTypes.map((type) => (
                    <Badge key={type} variant="outline" className="px-4 py-2 text-sm" data-testid={`aircraft-type-${type}`}>
                      <Plane className="h-4 w-4 mr-2" />
                      {type}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Rental History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 border rounded-lg hover-elevate" data-testid={`rental-history-${i}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">2018 Cessna 172 Skyhawk</h4>
                          <p className="text-sm text-muted-foreground">Santa Monica, CA (SMO)</p>
                        </div>
                        <Badge className="bg-chart-2 text-white">Completed</Badge>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Dec 1-3, 2024 • 6 hours</span>
                        <span className="font-semibold">$870.00</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews">
            <Card>
              <CardHeader>
                <CardTitle>Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  No reviews yet
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
