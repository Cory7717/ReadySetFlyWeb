import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  ExternalLink,
  Film,
  Mail,
  Mic2,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";

const PDF_PATH = "/downloads/noise-and-fury-investor-v2.pdf";
const HERO_IMAGE_PATH = "/downloads/noise-and-fury-hero.jpg";
const MARC_LOGO_PATH = "/downloads/marc-production-logo.jpg";

const highlightStats = [
  { value: "8", label: "Prestige episodes", detail: "Season one mapped end-to-end" },
  { value: "7 of 8", label: "Scripts written", detail: "Series bible and scripts already underway" },
  { value: "2", label: "WGA registrations", detail: "Scripts and series bible registered" },
  { value: "$50K", label: "Packaging target", detail: "Designed to move the project into market" },
];

const episodeRun = [
  "We Die Young - Formation. Joy. The cost implied.",
  "Man in the Box - Columbia Records. Facelift. The machine starts.",
  "Rooster - Dirt. Jerry and Cornell. First overdose.",
  "Would? - Andrew Wood. Grief without language.",
  "Angry Chair - The Metallica tour. Last outward resistance.",
  "Nutshell - Jar of Flies. MTV Unplugged. The world watching.",
  "Sea of Sorrow - Demri. The permanent withdrawal.",
  "Rain When I Die - April 2002. Legacy without erasure.",
];

const characterCards = [
  {
    name: "Layne Staley",
    summary: "The voice. Funny, magnetic, and fully alive before the cost arrives.",
  },
  {
    name: "Jerry Cantrell",
    summary: "The witness. The survivor. Still here. Still carrying the music.",
  },
  {
    name: "Demri Parrott",
    summary: "The season's moral center. Not a muse. Not a victim. A fully present person.",
  },
  {
    name: "Sean Kinney and Mike Starr",
    summary: "The rhythm section and emotional ballast of a band trying to stay intact while everything around it shifts.",
  },
];

const toneReferences = [
  "Boardwalk Empire - period authenticity with moral complexity",
  "True Detective Season 1 - tonal commitment without nihilism",
  "The Crown - prestige biographical storytelling over time",
  "Singles - a lived-in Seattle music world, but expanded into long-form drama",
];

const safeguards = [
  "No glorification of addiction",
  "No blame assignment around death or relapse",
  "No exploitation of the manner of death",
  "The dignity of every real person depicted is non-negotiable",
];

const useOfFunds = [
  "Showrunner and executive producer attachment support",
  "Legal, clearances, and chain-of-title work",
  "Pitch materials refinement",
  "Travel and industry meetings",
  "Administrative and development expenses",
];

const investorContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type InvestorContactValues = z.infer<typeof investorContactSchema>;

function trackDownload(label: string, path: string) {
  trackEvent("cta_click", { label, target: path });
}

export default function NoiseAndFuryPage() {
  const { toast } = useToast();

  useEffect(() => {
    trackEvent("noise_fury_investor_page_view", { page: "/noiseandfury" });
  }, []);

  const form = useForm<InvestorContactValues>({
    resolver: zodResolver(investorContactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      subject: "Noise & Fury investor inquiry",
      message: "I am interested in discussing the Noise & Fury packaging round, investor materials, and next steps.",
    },
  });

  const sendInvestorContactMutation = useMutation({
    mutationFn: async (values: InvestorContactValues) => apiRequest("POST", "/api/noise-and-fury/investor-contact", values),
    onSuccess: () => {
      trackEvent("cta_click", { label: "noise_fury_investor_contact_submit", target: "/api/noise-and-fury/investor-contact" });
      toast({
        title: "Inquiry sent",
        description: "Your Noise & Fury investor inquiry has been delivered.",
      });
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        subject: "Noise & Fury investor inquiry",
        message: "I am interested in discussing the Noise & Fury packaging round, investor materials, and next steps.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to send inquiry",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(139,88,32,0.18)_0%,_rgba(23,16,12,0.84)_22%,_rgba(6,6,7,1)_72%)] text-[#F4EEE9]">
      <section className="relative overflow-hidden border-b border-[#8E6B3B]/20">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,6,0.28)_0%,rgba(5,5,6,0.62)_44%,rgba(5,5,6,0.94)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(180,128,56,0.18)_0%,rgba(5,5,6,0)_48%)]" />
        <img
          src={HERO_IMAGE_PATH}
          alt="Noise and Fury amplifiers"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-24 mix-blend-screen"
        />
        <div className="container relative mx-auto px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-14">
          <div className="mx-auto max-w-6xl space-y-10">
            <div className="flex justify-center">
              <img
                src={MARC_LOGO_PATH}
                alt="MARC Production Enterprises"
                className="w-full max-w-[320px] rounded-[28px] border border-white/8 bg-[#0B0A0A]/72 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.45)] backdrop-blur"
              />
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <Badge className="border border-[#D3A869]/35 bg-[#D3A869]/10 px-3 py-1 text-[#E0BF84]">
                Investor Overview
              </Badge>
              <Badge className="border border-white/10 bg-white/5 px-3 py-1 text-[#D4C3B1]">
                Prestige Limited Series
              </Badge>
              <Badge className="border border-white/10 bg-white/5 px-3 py-1 text-[#D4C3B1]">
                Confidential Project Materials
              </Badge>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
              <div className="space-y-6">
                <div className="space-y-4 text-center lg:text-left">
                  <div className="text-xs font-semibold uppercase tracking-[0.42em] text-[#B89258]">
                    The music. The pain. The truth.
                  </div>
                  <h1 className="max-w-4xl font-display text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
                    Noise &amp; Fury
                  </h1>
                  <p className="max-w-3xl text-lg leading-8 text-[#E5D4C0] sm:text-xl">
                    Season One: Alice in Chains. A prestige music drama built to make investors and buyers feel the era
                    in their chest, not just understand it on paper.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[26px] border border-white/10 bg-[#0B0D10]/72 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.36)] backdrop-blur">
                    <div className="text-xs font-semibold uppercase tracking-[0.26em] text-[#B89258]">Created By</div>
                    <div className="mt-3 text-xl font-semibold text-white">Cory Armer and Cesar Rameriz</div>
                  </div>
                  <div className="rounded-[26px] border border-white/10 bg-[#0B0D10]/72 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.36)] backdrop-blur">
                    <div className="text-xs font-semibold uppercase tracking-[0.26em] text-[#B89258]">Written By</div>
                    <div className="mt-3 text-xl font-semibold text-white">Cory Armer</div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-[#8E6B3B]/28 bg-[linear-gradient(135deg,rgba(32,22,16,0.88)_0%,rgba(10,10,11,0.94)_100%)] p-6 shadow-[0_26px_70px_rgba(0,0,0,0.45)]">
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C8A26B]">Why this can matter now</div>
                  <div className="mt-4 space-y-4 text-sm leading-7 text-[#E4D6C7] sm:text-base">
                    <p>
                      This is not a nostalgia play. It is a modern prestige series about brotherhood, ambition, grief,
                      addiction, and survival inside one of the most emotionally resonant catalogs of the 1990s.
                    </p>
                    <p>
                      The audience that lived this era is now in the prime prestige-drama window, while a younger
                      audience keeps finding Alice in Chains without any prior emotional framing. That overlap is rare.
                    </p>
                    <p className="text-[#F4E8DA]">
                      Scripts exist. The world is built. WGA registrations are complete. Producer Scott Rosenfelt is
                      attached. This is a packageable project, not a concept waiting to become one.
                    </p>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button
                      asChild
                      size="lg"
                      className="bg-[#D3A869] text-[#141414] hover:bg-[#deb980]"
                    >
                      <a
                        href={PDF_PATH}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackDownload("noise_fury_download_pdf", PDF_PATH)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download investor overview
                      </a>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                    >
                      <a href="#investor-contact">
                        <Mail className="mr-2 h-4 w-4" />
                        Contact us
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[#0B0A0A]/78 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
                  <img
                    src={HERO_IMAGE_PATH}
                    alt="Noise and Fury key art"
                    className="aspect-square w-full object-cover object-center"
                  />
                </div>
                <div className="rounded-[28px] border border-[#8E6B3B]/24 bg-[linear-gradient(180deg,rgba(35,21,15,0.88)_0%,rgba(11,11,12,0.96)_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
                  <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#D3A869]">Packaging round</div>
                  <div className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">$50,000</div>
                  <p className="mt-3 text-sm leading-7 text-[#E2D5CC]">
                    Purpose-built capital to move Noise &amp; Fury from a fully developed writing package into a serious
                    market-facing project with the right attachments, legal readiness, and pitch materials.
                  </p>
                  <div className="mt-6 space-y-3">
                    {useOfFunds.map((item) => (
                      <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-[#F0E8E1]">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#D3A869]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto space-y-8 px-4 py-10 sm:px-6 sm:py-14">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {highlightStats.map((stat) => (
            <div key={stat.label} className="rounded-[24px] border border-[#8E6B3B]/18 bg-[linear-gradient(180deg,rgba(18,15,13,0.9)_0%,rgba(10,12,16,0.94)_100%)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.34)]">
              <div className="text-3xl font-semibold tracking-[-0.04em] text-[#D3A869]">{stat.value}</div>
              <div className="mt-2 text-sm font-semibold text-white">{stat.label}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#8C7B70]">{stat.detail}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
          <Card className="border-[#8E6B3B]/18 bg-[linear-gradient(180deg,rgba(26,18,14,0.92)_0%,rgba(9,11,14,0.96)_100%)] text-[#F4EEE9]">
            <CardHeader>
              <div className="flex items-center gap-2 text-[#D3A869]">
                <Film className="h-4 w-4" />
                <div className="text-xs font-semibold uppercase tracking-[0.26em]">The emotional hook</div>
              </div>
              <CardTitle className="text-3xl text-white">Not a rock poster. A human story with market gravity.</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-sm leading-7 text-[#E0D3C6]">
              <p>
                Noise &amp; Fury is designed to feel like a stage amp turned all the way up in a dark room: intimate,
                bruising, dangerous, and impossible to ignore.
              </p>
              <p>
                The goal is to make a visitor feel the pressure of the Seattle scene, the bonds inside the band, and
                the emotional consequences that made the music unforgettable.
              </p>
              <div className="rounded-[24px] border border-white/8 bg-white/5 p-5 text-[#F4E8DA]">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#B89258]">Investor frame</div>
                <div className="mt-3 text-base leading-7">
                  Prestige-biographical storytelling with a built-in cross-generational audience, unusually strong
                  cultural memory, and a package that is already materially de-risked.
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[#090909] shadow-[0_28px_90px_rgba(0,0,0,0.44)]">
            <img
              src={HERO_IMAGE_PATH}
              alt="Noise and Fury amplifiers and title treatment"
              className="h-full w-full object-cover object-center"
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <Card className="border-white/10 bg-[#0B1016]/90 text-[#F4EEE9]">
            <CardHeader>
              <div className="flex items-center gap-2 text-[#D3A869]">
                <Film className="h-4 w-4" />
                <div className="text-xs font-semibold uppercase tracking-[0.26em]">The show</div>
              </div>
              <CardTitle className="text-3xl text-white">Prestige music drama with a built-in audience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-sm leading-7 text-[#DDCFC5]">
              <p>
                Noise & Fury is an unflinching look at the formation and evolution of Alice in Chains, set against the
                birth of the Seattle grunge movement - where brotherhood, ambition, and addiction collide in the pursuit
                of something that would redefine music forever.
              </p>
              <p>
                The opportunity is unusually clean: the core 35-55 prestige audience has lived proximity to the era,
                while a second audience is discovering the band now. "Nutshell" and other tracks continue to trend in
                ways that would have been unimaginable in 2002.
              </p>
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#B18B6A]">Created by</div>
                <div className="mt-2 text-lg font-semibold text-white">Cory Armer and Cesar Rameriz</div>
                <div className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#B18B6A]">Written by</div>
                <div className="mt-2 text-lg font-semibold text-white">Cory Armer</div>
                <div className="mt-2 text-sm text-[#D7C8BD]">
                  WGA 2317225 (Scripts) and 2333978 (Series Bible)
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(31,11,11,0.96)_0%,rgba(11,16,22,0.98)_100%)] text-[#F4EEE9]">
            <CardHeader>
              <div className="flex items-center gap-2 text-[#D3A869]">
                <Users className="h-4 w-4" />
                <div className="text-xs font-semibold uppercase tracking-[0.26em]">Investment thesis</div>
              </div>
              <CardTitle className="text-3xl text-white">Why this page exists</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-[#DFD1C8]">
              <p>
                This is a packageable, prestige-ready project built around one of the most emotionally resonant catalogs
                of the 1990s. The material is already far beyond idea-stage development.
              </p>
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                  <div className="text-sm font-semibold text-white">What makes the package credible</div>
                  <div className="mt-2 text-sm text-[#D8CAC0]">
                    Existing scripts, a series bible, producer attachment, WGA registrations, and a sharply defined
                    ethical framework.
                  </div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                  <div className="text-sm font-semibold text-white">What capital unlocks</div>
                  <div className="mt-2 text-sm text-[#D8CAC0]">
                    Better attachments, cleaner legal readiness, sharper market-facing materials, and faster path into
                    serious conversations with buyers and partners.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
          <Card className="border-white/10 bg-[#0B1016]/90 text-[#F4EEE9]">
            <CardHeader>
              <div className="flex items-center gap-2 text-[#D3A869]">
                <Mic2 className="h-4 w-4" />
                <div className="text-xs font-semibold uppercase tracking-[0.26em]">Season one</div>
              </div>
              <CardTitle className="text-3xl text-white">Eight episodes, one unavoidable trajectory</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {episodeRun.map((episode) => (
                <div key={episode} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm leading-6 text-[#E3D7CF]">
                  {episode}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-white/10 bg-[#0B1016]/90 text-[#F4EEE9]">
              <CardHeader>
                <CardTitle className="text-2xl text-white">Key characters</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {characterCards.map((character) => (
                  <div key={character.name} className="rounded-2xl border border-white/8 bg-white/4 p-4">
                    <div className="text-sm font-semibold text-white">{character.name}</div>
                    <div className="mt-2 text-sm leading-6 text-[#DCCEC3]">{character.summary}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#0B1016]/90 text-[#F4EEE9]">
              <CardHeader>
                <CardTitle className="text-2xl text-white">Tone references</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {toneReferences.map((reference) => (
                  <div key={reference} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm leading-6 text-[#DCCEC3]">
                    {reference}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(34,10,10,0.95)_0%,rgba(11,16,22,0.98)_100%)] text-[#F4EEE9]">
            <CardHeader>
              <div className="flex items-center gap-2 text-[#D3A869]">
                <Shield className="h-4 w-4" />
                <div className="text-xs font-semibold uppercase tracking-[0.26em]">Safeguard protocol</div>
              </div>
              <CardTitle className="text-3xl text-white">Built with ethical guardrails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-[#DFD2C8]">
              <p>
                A 12-rule ethical framework governs the scripts. This project is designed to honor the people at its
                center, not exploit them.
              </p>
              {safeguards.map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card id="investor-contact" className="border-white/10 bg-[#0B1016]/90 text-[#F4EEE9]">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-2 text-[#D3A869]">
                <Mail className="h-4 w-4" />
                <div className="text-xs font-semibold uppercase tracking-[0.26em]">Investor contact</div>
              </div>
              <CardTitle className="text-3xl text-white">Interested in discussing the project?</CardTitle>
              <div className="text-sm leading-7 text-[#D9CBC1]">
                Send a note directly from this page. Noise &amp; Fury investor inquiries are delivered to{" "}
                <span className="font-semibold text-white">coryarmer@gmail.com</span>, with{" "}
                <span className="font-semibold text-white">ceo@marcmovies.com</span> copied.
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  asChild
                  variant="outline"
                  className="border-white/12 bg-white/5 text-white hover:bg-white/10"
                >
                  <a
                    href={PDF_PATH}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackDownload("noise_fury_download_footer_pdf", PDF_PATH)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download overview PDF
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-white/12 bg-white/5 text-white hover:bg-white/10"
                >
                  <a href="mailto:coryarmer@gmail.com?cc=ceo@marcmovies.com&subject=Noise%20%26%20Fury%20Investor%20Inquiry">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Email direct
                  </a>
                </Button>
              </div>
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
                          <FormLabel className="text-[#E9DED6]">First name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Jane" className="border-white/12 bg-[#111821] text-white" />
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
                          <FormLabel className="text-[#E9DED6]">Last name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Investor" className="border-white/12 bg-[#111821] text-white" />
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
                        <FormLabel className="text-[#E9DED6]">Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="jane@fund.com" className="border-white/12 bg-[#111821] text-white" />
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
                        <FormLabel className="text-[#E9DED6]">Subject</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Interested in the Noise & Fury packaging round" className="border-white/12 bg-[#111821] text-white" />
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
                        <FormLabel className="text-[#E9DED6]">Message</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            className="min-h-[150px] border-white/12 bg-[#111821] text-white"
                            placeholder="Share your interest, fund focus, timeline, and the best way to follow up."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full bg-[#D3A869] text-[#121212] hover:bg-[#deb980]"
                    disabled={sendInvestorContactMutation.isPending}
                  >
                    {sendInvestorContactMutation.isPending ? "Sending..." : "Send investor inquiry"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
