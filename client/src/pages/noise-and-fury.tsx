import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import { Download, ExternalLink, Mail, Mic2, Shield, Sparkles } from "lucide-react";

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
  {
    title: '"We Die Young"',
    theme: "Birth of the Band · Reckless Youth · Early Promise",
    summary:
      "Seattle, 1988. Before the spotlight, Layne realizes in a broken rehearsal room that when he sings, the room changes. We meet Demri in full color, Jerry arrives from the edge of the scene, and the first rehearsal reveals a chemistry nobody can manufacture.",
    turningPoint:
      'Layne tells Jerry, "If I can’t feel it, I can’t sing," revealing the emotional cost that will define the next fourteen years.',
  },
  {
    title: '"Man in the Box"',
    theme: "Trapped by Choices · The Machine Begins",
    summary:
      "Alice in Chains steps into Columbia and then into the Facelift sessions at London Bridge as total outsiders. The band locks in, Jerden pushes confession over performance, MTV starts to notice, and the first wave of fame begins to distort what the public sees versus what is actually happening.",
    turningPoint:
      "Layne performs through his first serious withdrawal, and the gap between the crowd’s version of him and the truth widens for the first time.",
  },
  {
    title: '"Rooster"',
    theme: "The Band's War — External and Internal",
    summary:
      "Success makes everything louder, not easier. Jerry’s time with Chris Cornell and his father’s Vietnam trauma shape 'Rooster' while the band records Dirt, still sharp and funny until the momentum breaks with Layne’s overdose.",
    turningPoint:
      "Layne is revived, touring is disrupted, and the band faces the first real choice between protecting the music and protecting the person making it.",
  },
  {
    title: '"Would?"',
    theme: "Grief and Survivor's Guilt",
    summary:
      "Andrew Wood’s death changes the Seattle scene before the world even knows the scene exists. Jerry responds by writing 'Would?' while Demri’s health begins to decline and Layne absorbs the grief instead of speaking it.",
    turningPoint:
      'The recording of "Would?" becomes the first moment where the art and the life are completely indistinguishable.',
  },
  {
    title: '"Angry Chair"',
    theme: "The Last Outward Resistance",
    summary:
      "The Metallica tour pushes the band into international pressure, public tension, and mounting damage. Layne confronts ugliness in the crowd, Mike Starr spirals, and the machinery around the band starts demanding control at exactly the moment everything inside it is becoming unstable.",
    turningPoint:
      "Alice in Chains withdraws from the Metallica tour, the machine finally stops, and Layne’s resistance turns inward from that point on.",
  },
  {
    title: '"Nutshell"',
    theme: "The Accidental Masterpiece · The Season's Emotional Center",
    summary:
      "Jar of Flies is born out of burnout and isolation, almost by accident, and becomes a masterpiece. Then MTV Unplugged places Layne in front of the world as he is visibly fading, making public honesty feel unbearable to witness.",
    turningPoint:
      '"Nutshell" live becomes the season’s emotional center, the most honest public moment any of them will ever have.',
  },
  {
    title: '"Sea of Sorrow"',
    theme: "The Permanent Withdrawal · The Last Tether Snaps",
    summary:
      "After Unplugged, the world thinks Layne returned. He knows he cannot. Isolation becomes total, Jerry starts adapting toward survival, Demri’s health collapses, and once she dies, Layne does not explode so much as disappear.",
    turningPoint:
      'Layne calls his mother and says, "I’m so tired," the last real outward reach before the drowning is complete.',
  },
  {
    title: '"Rain When I Die"',
    theme: "Endings and Continuation · Legacy Without Erasure",
    summary:
      "April 2002. Layne is found, Seattle mourns, and Jerry and Sean are left with the grief of having seen the end coming and still being shattered by it. The final movement of the season is not replacement, but the decision to keep creating without erasing what was lost.",
    turningPoint:
      "Jerry steps back to the microphone and chooses continuation as an act of honor rather than escape.",
  },
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
  "Singles - a lived-in Seattle music world, expanded into long-form drama",
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

const teamProfiles = [
  {
    role: "Creator / Writer",
    name: "Cory Armer",
    paragraphs: [
      "Cory Armer is the creator and writer of Noise & Fury, a prestige anthology series exploring the rise, impact, and legacy of iconic rock bands. The project is currently in early development and has already generated strong interest from established industry professionals, with active outreach underway for showrunners and executive producers. Built around emotionally driven storytelling and cultural authenticity, Noise & Fury is designed to deliver a cinematic, character-first experience for modern streaming audiences.",
      "Cory brings a distinct, non-traditional path into the entertainment industry. With over 15 years of experience leading large-scale, branded hospitality operations, he has built a career grounded in execution, leadership, and performance. Managing high-volume environments and delivering consistent results within structured systems has shaped a disciplined, solutions-oriented approach that now carries into his creative work.",
      "He is also the founder of Ready Set Fly (RSF), an aviation platform built to modernize how pilots plan, train, and access aircraft. The platform reflects his ability to identify gaps in traditional industries and build scalable, real-world solutions, with early traction validating both the concept and execution.",
      "As a creator, Cory represents a rare combination of operational discipline, entrepreneurial vision, and creative ambition. His focus is on developing projects that are both culturally resonant and commercially viable, with Noise & Fury serving as the foundation for a broader slate of film and television development.",
    ],
  },
  {
    role: "Producer / Co-Creator & Writer",
    name: "Cesar Rameriz",
    paragraphs: [
      "Producer, co-creator, and writer helping shape the series concept, long-form dramatic world, and season architecture. His body of work includes Road to Juarez.",
    ],
  },
  {
    role: "Producer",
    name: "Scott Rosenfelt",
    paragraphs: [
      "Attached producer whose credits include Home Alone and Russkies. Brings proven market credibility and experienced guidance as the project moves toward packaging and buyer-facing conversations.",
    ],
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
    mutationFn: async (values: InvestorContactValues) =>
      apiRequest("POST", "/api/noise-and-fury/investor-contact", values),
    onSuccess: () => {
      trackEvent("cta_click", {
        label: "noise_fury_investor_contact_submit",
        target: "/api/noise-and-fury/investor-contact",
      });
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
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(145,98,42,0.16)_0%,_rgba(24,18,13,0.82)_24%,_rgba(6,6,7,1)_72%)] text-[#F4EEE9]">
      <section className="relative min-h-[92vh] overflow-hidden border-b border-[#8E6B3B]/18">
        <img
          src={HERO_IMAGE_PATH}
          alt="Noise and Fury amplifiers"
          className="absolute inset-0 h-full w-full object-cover object-[center_12%]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,6,7,0.18)_0%,rgba(6,6,7,0.48)_34%,rgba(6,6,7,0.78)_70%,rgba(6,6,7,0.96)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,6,5,0.78)_0%,rgba(8,6,5,0.28)_42%,rgba(8,6,5,0.14)_62%,rgba(8,6,5,0.82)_100%)]" />

        <div className="container relative mx-auto flex min-h-[92vh] flex-col px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-10">
          <div className="flex justify-center">
            <img
              src={MARC_LOGO_PATH}
              alt="MARC Production Enterprises"
              className="w-full max-w-[220px] rounded-[22px] border border-white/10 bg-[#0B0A0A]/70 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.48)] backdrop-blur"
            />
          </div>

          <div className="mt-8 flex flex-1 items-end">
            <div className="mx-auto w-full max-w-6xl">
              <div className="max-w-4xl space-y-6">
                <div className="space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.38em] text-[#E0BF84]">
                    Season One: Alice in Chains
                  </div>
                  <h1 className="max-w-4xl font-display text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl lg:text-8xl">
                    Noise &amp; Fury
                  </h1>
                  <p className="max-w-3xl text-lg leading-8 text-[#F0E1D2] sm:text-xl">
                    Season One: Alice in Chains. A prestige music drama designed to make the audience feel the era, the
                    cultural pull, and the emotional cost in one hit.
                  </p>
                </div>

                <div className="grid gap-3 pt-2 sm:grid-cols-3">
                  <div className="border-l border-[#D3A869]/45 bg-black/28 px-4 py-3 backdrop-blur">
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#B89258]">Created By</div>
                    <div className="mt-2 text-base font-semibold text-white">Cory Armer and Cesar Rameriz</div>
                  </div>
                  <div className="border-l border-[#D3A869]/45 bg-black/28 px-4 py-3 backdrop-blur">
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#B89258]">Written By</div>
                    <div className="mt-2 text-base font-semibold text-white">Cory Armer and Cesar Rameriz</div>
                  </div>
                  <div className="border-l border-[#D3A869]/45 bg-black/28 px-4 py-3 backdrop-blur">
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#B89258]">Packaging Round</div>
                    <div className="mt-2 text-base font-semibold text-white">$50,000 target</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button asChild size="lg" className="bg-[#D3A869] text-[#141414] hover:bg-[#deb980]">
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
                    className="border-white/15 bg-black/35 text-white hover:bg-black/50"
                  >
                    <a href="#investor-contact">
                      <Mail className="mr-2 h-4 w-4" />
                      Contact us
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 sm:pb-24">
        <section className="grid gap-px overflow-hidden rounded-[26px] border border-[#8E6B3B]/16 bg-[#2A2118]/40 md:grid-cols-4">
          {highlightStats.map((stat) => (
            <div key={stat.label} className="bg-[linear-gradient(180deg,rgba(14,12,11,0.96)_0%,rgba(10,10,11,0.98)_100%)] px-5 py-6">
              <div className="text-3xl font-semibold tracking-[-0.04em] text-[#D3A869]">{stat.value}</div>
              <div className="mt-2 text-sm font-semibold text-white">{stat.label}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#8C7B70]">{stat.detail}</div>
            </div>
          ))}
        </section>

        <section className="border-b border-[#8E6B3B]/14 py-14">
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#B89258]">Why this can matter now</div>
              <h2 className="font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                Not a biopic pitch. A pressure-cooked prestige drama.
              </h2>
            </div>

            <div className="space-y-6 text-base leading-8 text-[#E3D5C6]">
              <p>
                This is not a nostalgia play. It is a modern prestige series about brotherhood, ambition, grief,
                addiction, survival, and the artistic cost of becoming part of American music history.
              </p>
              <p>
                The audience that lived this era is now in the prime prestige-drama window, while a younger audience
                continues discovering Alice in Chains without inherited mythology. That creates a rare bridge between
                cultural memory and fresh audience curiosity.
              </p>
              <p>
                Scripts exist. The world is built. WGA registrations are complete. Producer Scott Rosenfelt is attached.
                The project is already materially beyond concept stage and is ready to be packaged with discipline.
              </p>

              <div className="grid gap-6 pt-2 md:grid-cols-2">
                <div className="border-l border-[#D3A869]/40 pl-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#B89258]">What capital unlocks</div>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-[#E8DCCD]">
                    {useOfFunds.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </div>
                </div>
                <div className="border-l border-[#D3A869]/40 pl-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#B89258]">Why the package is credible</div>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-[#E8DCCD]">
                    <div>Existing scripts, a series bible, and completed WGA registrations.</div>
                    <div>Attached producer with recognized feature credentials.</div>
                    <div>Clear ethical framework and an emotionally coherent season arc.</div>
                    <div>A built-in audience that still feels culturally active and valuable.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#8E6B3B]/14 py-14">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr]">
            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#B89258]">Season one</div>
              <h2 className="font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                Eight episodes. One inevitable descent.
              </h2>
              <div className="max-w-md text-base leading-8 text-[#D9CCBF]">
                The season is structured like a record you can feel getting heavier. Each episode advances the band, the
                relationships, and the cost.
              </div>
            </div>

            <div className="divide-y divide-[#8E6B3B]/12 overflow-hidden rounded-[28px] border border-[#8E6B3B]/14 bg-[linear-gradient(180deg,rgba(15,13,12,0.96)_0%,rgba(9,10,11,0.98)_100%)]">
              {episodeRun.map((episode, index) => (
                <div key={episode.title} className="grid gap-5 px-5 py-6 md:grid-cols-[84px_1fr] md:px-7">
                  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[#B89258]">
                    EP {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-lg font-semibold text-white sm:text-xl">{episode.title}</div>
                      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#B89258]">
                        {episode.theme}
                      </div>
                    </div>
                    <div className="text-sm leading-7 text-[#E8DCCD] sm:text-base">{episode.summary}</div>
                    <div className="border-l border-[#D3A869]/38 pl-4 text-sm leading-7 text-[#F0E4D7]">
                      <span className="font-semibold text-white">Turning point:</span> {episode.turningPoint}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#8E6B3B]/14 py-14">
          <div className="grid gap-10 lg:grid-cols-[0.86fr_1.14fr]">
            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#B89258]">Writer and producer bios</div>
              <h2 className="font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                The team shaping the package.
              </h2>
              <div className="max-w-md text-base leading-8 text-[#D9CCBF]">
                Investors are backing not just a script package, but the people carrying it into serious conversations.
              </div>
            </div>

            <div className="grid gap-px overflow-hidden rounded-[28px] border border-[#8E6B3B]/14 bg-[#2A2118]/40">
              {teamProfiles.map((profile) => (
                <div
                  key={profile.name}
                  className="grid gap-4 bg-[linear-gradient(180deg,rgba(14,12,11,0.96)_0%,rgba(9,10,11,0.98)_100%)] px-6 py-6 md:grid-cols-[190px_1fr]"
                >
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B89258]">{profile.role}</div>
                    <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">{profile.name}</div>
                  </div>
                  <div className="space-y-4 text-sm leading-7 text-[#E6D9CC]">
                    {profile.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#8E6B3B]/14 py-14">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#B89258]">Character core</div>
                <h2 className="font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                  The people have to feel as alive as the music.
                </h2>
              </div>
              <div className="grid gap-4">
                {characterCards.map((character) => (
                  <div key={character.name} className="border-l border-[#D3A869]/38 pl-5">
                    <div className="text-lg font-semibold text-white">{character.name}</div>
                    <div className="mt-2 text-sm leading-7 text-[#DED1C5]">{character.summary}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#B89258]">Tonal DNA</div>
                <div className="mt-5 space-y-4">
                  {toneReferences.map((reference) => (
                    <div key={reference} className="border-b border-[#8E6B3B]/12 pb-4 text-sm leading-7 text-[#E1D5C8]">
                      {reference}
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-l border-[#D3A869]/38 pl-5">
                <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#B89258]">Investor frame</div>
                <div className="mt-4 text-base leading-8 text-[#F0E4D7]">
                  Prestige-biographical storytelling with a built-in cross-generational audience, unusually strong
                  cultural memory, and a package already moving with adult seriousness.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-10 py-14 lg:grid-cols-[0.86fr_1.14fr]">
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-[#D3A869]">
              <Shield className="h-4 w-4" />
              <div className="text-xs font-semibold uppercase tracking-[0.26em]">Safeguard protocol</div>
            </div>
            <h2 className="font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
              Built with ethical guardrails.
            </h2>
            <div className="text-base leading-8 text-[#D9CCBF]">
              A 12-rule ethical framework governs the scripts. This project is designed to honor the real people at its
              center, not exploit them.
            </div>
            <div className="space-y-3">
              {safeguards.map((item) => (
                <div key={item} className="border-l border-[#D3A869]/38 pl-4 text-sm leading-7 text-[#E6D9CC]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div
            id="investor-contact"
            className="rounded-[30px] border border-[#8E6B3B]/16 bg-[linear-gradient(180deg,rgba(14,13,12,0.96)_0%,rgba(8,9,10,0.98)_100%)] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.32)] sm:p-8"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#D3A869]">
                <Mail className="h-4 w-4" />
                <div className="text-xs font-semibold uppercase tracking-[0.26em]">Investor contact</div>
              </div>
              <h2 className="font-display text-4xl font-semibold tracking-[-0.05em] text-white">
                Interested in discussing the project?
              </h2>
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
            </div>

            <div className="mt-8">
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
                          <Input
                            {...field}
                            type="email"
                            placeholder="jane@fund.com"
                            className="border-white/12 bg-[#111821] text-white"
                          />
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
                          <Input
                            {...field}
                            placeholder="Interested in the Noise & Fury packaging round"
                            className="border-white/12 bg-[#111821] text-white"
                          />
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
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
