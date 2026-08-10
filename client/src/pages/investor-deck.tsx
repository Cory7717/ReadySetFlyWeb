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

const stats = [
  { value: "2.6K", label: "Active Users YTD", detail: "Jan. 1 – Aug. 10, 2026" },
  { value: "~79K", label: "User Events YTD", detail: "Jan. 1 – Aug. 10, 2026" },
  { value: "3m 15s", label: "Avg. Engagement / Active User", detail: "Jan. 1 – Aug. 10, 2026" },
  { value: "24K", label: "Core Pilot Hub Views", detail: "Jan. 1 – Aug. 10, 2026" },
];

const platformBadges = ["React", "TypeScript", "Express", "PostgreSQL"];

const valuationDrivers = [
  {
    title: "Substantial Platform Built",
    body: "RSF is raising to validate, commercialize, grow, and scale an operating platform—not to build an initial MVP.",
  },
  {
    title: "Connected Pilot Workflow",
    body: "Planning, aviation intelligence, training, records, rentals, marketplace discovery, subscriptions, and pilot utilities operate within one ecosystem.",
  },
  {
    title: "Defined Capital Milestone",
    body: "The round supports independent FAA Flight Service V&V, production progression, commercialization, pilot acquisition, and reliable scale.",
  },
];

const investmentPriorities = [
  {
    title: "FAA Flight Service V&V and production progression",
    body: "Independent requirements-based verification and validation, traceability, testing documentation, remediation, and progression toward production deployment.",
  },
  {
    title: "Platform engineering, reliability, and infrastructure",
    body: "Reliability hardening, aviation infrastructure, scalability, production monitoring, mobile and web development, and specialized aviation engineering.",
  },
  {
    title: "Pilot acquisition and commercial growth",
    body: "Targeted pilot acquisition, aviation-community outreach, marketplace growth, subscription conversion, and broader platform adoption.",
  },
  {
    title: "Strategic aviation integrations and relationships",
    body: "Expansion of aviation-data, service-provider, CFI, flight-school, FBO, association, and other strategic relationships.",
  },
  {
    title: "Operations, compliance, and runway",
    body: "Legal, insurance, compliance, infrastructure costs, specialized professional services, and reasonable operating runway.",
  },
];

const nearTermMilestones = [
  "Complete independent, requirements-based FAA Flight Service V&V and traceability.",
  "Address findings and progress the integration through the remaining production-readiness process.",
  "Increase registered and active pilot adoption through community, CFI, aviation-relationship, organic, and targeted channels.",
  "Expand subscription conversion, marketplace transactions, advertising, and other validated revenue channels.",
  "Grow relationships with instructors, schools, operators, aviation organizations, and service and technology providers.",
  "Continue hardening the platform for increased usage, aviation-data volume, and operational reliability.",
];

const businessModel = [
  "Aircraft rentals: free to list, with RSF earning a commission on completed rental transactions.",
  "Marketplace: paid listings and promotional placement where applicable.",
  "RSF Pro / Pro+: recurring subscription revenue for connected pilot workflow, planning, logbook, analytics, and advanced functionality.",
  "Advertising: aviation-focused advertising and partner placements.",
  "CFI and flight-school opportunities supported by professional and institutional workflows.",
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

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const title = "Ready Set Fly | $500K Pre-Seed Investor Materials";
    const description =
      "Ready Set Fly is raising a $500,000 pre-seed round to advance independent FAA Flight Service validation, commercialization, pilot growth, and reliable platform scale.";
    const canonical = `${window.location.origin}${INVESTOR_DECK_SHARE_PATH}`;
    const previousTitle = document.title;
    const touched: Array<{ element: HTMLMetaElement | HTMLLinkElement; previous: string | null; created: boolean }> = [];

    const setMeta = (selector: string, attribute: "name" | "property", key: string, content: string) => {
      let element = document.head.querySelector(selector) as HTMLMetaElement | null;
      const created = !element;
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      touched.push({ element, previous: element.getAttribute("content"), created });
      element.setAttribute("content", content);
    };

    document.title = title;
    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[property="og:title"]', "property", "og:title", title);
    setMeta('meta[property="og:description"]', "property", "og:description", description);
    setMeta('meta[property="og:url"]', "property", "og:url", canonical);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);

    let canonicalLink = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const canonicalCreated = !canonicalLink;
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      document.head.appendChild(canonicalLink);
    }
    touched.push({ element: canonicalLink, previous: canonicalLink.getAttribute("href"), created: canonicalCreated });
    canonicalLink.href = canonical;

    return () => {
      document.title = previousTitle;
      touched.forEach(({ element, previous, created }) => {
        if (created) element.remove();
        else if (element instanceof HTMLLinkElement) {
          if (previous === null) element.removeAttribute("href");
          else element.setAttribute("href", previous);
        } else if (previous === null) element.removeAttribute("content");
        else element.setAttribute("content", previous);
      });
    };
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
              $500,000 Pre-Seed Round Open
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
                The Connected General Aviation Workflow.
              </h1>
              <p className="text-base text-[#EEF3F9]/78 sm:text-lg">
                Founder-funded through the majority of platform development. Capital now advances validation,
                commercialization, growth, and scale.
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
              Ready Set Fly connects the fragmented general aviation workflow in one platform—helping pilots find
              aviation services, plan flights, access aviation weather and NOTAM intelligence, manage training and
              records, use a digital logbook, and remain within a connected aviation ecosystem. RSF has also developed
              an FAA Flight Service integration that is operating in the applicable test environment and undergoing
              validation, with independent requirements-based V&amp;V being pursued as part of the path toward production.
            </p>
          </div>
        </section>

        <section className="container mx-auto px-4 py-4 sm:px-6 sm:py-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#F0B429]">Why Capital Now</div>
            <div className="mt-4 flex flex-col gap-3">
              <h2 className="text-3xl font-bold tracking-tight text-[#0B1F3A]">$500,000 Pre-Seed Round</h2>
              <p className="max-w-4xl text-base leading-relaxed text-slate-700">
                RSF has already built a substantial operating platform spanning flight planning, aviation intelligence,
                pilot utilities, training workflows, digital records, aircraft rentals, marketplace functionality,
                subscriptions, and mobile and web experiences. This target round is intended to move the company through
                validation, production progression, commercialization, growth, and scale—not to build an initial MVP.
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
              <div className="text-sm font-semibold text-[#0B1F3A]">Differentiation</div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                RSF differentiates itself by combining marketplace discovery with an integrated pilot-tool and workflow
                ecosystem rather than competing as a single-purpose flight-planning or listing product. FAA Flight
                Service adds workflow depth and retention; it is not presented as a standalone revenue stream or as an
                approved production capability.
              </p>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-8 sm:px-6 sm:py-10">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#F0B429]">Use of Funds</div>
            <div className="mt-6 grid gap-x-8 gap-y-3 md:grid-cols-2">
              {investmentPriorities.map((priority) => (
                <div key={priority.title} className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#F0B429]" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{priority.title}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{priority.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#F0B429]">Near-Term Milestones</div>
              <div className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
                {nearTermMilestones.map((milestone) => (
                  <div key={milestone} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#F0B429]" />
                    <span className="text-sm leading-6 text-slate-800">{milestone}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#F0B429]">Business Model</div>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-700">
                Tool-led acquisition and aviation-community channels introduce pilots to RSF. Once inside, the connected
                platform expands their workflow across rentals, training, planning, records, subscriptions, and services.
              </p>
              <div className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
                {businessModel.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#F0B429]" />
                    <span className="text-sm leading-6 text-slate-800">{item}</span>
                  </div>
                ))}
              </div>
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
                  Ready Set Fly has reached approximately 2,600 active users YTD and generated nearly 79,000 user
                  events, with average engagement exceeding three minutes per active user. From Jan. 1–Aug. 10, 2026,
                  the core pilot-tool experience generated approximately 24,000 views, while the aviation marketplace
                  generated approximately 4,800 views from 317 active users. Early growth has been driven primarily by
                  direct traffic, aviation communities and organic outreach rather than significant paid customer
                  acquisition. These analytics describe active users, views, and events—not registered accounts, paying
                  customers, or completed marketplace transactions.
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
