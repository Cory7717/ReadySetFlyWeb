import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, DollarSign, Upload, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { insertMarketplaceListingSchema } from "@shared/schema";
import { z } from "zod";
import { Link } from "wouter";

// Base form schema
const baseFormSchema = insertMarketplaceListingSchema.omit({ userId: true }).extend({
  category: z.string().min(1, "Category is required"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  location: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  contactEmail: z.string().email("Valid email required").min(1, "Contact email is required"),
  contactPhone: z.string().optional(),
  price: z.string().optional(),
  tier: z.enum(["basic", "standard", "premium"]).optional(),
});

// Category-specific fields (stored in details JSONB)
const aircraftSaleSchema = z.object({
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.string().min(4, "Year is required"),
  registration: z.string().optional(),
  totalTime: z.string().optional(),
  engineTime: z.string().optional(),
  engineType: z.enum(["Single-Engine", "Multi-Engine", "Turboprop", "Jet"]).optional(),
  engineCount: z.string().optional(),
  seatingCapacity: z.string().optional(),
  avionicsPackage: z.string().optional(),
  usefulLoad: z.string().optional(),
  annualDueDate: z.string().optional(),
  interiorCondition: z.enum(["excellent", "good", "fair", "needs-work"]).optional(),
  exteriorCondition: z.enum(["excellent", "good", "fair", "needs-work"]).optional(),
  damageHistory: z.string().optional(),
});

const jobSchema = z.object({
  jobTitle: z.string().min(1, "Job title is required"),
  company: z.string().min(1, "Company is required"),
  employmentType: z.string().min(1, "Employment type is required"),
  salaryRange: z.string().optional(),
  requirements: z.string().optional(),
});

const cfiSchema = z.object({
  instructorName: z.string().min(1, "Instructor name is required"),
  certifications: z.array(z.string()).min(1, "At least one certification required"),
  hourlyRate: z.string().optional(),
  specialties: z.string().optional(),
});

const flightSchoolSchema = z.object({
  schoolName: z.string().min(1, "School name is required"),
  aircraftFleet: z.string().optional(),
  programsOffered: z.string().optional(),
  pricingInfo: z.string().optional(),
});

const mechanicSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  certifications: z.array(z.string()).optional(),
  specialties: z.string().optional(),
  serviceArea: z.string().optional(),
});

const charterSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  aircraftAvailable: z.string().optional(),
  serviceArea: z.string().optional(),
  pricingStructure: z.string().optional(),
});

type FormData = z.infer<typeof baseFormSchema> & {
  details?: any;
};

const categories = [
  { value: "aircraft-sale", label: "Aircraft for Sale" },
  { value: "charter", label: "Charter Services" },
  { value: "cfi", label: "CFI Services" },
  { value: "flight-school", label: "Flight School" },
  { value: "mechanic", label: "Mechanic Services" },
  { value: "job", label: "Aviation Jobs" },
];

export default function CreateMarketplaceListing() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [promoCodeValid, setPromoCodeValid] = useState<boolean | null>(null);
  const [promoCodeChecking, setPromoCodeChecking] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(baseFormSchema),
    defaultValues: {
      category: "",
      title: "",
      description: "",
      location: "",
      contactEmail: user?.email || "",
      contactPhone: "",
      price: "",
      tier: "basic",
      details: {},
      images: [],
      isActive: true,
    },
  });

  // Auto-fill contact email when user data loads
  useEffect(() => {
    if (user?.email && !form.getValues("contactEmail")) {
      form.setValue("contactEmail", user.email);
    }
  }, [user?.email, form]);

  // Watch category to render category-specific fields
  const selectedCategory = form.watch("category");
  const selectedTier = form.watch("details.tier");
  
  // Calculate max images based on category and tier
  const getMaxImages = (category: string, tier?: string) => {
    if (category === "aircraft-sale") {
      if (tier === "basic") return 3;
      if (tier === "standard") return 5;
      if (tier === "premium") return 10;
      return 3; // default to basic
    }
    if (category === "job") return 1;
    if (category === "cfi") return 1;
    if (category === "flight-school") return 3;
    if (category === "mechanic") return 3;
    if (category === "charter") return 5;
    return 5; // default
  };

  const maxImages = getMaxImages(selectedCategory, selectedTier);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + imageFiles.length > maxImages) {
      toast({
        title: "Too many images",
        description: `You can only upload up to ${maxImages} images for this category${selectedCategory === 'aircraft-sale' ? ' and tier' : ''}.`,
        variant: "destructive",
      });
      return;
    }
    
    // TODO: In production, upload to cloud storage (S3, Cloudinary) and get permanent URLs
    // For now, use placeholder images from Unsplash for demo purposes
    const placeholderImages = [
      'https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=1200&h=800&fit=crop', // Aircraft exterior
      'https://images.unsplash.com/photo-1583792645866-f6b9d2e755e7?w=1200&h=800&fit=crop', // Aircraft cockpit
      'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&h=800&fit=crop', // Aircraft in flight
      'https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?w=1200&h=800&fit=crop', // Aircraft side view
      'https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=1200&h=800&fit=crop', // Aircraft detail
      'https://images.unsplash.com/photo-1542362567-b07e54a88f93?w=1200&h=800&fit=crop', // Aircraft interior
      'https://images.unsplash.com/photo-1569629743817-70d8db6c323b?w=1200&h=800&fit=crop', // Airport
      'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?w=1200&h=800&fit=crop', // Aviation
      'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=1200&h=800&fit=crop', // Private jet
      'https://images.unsplash.com/photo-1583792645866-f6b9d2e755e7?w=1200&h=800&fit=crop', // Cockpit controls
    ];
    
    const urls = files.map((_, index) => {
      const placeholderIndex = (imageFiles.length + index) % placeholderImages.length;
      return placeholderImages[placeholderIndex];
    });
    
    setImageFiles([...imageFiles, ...urls]);
    
    toast({
      title: "Images Added",
      description: `Added ${files.length} placeholder image(s). Cloud storage integration coming soon!`,
    });
  };

  const removeImage = (index: number) => {
    setImageFiles(imageFiles.filter((_, i) => i !== index));
  };

  // Trim images when category or tier changes to enforce new limits
  useEffect(() => {
    if (imageFiles.length > maxImages) {
      const trimmedImages = imageFiles.slice(0, maxImages);
      setImageFiles(trimmedImages);
      toast({
        title: "Images Trimmed",
        description: `Reduced to ${maxImages} images for this ${selectedCategory === 'aircraft-sale' ? 'tier' : 'category'}.`,
      });
    }
  }, [selectedCategory, selectedTier, maxImages, imageFiles, toast]);

  const isVerified = user?.isVerified || false;
  const isSuperAdmin = user?.isSuperAdmin || false;

  // Check promo code validity
  const checkPromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoCodeValid(null);
      return;
    }
    
    setPromoCodeChecking(true);
    try {
      const response = await fetch(`/api/promo-codes/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode, category: selectedCategory }),
      });
      
      const data = await response.json();
      setPromoCodeValid(data.valid);
      
      if (data.valid) {
        toast({
          title: "Promo Code Applied!",
          description: data.description || "You've unlocked a free 7-day listing!",
        });
      } else {
        toast({
          title: "Invalid Promo Code",
          description: data.message || "This promo code is not valid",
          variant: "destructive",
        });
      }
    } catch (error) {
      setPromoCodeValid(false);
      toast({
        title: "Error",
        description: "Failed to validate promo code",
        variant: "destructive",
      });
    } finally {
      setPromoCodeChecking(false);
    }
  };

  const generateDescriptionMutation = useMutation({
    mutationFn: async ({ listingType, details }: { listingType: string; details: any }) => {
      const response = await apiRequest("POST", "/api/generate-description", {
        listingType,
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
    
    if (!values.category) {
      toast({
        title: "Category Required",
        description: "Please select a category first.",
        variant: "destructive",
      });
      return;
    }

    if (!values.title) {
      toast({
        title: "Title Required",
        description: "Please enter a title first.",
        variant: "destructive",
      });
      return;
    }

    // Map category to listing type for API
    const categoryToListingType: Record<string, string> = {
      "aircraft-sale": "aircraft-sale",
      "job": "aviation-job",
      "cfi": "cfi-listing",
      "flight-school": "flight-school",
      "mechanic": "mechanic",
      "charter": "charter",
    };

    const listingType = categoryToListingType[values.category];
    
    generateDescriptionMutation.mutate({
      listingType,
      details: {
        title: values.title,
        price: values.price,
        location: values.location,
        ...values.details,
      },
    });
  };

  const createListingMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/marketplace", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      toast({
        title: "Success",
        description: "Your marketplace listing has been created.",
      });
      navigate("/marketplace");
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
          description: "Please complete account verification to create listings.",
          variant: "destructive",
        });
        setTimeout(() => {
          navigate("/profile");
        }, 1000);
        return;
      }

      toast({
        title: "Error",
        description: error.message || "Failed to create listing",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    console.log("Form submitted with data:", data);
    console.log("Form errors:", form.formState.errors);
    console.log("User verification status:", isVerified);
    console.log("User is super admin:", isSuperAdmin);
    console.log("User data:", user);
    
    // Super admins can create listings without verification
    if (!isVerified && !isSuperAdmin) {
      console.error("Verification check failed:", { isVerified, isSuperAdmin, user });
      toast({
        title: "Verification Required",
        description: "Please complete account verification before creating listings.",
        variant: "destructive",
      });
      navigate("/profile");
      return;
    }

    // Validate category-specific required fields
    let validationError: string | null = null;
    
    if (data.category === "aircraft-sale") {
      if (!data.details?.make || !data.details?.model || !data.details?.year) {
        validationError = "Please fill in all required aircraft details (make, model, year)";
      }
    } else if (data.category === "job") {
      if (!data.details?.jobTitle || !data.details?.company || !data.details?.employmentType) {
        validationError = "Please fill in all required job details (title, company, employment type)";
      }
    } else if (data.category === "cfi") {
      if (!data.details?.instructorName) {
        validationError = "Please provide instructor name";
      }
    } else if (data.category === "flight-school") {
      if (!data.details?.schoolName) {
        validationError = "Please provide school name";
      }
    } else if (data.category === "mechanic") {
      if (!data.details?.businessName) {
        validationError = "Please provide business name";
      }
    } else if (data.category === "charter") {
      if (!data.details?.companyName) {
        validationError = "Please provide company name";
      }
    }

    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    // Validate image count doesn't exceed category/tier limits
    if (imageFiles.length > maxImages) {
      toast({
        title: "Too Many Images",
        description: `Please reduce to ${maxImages} images for this ${data.category === 'aircraft-sale' ? 'tier' : 'category'}.`,
        variant: "destructive",
      });
      return;
    }

    // Super admins bypass payment and create listing directly
    if (isSuperAdmin) {
      console.log("Super admin creating listing directly...");
      createListingMutation.mutate({
        ...data,
        price: data.price || undefined,
        images: imageFiles.length > 0 ? imageFiles : [],
        promoCode: promoCodeValid ? promoCode : undefined,
      });
      return;
    }

    // Regular users: redirect to payment
    const listingPayload = {
      ...data,
      price: data.price || undefined,
      images: imageFiles.length > 0 ? imageFiles : [],
      promoCode: promoCodeValid ? promoCode : undefined,
    };

    // Store listing data in localStorage for checkout page
    localStorage.setItem('pendingListingData', JSON.stringify(listingPayload));
    
    // Navigate to checkout
    navigate("/marketplace/listing/checkout");
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/marketplace")}
        className="mb-6"
        data-testid="button-back"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Marketplace
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-page-title">
          Create Marketplace Listing
        </h1>
        <p className="text-muted-foreground">
          List your services, aircraft for sale, job openings, or other aviation-related offerings
        </p>
      </div>

      {!isVerified && (
        <Alert className="mb-6" data-testid="alert-verification-required">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Verification Required</AlertTitle>
          <AlertDescription>
            You must be a verified user to create marketplace listings.{" "}
            <Link href="/profile" className="font-medium underline">
              Complete verification in your profile
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
          console.error("Form validation errors:", errors);
          // Show first error in a toast
          const firstErrorField = Object.keys(errors)[0];
          const firstError = errors[firstErrorField as keyof typeof errors];
          if (firstError && typeof firstError === 'object' && 'message' in firstError) {
            toast({
              title: "Form Validation Error",
              description: String(firstError.message) || "Please check all required fields",
              variant: "destructive",
            });
          }
        })} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Choose a category and provide details about your listing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2018 Cessna 172 for Sale" {...field} data-testid="input-title" />
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
                        placeholder="Provide detailed information about your listing..."
                        className="min-h-[120px]"
                        {...field}
                        data-testid="textarea-description"
                      />
                    </FormControl>
                    <div className="flex items-center justify-between gap-2">
                      <FormDescription className="flex-1">
                        Include all relevant details potential customers should know
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Denver" {...field} data-testid="input-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., CO" {...field} data-testid="input-state" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP Code (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 80202" {...field} data-testid="input-zipcode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (Optional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            placeholder="0.00"
                            className="pl-10"
                            {...field}
                            data-testid="input-price"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>Leave blank if price varies or negotiable</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>How should interested parties reach you?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        {...field}
                        data-testid="input-contact-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 123-4567" {...field} data-testid="input-contact-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Promo Code */}
          <Card>
            <CardHeader>
              <CardTitle>Promo Code (Optional)</CardTitle>
              <CardDescription>
                Enter a promo code for a free 7-day listing or other discounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter promo code"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase());
                    setPromoCodeValid(null);
                  }}
                  data-testid="input-promo-code"
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={checkPromoCode}
                  disabled={!promoCode.trim() || promoCodeChecking}
                  data-testid="button-check-promo"
                >
                  {promoCodeChecking ? "Checking..." : "Apply"}
                </Button>
              </div>
              {promoCodeValid === true && (
                <div className="mt-2 text-sm text-chart-2 flex items-center gap-1">
                  ✓ Promo code applied! Your listing is free for 7 days.
                </div>
              )}
              {promoCodeValid === false && (
                <div className="mt-2 text-sm text-destructive flex items-center gap-1">
                  ✗ Invalid promo code
                </div>
              )}
            </CardContent>
          </Card>

          {/* Image Upload */}
          {selectedCategory && (
            <Card>
              <CardHeader>
                <CardTitle>Photos</CardTitle>
                <CardDescription>
                  Upload up to {maxImages} {maxImages === 1 ? 'photo' : 'photos'} 
                  {selectedCategory === 'aircraft-sale' ? ` (${selectedTier || 'basic'} tier)` : ''}
                  {selectedCategory === 'job' && ' - Company logo or branding'}
                  {selectedCategory === 'cfi' && ' - Professional headshot'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {imageFiles.map((url, index) => (
                    <div key={index} className="relative aspect-square rounded-md border overflow-hidden group">
                      <img src={url} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                        data-testid={`button-remove-image-${index}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {imageFiles.length < maxImages && (
                    <label className="aspect-square rounded-md border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover-elevate active-elevate-2 transition-all">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageUpload}
                        data-testid="input-upload-images"
                      />
                    </label>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {imageFiles.length} of {maxImages} photos uploaded
                  {selectedCategory === 'aircraft-sale' && selectedTier && (
                    <span className="ml-2 text-accent">
                      (Upgrade tier for more photos)
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Aircraft for Sale - Category Specific Fields */}
          {selectedCategory === "aircraft-sale" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Aircraft Details</CardTitle>
                  <CardDescription>Specific information about the aircraft for sale</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="details.make"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            Make <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Cessna" {...field} data-testid="input-aircraft-make" required />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="details.model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            Model <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 172 Skyhawk" {...field} data-testid="input-aircraft-model" required />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="details.year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            Year <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 2018" {...field} data-testid="input-aircraft-year" required />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="details.registration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registration (N-Number)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., N12345" {...field} data-testid="input-aircraft-registration" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="details.totalTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Time (hours)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 3500" {...field} data-testid="input-aircraft-total-time" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="details.engineTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Engine Time (hours)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 500 SMOH" {...field} data-testid="input-aircraft-engine-time" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="details.engineType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Engine Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-aircraft-engine-type">
                                <SelectValue placeholder="Select engine type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Single-Engine">Single-Engine</SelectItem>
                              <SelectItem value="Multi-Engine">Multi-Engine</SelectItem>
                              <SelectItem value="Turboprop">Turboprop</SelectItem>
                              <SelectItem value="Jet">Jet</SelectItem>
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
                      name="details.seats"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Seats</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 4" {...field} data-testid="input-aircraft-seats" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="details.usefulLoad"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Useful Load (lbs)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 1,200" {...field} data-testid="input-aircraft-useful-load" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="details.avionicsPackage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Avionics Package</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Garmin G1000, dual GNS 430" {...field} data-testid="input-aircraft-avionics" />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Describe GPS, radios, autopilot, and other avionics
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="details.annualDue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Annual Due Date</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 12/2025" type="month" {...field} data-testid="input-aircraft-annual-due" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="details.interiorCondition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Interior Condition</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-interior-condition">
                                <SelectValue placeholder="Select condition" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="excellent">Excellent</SelectItem>
                              <SelectItem value="good">Good</SelectItem>
                              <SelectItem value="fair">Fair</SelectItem>
                              <SelectItem value="needs-work">Needs Work</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="details.exteriorCondition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Exterior/Paint Condition</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-exterior-condition">
                                <SelectValue placeholder="Select condition" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="excellent">Excellent</SelectItem>
                              <SelectItem value="good">Good</SelectItem>
                              <SelectItem value="fair">Fair</SelectItem>
                              <SelectItem value="needs-work">Needs Work</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="details.damageHistory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Damage History</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., None, or describe any incidents" {...field} data-testid="input-aircraft-damage-history" />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Disclose any accident/incident history or major repairs
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Listing Tier</CardTitle>
                  <CardDescription>Choose your listing package</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="tier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Tier</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-listing-tier">
                              <SelectValue placeholder="Select a tier" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="basic">
                              <div className="flex flex-col py-1">
                                <span className="font-semibold">Basic - $25/month</span>
                                <span className="text-xs text-muted-foreground">30-day listing, up to 3 photos</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="standard">
                              <div className="flex flex-col py-1">
                                <span className="font-semibold">Standard - $40/month</span>
                                <span className="text-xs text-muted-foreground">30-day listing, up to 5 photos, priority placement</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="premium">
                              <div className="flex flex-col py-1">
                                <span className="font-semibold">Premium - $100/month</span>
                                <span className="text-xs text-muted-foreground">30-day listing, up to 10 photos, featured on homepage</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    <p className="font-medium mb-1">Tier Benefits:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Basic: Standard listing visibility</li>
                      <li>Standard: 2x visibility, priority in search results</li>
                      <li>Premium: 5x visibility, homepage feature, social media promotion</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Aviation Job - Category Specific Fields */}
          {selectedCategory === "job" && (
            <Card>
              <CardHeader>
                <CardTitle>Job Details</CardTitle>
                <CardDescription>Information about the aviation job opening</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="details.jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Commercial Pilot" {...field} data-testid="input-job-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="details.company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., ABC Airlines" {...field} data-testid="input-job-company" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="details.employmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-employment-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="full-time">Full-time</SelectItem>
                            <SelectItem value="part-time">Part-time</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="temporary">Temporary</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="details.salaryRange"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salary Range (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., $60k-$80k" {...field} data-testid="input-salary-range" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="details.requirements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requirements (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="List qualifications and requirements..."
                          className="min-h-[80px]"
                          {...field}
                          data-testid="textarea-job-requirements"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* CFI - Category Specific Fields */}
          {selectedCategory === "cfi" && (
            <Card>
              <CardHeader>
                <CardTitle>CFI Details</CardTitle>
                <CardDescription>Information about your flight instruction services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="details.instructorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instructor Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your name" {...field} data-testid="input-instructor-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="details.hourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hourly Rate (Optional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            placeholder="0.00"
                            className="pl-10"
                            {...field}
                            data-testid="input-cfi-hourly-rate"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="details.specialties"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specialties (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Instrument training, tailwheel, aerobatics..."
                          className="min-h-[80px]"
                          {...field}
                          data-testid="textarea-cfi-specialties"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Flight School - Category Specific Fields */}
          {selectedCategory === "flight-school" && (
            <Card>
              <CardHeader>
                <CardTitle>Flight School Details</CardTitle>
                <CardDescription>Information about your flight school</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="details.schoolName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., ABC Flight Academy" {...field} data-testid="input-school-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="details.aircraftFleet"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aircraft Fleet (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="List your training aircraft..."
                          className="min-h-[80px]"
                          {...field}
                          data-testid="textarea-aircraft-fleet"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="details.programsOffered"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Programs Offered (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Private Pilot, Instrument Rating, Commercial..."
                          className="min-h-[80px]"
                          {...field}
                          data-testid="textarea-programs-offered"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="details.pricingInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pricing Information (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your pricing structure..."
                          className="min-h-[80px]"
                          {...field}
                          data-testid="textarea-pricing-info"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Mechanic - Category Specific Fields */}
          {selectedCategory === "mechanic" && (
            <Card>
              <CardHeader>
                <CardTitle>Mechanic Services</CardTitle>
                <CardDescription>Information about your aviation maintenance services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="details.businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., ABC Aviation Maintenance" {...field} data-testid="input-business-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="details.specialties"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specialties (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Piston engines, avionics, annuals..."
                          className="min-h-[80px]"
                          {...field}
                          data-testid="textarea-mechanic-specialties"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="details.serviceArea"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Area (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Southern California" {...field} data-testid="input-service-area" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Charter - Category Specific Fields */}
          {selectedCategory === "charter" && (
            <Card>
              <CardHeader>
                <CardTitle>Charter Services</CardTitle>
                <CardDescription>Information about your charter operation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="details.companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., ABC Charter Services" {...field} data-testid="input-charter-company-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="details.aircraftAvailable"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aircraft Available (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="List your charter aircraft..."
                          className="min-h-[80px]"
                          {...field}
                          data-testid="textarea-charter-aircraft"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="details.serviceArea"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Area (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., West Coast, USA" {...field} data-testid="input-charter-service-area" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="details.pricingStructure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pricing Structure (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your charter rates..."
                          className="min-h-[80px]"
                          {...field}
                          data-testid="textarea-charter-pricing"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          <div className="flex gap-4">
            <Button
              type="submit"
              size="lg"
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent"
              disabled={(!isVerified && !isSuperAdmin) || createListingMutation.isPending}
              data-testid="button-submit-listing"
            >
              {createListingMutation.isPending ? "Creating..." : "Create Listing"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => navigate("/marketplace")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
