import { useEffect, useState } from "react";
import "./noise-and-fury.css";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUpRight, Award, BookOpen, ChevronDown, ExternalLink, Shield, ZoomIn } from "lucide-react";
import {
  NoiseAndFuryExcerptDialog,
  type NoiseAndFuryExcerptId,
} from "@/components/noise-and-fury/NoiseAndFuryExcerptDialog";

const CONCERT_POSTER_PATH = "/downloads/noise-and-fury-award-poster.png";
const CORY_BIO_IMAGE_PATH = "/downloads/noise-and-fury-cory.jpg";
const CESAR_BIO_IMAGE_PATH = "/downloads/noise-and-fury-cesar.jpg";
const SCOTT_BIO_IMAGE_PATH = "/downloads/noise-and-fury-scott.jpg";

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
    years: "1989–1991",
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
      "Layne's work with Mad Season offers a less pressurized musical space. Alice in Chains reconvenes for the 1995 self-titled album before MTV Unplugged creates a deeply musical moment of connection and exposure. Demri's death in October 1996 changes the emotional ground beneath everything that follows.",
    turningPoint: "An extraordinary public connection cannot restore ordinary life.",
  },
  {
    title: "Sea of Sorrow",
    years: "1996–2001",
    theme: "The distance no one can close",
    summary:
      "Following Demri's death, Layne lives at a growing distance from the people who care about him, while Nancy's visits still reveal warmth and humor. Late recording sessions offer flashes of the old chemistry. Jerry meets William DuVall in 2000 and tours with Comes with the Fall in 2001; the episode closes on an ordinary phone conversation with Layne.",
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

const teamProfiles = [
  {
    role: "Producer",
    name: "Scott Rosenfelt",
    imagePath: SCOTT_BIO_IMAGE_PATH,
    imageClassName: "nf-portrait-scott",
    imdbUrl: "https://www.imdb.com/name/nm0742586/",
    teaser:
      "Producer of Home Alone, Mystic Pizza, Teen Wolf, and Smoke Signals, with decades of independent film experience.",
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
    imageClassName: "nf-portrait-cory",
    teaser:
      "Creator and writer of Noise & Fury. Entrepreneur and founder of Ready Set Fly, bringing a background in leadership and large-scale operations.",
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
      "Producer, co-creator, and writer at MARC Production Enterprises, with more than two decades across entertainment, operations, and development.",
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

export default function NoiseAndFuryPage() {
  const { toast } = useToast();
  const [openEpisodeTitle, setOpenEpisodeTitle] = useState<string | null>(null);
  const [excerptOpen, setExcerptOpen] = useState(false);
  const [selectedExcerptId, setSelectedExcerptId] = useState<NoiseAndFuryExcerptId>("the-audition");

  function openExcerpt(excerptId: NoiseAndFuryExcerptId) {
    setSelectedExcerptId(excerptId);
    setExcerptOpen(true);
  }

  function scrollToSection(sectionId: string) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
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
      message: "I would like to discuss Noise & Fury and request access to the project materials.",
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
        message: "I would like to discuss Noise & Fury and request access to the project materials.",
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
    <div className="nf-page">
      <nav className="nf-nav" aria-label="Noise & Fury page sections">
        <div className="nf-container nf-nav-inner">
          <a href="#project-top" className="nf-nav-brand">NOISE <span>&amp;</span> FURY</a>
          <div className="nf-nav-links">
            <a href="#series-excerpts">The writing</a>
            <a href="#season-overview">The season</a>
            <a href="#team-section">The team</a>
            <a href="#project-contact">Inquiries <ArrowUpRight size={13} aria-hidden="true" /></a>
          </div>
        </div>
      </nav>

      <section id="project-top" className="nf-hero">
        <div className="nf-hero-glow" aria-hidden="true" />
        <div className="nf-container nf-hero-grid">
          <div className="nf-hero-copy">
            <p className="nf-eyebrow">An original prestige dramatic series</p>
            <h1><span className="sr-only">Noise &amp; Fury</span><img src="/downloads/noise-and-fury-title.png" alt="" width="378" height="248" /></h1>
            <p className="nf-season-label">Season One <span>/</span> Alice in Chains</p>
            <p className="nf-hero-intro">The human story inside the sound.</p>
            <p className="nf-hero-description">Friendship, brotherhood, creativity, grief, and survival. A complete eight-episode season following the lives behind the music.</p>
            <div className="nf-actions">
              <button className="nf-button nf-button-gold" onClick={() => scrollToSection("series-excerpts")}><BookOpen size={16} aria-hidden="true" /> Read selected scenes</button>
              <button className="nf-button nf-button-outline" onClick={() => scrollToSection("project-contact")}>Request project materials <ArrowUpRight size={16} aria-hidden="true" /></button>
            </div>
            <div className="nf-award"><Award size={27} aria-hidden="true" /><div><strong>Winner &middot; Best TV Series Script</strong><span>Authentic Global Film Awards 2026</span></div></div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <button className="nf-poster" aria-label="Enlarge the Noise & Fury award-winning poster">
                <img src={CONCERT_POSTER_PATH} alt="Noise & Fury, Season One: Alice in Chains. Winner, Best TV Series Script, Authentic Global Film Awards 2026. MARC Production Enterprises." width={1105} height={1424} fetchPriority="high" />
                <span><ZoomIn size={14} aria-hidden="true" /> View full artwork</span>
              </button>
            </DialogTrigger>
            <DialogContent className="nf-poster-dialog w-[calc(100%_-_2rem)] max-w-3xl gap-0 p-3 pt-10">
              <DialogTitle className="sr-only">Noise &amp; Fury award-winning artwork</DialogTitle>
              <DialogDescription className="sr-only">Complete Season One poster featuring the 2026 Best TV Series Script award.</DialogDescription>
              <img src={CONCERT_POSTER_PATH} alt="Full Noise & Fury award-winning Season One poster." className="mx-auto block max-h-[78dvh] w-auto max-w-full object-contain" />
              <a href="https://marcmovies.com/" target="_blank" rel="noopener noreferrer" className="mt-3 text-center text-sm underline underline-offset-4">Visit MARC Production Enterprises</a>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <main>
        <section className="nf-overview nf-container" aria-labelledby="overview-title">
          <div className="nf-overview-copy"><p className="nf-eyebrow">01 / The series</p><h2 id="overview-title">Four musicians.<br />A bond that changed everything.</h2>
            <p className="nf-logline">In late-1980s Seattle, four young musicians forge the bond that makes Alice in Chains a defining voice of their generation. As success brings addiction, loss and painful changes to the band, the people who made the music must find a way to carry it forward without forgetting who they were together.</p>
            <p className="nf-credit">Created and written by <strong>Cory Armer &amp; Cesar R. Ramirez</strong></p>
          </div>
          <dl className="nf-facts"><div><dt>Format</dt><dd>8 &times; approximately one hour</dd></div><div><dt>Genre</dt><dd>Serialized prestige drama</dd></div><div><dt>World</dt><dd>Seattle &amp; the Pacific Northwest</dd></div><div><dt>Timeline</dt><dd>1987–present</dd></div><div><dt>Writing</dt><dd>Eight completed teleplays<br /><span>Complete Season One bible</span></dd></div></dl>
        </section>

        <section id="series-promise" className="nf-heart">
          <div className="nf-container">
            <p className="nf-eyebrow">02 / The heart of the story</p>
            <div className="nf-heart-grid"><h2>Brotherhood,<br /><em>before the mythology.</em></h2><div><p>A song turns a corner in rehearsal. A badly timed joke breaks the tension. One musician hears what the others are reaching for and changes what he is playing.</p><p>Layne, Jerry, Sean, and Mike Starr begin as working musicians discovering a chemistry that belongs to all four. As their world changes, Mike Inez and later William DuVall bring their own voices to its continuing story. The music matters because these people matter.</p></div></div>
            <blockquote>Out of the noise came the music.<br />Through the fury came the freedom.</blockquote>
          </div>
          <div className="nf-waterfront"><img src="/downloads/noise-and-fury-seattle.png" alt="Seattle waterfront and Space Needle in the packet's charcoal and gold artwork." width="1184" height="340" loading="lazy" /><span>Seattle / Where the story begins</span></div>
        </section>

        <section id="series-excerpts" className="nf-writing">
          <div className="nf-container">
            <div className="nf-section-heading"><div><p className="nf-eyebrow">03 / Selected screenplay excerpts</p><h2>Meet them on the page.</h2></div><p>Two scenes from the completed season.<br />The humor. The chemistry. The things music can say.</p></div>
            <div className="nf-excerpt-grid">
              <button className="nf-excerpt" onClick={() => openExcerpt("the-audition")}>
                <div className="nf-excerpt-meta"><span>01 / We Die Young</span><span>Scenes 22–23</span></div>
                <h3>The Audition</h3><p className="nf-excerpt-summary">An unexpected frontman walks into rehearsal. Layne makes his choice, and four musicians find a name.</p>
                <div className="nf-script-preview" aria-hidden="true"><span>JERRY</span><p>Waiting for you to say it.</p><span>LAYNE</span><p>Alright.</p></div>
                <span className="nf-read-link">Read the excerpt <ArrowUpRight size={19} aria-hidden="true" /></span>
              </button>
              <button className="nf-excerpt" onClick={() => openExcerpt("rooster")}>
                <div className="nf-excerpt-meta"><span>03 / Rooster</span><span>Scenes 6–8</span></div>
                <h3>Rooster</h3><p className="nf-excerpt-summary">A riff carries a father's history into the rehearsal room, onto a Seattle sidewalk, and finally to the stage.</p>
                <div className="nf-script-preview" aria-hidden="true"><span>JERRY</span><p>He said I got too close.</p><span>LAYNE</span><p>Then you got it right.</p></div>
                <span className="nf-read-link">Read the excerpt <ArrowUpRight size={19} aria-hidden="true" /></span>
              </button>
            </div>
            <p className="nf-small-print">Selected dramatized scenes. Private conversations and dialogue are imagined within a historical framework.</p>
          </div>
        </section>

        <section id="season-overview" className="nf-season nf-container">
          <div className="nf-section-heading"><div><p className="nf-eyebrow">04 / The season's journey</p><h2>Eight episodes.<br />One complete arc.</h2></div><p>From the first shared rooms to a changed band<br />and the music that carries forward.</p></div>
          <div className="nf-movements">
            <div><span>I / Episodes 1–3</span><h3>Becoming</h3><p>A partnership takes shape and grows into a career. The strain arrives early.</p></div>
            <div><span>II / Episodes 4–7</span><h3>Fracture</h3><p>Loss and pressure change the relationships. Music keeps offering moments of connection.</p></div>
            <div><span>III / Episode 8</span><h3>Continuing</h3><p>Grief, reunion, and new music. A future that carries everyone who came before.</p></div>
          </div>
          <div className="nf-episodes">
            {episodeRun.map((episode, index) => {
              const isOpen = openEpisodeTitle === episode.title;
              return <div key={episode.title} className="nf-episode">
                <h3><button id={`episode-trigger-${index}`} className="nf-episode-trigger" aria-expanded={isOpen} aria-controls={`episode-panel-${index}`} onClick={() => setOpenEpisodeTitle(isOpen ? null : episode.title)}><span className="nf-episode-number">{String(index + 1).padStart(2, "0")}</span><span className="nf-episode-title">{episode.title}<small>{episode.theme}</small></span><span className="nf-episode-years">{episode.years}</span><ChevronDown size={18} className={isOpen ? "rotate-180" : ""} aria-hidden="true" /></button></h3>
                <div id={`episode-panel-${index}`} role="region" aria-labelledby={`episode-trigger-${index}`} hidden={!isOpen} className="nf-episode-panel"><p>{episode.summary}</p><p className="nf-episode-turn"><strong>The turn</strong>{episode.turningPoint}</p></div>
              </div>;
            })}
          </div>
        </section>

        <section id="team-section" className="nf-team">
          <div className="nf-container">
            <div className="nf-section-heading"><div><p className="nf-eyebrow">05 / The creative team</p><h2>The people behind the series.</h2></div><a href="https://marcmovies.com/" target="_blank" rel="noopener noreferrer" className="nf-marc-link">MARC Production Enterprises <ArrowUpRight size={16} aria-hidden="true" /></a></div>
            <div className="nf-team-grid">{teamProfiles.map(profile => <article key={profile.name} className="nf-profile">
              <div className="nf-portrait"><img src={profile.imagePath} alt={profile.name} loading="lazy" width="420" height="420" className={profile.imageClassName ?? ""} /></div>
              <p className="nf-eyebrow">{profile.role}</p><h3>{profile.name}</h3><p className="nf-profile-intro">{profile.teaser}</p>
              <details><summary>Read biography <ChevronDown size={14} aria-hidden="true" /></summary><div className="nf-bio">{profile.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}{"imdbUrl" in profile && profile.imdbUrl ? <a href={profile.imdbUrl} target="_blank" rel="noopener noreferrer">View on IMDb <ExternalLink size={13} aria-hidden="true" /></a> : null}</div></details>
            </article>)}</div>
          </div>
        </section>

        <section className="nf-development nf-container" aria-labelledby="development-title">
          <div><p className="nf-eyebrow">06 / Development</p><h2 id="development-title">The complete season<br />is on the page.</h2><p>Eight completed teleplays and a complete season bible provide the basis for focused creative and producing conversations. Final historical review, consultation, and music, archival, and production rights planning remain part of the work ahead.</p></div>
          <div className="nf-approach"><Shield size={24} aria-hidden="true" /><h3>History with humanity.</h3><p>The series approaches the artists, families, and Seattle community through their full lives: their work, wit, loyalties, and losses. Documented events anchor the story; private dialogue is dramatized.</p><p className="nf-registration">WGA registered <span>#2317225 / #2333978</span></p></div>
        </section>

        <section id="project-contact" className="nf-contact">
          <div className="nf-container nf-contact-grid"><div className="nf-contact-copy"><p className="nf-eyebrow">07 / Continue the conversation</p><h2>The next chapter<br /><em>starts with a conversation.</em></h2><p>For producing partnerships, representation, creative collaboration, consultation, or a closer look at the writing, contact the team.</p><p>The complete season bible and teleplays are available for appropriate private review. Tell us about your interest and the materials you would like to see.</p><div className="nf-contact-signature"><strong>Noise &amp; Fury</strong><span>Season One: Alice in Chains</span><a href="https://marcmovies.com/" target="_blank" rel="noopener noreferrer">MARC Production Enterprises <ArrowUpRight size={14} aria-hidden="true" /></a></div></div>
          <div className="nf-contact-form"><h3>Project inquiries</h3>
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
                        <Textarea {...field} rows={5} className="border-white/10 bg-black/30 text-white placeholder:text-[#87796A]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="nf-button nf-button-gold w-full" disabled={sendProjectContactMutation.isPending}>
                  {sendProjectContactMutation.isPending ? "Sending inquiry..." : "Send inquiry"}
                </Button>
              </form>
            </Form>
          </div></div>
        </section>
      </main>
      <footer className="nf-footer"><div className="nf-container"><span>NOISE &amp; FURY / SEASON ONE</span><p>An independent development presentation. Participation or endorsement by Alice in Chains, its members, families, or representatives is not implied.</p><a href="#project-top">Back to top <ArrowDown size={13} className="rotate-180" aria-hidden="true" /></a></div></footer>
      <NoiseAndFuryExcerptDialog open={excerptOpen} excerptId={selectedExcerptId} onExcerptChange={setSelectedExcerptId} onOpenChange={setExcerptOpen} />
    </div>
  );
}
