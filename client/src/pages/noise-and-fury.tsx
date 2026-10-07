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
import { BookOpen, ChevronDown, Shield } from "lucide-react";
import {
  NoiseAndFuryExcerptDialog,
  type NoiseAndFuryExcerptId,
} from "@/components/noise-and-fury/NoiseAndFuryExcerptDialog";

const HERO_IMAGE_PATH = "/downloads/noise-and-fury-hero-textless.png";
const ONE_PAGER_ART_PATH = "/downloads/noise-and-fury-one-pager-design.png";
const MARC_LOGO_PATH = "/downloads/marc-production-logo.jpg";
const CORY_BIO_IMAGE_PATH = "/downloads/noise-and-fury-cory.jpg";
const CESAR_BIO_IMAGE_PATH = "/downloads/noise-and-fury-cesar.jpg";
const SCOTT_BIO_IMAGE_PATH = "/downloads/noise-and-fury-scott.jpg";

const highlightStats = [
  { value: "8", label: "Completed teleplays", detail: "One complete season arc" },
  { value: "1", label: "Complete season bible", detail: "Alice in Chains / Season One" },
  { value: "2", label: "WGA registrations", detail: "#2317225 / #2333978" },
  { value: "Complete", label: "Writing status", detail: "Ready for focused creative review" },
];

const episodeRun = [
  {
    title: "We Die Young",
    years: "1987–1988",
    theme: "Recognition and formation",
    summary:
      "Jerry first hears Layne sing outside Tacoma Little Theatre, then the story moves through the lives, losses and financial limits that bring Layne, Jerry, Sean and Mike Starr into the same rehearsal rooms. In the Music Bank, a messy collaboration begins to sound like something that belongs to all four of them.",
    turningPoint: "The band and its new sound emerge from a genuine partnership rather than an overnight discovery.",
  },
  {
    title: "Man in the Box",
    years: "1989–1990",
    theme: "The machine begins",
    summary:
      "A packed Seattle bill and growing label attention move Alice in Chains from local rooms toward Columbia, Los Angeles and the making of Facelift. As radio, MTV and touring expand the band's public life, backstage humor and ordinary domestic moments reveal how quickly private reality can fall out of step with a public image.",
    turningPoint: "Artistic breakthrough and the first unmistakable private danger arrive together.",
  },
  {
    title: "Rooster",
    years: "1990–1992",
    theme: "Family history becomes music",
    summary:
      "Jerry's relationship with his father and the legacy of Vietnam frame the writing of “Rooster.” As recording and touring demands intensify, the song becomes an exchange between father and son—and an example of what the band can carry together when direct conversation falls short.",
    turningPoint: "A private family history becomes music that reaches far beyond the people who first lived it.",
  },
  {
    title: "Would?",
    years: "1990–1992, revisited",
    theme: "Grief within a scene",
    summary:
      "The season returns to Andrew Wood's death and a Seattle music community confronting the fragility of its world. Through memorials, rehearsal, recording and the Singles film set, “Would?” becomes part of a larger ecosystem of remembrance, collaboration and uneasy survival.",
    turningPoint: "Communal grief becomes a song whose ambiguity is part of its lasting force.",
  },
  {
    title: "Angry Chair",
    years: "1993–1994",
    theme: "A changing lineup",
    summary:
      "The original four can still make one another laugh after a show, but international touring deepens pressures music alone cannot resolve. Mike Starr's departure changes the group materially, and Mike Inez enters as a musician with his own instincts while the band searches for a new equilibrium.",
    turningPoint: "The band survives a major personnel change without solving the troubles beneath it.",
  },
  {
    title: "Nutshell",
    years: "1994–1996",
    theme: "Openness and public exposure",
    summary:
      "Layne's work with Mike McCready, John Baker Saunders and Barrett Martin reveals a less pressurized musical space. Alice in Chains' acoustic work and MTV Unplugged create a brief, deeply musical moment of connection, even as private spaces become harder for friends and family to enter.",
    turningPoint: "An extraordinary public connection cannot restore ordinary life.",
  },
  {
    title: "Sea of Sorrow",
    years: "1996–2002",
    theme: "The distance no one can close",
    summary:
      "Following the band's last major public chapter, Layne lives at a growing distance from the people who care about him, while ordinary visits still reveal warmth and humor. Jerry continues to write and work; later recording sessions offer flashes of the old chemistry as contact becomes harder to sustain.",
    turningPoint: "No single confrontation can neatly represent a withdrawal that unfolds over years.",
  },
  {
    title: "Rain When I Die",
    years: "2002–present day",
    theme: "Grief, mourning and continuation",
    summary:
      "An ordinary afternoon between Layne and Mike Starr gives way to loss, mourning and memories that still make people laugh. The season then follows the musicians through separate work, reunion and a changed lineup, carrying the story into a present where the music continues without erasing anyone who came before.",
    turningPoint: "Continuation becomes a choice made without erasure, replacement or triumphalism.",
  },
];

const characterCards = [
  { name: "Layne Staley", summary: "The voice, the wit and the inward turn. Incisive, playful and affectionate; never reduced to an illness or an ending." },
  { name: "Jerry Cantrell", summary: "The collaborator and carrier. A musician who keeps returning to the work, even as grief and change reshape it." },
  { name: "Sean Kinney", summary: "The pulse and ballast. Funny, exacting and central to the bond that survives the years when the band barely functions." },
  { name: "Mike Starr", summary: "The first foundation. His momentum, humor, musicianship and place in the original four remain essential to the story." },
  { name: "Mike Inez", summary: "Continuity through change. A distinct musician who joins an evolving chemistry and builds his own history with the band." },
  { name: "Demri Parrott", summary: "A life in her own right: wit, tenderness, friendships, work, difficult choices and a place in Seattle's community." },
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

const currentPriorities = [
  "Focused conversations with artists, representatives, families and historical consultants",
  "Music, archival, likeness, legal and chain-of-title planning before production",
  "Creative and producing partnerships aligned with the season's human focus",
  "Final factual review across all eight teleplays before any production draft",
];
const teamProfiles = [
  {
    role: "Producer",
    name: "Scott Rosenfelt",
    imagePath: SCOTT_BIO_IMAGE_PATH,
    teaser:
      "Veteran producer and writer bringing major feature credibility, market trust, and experienced packaging guidance.",
    paragraphs: [
      "Scott Rosenfelt is one of Hollywood's most accomplished independent producers, with a body of work that includes Home Alone, Mystic Pizza, Teen Wolf, Smoke Signals, and Extremities. His producing career spans commercially successful studio films, acclaimed independent features, documentaries, and television projects, giving him rare credibility on both the creative and market sides of development.",
      "Recent and current work includes the series SellBlock, the feature Bukinawa, and upcoming projects such as Lips Like Sugar, Sinta Ko, Empress Wu, Choices, and Under The Boards. He also produced Critical Thinking, directed by and starring John Leguizamo, which was selected for SXSW and went on to a successful release and streaming run.",
      "Rosenfelt was also producer and writer on The Jade Pendant and wrote, produced, and directed the pilot Main Street. Through ShadowCatcher Entertainment, which he co-founded, he produced the Sundance-winning Smoke Signals, one of the landmark independent films of its era.",
      "In addition to his production work, Rosenfelt has written, directed, taught, and lectured widely. He is a member of the Directors Guild of America, the Writers Guild of America, and the Academy of Motion Picture Arts and Sciences, and is a graduate of NYU's Tisch School of the Arts.",
    ],
  },
  {
    role: "Creator / Writer",
    name: "Cory Armer",
    imagePath: CORY_BIO_IMAGE_PATH,
    imageClassName: "object-[center_10%] scale-[1.34] sm:scale-[1.4]",
    imageHoverClassName: "group-hover:scale-[1.38] sm:group-hover:scale-[1.44]",
    teaser:
      "Creator of Noise & Fury and founder of RSF, with the core operating and creative context behind the project.",
    paragraphs: [
      "Cory Armer is the creator and writer of Noise & Fury, a prestige dramatic series whose complete first season follows Alice in Chains. Across eight finished teleplays, the project approaches music history through brotherhood, creative collaboration and the lives that continue beyond loss. It is designed as cinematic, character-first storytelling for a modern television audience.",
      "Cory brings a distinct, non-traditional path into the entertainment industry. With over 15 years of experience leading large-scale, branded hospitality operations, he has built a career grounded in execution, leadership, and performance. Managing high-volume environments and delivering consistent results within structured systems has shaped a disciplined, solutions-oriented approach that now carries into his creative work.",
      "He is also the founder of Ready Set Fly (RSF), an aviation platform built to modernize how pilots plan, train, and access aircraft. The platform reflects his ability to identify gaps in traditional industries and build scalable, real-world solutions, with early traction validating both the concept and execution.",
      "As a creator, Cory represents a rare combination of operational discipline, entrepreneurial vision, and creative ambition. His focus is on developing projects that are both culturally resonant and commercially viable, with Noise & Fury serving as the foundation for a broader slate of film and television development.",
    ],
  },
  {
    role: "Producer / Co-Creator & Writer",
    name: "Cesar R. Ramirez",
    imagePath: CESAR_BIO_IMAGE_PATH,
    teaser:
      "Producer, co-creator, and writer with a cross-functional background spanning production, operations, and development.",
    paragraphs: [
      "Cesar R. Ramirez is a seasoned producer, consultant, and development executive with more than two decades of experience across entertainment, operations, construction, and product development. His work combines creative instincts, strategic planning, and practical execution, making him a key force in shaping projects from concept through delivery.",
      "At Marc Production Enterprises in Austin, he has helped develop and produce projects including Road to Juarez, Critical Thinking, Sno Cone Stand Inc., and The LookOut Creek, while also supporting current titles in development such as Ladies Forbidden G.O.L.F. and Crossed Love. His work has included producing, acting, directing support, and hands-on project assembly across multiple stages of production.",
      "Ramirez has collaborated with notable industry talent including Scott Rosenfelt, Sean McNamara, and John Leguizamo. He specializes in identifying strong material, refining projects in development, coordinating talent and production teams, securing resources, and helping guide films toward distribution and audience readiness.",
      "Outside film production, he has held senior roles in operations, product development, and international sales, including leadership positions at Skintiva, Robusto International Corporation, and International Space Optics. That operating discipline continues to inform his producing work, giving him a grounded, solutions-first approach to building ambitious projects.",
    ],
  },
];

const projectContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ProjectContactValues = z.infer<typeof projectContactSchema>;

function excerpt(text: string, max = 172) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

export default function NoiseAndFuryPage() {
  const { toast } = useToast();
  const [openEpisodeTitle, setOpenEpisodeTitle] = useState<string | null>("We Die Young");
  const [excerptOpen, setExcerptOpen] = useState(false);
  const [selectedExcerptId, setSelectedExcerptId] = useState<NoiseAndFuryExcerptId>("first-jam");

  function openExcerpt(excerptId: NoiseAndFuryExcerptId) {
    setSelectedExcerptId(excerptId);
    setExcerptOpen(true);
  }

  function scrollToSection(sectionId: string) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top, behavior: "smooth" });
  }

  useEffect(() => {
    trackEvent("noise_fury_project_page_view", { page: "/noiseandfury" });
  }, []);

  const form = useForm<ProjectContactValues>({
    resolver: zodResolver(projectContactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      subject: "Noise & Fury project inquiry",
      message: "I am interested in hearing more about Noise & Fury and discussing a potential creative or strategic conversation.",
    },
  });

  const sendProjectContactMutation = useMutation({
    mutationFn: async (values: ProjectContactValues) =>
      apiRequest("POST", "/api/noise-and-fury/investor-contact", values),
    onSuccess: () => {
      trackEvent("cta_click", {
        label: "noise_fury_project_contact_submit",
        target: "/api/noise-and-fury/investor-contact",
      });
      toast({
        title: "Inquiry sent",
        description: "Your Noise & Fury project inquiry has been delivered.",
      });
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        subject: "Noise & Fury project inquiry",
        message: "I am interested in hearing more about Noise & Fury and discussing a potential creative or strategic conversation.",
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
    <div className="min-h-screen overflow-hidden bg-[#e9dfce] text-[#241a13] [background-image:radial-gradient(circle_at_10%_18%,rgba(91,55,25,0.08)_0_1px,transparent_1.5px),radial-gradient(circle_at_82%_68%,rgba(91,55,25,0.06)_0_1px,transparent_1.5px)] [background-size:29px_31px,37px_41px]">
      <section className="relative overflow-hidden border-b border-[#9b682f] bg-[#080807] text-[#f2e9dc]">
        <img src={HERO_IMAGE_PATH} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-luminosity" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(132,85,35,0.15),_rgba(4,4,4,0.96)_72%)]" />
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(115deg,transparent_0%,rgba(196,142,75,0.16)_48%,transparent_49%),radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.08)_0_1px,transparent_1px)] [background-size:auto,9px_9px]" />
        <div className="relative mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-10">
          <div className="grid grid-cols-2 items-center gap-5 text-center md:grid-cols-[0.8fr_1.35fr_0.8fr] md:gap-8 md:text-left">
            <div aria-hidden="true" className="col-span-2 mx-auto font-display text-[clamp(3.2rem,7vw,6.8rem)] font-black uppercase leading-[0.7] tracking-[-0.095em] text-[#ded0bc] [text-shadow:2px_3px_0_rgba(105,68,31,0.55)] md:col-span-1 md:mx-0">
              <span className="block">Noise</span>
              <span className="block">&amp; Fury</span>
            </div>
            <div className="mx-auto w-full max-w-xl text-center">
              <div className="mx-auto h-px w-3/4 bg-[linear-gradient(90deg,transparent,#bd8545,transparent)]" />
              <div className="py-3 font-display text-lg uppercase tracking-[0.28em] text-[#e3d8c9] sm:py-5 sm:text-3xl sm:tracking-[0.42em]">A Prestige Dramatic Series</div>
              <div className="mx-auto h-px w-3/4 bg-[linear-gradient(90deg,transparent,#bd8545,transparent)]" />
            </div>
            <img
              src={MARC_LOGO_PATH}
              alt="MARC Production Enterprises"
              className="mx-auto w-full max-w-[130px] border border-white/10 bg-[#0B0A0A]/80 p-2 shadow-[0_20px_55px_rgba(0,0,0,0.5)] sm:max-w-[160px] sm:p-3 md:ml-auto md:mr-0 md:max-w-[190px]"
            />
          </div>
          <div className="mt-5 border-t border-[#a66e33]/50 pt-4 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-[#d7a264] sm:mt-8 sm:pt-5 sm:text-xs sm:tracking-[0.5em]">
            Season One <span className="px-2 text-[#8d6541]">/</span> Alice in Chains
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-b border-[#b4936b] bg-[#f2eadc] px-5 py-12 text-[#201711] sm:px-8 sm:py-16">
        <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:radial-gradient(circle_at_12%_20%,rgba(92,56,24,0.13)_0_1px,transparent_1.5px),radial-gradient(circle_at_78%_65%,rgba(92,56,24,0.09)_0_1px,transparent_1.5px)] [background-size:23px_29px,31px_37px]" />
        <div className="relative mx-auto max-w-6xl">
          <h1 className="font-serif text-[clamp(2.8rem,7vw,6.4rem)] font-medium italic leading-[0.98] tracking-[-0.045em] text-black">
            <span className="block">Out of the noise came the music.</span>
            <span className="block">Through the fury came the freedom.</span>
          </h1>
          <div className="mt-8 h-0.5 w-24 bg-[#a9692c]" />
          <div className="mt-8 grid gap-4 border-b border-[#b98a58]/45 pb-9 md:grid-cols-[8rem_1fr] md:gap-8">
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-[#8d5124]">Logline</div>
            <p className="font-serif text-xl leading-8 text-[#2b211a] sm:text-2xl sm:leading-10">
              In late-1980s Seattle, four young musicians forge the bond that makes Alice in Chains a defining voice of
              their generation. As success brings addiction, loss and painful changes to the band, the people who made
              the music must find a way to carry it forward without forgetting who they were together.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="border-l-2 border-[#a9692c] pl-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#8d5124]">Created and written by</div>
              <div className="mt-2 font-display text-xl font-semibold">Cory Armer and Cesar R. Ramirez</div>
            </div>
            <div className="border-l-2 border-[#a9692c] pl-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#8d5124]">Season One Complete</div>
              <div className="mt-2 font-display text-xl font-semibold">Eight completed hour-long teleplays</div>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-5 border-y border-[#b98a58]/45 py-5 sm:flex-row">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-[#9d642d]" />
              <div className="text-sm font-semibold">WGA Registered</div>
              <div className="font-mono text-xs text-[#6d5643]">#2317225 / #2333978</div>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button className="bg-[#17120f] text-[#f2eadc] hover:bg-[#33261d]" onClick={() => scrollToSection("series-excerpts")}>
                <BookOpen className="mr-2 h-4 w-4" /> Read the excerpts
              </Button>
              <Button variant="outline" className="border-[#8d6239] bg-transparent text-[#2b2018] hover:bg-[#e2d2ba]" onClick={() => scrollToSection("project-contact")}>
                Start a conversation
              </Button>
            </div>
          </div>
        </div>
      </section>

      <main className="relative mx-auto flex max-w-7xl flex-col px-4 pb-16 pt-8 sm:px-6 sm:pb-24">
        <section className="order-1 grid gap-px overflow-hidden border border-[#8E6B3B]/30 bg-[#2A2118]/40 md:grid-cols-4">
          {highlightStats.map((stat) => (
            <div key={stat.label} className="bg-[linear-gradient(180deg,rgba(14,12,11,0.96)_0%,rgba(10,10,11,0.98)_100%)] px-5 py-6">
              <div className="text-3xl font-semibold tracking-[-0.04em] text-[#D3A869]">{stat.value}</div>
              <div className="mt-2 text-sm font-semibold text-white">{stat.label}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#8C7B70]">{stat.detail}</div>
            </div>
          ))}
        </section>

        <section id="series-promise" className="order-2 mt-16 scroll-mt-24 border-y border-[#D3A869]/25 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.38em] text-[#8d5124]">The Series Promise</div>
            <h2 className="mt-6 font-serif text-4xl font-medium italic leading-[1.08] tracking-[-0.05em] text-[#17110d] sm:text-6xl">
              Out of the noise came the music. Through the fury came the freedom.
            </h2>
            <div className="mx-auto mt-7 max-w-4xl space-y-6 text-left font-serif text-lg leading-9 text-[#392b21] sm:text-xl sm:leading-10">
              <p>
                <em>Noise &amp; Fury</em> is really about a generation of artists who came up at a time when they had room
                to figure out who they were before the whole world was watching. They were influenced by the people
                around them, the places they came from, the things they lost and the things they were trying to survive,
                but they weren&apos;t being told every second what people thought of them or what they should become.
              </p>
              <p>
                And what makes that so powerful now is that the music didn&apos;t stay in that time. It kept moving forward.
                People who weren&apos;t even alive when these songs were written still hear themselves in them today.
              </p>
              <p>
                That&apos;s what I think <em>Noise &amp; Fury</em> is ultimately about. The world around the music has changed
                completely, but the reasons people connect to it haven&apos;t. Loss still feels like loss. Loneliness still
                feels like loneliness. Friendship still matters. Anger, addiction, grief, love, insecurity, all of it is
                still there.
              </p>
              <p>
                These artists had no idea they were creating something that would become part of somebody else&apos;s life
                thirty years later. They were trying to make something honest in the moment.
              </p>
              <p className="text-center font-display text-3xl font-semibold italic text-[#8d5124] sm:text-4xl">
                And somehow, that honesty lasted.
              </p>
            </div>
          </div>
        </section>

        <section className="order-4 mt-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6 border border-[#b9956e] bg-[#f5eddf] p-7 shadow-[0_18px_45px_rgba(77,47,24,0.12)] sm:p-9">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#8d5124]">Why This Story Matters</div>
              <h2 className="font-display text-4xl font-semibold tracking-[-0.05em] text-[#17110d] sm:text-5xl">
                Brotherhood before mythology.
              </h2>
            </div>
            <div className="grid gap-5 font-display text-[16px] leading-8 text-[#46362a] md:grid-cols-2">
              <p>
                This is not a nostalgia exercise or a conventional rise-and-fall biography. It begins with Layne,
                Jerry, Sean and Mike Starr as working musicians—carrying amplifiers, arguing, making one another laugh
                and discovering a sound no one of them could have created alone.
              </p>
              <p>
                That bond carries them through fame, private loss and a changing lineup. Mike Inez becomes part of the
                band's evolving chemistry, and the season ultimately moves beyond Layne's death toward the people and
                music that continue—without pretending anyone can be replaced or forgotten.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="border border-[#b9956e] bg-[#ede0cc] p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8d5124]">Development Status</div>
              <div className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-[#17110d]">The complete season is on the page.</div>
              <div className="mt-2 text-sm leading-7 text-[#554133]">
                Eight completed hour-long teleplays. A complete season bible. A complete one-pager. Final research,
                rights clearances and consultation remain essential before production; the completed writing package
                provides the basis for those focused conversations.
              </div>
            </div>
            <div className="border border-[#b9956e] bg-[#ede0cc] p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8d5124]">Current Priorities</div>
              <div className="mt-4 space-y-3">
                {currentPriorities.map((item) => (
                  <div key={item} className="border-l-2 border-[#a9692c] bg-[#f7f0e5] px-4 py-3 text-sm text-[#46362a]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="order-8 mt-16 scroll-mt-24">
          <div className="rounded-[30px] border border-[#8E6B3B]/18 bg-[linear-gradient(180deg,rgba(17,14,12,0.94)_0%,rgba(8,8,9,0.98)_100%)] p-7 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-9">
            <div className="mx-auto max-w-4xl text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#C59A5E]">Authenticity &amp; Stewardship</div>
              <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                An invitation to help protect the truth, humanity, and musical integrity of the story.
              </h2>
              <p className="mt-4 text-base leading-8 text-[#CEC1B5] sm:text-lg">
                Noise &amp; Fury is being developed with respect for the artists, families, collaborators, and communities
                connected to the history it portrays. We welcome conversations with people who can help the series feel
                lived-in, honest, and worthy of the music at its center.
              </p>
            </div>

            <div className="mx-auto mt-8 max-w-5xl border border-[#D3A869]/25 bg-[#16110D]/70 px-5 py-5 text-sm leading-7 text-[#E2D6CA] sm:px-7">
              Public performances, releases, collaborations and losses provide the historical framework. Private
              conversations and emotional transitions are dramatized and should be tested against primary records and
              first-person testimony as the work advances. This independent development presentation does not imply
              authorization, participation or endorsement by Alice in Chains, its members, their families or representatives.
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B89258]">1. Hear the Story</div>
                <div className="mt-3 text-lg font-semibold text-white">Begin with the vision, season architecture, and emotional purpose.</div>
                <div className="mt-3 text-sm leading-7 text-[#D8CCC0]">
                  Explore the project overview and episode guide, then connect directly if the story resonates or if your
                  experience can add context, perspective, or authenticity.
                </div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B89258]">2. Share Perspective</div>
                <div className="mt-3 text-lg font-semibold text-white">Continue the conversation privately with the creative team.</div>
                <div className="mt-3 text-sm leading-7 text-[#D8CCC0]">
                  Conversations can center on the music, the era, lived experience, creative fit, or the responsibilities
                  involved in portraying real people with honesty and dignity.
                </div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B89258]">3. Find the Right Role</div>
                <div className="mt-3 text-lg font-semibold text-white">Any next step should reflect genuine alignment.</div>
                <div className="mt-3 text-sm leading-7 text-[#D8CCC0]">
                  There is no predetermined ask. A conversation may lead to insight, an introduction, consultation,
                  creative participation, or simply a better and more responsible version of the work.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="season-overview" className="order-6 mt-16 scroll-mt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#8d5124]">Season One Overview</div>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-[#17110d] sm:text-5xl">
              Eight episodes. One complete arc.
            </h2>
            <p className="mt-4 font-display text-base leading-8 text-[#574435] sm:text-lg">
              Becoming. Fracture. Continuing. The season follows the original partnership, the years of change and the
              musicians who carry the work forward.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {episodeRun.map((episode, index) => {
              const isOpen = openEpisodeTitle === episode.title;
              return (
                <button
                  key={episode.title}
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenEpisodeTitle(isOpen ? null : episode.title)}
                  className="group border border-[#b9956e] bg-[#f5eddf] p-6 text-left shadow-[0_10px_28px_rgba(77,47,24,0.08)] transition hover:-translate-y-0.5 hover:border-[#8d5124] hover:bg-[#fbf6ed]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8d5124]">EP {index + 1} · {episode.years}</div>
                      <div className="mt-2 font-display text-3xl font-semibold tracking-[-0.05em] text-[#17110d]">
                        {episode.title}
                      </div>
                      <div className="mt-2 text-sm uppercase tracking-[0.18em] text-[#705a48]">{episode.theme}</div>
                    </div>
                    <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-[#D3A869] transition-transform ${isOpen ? "rotate-180" : "rotate-0"}`} />
                  </div>

                  <div className="mt-5 font-display text-[16px] leading-7 text-[#46362a]">
                    {isOpen ? episode.summary : excerpt(episode.summary)}
                  </div>

                  {isOpen ? (
                    <div className="mt-5 border-l-2 border-[#a9692c] bg-[#eadbc4] px-4 py-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8d5124]">The Turn</div>
                      <div className="mt-2 text-sm leading-7 text-[#35271e]">{episode.turningPoint}</div>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section id="series-excerpts" className="order-3 mt-16 scroll-mt-24">
          <div className="overflow-hidden rounded-[30px] border border-[#8E6B3B]/22 bg-[linear-gradient(135deg,rgba(25,19,14,0.98)_0%,rgba(8,8,9,0.98)_72%)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-9">
            <div className="mx-auto max-w-4xl text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#C59A5E]">A Moment from the Series</div>
              <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">
                Before the records, tours, and expectations, there were four musicians finding their way to each other.
              </h2>
            </div>

            <div className="mt-9 grid gap-4 lg:grid-cols-2">
              <button
                type="button"
                onClick={() => openExcerpt("first-jam")}
                className="group rounded-[26px] border border-white/10 bg-black/30 p-6 text-left transition hover:-translate-y-0.5 hover:border-[#D3A869]/60 hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3A869] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a0a]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#B89258]">Episode 1: We Die Young · Scenes 14–15</div>
                    <h3 className="mt-3 font-display text-3xl font-semibold uppercase tracking-[-0.03em] text-white">The First Jam</h3>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D3A869]/35 bg-[#D3A869]/10 text-[#D3A869] transition group-hover:bg-[#D3A869] group-hover:text-[#141414]">
                    <BookOpen className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-5 text-base leading-7 text-[#D8CCC0]">Four musicians discover what happens when they play together.</p>
                <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D3A869]">Read complete excerpt</div>
              </button>

              <button
                type="button"
                onClick={() => openExcerpt("the-name")}
                className="group rounded-[26px] border border-white/10 bg-black/30 p-6 text-left transition hover:-translate-y-0.5 hover:border-[#D3A869]/60 hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3A869] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a0a]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#B89258]">Episode 1: We Die Young · Scenes 22–23</div>
                    <h3 className="mt-3 font-display text-3xl font-semibold uppercase tracking-[-0.03em] text-white">The Name</h3>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D3A869]/35 bg-[#D3A869]/10 text-[#D3A869] transition group-hover:bg-[#D3A869] group-hover:text-[#141414]">
                    <BookOpen className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-5 text-base leading-7 text-[#D8CCC0]">Layne makes a decision. The band finds its name.</p>
                <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D3A869]">Read complete excerpt</div>
              </button>
            </div>

            <p className="mx-auto mt-6 max-w-4xl text-center text-xs leading-6 text-[#9F9387]">
              Dramatized scenes inspired by historical events. Dialogue and private interactions have been fictionalized. Not presented as a verbatim historical record.
            </p>
          </div>
        </section>

        <section id="team-section" className="order-7 mt-16 scroll-mt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#8d5124]">Writer and Producer Bios</div>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-[#17110d] sm:text-5xl">
              The team shaping the package.
            </h2>
            <p className="mt-4 font-display text-base leading-8 text-[#574435] sm:text-lg">
              The full team bios are presented here so the creative and producing package reads clearly at a glance.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
            {teamProfiles.map((profile) => {
              return (
                <div
                  key={profile.name}
                  className="group h-full border border-[#b9956e] bg-[#f5eddf] p-5 text-left shadow-[0_12px_34px_rgba(77,47,24,0.1)] transition hover:-translate-y-0.5 hover:border-[#8d5124] sm:p-6"
                >
                  <div className="overflow-hidden border border-[#9a7755] bg-[#1b1511] shadow-[0_18px_32px_rgba(57,36,20,0.2)]">
                    <img
                      src={profile.imagePath}
                      alt={`${profile.name} profile`}
                      className={`h-56 w-full object-cover transition duration-500 sm:h-64 ${profile.imageHoverClassName ?? "group-hover:scale-[1.02]"} ${profile.imageClassName ?? "object-center"}`}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="pt-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8d5124]">{profile.role}</div>
                      <div className="mt-3 font-display text-[2rem] font-semibold tracking-[-0.05em] text-[#17110d] sm:text-3xl">{profile.name}</div>
                    </div>
                  </div>

                  <div className="mt-4 text-sm leading-6 text-[#554133] sm:leading-7">{profile.teaser}</div>

                  <div className="mt-5 space-y-4 border-t border-[#b9956e] pt-5 font-display text-sm leading-6 text-[#392b21] sm:leading-7">
                    {profile.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="order-5 mt-16 grid gap-8 lg:grid-cols-2">
          <div className="rounded-[30px] border border-[#8E6B3B]/18 bg-[linear-gradient(180deg,rgba(15,12,10,0.96)_0%,rgba(9,9,10,0.98)_100%)] p-7 sm:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#C59A5E]">The Human Core</div>
            <h3 className="mt-3 font-display text-3xl font-semibold tracking-[-0.05em] text-white">The brotherhood—and the lives around it.</h3>
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

        <section id="project-contact" className="order-9 mt-16 grid gap-8 scroll-mt-24 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6 rounded-[30px] border border-[#8E6B3B]/18 bg-[linear-gradient(180deg,rgba(15,12,10,0.96)_0%,rgba(9,9,10,0.98)_100%)] p-7 sm:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#C59A5E]">Continue the Conversation</div>
            <h3 className="font-display text-4xl font-semibold tracking-[-0.05em] text-white">There are different ways into the project.</h3>
            <p className="text-base leading-8 text-[#D3C6BA]">
              Inquiries are sent directly to Cory Armer and copied to the producing team. Artists, representatives,
              historians, creative collaborators, producers and potential partners are invited to identify the kind of
              conversation they want to have.
            </p>
            <p className="text-sm leading-7 text-[#BCAEA0]">
              The eight teleplays and revised development documents are private materials. Appropriate review access can
              be arranged directly with the team; no scripts or confidential package materials are published here.
            </p>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-[#E7DACD]">
              Tell us what connects you to <em>Noise &amp; Fury</em>—its music, its people, its history, or its path toward the screen—and
              the team will respond with the most relevant next step.
            </div>
          </div>

          <div className="rounded-[30px] border border-[#8E6B3B]/18 bg-[linear-gradient(180deg,rgba(15,12,10,0.96)_0%,rgba(9,9,10,0.98)_100%)] p-7 sm:p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit((values) => sendProjectContactMutation.mutate(values))} className="space-y-5">
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

                <Button type="submit" className="w-full bg-[#D3A869] text-[#141414] hover:bg-[#deb980]" disabled={sendProjectContactMutation.isPending}>
                  {sendProjectContactMutation.isPending ? "Sending inquiry..." : "Start the conversation"}
                </Button>
              </form>
            </Form>
          </div>
        </section>
      </main>
      <footer className="relative h-[320px] overflow-hidden border-t border-[#9b682f] bg-[#090807] sm:h-[520px] lg:h-[620px]">
        <img
          src={ONE_PAGER_ART_PATH}
          alt="Seattle skyline and Space Needle from the Noise & Fury one-pager"
          className="absolute inset-0 h-full w-full origin-[65%_100%] scale-[3.2] object-cover object-bottom sm:origin-bottom sm:scale-100"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(9,8,7,0.88)_0%,rgba(9,8,7,0.18)_26%,rgba(9,8,7,0.02)_66%,rgba(9,8,7,0.28)_100%)]" />
      </footer>
      <NoiseAndFuryExcerptDialog
        open={excerptOpen}
        excerptId={selectedExcerptId}
        onExcerptChange={setSelectedExcerptId}
        onOpenChange={setExcerptOpen}
      />
    </div>
  );
}
