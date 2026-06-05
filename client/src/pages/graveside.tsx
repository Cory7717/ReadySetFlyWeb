import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ChevronDown,
  Clock3,
  Download,
  Eye,
  Expand,
  FileText,
  Fingerprint,
  MapPin,
  ScrollText,
  ShieldCheck,
  Skull,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScriptExcerptDialog } from "@/components/graveside/ScriptExcerptDialog";
import { trackEvent } from "@/lib/analytics";

const HERO_IMAGE_PATH = "/downloads/graveside-hero.png";
const CONCEPT_ART_PATH = "/downloads/graveside-concept-art.png";
const CORY_BIO_IMAGE_PATH = "/downloads/cory-armer-creator-bio.png";
const ONE_PAGER_PATH = "/downloads/graveside-one-pager.pdf";
const SERIES_BIBLE_PATH = "/downloads/graveside-series-bible.pdf";

type EpisodeType = "A" | "B" | "C" | "Special";

type Episode = {
  number: number;
  title: string;
  type: EpisodeType;
  era: string;
  label: string;
  summary: string;
  evidence?: string;
  payoff: string;
};

const episodes: Episode[] = [
  {
    number: 1,
    title: "Plot",
    type: "Special",
    era: "Present day / unknown past",
    label: "Pilot",
    summary:
      "A context-free cold open drops Mara and Eli inside a violent historical crisis, then cuts six months earlier to the cemetery detour that changed everything. Their intimacy, grief, and morbid shared hobby build toward the first transport - and the cold open resumes with its true cost finally understood.",
    payoff:
      "The audience experiences the mechanism before it is explained, then watches the same sequence become emotionally legible once Mara and Eli have earned it.",
  },
  {
    number: 2,
    title: "What Happened to Margaret Finch",
    type: "A",
    era: "1890s Northeast",
    label: "First full transport",
    summary:
      "Eli inhabits a respected mill foreman. Mara inhabits the mill owner. Both men know Margaret Finch's death was not accidental, but neither host holds the complete truth. Mara and Eli experience the crime from opposing sides without knowing where the other is.",
    evidence: "The instrument used in Margaret's death, wrapped in oilcloth and thrown into a specific bend in the mill river.",
    payoff:
      "The evidence is recovered and Margaret's cause of death is corrected after 130 years. Graveside's moral engine turns over for the first time.",
  },
  {
    number: 3,
    title: "The Good Doctor",
    type: "B",
    era: "1920s Texas",
    label: "Medicine becomes horror",
    summary:
      "A prominent physician conducts experiments on patients who trust him. Eli inhabits the doctor; Mara inhabits a patient's wife. The procedural horror lands personally for a trauma surgeon already struggling to process what the transports demand.",
    evidence: "A private experimental ledger hidden in the false bottom of a medical cabinet donated to a hospital archive.",
    payoff:
      "An anonymous tip launches an inquiry into the institution built on the doctor's reputation, while Felix begins noticing that Mara is not herself.",
  },
  {
    number: 4,
    title: "Republic",
    type: "A",
    era: "Republic of Texas, 1840s",
    label: "Land, power, and fraud",
    summary:
      "Eli becomes a celebrated land commissioner; Mara becomes the Mexican landowner whose claim he destroys through legal manipulation and fraud. In one charged moment, Eli forces a signature while Mara's hand fights to resist.",
    evidence: "The legitimate Reyes land grant, concealed in a strongbox beneath the floor of a building that is now a restaurant.",
    payoff:
      "The document surfaces publicly, a hero's legacy fractures, and Mara and Eli have their first real post-transport fight.",
  },
  {
    number: 5,
    title: "Lullaby",
    type: "B",
    era: "1900s Northeast",
    label: "The season's emotional low point",
    summary:
      "At a child's grave, Mara pushes past Eli's resistance. He inhabits the reverend who led a town's judgment against an accused mother; Mara inhabits the woman failed by every system around her. The horror is certainty without compassion.",
    evidence: "The mother's private correspondence, locked in a church strongbox and transferred unopened to a diocesan archive.",
    payoff:
      "Her descendant receives the true record. Investigative historian Raymond Chase reads the story and starts paying close attention.",
  },
  {
    number: 6,
    title: "Golden Spike",
    type: "A",
    era: "1860s American West",
    label: "A buried corporate crime",
    summary:
      "At a neglected railroad cemetery, Eli inhabits a company supervisor and Mara a Chinese immigrant laborer. They witness a covered-up act of violence against the labor camp. For the first time, the series removes dark humor entirely.",
    evidence: "A company memorandum authorizing the violence, hidden in a locked case inside a surviving company building.",
    payoff:
      "The document triggers a national inquiry. Cold-case investigator Nora Vasquez appears and questions the impossible sourcing with unnerving precision.",
  },
  {
    number: 7,
    title: "The Voss Grave",
    type: "C",
    era: "Late 1800s Northeast",
    label: "First ancestor episode",
    summary:
      "Mara finds her surname on a weathered headstone. In the transport, she inhabits Hildegard Voss while Eli becomes August Cole - a name he will not consciously register until later. A deliberately obscured family conflict begins to surface.",
    payoff:
      "The mystery remains unresolved, but the bloodline thread is planted. Nora's investigation board is revealed for the first time.",
  },
  {
    number: 8,
    title: "The Senator's Wife",
    type: "A",
    era: "Early 1900s Texas",
    label: "The public legend dismantled",
    summary:
      "Eli inhabits a celebrated reform senator; Mara inhabits the wife who knew his private conduct and made her own calculations. The season's sharpest dark humor comes from the senator's spectacular self-importance.",
    evidence: "Dorothy Cross's diary, hidden behind a false panel in a trunk donated to a historical society.",
    payoff:
      "A major biography is pulled pending review. The precision of Eli's tip gives Nora her first clear break in the anonymity.",
  },
  {
    number: 9,
    title: "Fever Ground",
    type: "B",
    era: "1870s South",
    label: "History's machinery of erasure",
    summary:
      "During a yellow fever epidemic, Eli inhabits the physician credited with staying behind. Mara inhabits the free Black woman whose medical work he absorbed into his official record. The theft of authorship becomes the episode's central violence.",
    evidence: "Celestine Broussard's original patient records, miscatalogued under the physician's estate in a university archive.",
    payoff:
      "Celestine receives formal credit. Raymond calls Eli. Mara says she does not want to transport again - and means it.",
  },
  {
    number: 10,
    title: "The Inheritance",
    type: "A",
    era: "1930s Rust Belt",
    label: "Domestic murder and economic desperation",
    summary:
      "Eli inhabits a dead man's brother; Mara inhabits his wife. Walter Hale's elaborate self-delusion is darkly funny until it hardens into murder, with Edna trapped inside the economics of what she knows.",
    evidence: "Financial documents and a personal item sealed in a strongbox dropped into a building foundation during construction.",
    payoff:
      "A civil claim is filed and Nora can finally describe the pattern to another investigator without sounding impossible.",
  },
  {
    number: 11,
    title: "Salt",
    type: "B",
    era: "1600s Colonial New England",
    label: "Institutional horror",
    summary:
      "Eli inhabits the magistrate who condemns a woman during a lesser-known witch panic; Mara inhabits the accused. The episode strips away humor again and lets the machinery of certainty, fear, and public punishment do the damage.",
    evidence: "The magistrate's private account of his own doubts, hidden inside the foundation stone of a church that still stands.",
    payoff:
      "Eli files a formal exoneration petition. Nora stops collecting clippings and makes her first active move.",
  },
  {
    number: 12,
    title: "What August Cole Knew",
    type: "C",
    era: "Late 1800s Northeast",
    label: "Second ancestor episode",
    summary:
      "Eli finds August Cole in his old notes and connects him to Hildegard Voss. He inhabits August directly; Mara becomes Hildegard's surviving sister. For the first time, the inexplicable pull between them inside the past is unmistakable.",
    payoff:
      "They surface nothing. Mara says they need to talk about their families. Nora calls Eli directly under a legitimate professional pretext.",
  },
  {
    number: 13,
    title: "The Photographer",
    type: "A",
    era: "1880s Northeast",
    label: "Erasure without murder",
    summary:
      "Mara inhabits a photographer who documented poverty and institutional abuse; Eli becomes the official who ordered her work destroyed. She was not killed. She was discredited, impoverished, and systematically removed from the record.",
    evidence: "A cache of original prints hidden in a locked cabinet inside a private building that later became a public library.",
    payoff:
      "Three museums restore attribution. Raymond publishes the story, placing his name close enough to Mara and Eli's work for Nora to trace.",
  },
  {
    number: 14,
    title: "Ground Truth",
    type: "Special",
    era: "Present day",
    label: "No transport",
    summary:
      "Research, relationship, and consequence take the entire hour. The Cole and Voss records are contradictory by design. Raymond arrives in person and nearly reveals his secret. Felix pushes Mara harder. Nora secures authorization for a formal inquiry.",
    payoff:
      "Mara and Eli find the cemetery they have been looking for and book flights, knowing the next grave may answer the question they are afraid to ask.",
  },
  {
    number: 15,
    title: "What the Dead Owe the Living",
    type: "C",
    era: "Late 1800s / present day",
    label: "Season finale",
    summary:
      "At two deliberately adjacent headstones, Mara and Eli enter the original Cole-Voss conflict from opposing bloodlines. The same moments unfold from both sides. Neither ancestor is simply villain or victim. The death at the center is finally witnessed completely.",
    payoff:
      "They return unable to explain what they now know. Across town, Nora adds two names to her board: MARA VOSS. ELI COLE. Black.",
  },
];

const seriesTracks = [
  {
    number: "01",
    title: "The Anthology",
    text: "A new dark American history every episode: period-specific, morally complex, violent, and rooted in human choices rather than supernatural spectacle.",
  },
  {
    number: "02",
    title: "The Relationship",
    text: "Every transport forces Mara and Eli to live on opposing sides of the same event, turning history into a pressure test for a modern love story.",
  },
  {
    number: "03",
    title: "The Conspiracy",
    text: "They recover evidence no living person should be able to locate. Anonymous justice leaves a pattern, and Nora Vasquez has started to see it.",
  },
];

const rules = [
  "Both Mara and Eli must be present.",
  "Deep research creates the threshold.",
  "Touching the headstone opens the door.",
  "They inhabit opposing sides of one true story.",
  "They cannot communicate or change the outcome.",
  "They return at the exact moment of death.",
  "No time passes in the present.",
  "They remember everything.",
];

const seasonArc = [
  {
    season: "Season One",
    title: "The Door Opens",
    text: "Discovery, first consequences, and the decision to use what they witness. Nora notices the pattern. Raymond moves toward them. The family connection emerges from the margins.",
  },
  {
    season: "Season Two",
    title: "The Cost Becomes Real",
    text: "Longer transports, physical deterioration, powerful living enemies, and bloodlines that can no longer be dismissed. Nora reaches a terrible choice.",
  },
  {
    season: "Season Three",
    title: "Reckoning",
    text: "The anthology, relationship, and conspiracy tracks converge. The original conflict is fully excavated, the mechanism completes its purpose, and the couple makes an earned final choice.",
  },
];

const creatorBio = {
  role: "Creator / Writer",
  name: "Cory Armer",
  teaser:
    "Creator and writer of Graveside and founder of RSF, bringing operational discipline, entrepreneurial vision, and a character-first approach to development.",
  paragraphs: [
    "Cory Armer is the creator and writer of Graveside, a TV-MA prestige drama-horror anthology built around dark American history, a central relationship under extraordinary pressure, and a present-day conspiracy driven by the evidence the dead leave behind. Designed as a closed three-season story, the series combines a repeatable anthology engine with an escalating mythology and definitive ending.",
    "Cory brings a distinct, non-traditional path into the entertainment industry. With over 15 years of experience leading large-scale, branded hospitality operations, he has built a career grounded in execution, leadership, and performance. Managing high-volume environments and delivering consistent results within structured systems has shaped a disciplined, solutions-oriented approach that now carries into his creative work.",
    "He is also the founder of Ready Set Fly (RSF), an aviation platform built to modernize how pilots plan, train, and access aircraft. The platform reflects his ability to identify gaps in traditional industries and build scalable, real-world solutions, with early traction validating both the concept and execution.",
    "As a creator, Cory represents a combination of operational discipline, entrepreneurial vision, and creative ambition. His focus is on developing character-driven projects that are culturally resonant, commercially viable, and constructed with a clear path from concept through market-ready execution.",
  ],
};

function scrollTo(sectionId: string) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - 32, behavior: "smooth" });
}

function downloadTracked(label: string, target: string) {
  trackEvent("cta_click", { label, target });
}

export default function GravesidePage() {
  const [activeType, setActiveType] = useState<"All" | EpisodeType>("All");
  const [openEpisode, setOpenEpisode] = useState(1);
  const [scriptExcerptOpen, setScriptExcerptOpen] = useState(false);

  useEffect(() => {
    document.title = "Graveside | A Television Series";
    trackEvent("graveside_page_view", { page: "/graveside" });
  }, []);

  const filteredEpisodes = useMemo(
    () => episodes.filter((episode) => activeType === "All" || episode.type === activeType),
    [activeType],
  );

  return (
    <div className="min-h-screen overflow-hidden bg-[#080b0c] text-[#ece9df] selection:bg-[#8f2f28] selection:text-white">
      <section className="relative min-h-screen overflow-hidden border-b border-[#b1a995]/15">
        <img
          src={HERO_IMAGE_PATH}
          alt="Two figures at a historic cemetery as a cold light opens beyond a headstone"
          className="absolute inset-0 h-full w-full object-cover object-[63%_center]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,8,9,0.98)_0%,rgba(5,8,9,0.9)_30%,rgba(5,8,9,0.3)_65%,rgba(5,8,9,0.7)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,9,0.25)_0%,rgba(5,8,9,0.15)_48%,rgba(5,8,9,0.98)_100%)]" />
        <div className="absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(255,255,255,0.025)_3px,rgba(255,255,255,0.025)_4px)]" />

        <div className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col px-5 py-6 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between border-b border-white/15 pb-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#c6c0b2]">
              A television series by Cory Armer
            </div>
            <div className="hidden items-center gap-6 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#aaa496] sm:flex">
              <button onClick={() => scrollTo("series")} className="transition hover:text-white">Series</button>
              <button onClick={() => scrollTo("concept-art")} className="transition hover:text-white">Concept</button>
              <button onClick={() => scrollTo("season-one")} className="transition hover:text-white">Episodes</button>
              <button onClick={() => scrollTo("creator")} className="transition hover:text-white">Creator</button>
              <span className="border border-[#a33a32]/60 bg-[#571c18]/35 px-3 py-1.5 text-[#dfc4bd]">Confidential</span>
            </div>
          </header>

          <div className="flex flex-1 items-center py-16">
            <div className="max-w-4xl">
              <div className="mb-5 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-[#cdc7b8]">
                <span className="border border-white/20 bg-black/30 px-3 py-2 backdrop-blur">TV-MA</span>
                <span className="border border-white/20 bg-black/30 px-3 py-2 backdrop-blur">60 minutes</span>
                <span className="border border-white/20 bg-black/30 px-3 py-2 backdrop-blur">15 episodes</span>
                <span className="border border-white/20 bg-black/30 px-3 py-2 backdrop-blur">3-season arc</span>
              </div>

              <h1 className="font-display text-[clamp(4.8rem,15vw,11rem)] font-semibold uppercase leading-[0.76] tracking-[-0.085em] text-[#f4f1e8] drop-shadow-[0_18px_40px_rgba(0,0,0,0.65)]">
                Grave
                <br />
                <span className="ml-[0.16em] text-[#a94137]">side</span>
              </h1>

              <p className="mt-8 max-w-2xl font-display text-xl italic tracking-[-0.02em] text-[#d7d1c3] sm:text-2xl">
                Some doors open from the other side.
              </p>

              <p className="mt-6 max-w-2xl border-l-2 border-[#9d3a31] pl-5 text-base leading-8 text-[#d0ccc2] sm:text-lg">
                Two people obsessed with cemetery history get exactly what they wished for - and spend three seasons
                trying to survive what they found.
              </p>

              <div className="mt-7 flex w-fit items-center gap-4 border border-[#a94137]/65 bg-[linear-gradient(90deg,rgba(79,22,18,0.82),rgba(9,12,13,0.78))] px-5 py-4 shadow-[0_18px_55px_rgba(0,0,0,0.42)] backdrop-blur">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#c65a4f]/55 bg-black/25 text-[#d86a5f]">
                  <ShieldCheck className="h-6 w-6" />
                </span>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#d86a5f]">WGA Registered</div>
                  <div className="mt-1 font-mono text-base font-semibold tracking-[0.1em] text-white sm:text-lg">
                    WGA #2339596
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={() => setScriptExcerptOpen(true)}
                  className="border-[#a43d34] bg-[#a43d34] text-white [background-image:none] hover:bg-[#bb4a40]"
                >
                  <ScrollText className="mr-2 h-4 w-4" />
                  Read pilot excerpt
                </Button>
                <Button
                  size="lg"
                  onClick={() => scrollTo("series")}
                  variant="outline"
                  className="border-white/20 bg-black/35 text-white [background-image:none] backdrop-blur hover:bg-black/55"
                >
                  Enter the story
                  <ArrowDown className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-transparent text-white [background-image:none] backdrop-blur hover:bg-black/55"
                >
                  <a
                    href={ONE_PAGER_PATH}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => downloadTracked("graveside_one_pager", ONE_PAGER_PATH)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    One-pager
                  </a>
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/15 pt-5 text-[10px] uppercase tracking-[0.22em] text-[#aaa598] sm:grid-cols-3">
            <span>Prestige drama / horror anthology</span>
            <span className="sm:text-center">Action. Violence. Dark humor.</span>
            <span className="sm:text-right">Definitive ending</span>
          </div>
        </div>
      </section>

      <main>
        <section id="series" className="relative mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-[#7c2923]/10 blur-[120px]" />
          <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#a94137]">Series Logline</div>
              <h2 className="mt-5 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-white sm:text-6xl">
                The dead do not stay buried.
              </h2>
            </div>
            <div className="space-y-7">
              <p className="text-xl leading-9 tracking-[-0.02em] text-[#e1ddd3] sm:text-2xl sm:leading-10">
                A trauma surgeon and a genealogist discover that certain cemeteries hold a door neither of them chose
                to open.
              </p>
              <p className="text-base leading-8 text-[#aaa79f] sm:text-lg">
                Pulled into the lives of the buried, they experience history's darkest stories from opposing sides,
                powerless to change a single outcome but not powerless to act on what they witness. As they anonymously
                surface buried crimes with living consequences, someone in the present starts noticing the impossible
                specificity of what they know.
              </p>
              <div className="grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3">
                {seriesTracks.map((track) => (
                  <div key={track.number} className="bg-[#0c1011] p-6">
                    <div className="font-mono text-xs text-[#a94137]">{track.number}</div>
                    <h3 className="mt-8 font-display text-2xl font-semibold tracking-[-0.04em] text-white">{track.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#9e9b94]">{track.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="concept-art" className="border-y border-white/10 bg-[#050708] scroll-mt-8">
          <div className="mx-auto max-w-[1600px] px-3 py-16 sm:px-6 lg:px-10 lg:py-24">
            <div className="mx-auto mb-8 grid max-w-[1500px] gap-5 px-2 sm:px-0 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#a94137]">
                  Series Concept Art
                </div>
                <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl">
                  The world at a glance.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-[#99968e] lg:text-right">
                A visual statement of the series engine, central couple, historical scope, and collision between the
                evidence of the past and the danger building in the present.
              </p>
            </div>

            <div className="group relative overflow-hidden border border-white/15 bg-[#0b0e0f] shadow-[0_34px_100px_rgba(0,0,0,0.55)]">
              <img
                src={CONCEPT_ART_PATH}
                alt="Graveside concept art featuring Eli Cole, Mara Voss, historic cemetery imagery, and series overview copy"
                className="h-auto w-full"
              />
              <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/75 via-black/20 to-transparent p-4 pt-20 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-white/25 bg-black/65 text-white [background-image:none] backdrop-blur hover:bg-black/85"
                >
                  <a
                    href={CONCEPT_ART_PATH}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => downloadTracked("graveside_concept_art_full_size", CONCEPT_ART_PATH)}
                  >
                    <Expand className="mr-2 h-4 w-4" />
                    Open full size
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#0c1011]">
          <div className="mx-auto grid max-w-[1500px] lg:grid-cols-2">
            <div className="border-b border-white/10 p-7 sm:p-12 lg:border-b-0 lg:border-r lg:p-16">
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#a94137]">Dr. Mara Voss / 36</div>
              <h2 className="mt-6 font-display text-5xl font-semibold tracking-[-0.06em] text-white">The surgeon.</h2>
              <p className="mt-6 max-w-xl text-base leading-8 text-[#aaa79f]">
                Precise, caustically funny, and built to change outcomes. The transports are a specific kind of torture:
                she is fully aware of every preventable death and completely unable to intervene.
              </p>
              <div className="mt-10 flex items-center gap-3 text-sm text-[#d4cfc3]">
                <Fingerprint className="h-5 w-5 text-[#a94137]" />
                Her flaw is control.
              </div>
            </div>
            <div className="p-7 sm:p-12 lg:p-16">
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#a94137]">Eli Cole / 38</div>
              <h2 className="mt-6 font-display text-5xl font-semibold tracking-[-0.06em] text-white">The genealogist.</h2>
              <p className="mt-6 max-w-xl text-base leading-8 text-[#aaa79f]">
                Gifted at finding people deliberately erased from the record, with a dry sense of humor and a lifetime
                spent processing pain as story. The transports make emotional distance impossible.
              </p>
              <div className="mt-10 flex items-center gap-3 text-sm text-[#d4cfc3]">
                <Fingerprint className="h-5 w-5 text-[#a94137]" />
                His flaw is detachment.
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 px-5 py-7 text-center sm:px-8">
            <p className="font-display text-xl italic text-[#d7d2c6] sm:text-2xl">
              Together three years. Met at a cemetery. History has already decided they should not choose each other.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            <div>
              <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#a94137]">
                <Skull className="h-4 w-4" />
                The mechanism
              </div>
              <h2 className="mt-5 max-w-xl font-display text-5xl font-semibold leading-none tracking-[-0.06em] text-white sm:text-6xl">
                They touch the stone. They go back.
              </h2>
              <p className="mt-7 max-w-xl text-base leading-8 text-[#aaa79f]">
                Never fully explained. Never confirmed as supernatural, psychological, or biological. What matters is
                what Mara and Eli can prove - and what every crossing costs.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2">
              {rules.map((rule, index) => (
                <div key={rule} className="flex min-h-28 items-start gap-4 bg-[#0a0d0e] p-5">
                  <span className="font-mono text-xs text-[#7f332d]">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-sm leading-7 text-[#d1cdc3]">{rule}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            <div className="border border-white/10 bg-[#0d1112] p-6">
              <Eye className="h-5 w-5 text-[#a94137]" />
              <div className="mt-8 text-xs uppercase tracking-[0.25em] text-[#827f78]">Emotional bleed</div>
              <p className="mt-3 text-sm leading-7 text-[#c3bfb5]">The host's terror, grief, or cold certainty follows them home.</p>
            </div>
            <div className="border border-white/10 bg-[#0d1112] p-6">
              <Clock3 className="h-5 w-5 text-[#a94137]" />
              <div className="mt-8 text-xs uppercase tracking-[0.25em] text-[#827f78]">Physical toll</div>
              <p className="mt-3 text-sm leading-7 text-[#c3bfb5]">Exhaustion becomes medically visible and increasingly impossible to explain.</p>
            </div>
            <div className="border border-white/10 bg-[#0d1112] p-6">
              <MapPin className="h-5 w-5 text-[#a94137]" />
              <div className="mt-8 text-xs uppercase tracking-[0.25em] text-[#827f78]">Temporal erosion</div>
              <p className="mt-3 text-sm leading-7 text-[#c3bfb5]">Eventually, time spent in the past begins to feel more real than the present.</p>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[radial-gradient(circle_at_20%_20%,rgba(120,39,33,0.16),transparent_35%),#0b0e0f]">
          <div className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#a94137]">Three-season architecture</div>
              <h2 className="mt-5 font-display text-5xl font-semibold tracking-[-0.06em] text-white sm:text-7xl">
                The door has a purpose.
              </h2>
              <p className="mt-6 text-base leading-8 text-[#aaa79f] sm:text-lg">
                A closed, escalating arc with a definitive ending. The mechanism is explained through experience, not exposition.
              </p>
            </div>
            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {seasonArc.map((season, index) => (
                <article key={season.season} className="relative overflow-hidden border border-white/10 bg-black/25 p-7">
                  <div className="absolute right-4 top-1 font-display text-8xl font-semibold text-white/[0.035]">{index + 1}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#9d3a32]">{season.season}</div>
                  <h3 className="mt-8 font-display text-3xl font-semibold tracking-[-0.05em] text-white">{season.title}</h3>
                  <p className="mt-5 text-sm leading-7 text-[#aaa79f]">{season.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="season-one" className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#a94137]">Season One</div>
              <h2 className="mt-5 font-display text-5xl font-semibold tracking-[-0.06em] text-white sm:text-7xl">
                The Door Opens
              </h2>
            </div>
            <p className="max-w-2xl self-end text-base leading-8 text-[#aaa79f] sm:text-lg">
              Fifteen hours move from first contact to full exposure: ten dark histories, three ancestor episodes, a
              present-day collision, and an investigator who ends the season with their names.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-2 border-y border-white/10 py-4">
            {(["All", "A", "B", "C", "Special"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setActiveType(type)}
                className={`border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] transition ${
                  activeType === type
                    ? "border-[#a94137] bg-[#a94137] text-white"
                    : "border-white/10 bg-white/[0.02] text-[#8f8b83] hover:border-white/30 hover:text-white"
                }`}
              >
                {type === "All" ? "All episodes" : type === "Special" ? "Pilot / Present" : `Type ${type}`}
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-3">
            {filteredEpisodes.map((episode) => {
              const isOpen = openEpisode === episode.number;
              return (
                <article
                  key={episode.number}
                  className={`border transition ${
                    isOpen ? "border-[#8f3730]/70 bg-[#101415]" : "border-white/10 bg-[#0b0e0f] hover:border-white/25"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenEpisode(isOpen ? 0 : episode.number)}
                    className="grid w-full items-center gap-5 p-5 text-left sm:grid-cols-[70px_1fr_auto] sm:p-6"
                  >
                    <div className="font-mono text-sm text-[#a94137]">EP {String(episode.number).padStart(2, "0")}</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-display text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
                          {episode.title}
                        </h3>
                        <span className="border border-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-[#8f8b83]">
                          {episode.type === "Special" ? episode.label : `Type ${episode.type}`}
                        </span>
                      </div>
                      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[#77746e]">{episode.era}</div>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-[#a94137] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen ? (
                    <div className="grid gap-6 border-t border-white/10 px-5 py-6 sm:px-6 lg:grid-cols-[1.2fr_0.8fr]">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#807d76]">{episode.label}</div>
                        <p className="mt-4 text-base leading-8 text-[#d0ccc2]">{episode.summary}</p>
                      </div>
                      <div className="space-y-4">
                        {episode.evidence ? (
                          <div className="border-l border-[#8f3730] bg-black/20 px-5 py-4">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#9f5b55]">Physical evidence</div>
                            <p className="mt-3 text-sm leading-7 text-[#aaa79f]">{episode.evidence}</p>
                          </div>
                        ) : null}
                        <div className="border-l border-[#807a6d] bg-black/20 px-5 py-4">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#969187]">End beat</div>
                          <p className="mt-3 text-sm leading-7 text-[#aaa79f]">{episode.payoff}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section id="creator" className="border-t border-white/10 bg-[#080b0c] scroll-mt-8">
          <div className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#a94137]">
                Creator / Writer
              </div>
              <h2 className="mt-5 font-display text-5xl font-semibold tracking-[-0.06em] text-white sm:text-7xl">
                The person behind the door.
              </h2>
              <p className="mt-6 text-base leading-8 text-[#aaa79f] sm:text-lg">
                The creative and operating background shaping Graveside from concept through industry-facing development.
              </p>
            </div>

            <article className="group mx-auto mt-12 max-w-5xl rounded-[26px] border border-[#8f3730]/25 bg-[linear-gradient(180deg,rgba(16,19,20,0.98)_0%,rgba(8,10,11,1)_100%)] p-5 transition hover:border-[#a94137]/55 sm:rounded-[30px] sm:p-7">
              <div className="grid gap-7 lg:grid-cols-[0.72fr_1.28fr] lg:gap-10">
                <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black/20 shadow-[0_22px_50px_rgba(0,0,0,0.36)]">
                  <img
                    src={CORY_BIO_IMAGE_PATH}
                    alt="Cory Armer profile"
                    className="h-80 w-full object-cover object-[42%_center] transition duration-500 group-hover:scale-[1.02] sm:h-[30rem]"
                  />
                </div>

                <div className="flex flex-col justify-center py-1 sm:py-4">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-[#a95a52]">{creatorBio.role}</div>
                  <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.055em] text-white sm:text-5xl">
                    {creatorBio.name}
                  </h3>
                  <p className="mt-5 text-base leading-8 text-[#c6c0b5]">{creatorBio.teaser}</p>
                  <div className="mt-6 space-y-4 border-t border-white/10 pt-6 text-sm leading-7 text-[#ddd7cc]">
                    {creatorBio.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="border-t border-white/10 bg-[#0c1011]">
          <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-8 lg:px-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-4xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#a94137]">The promise</div>
                <p className="mt-6 font-display text-3xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-5xl">
                  This is not a ghost story. It is about what the dead leave behind, what the living inherit, and whether
                  justice has an expiration date.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <Button
                  asChild
                  size="lg"
                  className="border-[#a43d34] bg-[#a43d34] text-white [background-image:none] hover:bg-[#bb4a40]"
                >
                  <a
                    href={SERIES_BIBLE_PATH}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => downloadTracked("graveside_series_bible", SERIES_BIBLE_PATH)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Read series bible
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/15 bg-transparent text-white [background-image:none] hover:bg-white/5"
                >
                  <a
                    href={ONE_PAGER_PATH}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => downloadTracked("graveside_footer_one_pager", ONE_PAGER_PATH)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download one-pager
                  </a>
                </Button>
              </div>
            </div>
            <div className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-6 text-[10px] uppercase tracking-[0.24em] text-[#66645f] sm:flex-row sm:items-center sm:justify-between">
              <span>Graveside - Created by Cory Armer</span>
              <span>Confidential - Not for distribution</span>
            </div>
          </div>
        </section>
      </main>
      <ScriptExcerptDialog open={scriptExcerptOpen} onOpenChange={setScriptExcerptOpen} />
    </div>
  );
}
