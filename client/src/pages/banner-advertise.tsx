import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BANNER_AD_TIERS, BANNER_AD_CREATION_FEE } from "@shared/config/bannerPricing";

const placements = [
  { value: "home", label: "Homepage" },
  { value: "student-hub", label: "Student Hub" },
  { value: "pilot-tools", label: "Pilot Tools" },
  { value: "cfi-directory", label: "CFI Directory" },
  { value: "rentals", label: "Aircraft Rentals" },
  { value: "marketplace", label: "Marketplace Hub" },
  { value: "aircraft-sale", label: "Aircraft for Sale" },
  { value: "jobs", label: "Aviation Jobs" },
  { value: "cfi", label: "CFI Services" },
  { value: "flight-school", label: "Flight Schools" },
  { value: "mechanic", label: "Mechanic Services" },
  { value: "charter", label: "Charter Services" },
];

const AGREEMENT_VERSION = "RSF Banner Advertising Agreement v1";

const agreementSections = [
  {
    title: "Parties & Effective Date",
    body: "This Banner Advertising Agreement is between Austin Ready Set Fly, LLC (RSF) and the Advertiser. The effective date is the date of signature below.",
  },
  {
    title: "1. Purpose",
    body: "Ready Set Fly (RSF) operates a pilot workflow and aviation tools platform. Advertisers may place banner advertisements promoting aviation-related products or services on the platform under the terms below.",
  },
  {
    title: "2. Advertising Placement",
    body: "RSF will display the advertiser’s banner within designated areas. RSF retains sole discretion over placement location, banner size/layout, and design adjustments needed to preserve user experience and platform integrity.",
  },
  {
    title: "3. Term & Compensation",
    body: "The campaign runs for the agreed term (default three months if not specified). Promotional placements may be complimentary. Paid placements follow the agreed monthly rate and payment schedule. Term length, start/end dates, and renewal terms are confirmed on the final order or invoice.",
  },
  {
    title: "4. Advertiser Responsibilities",
    body: "Advertiser will provide compliant creative assets, ensure accuracy, and maintain any required licenses or approvals. RSF may reject or remove ads that violate standards or applicable law.",
  },
  {
    title: "5. Creative & Content Approval",
    body: "RSF reserves the right to review and approve all ad materials prior to publication and may assist with formatting when requested.",
  },
  {
    title: "6. Analytics & Lead Tracking",
    body: "RSF provides impressions, clicks/CTR, and engagement metrics. Inquiries submitted through RSF will be routed to the advertiser with RSF attribution. RSF does not guarantee minimum impressions, clicks, or conversions.",
  },
  {
    title: "7. No Endorsement",
    body: "Advertising placement does not constitute RSF endorsement. RSF is not responsible for advertiser products, services, or transactions with users.",
  },
  {
    title: "8. Termination",
    body: "Either party may terminate with notice or immediately for material breach, reputational risk, regulatory issue, or legal concern. Refunds for partial billing periods are not guaranteed unless agreed in writing.",
  },
  {
    title: "9. Limitation of Liability",
    body: "RSF is not liable for indirect, incidental, or consequential damages arising from the agreement. Advertiser agrees to indemnify RSF for claims arising from advertiser content or services.",
  },
  {
    title: "10. Governing Law",
    body: "This agreement is governed by the laws of the State of Texas.",
  },
  {
    title: "11. Entire Agreement",
    body: "This agreement supersedes prior discussions and may only be amended in writing signed by both parties.",
  },
];

const bannerInquirySchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().max(40).optional().or(z.literal("")),
  company: z.string().max(160).optional().or(z.literal("")),
  website: z.string().max(240).optional().or(z.literal("")),
  placements: z.array(z.string()).optional(),
  desiredTier: z.string().optional().or(z.literal("")),
  timeframe: z.string().max(120).optional().or(z.literal("")),
  budget: z.string().max(120).optional().or(z.literal("")),
  message: z.string().max(2000).optional().or(z.literal("")),
  agreementAccepted: z.boolean().refine((value) => value === true, {
    message: "You must accept the agreement to continue.",
  }),
  agreementName: z.string().min(1, "Signature name is required").max(160),
  agreementTitle: z.string().max(160).optional().or(z.literal("")),
  agreementVersion: z.string().optional().or(z.literal("")),
});

type BannerInquiryForm = z.infer<typeof bannerInquirySchema>;

export default function BannerAdvertise() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BannerInquiryForm>({
    resolver: zodResolver(bannerInquirySchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      website: "",
      placements: [],
      desiredTier: "",
      timeframe: "",
      budget: "",
      message: "",
      agreementAccepted: false,
      agreementName: "",
      agreementTitle: "",
      agreementVersion: AGREEMENT_VERSION,
    },
  });

  const handleSubmit = async (data: BannerInquiryForm) => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/banner-ads/inquiry", {
        ...data,
        agreementVersion: AGREEMENT_VERSION,
      });
      toast({
        title: "Inquiry sent",
        description: "Thanks! Our team will follow up soon.",
      });
      form.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send inquiry.";
      toast({ title: "Message failed", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="container mx-auto max-w-5xl px-4 py-10 space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold">Become a Sponsored Business</h1>
          <p className="text-slate-600">
            Promote your aviation business inside Ready Set Fly and reach pilots actively planning flights.
          </p>
        </div>

        <Card className="border-slate-200 bg-white text-slate-950">
          <CardHeader>
            <CardTitle>Banner Ad Pricing</CardTitle>
            <CardDescription className="text-slate-600">
              All plans include placement targeting and RSF performance tracking. A one-time ad creation fee applies.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(BANNER_AD_TIERS).map(([key, tier]) => (
              <div key={key} className="rounded-xl border border-slate-200 bg-white p-4 text-slate-950 shadow-sm">
                <div className="text-sm text-slate-600">{tier.label}</div>
                <div className="text-2xl font-semibold">${tier.monthlyRate.toFixed(0)}/mo</div>
                <div className="text-xs text-slate-600">Total ${tier.totalPrice.toFixed(0)}</div>
                <div className="mt-2 text-xs text-slate-600">{tier.description}</div>
              </div>
            ))}
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-slate-950 shadow-sm">
              <div className="text-sm font-semibold">Ad Creation Fee</div>
              <div className="text-2xl font-semibold">${BANNER_AD_CREATION_FEE.toFixed(0)}</div>
              <div className="text-xs text-slate-600">One-time creative setup</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white text-slate-950">
          <CardHeader>
            <CardTitle>Performance Analytics Included</CardTitle>
            <CardDescription className="text-slate-600">
              Every sponsor receives performance metrics for transparency and ROI.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-slate-700">
            <span>• Impressions and clicks tracked per placement</span>
            <span>• Click-through rate (CTR) reporting</span>
            <span>• Date-range performance summaries</span>
            <span>• Exportable summary report available on request or during renewals</span>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white text-slate-950">
          <CardHeader>
            <CardTitle>What to Send RSF</CardTitle>
            <CardDescription className="text-slate-600">
              Provide the details below so we can build the banner ad quickly.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-slate-700">
            <span>• Business logo (PNG or SVG preferred)</span>
            <span>• Banner headline (short, aviation-focused)</span>
            <span>• 1–2 sentence description/tagline</span>
            <span>• Destination URL (where pilots should click)</span>
            <span>• Preferred placements and start date</span>
            <span>• Optional image or video (landscape or portrait)</span>
            <span>• Videos should be 15 seconds or less for best rotation visibility</span>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white text-slate-950">
          <CardHeader>
            <CardTitle>Request Sponsorship Info</CardTitle>
            <CardDescription className="text-slate-600">
              Submit your details and we will follow up with next steps.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl>
                          <Input placeholder="Alex" {...field} />
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
                        <FormLabel>Last name</FormLabel>
                        <FormControl>
                          <Input placeholder="Aviator" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="alex@company.com" {...field} />
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
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Input placeholder="Aviation Co." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <FormLabel>Preferred placements</FormLabel>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {placements.map((placement) => (
                      <FormField
                        key={placement.value}
                        control={form.control}
                        name="placements"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(placement.value) ?? false}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  const updated = checked
                                    ? [...current, placement.value]
                                    : current.filter((item) => item !== placement.value);
                                  field.onChange(updated);
                                }}
                              />
                            </FormControl>
                            <FormLabel className="cursor-pointer font-normal">
                              {placement.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="desiredTier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desired tier</FormLabel>
                        <FormControl>
                          <Input placeholder="3 Months (recommended)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timeframe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timeframe / start date</FormLabel>
                        <FormControl>
                          <Input placeholder="Start in March 2026" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="$200-400 per month" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell us about your business and any ad ideas..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-950 space-y-4">
                  <div>
                    <h3 className="text-base font-semibold">Banner Advertising Agreement</h3>
                    <p className="text-xs text-slate-600">
                      Review the agreement below and sign electronically to submit your inquiry.
                    </p>
                  </div>

                  <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800 space-y-4">
                    {agreementSections.map((section) => (
                      <div key={section.title} className="space-y-1">
                        <div className="font-semibold text-slate-950">{section.title}</div>
                        <p>{section.body}</p>
                      </div>
                    ))}
                  </div>

                  <FormField
                    control={form.control}
                    name="agreementAccepted"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => field.onChange(checked === true)}
                          />
                        </FormControl>
                        <div className="space-y-1">
                          <FormLabel className="text-sm leading-snug">
                            I agree to the {AGREEMENT_VERSION}.
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="agreementName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Signature name</FormLabel>
                          <FormControl>
                            <Input placeholder="Legal name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="agreementTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title / Role (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Owner, Marketing Lead, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <p className="text-xs text-slate-600">
                    Signature date: {new Date().toLocaleDateString("en-US")}
                  </p>
                </div>

                <Button type="submit" disabled={isSubmitting} className="bg-slate-950 text-white hover:bg-slate-800">
                  {isSubmitting ? "Sending..." : "Send inquiry"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
