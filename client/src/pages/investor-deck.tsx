import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Download, ExternalLink } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { trackEvent } from "@/lib/analytics";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/RSFOpaqueLogo_1761494760586.png";

const PDF_PATH = "/downloads/RSF_Investor_Pitch_Deck.pdf";
const PPTX_PATH = "/downloads/RSF_Investor_Pitch_Deck.pptx";
export const INVESTOR_DECK_SHARE_PATH = "/investor-deck/share/rsf-2026-deck";
const INVESTOR_DECK_CONFIDENTIALITY_KEY = "rsf_investor_deck_confidentiality_accepted_v1";
const INVESTOR_DECK_CONFIDENTIALITY_TERMS_VERSION = "2026-03-24-v1";

const deckTopics = [
  "The Problem",
  "The Solution",
  "Market Opportunity",
  "Traction & GA4 Data",
  "Product Deep-Dive",
  "Business Model",
  "Competitive Landscape",
  "Go-To-Market Strategy",
  "The Ask",
  "12-Month Milestones",
  "Closing",
];

const stats = [
  { value: "800K+", label: "Active GA Pilots", detail: "Per FAA" },
  { value: "$6.4B", label: "US GA Market Size", detail: "Annual market estimate" },
  { value: "1,294", label: "QTD Active Users", detail: "Jan-Mar 2026" },
  { value: "~7%", label: "Avg Bounce Rate", detail: "Tool Hub & Marketplace" },
];

const platformBadges = ["React", "TypeScript", "Express", "PostgreSQL"];

const valuationDrivers = [
  {
    title: "Indicative Current Range",
    body: "$12M-$16M pre-money based on current product maturity, early traction, and strategic positioning.",
  },
  {
    title: "Marketplace Comp Set",
    body: "Directionally informed by peer-to-peer rental marketplaces like Turo, Boatsetter, and RVshare, adjusted down for RSF's earlier stage and adjusted up for platform depth.",
  },
  {
    title: "Near-Term Re-Rate Triggers",
    body: "Live Leidos integration, CPA member distribution, listing growth, and first monetization proof can support a higher valuation band.",
  },
];

const investorContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type InvestorContactValues = z.infer<typeof investorContactSchema>;

function downloadDeck(label: string, path: string) {
  trackEvent("cta_click", { label, target: path });
}

export default function InvestorDeck() {
  const { toast } = useToast();
  const [hasAcceptedConfidentiality, setHasAcceptedConfidentiality] = useState(false);
  const [acknowledgedTerms, setAcknowledgedTerms] = useState(false);
  const [isRecordingConfidentiality, setIsRecordingConfidentiality] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const accepted = window.localStorage.getItem(INVESTOR_DECK_CONFIDENTIALITY_KEY) === "true";
    setHasAcceptedConfidentiality(accepted);
    setAcknowledgedTerms(accepted);
  }, []);

  const form = useForm<InvestorContactValues>({
    resolver: zodResolver(investorContactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      subject: "Investor deck inquiry",
      message: "",
    },
  });

  const acceptConfidentialityTerms = async () => {
    try {
      setIsRecordingConfidentiality(true);
      await apiRequest("POST", "/api/investor/confidentiality-accept", {
        pagePath: INVESTOR_DECK_SHARE_PATH,
        termsVersion: INVESTOR_DECK_CONFIDENTIALITY_TERMS_VERSION,
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(INVESTOR_DECK_CONFIDENTIALITY_KEY, "true");
      }
      trackEvent("cta_click", { label: "investor_deck_confidentiality_accept", target: INVESTOR_DECK_SHARE_PATH });
      setHasAcceptedConfidentiality(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to record confidentiality acceptance";
      toast({
        title: "Acceptance failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsRecordingConfidentiality(false);
    }
  };

  const sendInvestorContactMutation = useMutation({
    mutationFn: async (values: InvestorContactValues) => {
      return apiRequest("POST", "/api/investor/contact", values);
    },
    onSuccess: () => {
      trackEvent("cta_click", { label: "investor_deck_contact_submit", target: "/api/investor/contact" });
      toast({
        title: "Message sent",
        description: "Your investor inquiry has been delivered.",
      });
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        subject: "Investor deck inquiry",
        message: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Message failed",
        description: error.message || "Unable to send investor inquiry",
        variant: "destructive",
      });
    },
  });

  if (!hasAcceptedConfidentiality) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#17345d_0%,_#0f2747_35%,_#0B1F3A_72%)] text-[#EEF3F9]">
        <div className="container mx-auto flex min-h-screen items-center px-4 py-10 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <Card className="border border-[#F0B429]/18 bg-[#08172d]/95 text-[#EEF3F9] shadow-[0_30px_80px_rgba(2,8,20,0.5)]">
              <CardHeader className="space-y-4 pb-4">
                <Badge className="w-fit border border-[#F0B429]/35 bg-[#F0B429]/14 px-3 py-1 text-[#F0B429]">
                  Confidential Investor Materials
                </Badge>
                <CardTitle className="text-3xl font-bold tracking-tight text-white">
                  Ready Set Fly Investor Deck Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-sm leading-7 text-[#E2EBF7]">
                <p className="text-[#E2EBF7]">
                  These materials are confidential and are being provided solely for the purpose of evaluating a
                  potential investment, strategic relationship, or business discussion with Ready Set Fly.
                </p>
                <div className="rounded-2xl border border-white/10 bg-[#0d223f] p-5">
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F0B429]">
                    By proceeding, you agree that you will not:
                  </div>
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#F3F7FC]">
                    <li>Share, forward, publish, or distribute these materials without written permission.</li>
                    <li>Use the information for any purpose other than evaluating Ready Set Fly.</li>
                    <li>Represent these materials as public marketing collateral.</li>
                  </ul>
                </div>
                <label className="flex items-start gap-3 rounded-2xl border border-white/12 bg-[#122a4b] p-4">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[#F0B429]"
                    checked={acknowledgedTerms}
                    onChange={(event) => setAcknowledgedTerms(event.target.checked)}
                    data-testid="checkbox-investor-confidentiality-accept"
                  />
                  <span className="text-sm text-white">
                    I understand that these materials are confidential and I agree not to copy, distribute, or share
                    them without written permission from Ready Set Fly.
                  </span>
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    asChild
                    variant="outline"
                    className="border-white/20 bg-transparent text-white hover:bg-white/12"
                  >
                    <a href="https://readysetfly.us">Return to readysetfly.us</a>
                  </Button>
                  <Button
                    onClick={() => void acceptConfidentialityTerms()}
                    disabled={!acknowledgedTerms || isRecordingConfidentiality}
                    className="bg-[#F0B429] text-slate-950 hover:bg-[#e4aa22] disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="button-investor-confidentiality-continue"
                  >
                    {isRecordingConfidentiality ? "Recording acceptance..." : "Accept And Continue"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#EEF3F9] text-slate-900">
      <section className="border-b border-white/10 bg-[#0B1F3A] text-[#EEF3F9]">
        <div className="container mx-auto px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="Ready Set Fly" className="h-12 w-12" />
              <div>
                <div className="font-display text-2xl font-bold tracking-tight">Ready Set Fly</div>
                <div className="text-xs uppercase tracking-[0.28em] text-[#F0B429]">Investor Materials</div>
              </div>
            </div>
            <div className="text-left text-xs text-[#EEF3F9]/72 sm:text-sm lg:text-right">
              Confidential - For Investor Use Only
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0B1F3A] text-[#EEF3F9]">
        <div className="container mx-auto px-4 py-12 sm:px-6 sm:py-16">
          <div className="max-w-4xl space-y-6">
            <Badge className="border border-[#F0B429]/35 bg-[#F0B429]/12 px-3 py-1 text-[#F0B429]">
              Pre-Seed Round Open
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
                The Aviation Marketplace with the Planning Tools Built In.
              </h1>
              <p className="text-base text-[#EEF3F9]/78 sm:text-lg">
                Pre-Seed Round Open - 2026 - readysetfly.us
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-[#F0B429] text-slate-950 hover:bg-[#e4aa22]"
              >
                <a
                  href={PDF_PATH}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => downloadDeck("investor_deck_pdf", PDF_PATH)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Pitch Deck (PDF)
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-[#EEF3F9]/35 bg-transparent text-[#EEF3F9] hover:bg-white/10"
              >
                <a
                  href={PPTX_PATH}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => downloadDeck("investor_deck_pptx", PPTX_PATH)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PPTX
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section className="container mx-auto px-4 py-8 sm:px-6 sm:py-10">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-3xl font-bold tracking-tight text-[#F0B429]">{stat.value}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{stat.label}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">{stat.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 py-4 sm:px-6 sm:py-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#F0B429]">Why RSF</div>
            <p className="mt-4 max-w-4xl text-lg leading-relaxed text-slate-800">
              Ready Set Fly is the only platform where pilots can rent or list aircraft AND complete their full
              pre-flight workflow - flight planning, weather briefing, NOTAM translation, E6B calculations, and more -
              in a single destination. We&apos;re building the aviation marketplace that ForeFlight forgot to build.
            </p>
          </div>
        </section>

        <section className="container mx-auto px-4 py-4 sm:px-6 sm:py-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#F0B429]">Valuation Perspective</div>
            <div className="mt-4 flex flex-col gap-3">
              <h2 className="text-3xl font-bold tracking-tight text-[#0B1F3A]">Indicative Pre-Seed Valuation: $12M-$16M Pre-Money</h2>
              <p className="max-w-4xl text-base leading-relaxed text-slate-700">
                This range reflects RSF as a live, multi-sided aviation platform with early traction, strong engagement,
                a differentiated tools-plus-marketplace product, and strategic Leidos approval that places the company in
                a small approved-provider set alongside leading aviation software platforms.
              </p>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {valuationDrivers.map((driver) => (
                <div key={driver.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F0B429]">{driver.title}</div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{driver.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-[#0B1F3A]/10 bg-[#0B1F3A]/[0.03] p-5">
              <div className="text-sm font-semibold text-[#0B1F3A]">Professional framing</div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                The range is intended as a founder management estimate for investor discussions. It is informed by 2025
                Carta early-stage fundraising benchmarks, marketplace comparables, and RSF-specific strategic milestones.
                It is not presented as a third-party fairness opinion or formal 409A valuation.
              </p>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-8 sm:px-6 sm:py-10">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#F0B429]">
              11 Slides Covering
            </div>
            <div className="mt-6 grid gap-x-8 gap-y-3 md:grid-cols-2">
              {deckTopics.map((topic) => (
                <div key={topic} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#F0B429]" />
                  <span className="text-sm font-medium text-slate-800">{topic}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white/80">
          <div className="container mx-auto px-4 py-6 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="text-sm text-slate-600">
                  Live at{" "}
                  <a
                    href="https://readysetfly.us"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#0B1F3A] underline decoration-[#F0B429] underline-offset-4"
                    onClick={() =>
                      trackEvent("cta_click", { label: "investor_deck_live_site", target: "https://readysetfly.us" })
                    }
                  >
                    readysetfly.us
                  </a>
                </div>
                <div className="text-sm text-slate-600">
                  Full-stack platform in soft launch - actively acquiring users.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {platformBadges.map((badge) => (
                  <Badge key={badge} variant="outline" className="border-[#0B1F3A]/20 bg-white text-[#0B1F3A]">
                    {badge}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <section className="bg-[#0B1F3A] text-[#EEF3F9]">
        <div className="container mx-auto px-4 py-10 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <Card className="border border-[#F0B429]/20 bg-gradient-to-br from-[#10284a] via-[#0f2441] to-[#0B1F3A] text-white shadow-[0_20px_50px_rgba(3,10,24,0.35)]">
              <CardHeader className="pb-4">
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#F0B429]">Get In Touch</div>
                <CardTitle className="text-2xl text-white">Investor Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-[#E7EEF8]">
                <div className="font-semibold text-white">Cory Armer</div>
                <div className="text-[#D7E2F2]">cory@readysetfly.us</div>
                <div>
                  <a
                    href="https://www.linkedin.com/in/cory-armer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#F0B429] underline decoration-[#F0B429]/60 underline-offset-4"
                    onClick={() =>
                      trackEvent("cta_click", {
                        label: "investor_deck_linkedin",
                        target: "https://www.linkedin.com/in/cory-armer",
                      })
                    }
                  >
                    linkedin.com/in/cory-armer
                  </a>
                </div>
                <div>
                  Send a note directly from this page. Investor inquiries are delivered to{" "}
                  <span className="font-semibold text-white">cory@readysetfly.us</span>.
                </div>
                <div className="pt-2">
                  <Button
                    asChild
                    size="lg"
                    className="w-full !bg-[#F0B429] !text-slate-950 shadow-md hover:!bg-[#e4aa22]"
                  >
                    <a
                      href={PDF_PATH}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => downloadDeck("investor_footer_pdf", PDF_PATH)}
                    >
                      Download PDF
                    </a>
                  </Button>
                </div>
                <div>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="w-full border-white/20 bg-white/8 text-white hover:bg-white/14"
                  >
                    <a
                      href="https://readysetfly.us"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        trackEvent("cta_click", { label: "investor_footer_live_site", target: "https://readysetfly.us" })
                      }
                    >
                      Visit readysetfly.us
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/95 text-slate-900">
              <CardHeader>
                <CardTitle className="text-xl text-[#0B1F3A]">Send investor inquiry</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit((values) => sendInvestorContactMutation.mutate(values))}
                    className="space-y-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Jane" />
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
                              <Input {...field} placeholder="Investor" />
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
                            <Input {...field} type="email" placeholder="jane@fund.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Interested in the RSF pre-seed round" />
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
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Share your interest, fund focus, and best way to follow up."
                              className="min-h-[140px]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full bg-[#0B1F3A] text-white hover:bg-[#10284b]"
                      disabled={sendInvestorContactMutation.isPending}
                    >
                      {sendInvestorContactMutation.isPending ? "Sending..." : "Send inquiry"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 border-t border-white/10 pt-4 text-xs text-[#EEF3F9]/60">
            © 2026 Ready Set Fly. All rights reserved. Confidential.
          </div>
        </div>
      </section>
    </div>
  );
}
