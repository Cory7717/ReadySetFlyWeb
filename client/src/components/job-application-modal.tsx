import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2 } from "lucide-react";
import type { MarketplaceListing } from "@shared/schema";

const jobApplicationFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  coverLetter: z.string().optional(),
  resume: z.instanceof(File, { message: "Resume is required" }),
});

type JobApplicationFormData = z.infer<typeof jobApplicationFormSchema>;

interface JobApplicationModalProps {
  listing: MarketplaceListing;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JobApplicationModal({ listing, open, onOpenChange }: JobApplicationModalProps) {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<JobApplicationFormData>({
    resolver: zodResolver(jobApplicationFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      coverLetter: "",
    },
  });

  const applicationMutation = useMutation({
    mutationFn: async (data: JobApplicationFormData) => {
      const formData = new FormData();
      formData.append('listingId', listing.id);
      formData.append('firstName', data.firstName);
      formData.append('lastName', data.lastName);
      formData.append('email', data.email);
      if (data.phone) formData.append('phone', data.phone);
      if (data.coverLetter) formData.append('coverLetter', data.coverLetter);
      formData.append('resume', data.resume);

      const response = await fetch('/api/job-applications', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit application');
      }

      return response.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({
        title: "Application submitted!",
        description: "The employer has been notified and will review your application soon.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF or Word document",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Resume must be less than 5MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      form.setValue('resume', file);
      form.clearErrors('resume');
    }
  };

  const onSubmit = (data: JobApplicationFormData) => {
    applicationMutation.mutate(data);
  };

  const handleClose = () => {
    if (!applicationMutation.isPending) {
      onOpenChange(false);
      // Reset form after modal closes
      setTimeout(() => {
        form.reset();
        setSelectedFile(null);
        setIsSubmitted(false);
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-job-application">
        {!isSubmitted ? (
          <>
            <DialogHeader>
              <DialogTitle>Apply for Position</DialogTitle>
              <DialogDescription>
                {listing.title} - {listing.location || 'Location not specified'}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="John"
                            data-testid="input-first-name"
                          />
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
                          <Input
                            {...field}
                            placeholder="Doe"
                            data-testid="input-last-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="john.doe@example.com"
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          placeholder="(555) 123-4567"
                          data-testid="input-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="coverLetter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cover Letter (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Tell the employer why you're a great fit for this position..."
                          className="min-h-32 resize-none"
                          data-testid="textarea-cover-letter"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="resume"
                  render={({ field: { value, onChange, ...field } }) => (
                    <FormItem>
                      <FormLabel>Resume (PDF or Word)</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              {...field}
                              type="file"
                              accept=".pdf,.doc,.docx"
                              onChange={handleFileChange}
                              className="hidden"
                              id="resume-upload"
                              data-testid="input-resume"
                            />
                            <label htmlFor="resume-upload">
                              <Button
                                type="button"
                                variant="outline"
                                className="cursor-pointer"
                                asChild
                                data-testid="button-upload-resume"
                              >
                                <span>
                                  <Upload className="w-4 h-4 mr-2" />
                                  Choose File
                                </span>
                              </Button>
                            </label>
                            {selectedFile && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileText className="w-4 h-4" />
                                <span data-testid="text-resume-filename">{selectedFile.name}</span>
                                <span className="text-xs">
                                  ({(selectedFile.size / 1024).toFixed(0)} KB)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={applicationMutation.isPending}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={applicationMutation.isPending}
                    data-testid="button-submit-application"
                  >
                    {applicationMutation.isPending ? "Submitting..." : "Submit Application"}
                  </Button>
                </div>
              </form>
            </Form>
          </>
        ) : (
          <div className="py-8 text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="w-16 h-16 text-green-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Application Submitted Successfully!</h3>
              <p className="text-muted-foreground">
                Your application has been sent to the employer. They will review your resume and
                contact you if you're a good fit for the position.
              </p>
            </div>
            <Button
              onClick={handleClose}
              className="mt-4"
              data-testid="button-close-success"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
