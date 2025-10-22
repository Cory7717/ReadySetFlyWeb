import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, DollarSign } from "lucide-react";
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

const formSchema = insertMarketplaceListingSchema.omit({ userId: true }).extend({
  category: z.string().min(1, "Category is required"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  location: z.string().optional(),
  contactEmail: z.string().email("Valid email required").min(1, "Contact email is required"),
  contactPhone: z.string().optional(),
  price: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

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
  const [imageFiles] = useState<string[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: "",
      title: "",
      description: "",
      location: "",
      contactEmail: "",
      contactPhone: "",
      price: "",
      tier: "basic",
      details: {},
      images: [],
      isActive: true,
    },
  });

  const createListingMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/marketplace", {
        method: "POST",
        body: JSON.stringify(data),
      });
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
    // Prevent submission if not verified
    if (!isVerified) {
      toast({
        title: "Verification Required",
        description: "Please complete account verification before creating listings.",
        variant: "destructive",
      });
      navigate("/profile");
      return;
    }

    createListingMutation.mutate({
      ...data,
      price: data.price ? parseFloat(data.price) : null,
      images: imageFiles.length > 0 ? imageFiles : [],
    });
  };

  const isVerified = user?.isVerified || false;

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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    <FormDescription>
                      Include all relevant details potential customers should know
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Denver, CO" {...field} data-testid="input-location" />
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

          <div className="flex gap-4">
            <Button
              type="submit"
              size="lg"
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent"
              disabled={!isVerified || createListingMutation.isPending}
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
