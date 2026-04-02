import { useEffect, useState } from "react";
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
import { ChevronDown, Download, ExternalLink, Mail, Shield } from "lucide-react";

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
    theme: "Birth of the Band / Reckless Youth / Early Promise",
    summary:
      "Seattle, 1988. Before the spotlight. Before expectations. Before anyone understands what this is about to become. Layne realizes in a rehearsal room that when he sings, the room changes. We meet Demri as a fully present force in her own right, Jerry arrives from the edge of the scene, and the first rehearsal reveals a chemistry nobody can manufacture.",
    turningPoint:
      'Layne tells Jerry, "If I cannot feel it, I cannot sing," revealing exactly what the next fourteen years will cost.',
  },
  {
    title: '"Man in the Box"',
    theme: "Trapped by Choices / The Machine Begins",
    summary:
      "Alice in Chains walks into Columbia and into the Facelift era as total outsiders. The band locks into its studio rhythm, Dave Jerden pushes confession over performance, MTV starts to notice, and the first real machine of fame begins moving around them while Layne's private reality starts slipping out of sync with what the public sees.",
    turningPoint:
      "Layne performs through his first serious withdrawal, and the gap between the crowd's version of him and the truth widens for the first time.",
  },
  {
    title: '"Rooster"',
    theme: "The Band's War / External and Internal",
    summary:
      "Success makes everything louder. Jerry's time with Chris Cornell and his father's Vietnam trauma shape Rooster while the band records Dirt with confidence, danger, and mounting strain. The music is undeniable, right up to the moment Layne's overdose stops everything cold.",
    turningPoint:
      "Layne is revived, touring is disrupted, and the band faces the first real choice between protecting the music and protecting the person making it.",
  },
  {
    title: '"Would?"',
    theme: "Grief and Survivor's Guilt",
    summary:
      "Andrew Wood's overdose changes the Seattle scene before the rest of the world even knows the scene exists. Jerry responds by writing Would? while Demri's health begins to decline and Layne absorbs the grief instead of speaking it. The scene, the friendships, and the private emotional damage all begin to merge.",
    turningPoint:
      "The recording of Would? becomes the first moment where the art and the life are completely indistinguishable.",
  },
  {
    title: '"Angry Chair"',
    theme: "The Last Outward Resistance",
    summary:
      "The Metallica tour pushes the band into international pressure, public tension, and growing internal collapse. Layne confronts ugliness in the crowd, Mike Starr spirals, and the machinery around the band starts pushing for control just as everything inside the band is becoming unstable.",
    turningPoint:
      "Alice in Chains withdraws from the Metallica tour, the machine finally stops, and Layne's resistance turns inward from that point on.",
  },
  {
    title: '"Nutshell"',
    theme: "The Accidental Masterpiece / The Season's Emotional Center",
    summary:
      "Jar of Flies is born in a week of burnout and isolation and becomes an accidental masterpiece. Then MTV Unplugged places Layne in front of the world as he is visibly fading, making public honesty feel unbearable to witness and impossible to forget.",
    turningPoint:
      "Nutshell live becomes the season's emotional center, the most honest public moment any of them will ever have.",
  },
  {
    title: '"Sea of Sorrow"',
    theme: "The Permanent Withdrawal / The Last Tether Snaps",
    summary:
      "After Unplugged, the world thinks Layne came back. Layne knows he cannot do that again. Isolation becomes chosen and total, Jerry starts adapting toward survival, Demri's health collapses, and after her death, Layne does not explode so much as disappear. The band dissolves as a living organism.",
    turningPoint:
      'Layne calls his mother and says, "I am so tired," the last outward reach before the drowning is complete.',
  },
  {
    title: '"Rain When I Die"',
    theme: "Endings and Continuation / Legacy Without Erasure",
    summary:
      "April 2002. Layne is found, Seattle mourns, and Jerry and Sean are left with the grief of having seen the end coming and still being shattered by it. The final movement of the season is not about replacement, but about the decision to continue creating without erasing what was lost.",
    turningPoint:
      "Jerry steps back to the microphone and chooses continuation as an act of honoring rather than escape.",
  },
];

const characterCards = [
  { name: "Layne Staley", summary: "The voice. Funny, magnetic, and fully alive before the cost arrives." },
  { name: "Jerry Cantrell", summary: "The witness. The survivor. Still here. Still carrying the music." },
  { name: "Demri Parrott", summary: "The season's moral center. Not a muse. Not a victim. A fully present person." },
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
    teaser:
      "Creator of Noise & Fury and founder of RSF, with the core operating and creative context behind the project.",
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
    teaser:
      "Producer, co-creator, and writer shaping the dramatic world, with Road to Juarez among his credits.",
    paragraphs: [
      "Producer, co-creator, and writer helping shape the series concept, long-form dramatic world, and season architecture. His body of work includes Road to Juarez.",
    ],
  },
  {
    role: "Producer",
    name: "Scott Rosenfelt",
    teaser:
      "Attached producer bringing proven feature credibility and experienced packaging guidance.",
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

function excerpt(text: string, max = 172) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

export default function NoiseAndFuryPage() {
  const { toast } = useToast();
  const [openBioName, setOpenBioName] = useState("Cory Armer");
  const [openEpisodeTitle, setOpenEpisodeTitle] = useState('"We Die Young"');

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
                    Season One: Alice in Chains. A prestige music drama designed to make audiences feel the era,
                    the cultural pull, and the emotional cost in one hit.
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
                  <Button asChild size="lg" variant="outline" className="border-white/15 bg-black/35 text-white hover:bg-black/50">
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

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6 rounded-[30px] border border-[#8E6B3B]/18 bg-[linear-gradient(180deg,rgba(17,14,12,0.94)_0%,rgba(8,8,9,0.98)_100%)] p-7 shadow-[0_18px_60px_rgba(0,0,0,0.25)] sm:p-9">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#C59A5E]">Why This Can Matter Now</div>
              <h2 className="font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                Not a rock poster. A human story with market gravity.
              </h2>
            </div>
            <div className="grid gap-5 text-[15px] leading-8 text-[#D7CCC2] md:grid-cols-2">
              <p>
                This is not a nostalgia play. It is a modern prestige series about fame, addiction,
                friendship, grief, ambition, and the emotional residue left after cultural movements burn
                hot and disappear. Investors are backing a project designed to speak to both music-history
                audiences and premium-drama buyers.
              </p>
              <p>
                The package already carries serious development momentum, and the current round is built to
                support showrunner outreach, executive producer conversations, legal refinement, and buyer-
                facing materials that help the project move with credibility.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[28px] border border-[#8E6B3B]/18 bg-black/45 p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#C59A5E]">Packaging Round</div>
              <div className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">$50,000</div>
              <div className="mt-2 text-sm leading-7 text-[#CFC2B5]">
                The current raise supports packaging, clearances, legal work, materials, and the meetings
                needed to move the series into higher-level conversations.
              </div>
            </div>
            <div className="rounded-[28px] border border-[#8E6B3B]/18 bg-black/45 p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#C59A5E]">Use of Funds</div>
              <div className="mt-4 space-y-3">
                {useOfFunds.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[#E4D7C9]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#C59A5E]">Season One Run</div>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
              Eight episodes. One emotional descent.
            </h2>
            <p className="mt-4 text-base leading-8 text-[#CEC1B5] sm:text-lg">
              Click into each episode to reveal the packaging summary and the turning point that drives the hour.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {episodeRun.map((episode, index) => {
              const isOpen = openEpisodeTitle === episode.title;
              return (
                <button
                  key={episode.title}
                  type="button"
                  onClick={() => setOpenEpisodeTitle(isOpen ? '"We Die Young"' : episode.title)}
                  className="group rounded-[28px] border border-[#8E6B3B]/18 bg-[linear-gradient(180deg,rgba(15,12,10,0.96)_0%,rgba(9,9,10,0.98)_100%)] p-6 text-left transition hover:border-[#B88A50]/55 hover:bg-[linear-gradient(180deg,rgba(22,17,13,0.98)_0%,rgba(10,10,11,1)_100%)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.28em] text-[#B89258]">EP {index + 1}</div>
                      <div className="mt-2 font-display text-3xl font-semibold tracking-[-0.05em] text-white">
                        {episode.title}
                      </div>
                      <div className="mt-2 text-sm uppercase tracking-[0.18em] text-[#B8AA9C]">{episode.theme}</div>
                    </div>
                    <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-[#D3A869] transition-transform ${isOpen ? "rotate-180" : "rotate-0"}`} />
                  </div>

                  <div className="mt-5 text-[15px] leading-7 text-[#D8CCC0]">
                    {isOpen ? episode.summary : excerpt(episode.summary)}
                  </div>

                  {isOpen ? (
                    <div className="mt-5 rounded-[22px] border border-[#8E6B3B]/20 bg-[#16110D]/85 px-4 py-4">
                      <div className="text-[11px] uppercase tracking-[0.28em] text-[#C59A5E]">Turning Point</div>
                      <div className="mt-2 text-sm leading-7 text-[#F0E4D6]">{episode.turningPoint}</div>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-16">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#C59A5E]">Writer and Producer Bios</div>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
              The team shaping the package.
            </h2>
            <p className="mt-4 text-base leading-8 text-[#CEC1B5] sm:text-lg">
              Click into each profile to reveal the full bio. Cory opens by default because he carries the core creator and founder context behind the project.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {teamProfiles.map((profile) => {
              const isOpen = openBioName === profile.name;
              return (
                <button
                  key={profile.name}
                  type="button"
                  onClick={() => setOpenBioName(isOpen ? "Cory Armer" : profile.name)}
                  className="group h-full rounded-[30px] border border-[#8E6B3B]/18 bg-[linear-gradient(180deg,rgba(15,12,10,0.96)_0%,rgba(9,9,10,0.98)_100%)] p-6 text-left transition hover:border-[#B88A50]/55 hover:bg-[linear-gradient(180deg,rgba(22,17,13,0.98)_0%,rgba(10,10,11,1)_100%)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.28em] text-[#B89258]">{profile.role}</div>
                      <div className="mt-3 font-display text-3xl font-semibold tracking-[-0.05em] text-white">{profile.name}</div>
                    </div>
                    <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-[#D3A869] transition-transform ${isOpen ? "rotate-180" : "rotate-0"}`} />
                  </div>

                  <div className="mt-4 text-sm leading-7 text-[#D3C6BA]">{profile.teaser}</div>

                  {isOpen ? (
                    <div className="mt-5 space-y-4 border-t border-white/10 pt-5 text-sm leading-7 text-[#EFE3D7]">
                      {profile.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-16 grid gap-8 lg:grid-cols-2">
          <div className="rounded-[30px] border border-[#8E6B3B]/18 bg-[linear-gradient(180deg,rgba(15,12,10,0.96)_0%,rgba(9,9,10,0.98)_100%)] p-7 sm:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#C59A5E]">Character Core</div>
            <h3 className="mt-3 font-display text-3xl font-semibold tracking-[-0.05em] text-white">The people at the center.</h3>
            <div className="mt-6 grid gap-4">
              {characterCards.map((character) => (
                <div key={character.name} className="rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-4">
                  <div className="text-lg font-semibold text-white">{character.name}</div>
                  <div className="mt-2 text-sm leading-7 text-[#D3C6BA]">{character.summary}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-[30px] border border-[#8E6B3B]/18 bg-[linear-gradient(180deg,rgba(15,12,10,0.96)_0%,rgba(9,9,10,0.98)_100%)] p-7 sm:p-8">
              <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#C59A5E]">Tonal DNA</div>
              <div className="mt-5 space-y-3">
                {toneReferences.map((item) => (
                  <div key={item} className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-7 text-[#E7DACD]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[30px] border border-[#8E6B3B]/18 bg-[linear-gradient(180deg,rgba(15,12,10,0.96)_0%,rgba(9,9,10,0.98)_100%)] p-7 sm:p-8">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.34em] text-[#C59A5E]">
                <Shield className="h-4 w-4" />
                Ethical guardrails
              </div>
              <div className="mt-5 grid gap-3">
                {safeguards.map((item) => (
                  <div key={item} className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[#E7DACD]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="investor-contact" className="mt-16 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6 rounded-[30px] border border-[#8E6B3B]/18 bg-[linear-gradient(180deg,rgba(15,12,10,0.96)_0%,rgba(9,9,10,0.98)_100%)] p-7 sm:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#C59A5E]">Investor Contact</div>
            <h3 className="font-display text-4xl font-semibold tracking-[-0.05em] text-white">Request the full package and start a conversation.</h3>
            <p className="text-base leading-8 text-[#D3C6BA]">
              Inquiries are sent directly to coryarmer@gmail.com and copied to ceo@marcmovies.com so both sides can respond quickly to investor and packaging interest.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-[#D3A869] text-[#141414] hover:bg-[#deb980]">
                <a href={PDF_PATH} target="_blank" rel="noopener noreferrer" onClick={() => trackDownload("noise_fury_contact_download_pdf", PDF_PATH)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </a>
              </Button>
              <Button asChild variant="outline" className="border-white/15 bg-black/35 text-white hover:bg-black/50">
                <a href="mailto:coryarmer@gmail.com?cc=ceo@marcmovies.com&subject=Noise%20%26%20Fury%20Investor%20Inquiry">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Email directly
                </a>
              </Button>
            </div>
          </div>

          <div className="rounded-[30px] border border-[#8E6B3B]/18 bg-[linear-gradient(180deg,rgba(15,12,10,0.96)_0%,rgba(9,9,10,0.98)_100%)] p-7 sm:p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit((values) => sendInvestorContactMutation.mutate(values))} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#D7C8B9]">First name</FormLabel>
                        <FormControl>
                          <Input {...field} className="border-white/10 bg-black/30 text-white placeholder:text-[#87796A]" />
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
                        <FormLabel className="text-[#D7C8B9]">Last name</FormLabel>
                        <FormControl>
                          <Input {...field} className="border-white/10 bg-black/30 text-white placeholder:text-[#87796A]" />
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
                      <FormLabel className="text-[#D7C8B9]">Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" className="border-white/10 bg-black/30 text-white placeholder:text-[#87796A]" />
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
                      <FormLabel className="text-[#D7C8B9]">Subject</FormLabel>
                      <FormControl>
                        <Input {...field} className="border-white/10 bg-black/30 text-white placeholder:text-[#87796A]" />
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
                      <FormLabel className="text-[#D7C8B9]">Message</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={7} className="border-white/10 bg-black/30 text-white placeholder:text-[#87796A]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full bg-[#D3A869] text-[#141414] hover:bg-[#deb980]" disabled={sendInvestorContactMutation.isPending}>
                  {sendInvestorContactMutation.isPending ? "Sending inquiry..." : "Send investor inquiry"}
                </Button>
              </form>
            </Form>
          </div>
        </section>
      </main>
    </div>
  );
}
