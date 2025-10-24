import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { User, CertificationType } from "@shared/schema";
import { certificationTypes } from "@shared/schema";
import { Shield, Award, Plane, Clock, CheckCircle2, Edit, Upload, FileText } from "lucide-react";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const profileUpdateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  totalFlightHours: z.coerce.number().min(0).optional(),
  certifications: z.array(z.string()),
  pilotLicense: z.any().optional(),
  insurance: z.any().optional(),
});

type ProfileUpdateForm = z.infer<typeof profileUpdateSchema>;

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
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  
  // Fetch full user data
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/users", authUser?.id],
    enabled: !!authUser?.id,
  });

  const form = useForm<ProfileUpdateForm>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phone: user?.phone || "",
      totalFlightHours: user?.totalFlightHours || 0,
      certifications: user?.certifications || [],
    },
  });

  // Update form when user data loads
  if (user && !form.formState.isDirty) {
    form.reset({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      phone: user.phone || "",
      totalFlightHours: user.totalFlightHours || 0,
      certifications: user.certifications || [],
    });
  }

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: { updates: Partial<User>; files?: { license?: File; insurance?: File } }) => {
      let updates = { ...data.updates };

      // Upload documents if provided
      if (data.files?.license || data.files?.insurance) {
        setUploadingDocs(true);
        const formData = new FormData();
        if (data.files.license) formData.append('images', data.files.license);
        if (data.files.insurance) formData.append('images', data.files.insurance);

        try {
          const uploadRes = await fetch('/api/upload-images', {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });

          if (!uploadRes.ok) throw new Error('Failed to upload documents');
          
          const uploadData = await uploadRes.json();
          const urls = uploadData.imageUrls || [];

          let urlIndex = 0;
          if (data.files.license && urls[urlIndex]) {
            updates.pilotLicenseUrl = urls[urlIndex];
            urlIndex++;
          }
          if (data.files.insurance && urls[urlIndex]) {
            updates.insuranceUrl = urls[urlIndex];
          }
        } finally {
          setUploadingDocs(false);
        }
      }

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
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileUpdateForm) => {
    const updates: Partial<User> = {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      totalFlightHours: data.totalFlightHours,
      certifications: data.certifications,
    };

    const files: { license?: File; insurance?: File } = {};
    if (data.pilotLicense?.[0]) files.license = data.pilotLicense[0];
    if (data.insurance?.[0]) files.insurance = data.insurance[0];

    updateUserMutation.mutate({ updates, files });
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
                <AvatarFallback>
                  {user.firstName?.[0]}{user.lastName?.[0]}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <h1 className="font-display text-2xl sm:text-3xl font-bold mb-1" data-testid="text-profile-name">
                      {user.firstName} {user.lastName}
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground mb-3">{user.email}</p>
                    
                    {/* Verification Badges */}
                    <div className="flex gap-2 flex-wrap items-center">
                      <VerificationBadges user={user} type="renter" size="md" />
                      {!user.identityVerified && (
                        <Link href="/verify-identity">
                          <Button variant="outline" size="sm" className="w-full sm:w-auto" data-testid="button-start-verification">
                            <Shield className="h-4 w-4 mr-2" />
                            Start Verification
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                  <Dialog open={isEditing} onOpenChange={setIsEditing}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-auto" data-testid="button-edit-profile">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Profile
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Edit Profile</DialogTitle>
                        <DialogDescription>
                          Update your profile information, certifications, and documents
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="firstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>First Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-edit-firstname" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="lastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Last Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-edit-lastname" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="+1 (555) 123-4567" data-testid="input-edit-phone" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="totalFlightHours"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Total Flight Hours</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    data-testid="input-edit-hours"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="certifications"
                            render={() => (
                              <FormItem>
                                <div className="mb-4">
                                  <FormLabel>Pilot Certifications</FormLabel>
                                  <FormDescription>
                                    Select all certifications you hold
                                  </FormDescription>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  {certificationTypes.map((cert) => (
                                    <FormField
                                      key={cert}
                                      control={form.control}
                                      name="certifications"
                                      render={({ field }) => {
                                        return (
                                          <FormItem
                                            key={cert}
                                            className="flex flex-row items-start space-x-3 space-y-0"
                                          >
                                            <FormControl>
                                              <Checkbox
                                                checked={field.value?.includes(cert)}
                                                onCheckedChange={(checked) => {
                                                  return checked
                                                    ? field.onChange([...field.value, cert])
                                                    : field.onChange(
                                                        field.value?.filter(
                                                          (value) => value !== cert
                                                        )
                                                      )
                                                }}
                                                data-testid={`checkbox-cert-${cert}`}
                                              />
                                            </FormControl>
                                            <FormLabel className="font-normal cursor-pointer">
                                              {cert}
                                            </FormLabel>
                                          </FormItem>
                                        )
                                      }}
                                    />
                                  ))}
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="space-y-4 border-t pt-4">
                            <h3 className="font-semibold">Document Uploads</h3>
                            
                            <FormField
                              control={form.control}
                              name="pilotLicense"
                              render={({ field: { onChange, value, ...field } }) => (
                                <FormItem>
                                  <FormLabel>Pilot License</FormLabel>
                                  <FormControl>
                                    <div className="space-y-2">
                                      <Input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => onChange(e.target.files)}
                                        {...field}
                                        data-testid="input-pilot-license"
                                      />
                                      {user.pilotLicenseUrl && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <FileText className="h-4 w-4" />
                                          <a
                                            href={user.pilotLicenseUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:underline"
                                          >
                                            Current license on file
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  </FormControl>
                                  <FormDescription>
                                    Upload a copy of your pilot license (image or PDF)
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="insurance"
                              render={({ field: { onChange, value, ...field } }) => (
                                <FormItem>
                                  <FormLabel>Insurance Certificate</FormLabel>
                                  <FormControl>
                                    <div className="space-y-2">
                                      <Input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => onChange(e.target.files)}
                                        {...field}
                                        data-testid="input-insurance"
                                      />
                                      {user.insuranceUrl && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <FileText className="h-4 w-4" />
                                          <a
                                            href={user.insuranceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:underline"
                                          >
                                            Current insurance on file
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  </FormControl>
                                  <FormDescription>
                                    Upload a copy of your insurance certificate (image or PDF)
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="flex justify-end gap-2 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setIsEditing(false);
                                form.reset();
                              }}
                              disabled={updateUserMutation.isPending || uploadingDocs}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={updateUserMutation.isPending || uploadingDocs}
                              data-testid="button-save-profile"
                            >
                              {uploadingDocs ? (
                                <>
                                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                                  Uploading...
                                </>
                              ) : updateUserMutation.isPending ? (
                                "Saving..."
                              ) : (
                                "Save Changes"
                              )}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Clock className="h-4 w-4" />
                      Total Hours
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-total-hours">
                      {user.totalFlightHours?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Award className="h-4 w-4" />
                      Certifications
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-cert-count">
                      {user.certifications?.length || 0}
                    </p>
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
                    <Badge className={user.identityVerified ? "bg-chart-2 text-white" : ""}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {user.identityVerified ? "Verified" : "Unverified"}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {user.identityVerified && (
                    <Badge variant="outline" className="bg-background">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-chart-2" />
                      ID Verified
                    </Badge>
                  )}
                  {user.licenseVerified && (
                    <Badge variant="outline" className="bg-background">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-chart-2" />
                      License Verified
                    </Badge>
                  )}
                  {user.backgroundCheckCompleted && (
                    <Badge variant="outline" className="bg-background">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-chart-2" />
                      Background Check
                    </Badge>
                  )}
                  {user.pilotLicenseUrl && (
                    <Badge variant="outline" className="bg-background">
                      <FileText className="h-3 w-3 mr-1 text-primary" />
                      License on File
                    </Badge>
                  )}
                  {user.insuranceUrl && (
                    <Badge variant="outline" className="bg-background">
                      <FileText className="h-3 w-3 mr-1 text-primary" />
                      Insurance on File
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="certifications" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto" data-testid="tabs-profile">
            <TabsTrigger value="certifications" className="text-xs sm:text-sm" data-testid="tab-certifications">Certifications</TabsTrigger>
            <TabsTrigger value="aircraft" className="text-xs sm:text-sm" data-testid="tab-aircraft-types">Aircraft</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm" data-testid="tab-rental-history">History</TabsTrigger>
            <TabsTrigger value="reviews" className="text-xs sm:text-sm" data-testid="tab-reviews">Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="certifications">
            <Card>
              <CardHeader>
                <CardTitle>Pilot Certifications</CardTitle>
              </CardHeader>
              <CardContent>
                {user.certifications && user.certifications.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {user.certifications.map((cert) => (
                      <div
                        key={cert}
                        className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                        data-testid={`cert-${cert}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Award className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{cert}</h3>
                            <p className="text-sm text-muted-foreground">Pilot Certification</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No certifications added yet. Click "Edit Profile" to add certifications.
                  </div>
                )}
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
