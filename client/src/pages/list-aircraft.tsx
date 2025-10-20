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
import { Upload, X, ShieldAlert } from "lucide-react";
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
  hourlyRate: z.coerce.number().min(1, "Hourly rate is required"),
  location: z.string().min(1, "Location is required"),
  airportCode: z.string().optional(),
  description: z.string().min(20, "Description must be at least 20 characters"),
  insuranceIncluded: z.boolean().default(true),
  wetRate: z.boolean().default(true),
  minFlightHours: z.coerce.number().min(0).default(0),
});

type ListingFormData = z.infer<typeof listingSchema>;

export default function ListAircraft() {
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>(["PPL"]);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<ListingFormData>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      insuranceIncluded: true,
      wetRate: true,
      minFlightHours: 0,
    },
  });

  const createListingMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/aircraft", data);
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

  const onSubmit = (data: ListingFormData) => {
    // Prevent submission if not verified
    if (!isVerified) {
      toast({
        title: "Verification Required",
        description: "Please complete account verification before listing aircraft.",
        variant: "destructive",
      });
      navigate("/profile");
      return;
    }
    
    // ownerId is now automatically set by the backend from auth session
    createListingMutation.mutate({
      ...data,
      requiredCertifications: selectedCertifications,
      images: imageFiles.length > 0 ? imageFiles : ["https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=800"],
    });
  };

  const certifications = ["PPL", "IR", "CPL", "Multi-Engine", "ATP"];

  const isVerified = user?.isVerified || false;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Verification Alert */}
        {!isVerified && (
          <Alert className="mb-6 border-destructive" data-testid="alert-verification-required">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              <strong>Account Verification Required</strong> - You must complete account verification before listing aircraft. 
              Please visit your <a href="/profile" className="underline font-medium">profile page</a> to complete verification.
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
                      <FormDescription>
                        Provide detailed information to help renters understand your aircraft
                      </FormDescription>
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

            {/* Images */}
            <Card>
              <CardHeader>
                <CardTitle>Photos</CardTitle>
                <CardDescription>Add up to 15 photos of your aircraft</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
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
                      <div className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-2 hover-elevate cursor-pointer" data-testid="upload-image-area">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Upload Photo</span>
                      </div>
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
                disabled={!isVerified || createListingMutation.isPending}
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
