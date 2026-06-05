import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  BookOpen,
  ChevronDown,
  Download,
  Expand,
  Eye,
  FileText,
  Fingerprint,
  Network,
  RadioTower,
  ScrollText,
  Shield,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PatriotScriptExcerptDialog } from "@/components/patriot-protocol/PatriotScriptExcerptDialog";
import { trackEvent } from "@/lib/analytics";

const CONCEPT_ART_PATH = "/downloads/patriot-protocol-concept-art.png";
const COVERT_RESPONSE_PATH = "/downloads/patriot-protocol-covert-response.png";
const SERIES_BIBLE_PATH = "/downloads/patriot-protocol-series-bible.docx";
const CORY_BIO_IMAGE_PATH = "/downloads/cory-armer-creator-bio.png";

type SystemNode = {
  id: string;
  number: string;
  title: string;
  status: string;
  summary: string;
  method: string;
};

const systemNodes: SystemNode[] = [
  {
    id: "education",
    number: "01",
    title: "Education",
    status: "Phase I active",
    summary: "The Department of Education is dissolved and replaced by Patriot Curriculum Centers.",
    method: "Curriculum control, loyalty statements, teacher removals, and the recasting of history as a threat to stability.",
  },
  {
    id: "media",
    number: "02",
    title: "Media",
    status: "Narrative dominance",
    summary: "Liberty Broadcast Network turns policy seizure into soothing national renewal.",
    method: "Deepfakes, emotional targeting, cognitive-vulnerability mapping, and manufactured consensus moving faster than verification.",
  },
  {
    id: "military",
    number: "03",
    title: "Military",
    status: "Loyalty review",
    summary: "Foundation guidance begins entering the chain of command under the language of stability.",
    method: "Ideological audits, ambiguous domestic orders, selective promotion, and pressure to transfer loyalty from the Constitution to leadership.",
  },
  {
    id: "courts",
    number: "04",
    title: "Courts",
    status: "Long-game placement",
    summary: "The takeover relies on decades of quiet placement rather than one visible seizure.",
    method: "Clerk networks, policy pipelines, legal stress tests, and constitutional loopholes normalized before the public recognizes the pattern.",
  },
  {
    id: "technology",
    number: "05",
    title: "Technology",
    status: "Behavioral control",
    summary: "The Foundation knows which communities will believe which lie before releasing it.",
    method: "Influence algorithms, sentiment grids, identity reinforcement, access rewards, and surveillance of anomaly signatures.",
  },
  {
    id: "force",
    number: "06",
    title: "Domestic Force",
    status: "Visible enforcement",
    summary: "The Civil Defense Front and Federal Harmonization Service give the ideology a uniform.",
    method: "Deputized militias, checkpoints, blacksites, mass detentions, and coercion presented as public safety.",
  },
];

const resistanceRoles = [
  {
    icon: Shield,
    title: "Command",
    lead: "Roark / Shaw",
    text: "Strategic authorization, constitutional military resistance, compartmentalization, and the political architecture required to survive success.",
  },
  {
    icon: Target,
    title: "Field Operations",
    lead: "Jacob / Wolfe",
    text: "Reconnaissance, extraction, protection, and tightly controlled strike capability built outside compromised institutions.",
  },
  {
    icon: Network,
    title: "Intelligence",
    lead: "Lena Calder",
    text: "Maps the Foundation's influence architecture, identifies vulnerabilities, and keeps the network ahead of digital detection.",
  },
  {
    icon: RadioTower,
    title: "Narrative",
    lead: "Alicia Ortega",
    text: "Counters manufactured reality with precisely timed truth, localized trust, and stories the propaganda system cannot immediately neutralize.",
  },
];

const characters = [
  {
    name: "Jacob Hale",
    role: "Civilian operator / former soldier",
    summary:
      "A service manager in Austin who recognizes the psychological-warfare pattern before the country recognizes the coup. His awakening turns into recruitment, then command.",
  },
  {
    name: "General Isaac Roark",
    role: "Architect",
    summary:
      "The strategist who gives the resistance its name, structure, money, and burden: build something strong enough to restore the republic without becoming its replacement.",
  },
  {
    name: "General Adrian Shaw",
    role: "Constitutional firewall",
    summary:
      "A senior officer watching Foundation language infect military orders. He begins building a hidden faction around one principle: the oath is to the Constitution.",
  },
  {
    name: "Lena Calder",
    role: "Intelligence systems",
    summary:
      "An NSA technologist whose own work was repurposed into the Foundation's influence machine. She knows how they think because part of the system began with her.",
  },
  {
    name: "Damian Wolfe",
    role: "Strike-cell formation",
    summary:
      "Ex-Delta, isolated and lethal. He brings the tactical capability the Protocol needs and the moral danger it may not be able to control.",
  },
  {
    name: "Alicia Ortega",
    role: "Investigative journalist",
    summary:
      "A reporter whose Fourth Foundation investigation was killed before publication. She turns narrative knowledge into an operational weapon.",
  },
  {
    name: "Vincent Harken",
    role: "Fourth Foundation director",
    summary:
      "Composed, intellectual, and terrifyingly patient. He does not believe he is destroying democracy; he believes he is correcting it.",
  },
  {
    name: "Kessler",
    role: "FHS antagonist",
    summary:
      "The enforcement mind who follows anomalies back toward Jacob and converts the Foundation's ideology into direct pursuit.",
  },
];

const episodes = [
  {
    number: 1,
    title: "The Quiet Coup",
    phase: "Awakening",
    summary:
      "The Department of Education disappears overnight. Teachers are detained, propaganda becomes policy, and Jacob Hale recognizes the shape of a domestic psychological operation. The Fourth Foundation emerges. The Patriot Protocol is born.",
    escalation: "The takeover becomes visible, but most of the country reads it as restoration.",
  },
  {
    number: 2,
    title: "The First Blueprint",
    phase: "Architecture",
    summary:
      "FHS enters the picture, militia influence expands, and Lena decodes the first target clusters. Jacob, Wolfe, and Alicia conduct field reconnaissance while the Foundation begins tracking anomalies in its system.",
    escalation: "The resistance builds its first target board as the enemy notices resistance exists.",
  },
  {
    number: 3,
    title: "Shadow Signals",
    phase: "Countermove",
    summary:
      "Kessler arrives, FHS gains military access, and the Foundation tests population compliance. A night raid reveals a new kill doctrine and forces the team to define the real enemy.",
    escalation: "They are not fighting individuals. They are fighting a system.",
  },
  {
    number: 4,
    title: "Hindsight",
    phase: "Timeline episode",
    featured: true,
    summary:
      "Twenty years of civic erosion unfold across one prestige-format hour: think-tank papers, donor networks, media boards, school systems, court placements, militia channels, AI influence tools, and the bureaucratic evolution of FHS.",
    escalation: "The coup did not arrive suddenly. It grew in daylight, one compromised institution at a time.",
  },
  {
    number: 5,
    title: "The First Targets",
    phase: "Resistance",
    summary:
      "Roark authorizes the first non-lethal counterstrike. Alicia disrupts a propaganda funnel, Wolfe forms the first specialized cell, and a key bureaucrat is exposed.",
    escalation: "The season moves from diagnosis into active resistance.",
  },
  {
    number: 6,
    title: "Loyalty Tests",
    phase: "Pressure",
    summary:
      "Military loyalty audits intensify. Shaw leaks intelligence, officers face FHS interrogation, and Jacob confronts a moral boundary during the first direct clash with a Protocol operation.",
    escalation: "Foundation Phase III begins: Identity Reinforcement.",
  },
  {
    number: 7,
    title: "The Breach",
    phase: "Exposure",
    summary:
      "State government is compromised, checkpoints spread, Lena penetrates a sentiment grid, and the Protocol extracts a captured whistleblower while Wolfe's darker instincts threaten the team.",
    escalation: "Kessler identifies Jacob as the anomaly.",
  },
  {
    number: 8,
    title: "The Long Game",
    phase: "Moral break",
    summary:
      "A blacksite is discovered. Defectors are being killed. Alicia's station is targeted, Shaw must choose between orders and conscience, and Jacob carries out the season's first violent takedown.",
    escalation: "The team learns what Phase IV actually requires.",
  },
  {
    number: 9,
    title: "The Trigger Point",
    phase: "Commitment",
    summary:
      "The Foundation approaches Phase IV. Jacob crosses a clean moral line, Wolfe pushes toward deadly force, and Roark begins building bipartisan civilian oversight around the operation.",
    escalation: "The final activation plan is drafted.",
  },
  {
    number: 10,
    title: "Activation",
    phase: "Season finale",
    summary:
      "Mass stability detentions begin. A blacksite rescue forces every resistance discipline into the same operation while the Foundation prepares its launch and Harken turns his attention toward Jacob.",
    escalation: "Strike Team Alpha assembles. The war begins.",
  },
];

const creatorBio = [
  "Cory Armer is the creator and writer of The Patriot Protocol, a present-day and near-future political action drama about institutional capture, manufactured consent, and the moral cost of building a resistance powerful enough to reverse an authoritarian takeover. The series combines conspiracy thriller, ensemble drama, military tension, and a long-form operational engine designed to escalate across multiple seasons.",
  "Cory brings a distinct, non-traditional path into the entertainment industry. With over 15 years of experience leading large-scale, branded hospitality operations, he has built a career grounded in execution, leadership, and performance. Managing high-volume environments and delivering consistent results within structured systems has shaped a disciplined, solutions-oriented approach that now carries into his creative work.",
  "He is also the founder of Ready Set Fly (RSF), an aviation platform built to modernize how pilots plan, train, and access aircraft. The platform reflects his ability to identify gaps in traditional industries and build scalable, real-world solutions.",
  "As a creator, Cory focuses on character-driven projects with clear commercial engines, emotionally consequential choices, and worlds capable of sustaining premium serialized storytelling. The Patriot Protocol sits within a broader slate that includes Noise & Fury and Graveside.",
];

function scrollTo(sectionId: string) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - 34, behavior: "smooth" });
}

function trackDownload(label: string, target: string) {
  trackEvent("cta_click", { label, target });
}

export default function PatriotProtocolPage() {
  const [activeSystemId, setActiveSystemId] = useState(systemNodes[0].id);
  const [openEpisode, setOpenEpisode] = useState(1);
  const [scriptOpen, setScriptOpen] = useState(false);

  useEffect(() => {
    document.title = "The Patriot Protocol | A Television Series";
    trackEvent("patriot_protocol_page_view", { page: "/patriotprotocol" });
  }, []);

  const activeSystem = useMemo(
    () => systemNodes.find((node) => node.id === activeSystemId) ?? systemNodes[0],
    [activeSystemId],
  );

  return (
    <div className="min-h-screen overflow-hidden bg-[#070a08] text-[#e7e6d8] selection:bg-[#65734b] selection:text-white">
      <section className="relative min-h-screen overflow-hidden border-b border-white/10">
        <img
          src={CONCEPT_ART_PATH}
          alt="The Patriot Protocol concept art showing the resistance, the Fourth Foundation, and an authoritarian Washington"
          className="absolute inset-0 h-full w-full object-cover object-[53%_center]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,5,0.98)_0%,rgba(3,7,5,0.9)_31%,rgba(6,10,7,0.32)_66%,rgba(3,7,5,0.78)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,5,0.2)_0%,rgba(3,7,5,0.08)_43%,rgba(3,7,5,0.99)_100%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(151,166,119,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(151,166,119,0.12)_1px,transparent_1px)] [background-size:80px_80px]" />
        <div className="absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(216,205,170,0.035)_3px,rgba(216,205,170,0.035)_4px)]" />

        <div className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col px-5 py-6 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between border-b border-white/15 pb-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#d1cbc0]">
              A television series by Cory Armer
            </div>
            <nav className="hidden items-center gap-6 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#aaa59b] lg:flex">
              <button onClick={() => scrollTo("series")} className="transition hover:text-white">Series</button>
              <button onClick={() => scrollTo("system")} className="transition hover:text-white">The System</button>
              <button onClick={() => scrollTo("episodes")} className="transition hover:text-white">Episodes</button>
              <button onClick={() => scrollTo("creator")} className="transition hover:text-white">Creator</button>
              <span className="border border-[#a88a50]/65 bg-[#342d1d]/65 px-3 py-1.5 text-[#ddc38f]">Classified / Eyes Only</span>
            </nav>
          </header>

          <div className="flex flex-1 items-center py-16">
            <div className="max-w-[780px]">
              <div className="mb-6 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#d2ccc1]">
                <span className="border border-white/20 bg-black/40 px-3 py-2 backdrop-blur">TV-MA</span>
                <span className="border border-white/20 bg-black/40 px-3 py-2 backdrop-blur">One-hour drama</span>
                <span className="border border-white/20 bg-black/40 px-3 py-2 backdrop-blur">10 episodes</span>
                <span className="border border-white/20 bg-black/40 px-3 py-2 backdrop-blur">Present / near future</span>
              </div>

              <div className="text-[11px] font-semibold uppercase tracking-[0.42em] text-[#d4cfc6]">
                They didn't steal the country.
              </div>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.42em] text-[#c7a35d]">
                We handed it to them.
              </div>

              <h1 className="mt-7 font-display text-[clamp(4.2rem,10.5vw,9rem)] font-semibold uppercase leading-[0.78] tracking-[-0.085em] text-[#f2efe8] drop-shadow-[0_18px_45px_rgba(0,0,0,0.75)]">
                Patriot
                <br />
                <span className="text-[#9ba776]">Protocol</span>
              </h1>

              <p className="mt-8 max-w-2xl border-l-2 border-[#9ba776] pl-5 text-base leading-8 text-[#d4d0c7] sm:text-lg">
                A decades-long authoritarian takeover reaches its final phase. The only countermeasure is a resistance
                built in the shadows: more than thirty six-person cells preparing for one synchronized night that can
                dismantle the operating network before the republic disappears.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={() => setScriptOpen(true)}
                  className="border-[#768356] bg-[#667449] text-white [background-image:none] hover:bg-[#78875a]"
                >
                  <ScrollText className="mr-2 h-4 w-4" />
                  Read pilot excerpt
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => scrollTo("series")}
                  className="border-white/20 bg-black/40 text-white [background-image:none] backdrop-blur hover:bg-black/60"
                >
                  Enter the dossier
                  <ArrowDown className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-transparent text-white [background-image:none] backdrop-blur hover:bg-black/60"
                >
                  <a
                    href={SERIES_BIBLE_PATH}
                    download
                    onClick={() => trackDownload("patriot_protocol_series_bible", SERIES_BIBLE_PATH)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download series bible
                  </a>
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/15 pt-5 text-[10px] uppercase tracking-[0.22em] text-[#aaa59b] sm:grid-cols-3">
            <span>Prestige political action thriller</span>
            <span className="sm:text-center">A system built in the open</span>
            <span className="sm:text-right">A resistance built in the shadows</span>
          </div>
        </div>
      </section>

      <main>
        <section id="series" className="relative mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="pointer-events-none absolute -left-20 top-20 h-80 w-80 rounded-full bg-[#6f7d50]/10 blur-[120px]" />
          <div className="grid gap-14 lg:grid-cols-[0.76fr_1.24fr] lg:gap-20">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#c4a263]">Mission Overview</div>
              <h2 className="mt-5 font-display text-5xl font-semibold leading-[0.98] tracking-[-0.06em] text-white sm:text-7xl">
                The coup already happened.
              </h2>
            </div>
            <div className="space-y-7">
              <p className="text-xl leading-9 tracking-[-0.02em] text-[#e0dcd3] sm:text-2xl sm:leading-10">
                America still has elections, courts, broadcasts, schools, and uniforms. The names survived. The institutions did not.
              </p>
              <p className="text-base leading-8 text-[#aaa79f] sm:text-lg">
                The Fourth Foundation spent decades converting civic anxiety into infrastructure: curriculum policy,
                media ownership, judicial pipelines, military doctrine, influence technology, and domestic enforcement.
                By the time Jacob Hale sees the pattern, resistance cannot rely on any single institution because every
                institution may already be compromised.
              </p>
              <p className="text-base leading-8 text-[#aaa79f] sm:text-lg">
                The Patriot Protocol follows the people who build a parallel network capable of surviving discovery,
                restoring legitimate government, and confronting the central moral question of the series: how do you
                defeat authoritarian power without teaching yourself to become it?
              </p>
              <div className="grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3">
                {[
                  ["01", "Capture", "The Foundation wins through procedure, placement, and public consent."],
                  ["02", "Resistance", "A civilian-military network forms beyond compromised command structures."],
                  ["03", "Activation", "Thirty-plus cells prepare for one coordinated national operation."],
                ].map(([number, title, text]) => (
                  <div key={number} className="bg-[#0c0f10] p-6">
                    <div className="font-mono text-xs text-[#9ba776]">{number}</div>
                    <h3 className="mt-8 font-display text-2xl font-semibold tracking-[-0.04em] text-white">{title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#9d9a93]">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="system"
          className="border-y border-[#929d73]/15 bg-[#0a0e0b] scroll-mt-8 [background-image:linear-gradient(rgba(130,145,99,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(130,145,99,0.055)_1px,transparent_1px)] [background-size:48px_48px]"
        >
          <div className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
            <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
              <div>
                <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#c4a263]">
                  <Fingerprint className="h-4 w-4" />
                  Capture Architecture
                </div>
                <h2 className="mt-5 font-display text-5xl font-semibold leading-none tracking-[-0.06em] text-white sm:text-6xl">
                  Every institution became a delivery system.
                </h2>
                <p className="mt-7 text-base leading-8 text-[#aaa79f]">
                  Select a compromised domain to see how the Fourth Foundation turned ordinary civic machinery into a
                  self-reinforcing authoritarian network.
                </p>

                <div className="mt-9 grid grid-cols-2 gap-2">
                  {systemNodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setActiveSystemId(node.id)}
                      className={`border p-4 text-left transition ${
                        activeSystemId === node.id
                          ? "border-[#8d9b68] bg-[#1b2117] text-white"
                          : "border-[#8c9674]/15 bg-black/25 text-[#8f9385] hover:border-[#9da980]/45 hover:text-white"
                      }`}
                    >
                      <div className="font-mono text-[10px] text-[#9ba776]">{node.number}</div>
                      <div className="mt-2 text-sm font-semibold uppercase tracking-[0.12em]">{node.title}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative min-h-[520px] overflow-hidden border border-[#8f9b70]/30 bg-[radial-gradient(circle_at_70%_30%,rgba(105,120,76,0.18),transparent_36%),#070a08] p-7 sm:p-10">
                <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(135deg,transparent,transparent_18px,rgba(189,166,105,0.06)_18px,rgba(189,166,105,0.06)_19px)]" />
                <div className="absolute right-5 top-3 font-display text-[10rem] font-semibold leading-none text-white/[0.025]">
                  {activeSystem.number}
                </div>
                <div className="relative">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#c4a263]">Active domain</div>
                      <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                        {activeSystem.title}
                      </h3>
                    </div>
                    <span className="border border-[#8d9b68]/45 bg-[#202718]/75 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-[#c8d1aa]">
                      {activeSystem.status}
                    </span>
                  </div>
                  <p className="mt-10 max-w-2xl text-xl leading-9 text-[#e0dcd3]">{activeSystem.summary}</p>
                  <div className="mt-10 border-l-2 border-[#9ba776] bg-black/30 px-6 py-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#b3955c]">Method</div>
                    <p className="mt-3 text-base leading-8 text-[#aaa79f]">{activeSystem.method}</p>
                  </div>
                  <div className="mt-10 grid grid-cols-3 gap-px bg-white/10">
                    {["Normalize", "Isolate", "Enforce"].map((step, index) => (
                      <div key={step} className="bg-[#0b0e0f] px-3 py-5 text-center">
                        <div className="font-mono text-[10px] text-[#7e7770]">0{index + 1}</div>
                        <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c9c4bb]">{step}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#c4a263]">Operational Structure</div>
            <h2 className="mt-5 font-display text-5xl font-semibold tracking-[-0.06em] text-white sm:text-7xl">
              Thirty-plus cells. Six people each. One night.
            </h2>
            <p className="mt-6 text-base leading-8 text-[#aaa79f] sm:text-lg">
              The Protocol is designed as a compartmentalized national network: enough people to dismantle the operating
              structure, few enough in each cell to survive penetration. No participant holds the entire plan.
            </p>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {resistanceRoles.map((role) => {
              const Icon = role.icon;
              return (
                <article key={role.title} className="border border-[#8d9872]/15 bg-[#0c100d] p-6 transition hover:border-[#9ba776]/55">
                  <Icon className="h-5 w-5 text-[#9ba776]" />
                  <div className="mt-8 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#817e77]">{role.lead}</div>
                  <h3 className="mt-3 font-display text-2xl font-semibold tracking-[-0.04em] text-white">{role.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-[#aaa79f]">{role.text}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3">
            {[
              ["30+", "Compartmentalized cells", "A national network designed to remain functional after discovery."],
              ["6", "Operators per cell", "Small teams with distinct field, intelligence, logistics, and command roles."],
              ["1", "Coordinated night", "A narrow window to sever the system before Phase IV becomes irreversible."],
            ].map(([value, title, text]) => (
              <div key={value} className="bg-[#090c0d] p-7">
                <div className="font-display text-5xl font-semibold tracking-[-0.06em] text-[#c4a263]">{value}</div>
                <div className="mt-4 text-sm font-semibold uppercase tracking-[0.15em] text-white">{title}</div>
                <p className="mt-3 text-sm leading-7 text-[#99968f]">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden border-y border-[#929d73]/15 bg-[#060907]">
          <img
            src={COVERT_RESPONSE_PATH}
            alt="Covert response helicopters and black government SUVs staging at a remote airfield"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,8,5,0.97)_0%,rgba(4,8,5,0.8)_42%,rgba(4,8,5,0.18)_72%,rgba(4,8,5,0.62)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,5,0.15)_0%,rgba(4,8,5,0.28)_55%,rgba(4,8,5,0.96)_100%)]" />
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(153,171,116,0.11)_1px,transparent_1px),linear-gradient(90deg,rgba(153,171,116,0.11)_1px,transparent_1px)] [background-size:64px_64px]" />

          <div className="relative mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-36">
            <div className="h-44 sm:hidden" aria-hidden="true" />
            <div className="max-w-2xl border-l-2 border-[#9ba776] bg-black/35 p-6 backdrop-blur-sm sm:p-8">
              <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#c4a263]">
                <Activity className="h-4 w-4" />
                Activation Package / QRF
              </div>
              <h2 className="mt-5 font-display text-5xl font-semibold leading-none tracking-[-0.06em] text-white sm:text-7xl">
                Quiet lift. Black convoy. No insignia.
              </h2>
              <p className="mt-6 text-base leading-8 text-[#d0d2c4] sm:text-lg">
                Compact quick-response aircraft move strike cells between austere staging sites while armored,
                blacked-out SUVs carry operators through the final ground approach. Every platform is deniable,
                compartmentalized, and visible only during the narrow activation window.
              </p>

              <div className="mt-8 grid gap-px bg-[#9ba776]/20 sm:grid-cols-3">
                {[
                  ["AIR", "Low-profile rotorcraft", "Rapid insertion and extraction"],
                  ["GROUND", "Armored black SUVs", "Low-visibility urban movement"],
                  ["COMMS", "Burst transmission", "No persistent network signature"],
                ].map(([code, title, detail]) => (
                  <div key={code} className="bg-[#0a0e0b]/90 p-4">
                    <div className="font-mono text-[10px] text-[#b79c66]">{code}</div>
                    <div className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">{title}</div>
                    <div className="mt-2 text-xs leading-5 text-[#929789]">{detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute bottom-5 right-5 hidden border border-[#9ba776]/35 bg-black/55 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#b9c49b] backdrop-blur md:block">
            Package 04-A / Wheels up 02:10 / Status: compartmented
          </div>
        </section>

        <section className="border-y border-[#929d73]/15 bg-[radial-gradient(circle_at_18%_30%,rgba(104,120,75,0.14),transparent_32%),#0a0e0b]">
          <div className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
            <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#c4a263]">Personnel Roster</div>
                <h2 className="mt-5 font-display text-5xl font-semibold tracking-[-0.06em] text-white sm:text-7xl">
                  Different oaths. One line they will not cross.
                </h2>
              </div>
              <p className="max-w-2xl self-end text-base leading-8 text-[#aaa79f] sm:text-lg">
                The ensemble spans ordinary civilian life, special operations, intelligence, journalism, senior command,
                and the architects of the authoritarian project.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {characters.map((character) => (
                <article key={character.name} className="min-h-64 border border-[#8d9872]/15 bg-black/25 p-6 transition hover:border-[#9ba776]/55">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-[#b3955c]">{character.role}</div>
                  <h3 className="mt-5 font-display text-2xl font-semibold tracking-[-0.04em] text-white">{character.name}</h3>
                  <p className="mt-4 text-sm leading-7 text-[#aaa79f]">{character.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="episodes" className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#c4a263]">Season One / Mission Progression</div>
              <h2 className="mt-5 font-display text-5xl font-semibold tracking-[-0.06em] text-white sm:text-7xl">
                From quiet coup to activation.
              </h2>
            </div>
            <p className="max-w-2xl self-end text-base leading-8 text-[#aaa79f] sm:text-lg">
              Ten episodes expose the system, assemble the resistance, force the first moral breaks, and end with the
              formation of Strike Team Alpha.
            </p>
          </div>

          <div className="mt-10 grid gap-3">
            {episodes.map((episode) => {
              const isOpen = openEpisode === episode.number;
              return (
                <article
                  key={episode.number}
                  className={`border transition ${
                    episode.featured
                      ? "border-[#a58c59]/65 bg-[linear-gradient(90deg,rgba(51,46,29,0.72),rgba(12,16,13,0.98))]"
                      : isOpen
                        ? "border-[#839064]/65 bg-[#101510]"
                        : "border-[#8d9872]/15 bg-[#0a0e0b] hover:border-[#9ba776]/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenEpisode(isOpen ? 0 : episode.number)}
                    className="grid w-full items-center gap-5 p-5 text-left sm:grid-cols-[72px_1fr_auto] sm:p-6"
                  >
                    <div className="font-mono text-sm text-[#9ba776]">EP {String(episode.number).padStart(2, "0")}</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-display text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
                          {episode.title}
                        </h3>
                        {episode.featured ? (
                          <span className="border border-[#b09257]/55 bg-[#352d1b]/75 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-[#dbc28d]">
                            Structural centerpiece
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[#77746e]">{episode.phase}</div>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-[#9ba776] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen ? (
                    <div className="grid gap-6 border-t border-white/10 px-5 py-6 sm:px-6 lg:grid-cols-[1.2fr_0.8fr]">
                      <p className="text-base leading-8 text-[#d0ccc3]">{episode.summary}</p>
                      <div className="border-l border-[#9ba776] bg-black/20 px-5 py-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#b3955c]">Escalation</div>
                        <p className="mt-3 text-sm leading-7 text-[#aaa79f]">{episode.escalation}</p>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-[#929d73]/15 bg-[#050806]">
          <div className="mx-auto max-w-[1600px] px-3 py-20 sm:px-6 lg:px-10 lg:py-28">
            <div className="mx-auto mb-8 grid max-w-[1500px] gap-5 px-2 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#c4a263]">Strategic Visual</div>
                <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl">
                  The republic under pressure.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-[#99968e] lg:text-right">
                The principal ensemble, propaganda state, enforcement apparatus, and resistance atmosphere in one buyer-facing visual.
              </p>
            </div>
            <div className="group relative overflow-hidden border border-white/15 bg-[#0b0e0f] shadow-[0_34px_100px_rgba(0,0,0,0.58)]">
              <img src={CONCEPT_ART_PATH} alt="The Patriot Protocol full concept board" className="h-auto w-full" />
              <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 pt-20 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-white/25 bg-black/70 text-white [background-image:none] backdrop-blur hover:bg-black/90"
                >
                  <a
                    href={CONCEPT_ART_PATH}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackDownload("patriot_protocol_concept_art", CONCEPT_ART_PATH)}
                  >
                    <Expand className="mr-2 h-4 w-4" />
                    Open full size
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="creator" className="border-b border-[#929d73]/15 bg-[#070a08] scroll-mt-8">
          <div className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#c4a263]">Creator / Writer</div>
              <h2 className="mt-5 font-display text-5xl font-semibold tracking-[-0.06em] text-white sm:text-7xl">
                The creator behind the Protocol.
              </h2>
            </div>

            <article className="group mx-auto mt-12 max-w-5xl border border-[#8d9872]/20 bg-[linear-gradient(180deg,rgba(14,18,14,0.98)_0%,rgba(7,10,8,1)_100%)] p-5 transition hover:border-[#9ba776]/55 sm:p-7">
              <div className="grid gap-7 lg:grid-cols-[0.72fr_1.28fr] lg:gap-10">
                <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black/20 shadow-[0_22px_50px_rgba(0,0,0,0.38)]">
                  <img
                    src={CORY_BIO_IMAGE_PATH}
                    alt="Cory Armer profile"
                    className="h-80 w-full object-cover object-[42%_center] transition duration-500 group-hover:scale-[1.02] sm:h-[30rem]"
                  />
                </div>
                <div className="flex flex-col justify-center py-1 sm:py-4">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-[#b3955c]">Creator / Writer</div>
                  <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.055em] text-white sm:text-5xl">
                    Cory Armer
                  </h3>
                  <p className="mt-5 text-base leading-8 text-[#c6c0b5]">
                    Creator of The Patriot Protocol and founder of RSF, combining operational leadership with ambitious,
                    character-first serialized storytelling.
                  </p>
                  <div className="mt-6 space-y-4 border-t border-white/10 pt-6 text-sm leading-7 text-[#ddd7cc]">
                    {creatorBio.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="bg-[#0a0e0b]">
          <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-8 lg:px-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-4xl">
                <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#c4a263]">
                  <Eye className="h-4 w-4" />
                  Series Promise
                </div>
                <p className="mt-6 font-display text-3xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-5xl">
                  Some fight for power. They fight for the republic.
                </p>
                <p className="mt-5 max-w-3xl text-base leading-8 text-[#aaa79f]">
                  A TV-MA thriller about how democratic systems erode, what resistance costs, and whether restoring a
                  republic requires actions that can never be made clean.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:max-w-md lg:justify-end">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setScriptOpen(true)}
                  className="border-[#768356] bg-[#667449] text-white [background-image:none] hover:bg-[#78875a]"
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Read pilot excerpt
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/15 bg-transparent text-white [background-image:none] hover:bg-white/5"
                >
                  <a
                    href={SERIES_BIBLE_PATH}
                    download
                    onClick={() => trackDownload("patriot_protocol_footer_series_bible", SERIES_BIBLE_PATH)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Download series bible
                  </a>
                </Button>
              </div>
            </div>
            <div className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-6 text-[10px] uppercase tracking-[0.24em] text-[#66645f] sm:flex-row sm:items-center sm:justify-between">
              <span>The Patriot Protocol - Created by Cory Armer</span>
              <span>Confidential - Not for distribution</span>
            </div>
          </div>
        </section>
      </main>

      <PatriotScriptExcerptDialog open={scriptOpen} onOpenChange={setScriptOpen} />
    </div>
  );
}
