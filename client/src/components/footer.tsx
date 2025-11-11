import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const contactFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export function Footer() {
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const { toast } = useToast();
  
  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      subject: "",
      message: "",
    },
  });
  
  const sendContactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      return await apiRequest("POST", "/api/contact", data);
    },
    onSuccess: () => {
      toast({
        title: "Message sent",
        description: "We'll get back to you as soon as possible.",
      });
      contactForm.reset();
      setContactDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });
  
  return (
    <>
      <footer className="mt-auto border-t bg-muted/30">
        <div className="container px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Ready Set Fly. All rights reserved.
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <button
                onClick={() => setContactDialogOpen(true)}
                className="text-muted-foreground hover:text-foreground transition-colors hover-elevate px-3 py-1 rounded-md"
                data-testid="button-contact-us"
              >
                Contact Us
              </button>
              <Separator orientation="vertical" className="h-4 hidden md:block" />
              <Link 
                href="/privacy-policy" 
                className="text-muted-foreground hover:text-foreground transition-colors hover-elevate px-3 py-1 rounded-md"
                data-testid="link-privacy-policy"
              >
                Privacy Policy
              </Link>
              <Separator orientation="vertical" className="h-4 hidden md:block" />
              <Link 
                href="/terms-of-service" 
                className="text-muted-foreground hover:text-foreground transition-colors hover-elevate px-3 py-1 rounded-md"
                data-testid="link-terms-of-service"
              >
                Terms of Service
              </Link>
              <Separator orientation="vertical" className="h-4 hidden md:block" />
              <Link 
                href="/delete-account" 
                className="text-muted-foreground hover:text-foreground transition-colors hover-elevate px-3 py-1 rounded-md"
                data-testid="link-delete-account"
              >
                Delete Account
              </Link>
            </div>
          </div>
        </div>
      </footer>
      
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-contact-us">
          <DialogHeader>
            <DialogTitle>Contact Us</DialogTitle>
            <DialogDescription>
              Have a question or feedback? Send us a message and we'll get back to you soon.
            </DialogDescription>
          </DialogHeader>
          <Form {...contactForm}>
            <form
              onSubmit={contactForm.handleSubmit((data) => sendContactMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={contactForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} data-testid="input-contact-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} data-testid="input-contact-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={contactForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@example.com" {...field} data-testid="input-contact-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={contactForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="How can we help?" {...field} data-testid="input-contact-subject" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={contactForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell us what's on your mind..."
                        className="min-h-[120px]"
                        {...field}
                        data-testid="textarea-contact-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setContactDialogOpen(false);
                    contactForm.reset();
                  }}
                  data-testid="button-cancel-contact"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={sendContactMutation.isPending}
                  data-testid="button-submit-contact"
                >
                  {sendContactMutation.isPending ? "Sending..." : "Send Message"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
