import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Upload, X, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const listingSchema = z.object({
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.coerce.number().min(1900).max(new Date().getFullYear() + 1),
  registration: z.string().min(1, "Registration is required"),
  category: z.string().min(1, "Category is required"),
  totalTime: z.coerce.number().min(0),
  engine: z.string().optional(),
  avionics: z.string().optional(),
  hourlyRate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid price (e.g., 150 or 150.50)").min(1, "Hourly rate is required"),
  location: z.string().min(1, "Location is required"),
  airportCode: z.string().optional(),
  description: z.string().min(20, "Description must be at least 20 characters"),
  insuranceIncluded: z.boolean().default(true),
  wetRate: z.boolean().default(true),
  minFlightHours: z.coerce.number().min(0).default(0),
  // Owner/Aircraft Verification Fields
  serialNumber: z.string().min(1, "Serial number is required"),
  annualInspectionDate: z.string().optional(),
  annualSignerName: z.string().optional(),
  annualSignerCertNumber: z.string().optional(),
  requires100Hour: z.boolean().default(false),
  currentTach: z.coerce.number().optional(),
  hour100InspectionTach: z.coerce.number().optional(),
  maintenanceTrackingProvider: z.string().optional(),
});

type ListingFormData = z.infer<typeof listingSchema>;

export default function ListAircraft() {
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>(["PPL"]);
  const [verificationDocs, setVerificationDocs] = useState<{
    registrationDoc: File | null;
    llcAuthorization: File | null;
    annualInspectionDoc: File | null;
    hour100InspectionDoc: File | null;
    maintenanceTrackingDoc: File | null;
  }>({
    registrationDoc: null,
    llcAuthorization: null,
    annualInspectionDoc: null,
    hour100InspectionDoc: null,
    maintenanceTrackingDoc: null,
  });
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user} = useAuth();

  const form = useForm<ListingFormData>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      insuranceIncluded: true,
      wetRate: true,
      minFlightHours: 0,
      requires100Hour: false,
    },
  });

  const createListingMutation = useMutation({
    mutationFn: async ({ formData, hasFiles }: { formData: any; hasFiles: boolean }) => {
      if (hasFiles) {
        // Use fetch for FormData (multipart/form-data)
        const response = await fetch("/api/aircraft", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Submission failed");
        }
        return await response.json();
      } else {
        // Use apiRequest for JSON
        return await apiRequest("POST", "/api/aircraft", formData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aircraft"] });
      toast({
        title: "Aircraft Listed",
        description: "Your aircraft has been successfully listed.",
      });
      navigate("/dashboard");
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      // Handle 403 verification error
      if (error.message.includes("403") || error.message.includes("verification")) {
        toast({
          title: "Verification Required",
          description: "Please complete account verification to list aircraft.",
          variant: "destructive",
        });
        setTimeout(() => {
          navigate("/profile");
        }, 1000);
        return;
      }
      
      toast({
        title: "Error",
        description: error.message || "Failed to list aircraft",
        variant: "destructive",
      });
    },
  });

  const generateDescriptionMutation = useMutation({
    mutationFn: async (details: any) => {
      const response = await apiRequest("POST", "/api/generate-description", {
        listingType: "aircraft-rental",
        details,
      });
      const result = await response.json() as { description: string };
      console.log("AI Response received:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("Setting description to:", data.description);
      form.setValue("description", data.description, { shouldValidate: true, shouldDirty: true });
      toast({
        title: "Description Generated",
        description: "AI-generated description added. Feel free to customize it!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Could not generate description",
        variant: "destructive",
      });
    },
  });

  const handleGenerateDescription = () => {
    const values = form.getValues();
    
    // Check if we have enough information to generate a description
    if (!values.make || !values.model) {
      toast({
        title: "More Information Needed",
        description: "Please fill in at least the Make and Model to generate a description.",
        variant: "destructive",
      });
      return;
    }

    generateDescriptionMutation.mutate({
      make: values.make,
      model: values.model,
      year: values.year,
      category: values.category,
      engine: values.engine,
      avionics: values.avionics,
      totalTime: values.totalTime,
      location: values.location,
    });
  };

  const onSubmit = (data: ListingFormData) => {
    console.log("Form submitted with data:", data);
    console.log("Form errors:", form.formState.errors);
    
    // Note: Backend middleware enforces verification requirement
    // Frontend check removed to avoid UX issues with cached user data
    
    // Check if verification documents are provided
    const hasVerificationDocs = Object.values(verificationDocs).some(doc => doc !== null);
    
    // Convert preview URLs to placeholder URLs for storage
    // Once cloud storage is integrated, this will upload actual files
    const placeholderImages = imageFiles.length > 0 
      ? imageFiles.map((_, idx) => `https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=800&auto=format&fit=crop&q=60&idx=${idx}`)
      : ["https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=800"];
    
    const listingPayload = {
      ...data,
      requiredCertifications: selectedCertifications,
      images: placeholderImages,
    };
    
    if (hasVerificationDocs) {
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('listingData', JSON.stringify(listingPayload));
      
      // Append verification document files
      if (verificationDocs.registrationDoc) {
        formData.append('registrationDoc', verificationDocs.registrationDoc);
      }
      if (verificationDocs.llcAuthorization) {
        formData.append('llcAuthorization', verificationDocs.llcAuthorization);
      }
      if (verificationDocs.annualInspectionDoc) {
        formData.append('annualInspectionDoc', verificationDocs.annualInspectionDoc);
      }
      if (verificationDocs.hour100InspectionDoc) {
        formData.append('hour100InspectionDoc', verificationDocs.hour100InspectionDoc);
      }
      if (verificationDocs.maintenanceTrackingDoc) {
        formData.append('maintenanceTrackingDoc', verificationDocs.maintenanceTrackingDoc);
      }
      
      createListingMutation.mutate({ formData, hasFiles: true });
    } else {
      // No files, use regular JSON submission
      createListingMutation.mutate({ formData: listingPayload, hasFiles: false });
    }
  };

  const certifications = ["PPL", "IR", "CPL", "Multi-Engine", "ATP"];

  const isVerified = user?.isVerified || false;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Verification Info */}
        {!isVerified && (
          <Alert className="mb-6 border-yellow-500" data-testid="alert-verification-info">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              <strong>Verification Recommended</strong> - Verified aircraft listings get priority placement and build trust with renters. 
              Visit your <a href="/profile" className="underline font-medium">profile page</a> to complete verification.
            </AlertDescription>
          </Alert>
        )}
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold mb-2" data-testid="text-list-aircraft-title">
            List Your Aircraft
          </h1>
          <p className="text-muted-foreground">
            Share your aircraft with the pilot community and earn income when you're not flying
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Aircraft Information</CardTitle>
                <CardDescription>Provide basic details about your aircraft</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="make"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Make</FormLabel>
                        <FormControl>
                          <Input placeholder="Cessna" {...field} data-testid="input-make" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input placeholder="172 Skyhawk" {...field} data-testid="input-model" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2018" {...field} data-testid="input-year" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="registration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration</FormLabel>
                        <FormControl>
                          <Input placeholder="N12345" {...field} data-testid="input-registration" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Single-Engine">Single-Engine</SelectItem>
                            <SelectItem value="Multi-Engine">Multi-Engine</SelectItem>
                            <SelectItem value="Jet">Jet</SelectItem>
                            <SelectItem value="Turboprop">Turboprop</SelectItem>
                            <SelectItem value="Helicopter">Helicopter</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="totalTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Time (hours)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2500" {...field} data-testid="input-total-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="engine"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Engine</FormLabel>
                        <FormControl>
                          <Input placeholder="Lycoming IO-360" {...field} data-testid="input-engine" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="avionics"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Avionics Suite</FormLabel>
                      <FormControl>
                        <Input placeholder="Garmin G1000" {...field} data-testid="input-avionics" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your aircraft, its condition, features, and any special notes for renters..."
                          className="min-h-32"
                          {...field}
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <div className="flex items-center justify-between gap-2">
                        <FormDescription className="flex-1">
                          Provide detailed information to help renters understand your aircraft
                        </FormDescription>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateDescription}
                          disabled={generateDescriptionMutation.isPending}
                          data-testid="button-generate-description"
                          className="shrink-0"
                        >
                          {generateDescriptionMutation.isPending ? (
                            <>Generating...</>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Generate with AI
                            </>
                          )}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Location */}
            <Card>
              <CardHeader>
                <CardTitle>Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="Santa Monica, CA" {...field} data-testid="input-location" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="airportCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Airport Code</FormLabel>
                        <FormControl>
                          <Input placeholder="SMO" {...field} data-testid="input-airport-code" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing & Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="hourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hourly Rate ($)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="145" {...field} data-testid="input-hourly-rate" />
                      </FormControl>
                      <FormDescription>
                        Set your hourly rental rate. Ready Set Fly will collect 7.5% platform fee from both you and the renter.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minFlightHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Flight Hours</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="100" {...field} data-testid="input-min-hours" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <Label>Required Certifications</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {certifications.map((cert) => (
                      <div key={cert} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cert-${cert}`}
                          checked={selectedCertifications.includes(cert)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCertifications([...selectedCertifications, cert]);
                            } else {
                              setSelectedCertifications(selectedCertifications.filter(c => c !== cert));
                            }
                          }}
                          data-testid={`checkbox-required-cert-${cert}`}
                        />
                        <label htmlFor={`cert-${cert}`} className="text-sm cursor-pointer">
                          {cert}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="insuranceIncluded"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-insurance"
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Insurance included in rate</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="wetRate"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-wet-rate"
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Wet rate (fuel included)</FormLabel>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Owner/Aircraft Verification */}
            <Card>
              <CardHeader>
                <CardTitle>Owner & Aircraft Verification</CardTitle>
                <CardDescription>
                  Provide ownership and maintenance documentation for verification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="serialNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aircraft Serial Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter serial number" {...field} data-testid="input-serial-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Label>Registration Document</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setVerificationDocs(prev => ({ ...prev, registrationDoc: file }));
                    }}
                    data-testid="input-registration-doc"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload aircraft registration document
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Annual Inspection</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="annualInspectionDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Inspection Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-annual-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="annualSignerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Signer Name</FormLabel>
                          <FormControl>
                            <Input placeholder="A&P/IA name" {...field} data-testid="input-signer-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setVerificationDocs(prev => ({ ...prev, annualInspectionDoc: file }));
                    }}
                    data-testid="input-annual-doc"
                  />
                </div>

                <FormField
                  control={form.control}
                  name="requires100Hour"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-requires-100-hour"
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Aircraft requires 100-hour inspection</FormLabel>
                    </FormItem>
                  )}
                />

                {form.watch("requires100Hour") && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-l-2 border-primary/30 pl-4">
                    <FormField
                      control={form.control}
                      name="currentTach"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Tachometer</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" placeholder="2450.5" {...field} data-testid="input-current-tach" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hour100InspectionTach"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last 100-Hour Tach</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" placeholder="2375.0" {...field} data-testid="input-100-hour-tach" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="maintenanceTrackingProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maintenance Tracking (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Savvy Aviation, MxManager" {...field} data-testid="input-maintenance-provider" />
                      </FormControl>
                      <FormDescription>
                        If you use a maintenance tracking service, specify the provider
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Images */}
            <Card>
              <CardHeader>
                <CardTitle>Photos</CardTitle>
                <CardDescription>Add up to 15 photos of your aircraft. You can preview them here before submitting.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {imageFiles.length > 0 && (
                    <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                      <AlertDescription className="text-sm">
                        <strong>Note:</strong> Cloud storage integration is currently in development. Your images are previewing correctly and will be stored as placeholders until cloud storage is fully integrated.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {imageFiles.map((url, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                        <img src={url} alt={`Aircraft ${index + 1}`} className="w-full h-full object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={() => setImageFiles(imageFiles.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {imageFiles.length < 15 && (
                      <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-2 hover-elevate cursor-pointer" data-testid="upload-image-area">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Upload Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Create temporary preview URL
                              const previewUrl = URL.createObjectURL(file);
                              setImageFiles([...imageFiles, previewUrl]);
                              toast({
                                title: "Image Added",
                                description: "Note: Cloud storage integration is in progress. Images are currently stored as placeholders.",
                              });
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {imageFiles.length} of 15 photos uploaded
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex gap-4">
              <Button 
                type="submit" 
                size="lg" 
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent" 
                disabled={createListingMutation.isPending}
                data-testid="button-submit-listing"
              >
                {createListingMutation.isPending ? "Listing..." : "List Aircraft"}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="lg" 
                data-testid="button-cancel-listing"
                onClick={() => navigate("/dashboard")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
