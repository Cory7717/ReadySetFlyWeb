import { useEffect, useState } from "react";
import {
  ArrowDown,
  BookOpen,
  CircleDot,
  Expand,
  Eye,
  Infinity,
  MapPin,
  Shell,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GraspScriptExcerptDialog } from "@/components/the-grasp/GraspScriptExcerptDialog";
import { trackEvent } from "@/lib/analytics";

const CONCEPT_ART_PATH = "/downloads/the-grasp-concept-art.png";
const CORY_BIO_IMAGE_PATH = "/downloads/cory-armer-creator-bio.png";
const THE_GRASP_DESCRIPTION =
  "Seeking freedom from a life dictated by time, Jonas and Lena relocate to the Norwegian island of Sommarøy, where clocks and schedules have been abandoned. What begins as liberation slowly reveals itself to be something far darker as they uncover the island’s true reason for drawing people there.";

const storyMovements = [
  {
    number: "I",
    title: "The Clock",
    label: "Urban compression",
    text: "Jonas and Lena live inside deadlines, alerts, overdue notices, transit delays, and a relationship reduced to logistics. Time is not passing. It is consuming them.",
  },
  {
    number: "II",
    title: "The Arrival",
    label: "Endless light",
    text: "Sommarøy appears to offer what they need: open water, quiet streets, no darkness, and a community that treats time as something optional.",
  },
  {
    number: "III",
    title: "The Belonging",
    label: "Seduction",
    text: "Lena begins to feel seen by the island. Jonas begins to notice patterns: the hum, the spirals, missing departures, and villagers who answer questions he has not asked.",
  },
  {
    number: "IV",
    title: "The Ritual",
    label: "Choice",
    text: "The island's calm reveals a structure built around memory, sacrifice, and communal permanence. The couple's attempt to reconnect becomes a fight over who gets to define rescue.",
  },
  {
    number: "V",
    title: "The Return",
    label: "The grasp closes",
    text: "Leaving becomes another movement inside the pattern. The ferry, the shoreline, and even Jonas's resistance bend toward the same patient conclusion.",
  },
];

const characters = [
  {
    name: "Jonas",
    title: "The one who came to save",
    text: "Early thirties, overworked and increasingly desperate to repair what the city has hollowed out. He reads the island's calm as a threat before he understands why.",
  },
  {
    name: "Lena",
    title: "The one who feels found",
    text: "Late twenties, exhausted by a life organized around demand. Sommarøy offers her attention, rhythm, and belonging without requiring her to perform wellness first.",
  },
  {
    name: "The Elder",
    title: "The one who remembers",
    text: "Weathered, calm, and impossible to hurry. He does not command the village so much as articulate what the island has already decided.",
  },
];

const themes = [
  ["Belonging", "When does being understood become being absorbed?"],
  ["Time", "A prison in the city. A lure on the island."],
  ["Love", "Is rescue still love when the other person refuses it?"],
  ["Choice", "The film allows choice to remain sincere even when its conditions are terrifying."],
  ["Memory", "The island remembers what its people surrender."],
  ["Identity", "Freedom and disappearance begin to resemble each other."],
];

const creatorBio = [
  "Cory Armer is the creator and writer of The Grasp, a psychological folk-horror feature set on Sommarøy, Norway. The film begins with contemporary urban exhaustion and opens outward into endless daylight, Nordic landscape, ritual, memory, and a relationship divided by two incompatible definitions of freedom.",
  "Cory brings a distinct, non-traditional path into the entertainment industry. With over 15 years of experience leading large-scale, branded hospitality operations, he has built a career grounded in execution, leadership, and performance. That operating discipline now informs a creative slate built around character, atmosphere, and commercially legible story engines.",
  "He is also the founder of Ready Set Fly (RSF), an aviation platform built to modernize how pilots plan, train, and access aircraft. The platform reflects his ability to identify gaps in traditional industries and build scalable, real-world solutions.",
  "His developing slate includes Noise & Fury, Graveside, The Patriot Protocol, and The Grasp, spanning prestige television, political action, historical horror, and psychologically driven feature storytelling.",
];

function scrollTo(sectionId: string) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - 24, behavior: "smooth" });
}

function trackAsset(label: string, target: string) {
  trackEvent("cta_click", { label, target });
}

const setMetaTag = (selector: string, attribute: "name" | "property", value: string, content: string) => {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, value);
    document.head.appendChild(tag);
  }
  const previous = tag.content;
  tag.content = content;
  return () => {
    if (previous) {
      tag.content = previous;
    } else {
      tag.remove();
    }
  };
};

function SpiralMark({ className = "" }: { className?: string }) {
  return (
    <div className={`relative aspect-square ${className}`} aria-hidden="true">
      {[100, 76, 53, 31].map((size, index) => (
        <div
          key={size}
          className="absolute left-1/2 top-1/2 rounded-full border border-current"
          style={{
            width: `${size}%`,
            height: `${size}%`,
            transform: `translate(-50%, -50%) rotate(${index * 18}deg)`,
            borderTopColor: index % 2 === 0 ? "transparent" : undefined,
            borderRightColor: index % 2 === 1 ? "transparent" : undefined,
          }}
        />
      ))}
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
    </div>
  );
}

export default function TheGraspPage() {
  const [activeMovement, setActiveMovement] = useState(0);
  const [scriptOpen, setScriptOpen] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "The Grasp | A Psychological Folk Horror Feature";
    const metaCleanups = [
      setMetaTag('meta[name="description"]', "name", "description", THE_GRASP_DESCRIPTION),
      setMetaTag('meta[property="og:title"]', "property", "og:title", "The Grasp | A Psychological Folk Horror Feature"),
      setMetaTag('meta[property="og:description"]', "property", "og:description", THE_GRASP_DESCRIPTION),
      setMetaTag('meta[property="og:image"]', "property", "og:image", CONCEPT_ART_PATH),
    ];
    trackEvent("the_grasp_page_view", { page: "/thegrasp" });

    return () => {
      document.title = previousTitle;
      metaCleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  const movement = storyMovements[activeMovement];

  return (
    <div className="min-h-screen overflow-hidden bg-[#dfe5e4] text-[#26373c] selection:bg-[#5f7880] selection:text-white">
      <section className="relative min-h-screen overflow-hidden border-b border-[#50666e]/20">
        <img
          src={CONCEPT_ART_PATH}
          alt="The Grasp concept art showing Sommarøy, Jonas, Lena, the Elder, and a spiral in the sea"
          className="absolute inset-0 h-full w-full object-cover object-[center_18%]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(222,229,228,0.97)_0%,rgba(222,229,228,0.8)_28%,rgba(218,226,225,0.16)_62%,rgba(210,219,218,0.5)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(224,231,230,0.25)_0%,rgba(224,231,230,0.04)_48%,rgba(219,226,225,0.94)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(223,229,228,0.98)_0%,rgba(223,229,228,0.94)_35%,rgba(223,229,228,0.2)_58%,transparent_72%)] sm:hidden" />

        <div className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col px-5 py-6 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between border-b border-[#3f555d]/20 pb-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#465d65]">
              A feature film by Cory Armer
            </div>
            <nav className="hidden items-center gap-7 font-serif text-[11px] uppercase tracking-[0.24em] text-[#50666e] md:flex">
              <button onClick={() => scrollTo("film")} className="transition hover:text-[#18282d]">The Film</button>
              <button onClick={() => scrollTo("island")} className="transition hover:text-[#18282d]">The Island</button>
              <button onClick={() => scrollTo("creator")} className="transition hover:text-[#18282d]">Creator</button>
            </nav>
          </header>

          <div className="flex flex-1 items-center py-16">
            <div className="max-w-3xl">
              <div className="text-[10px] font-semibold uppercase tracking-[0.38em] text-[#536d76]">
                Psychological folk horror / feature
              </div>
              <h1 className="mt-7 font-serif text-[clamp(5rem,13vw,10rem)] font-normal uppercase leading-[0.82] tracking-[0.15em] text-[#30464d]">
                The
                <br />
                Grasp
              </h1>
              <div className="mt-8 flex items-center gap-5">
                <SpiralMark className="w-16 text-[#607881]" />
                <p className="max-w-xl font-serif text-xl italic leading-8 text-[#30464d] sm:text-2xl">
                  Time isn't the prison. Belonging is.
                </p>
              </div>
              <p className="mt-7 max-w-2xl text-base leading-8 text-[#40575f] sm:text-lg">
                {THE_GRASP_DESCRIPTION}
              </p>
              <div className="mt-7 flex w-fit items-center gap-4 border border-[#536d76]/35 bg-[#e6ecea]/70 px-5 py-4 shadow-[0_18px_50px_rgba(46,65,71,0.12)] backdrop-blur">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#536d76]/30 bg-white/30 text-[#536d76]">
                  <ShieldCheck className="h-6 w-6" />
                </span>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#607881]">
                    WGA Registered
                  </div>
                  <div className="mt-1 font-mono text-base font-semibold tracking-[0.1em] text-[#30464d] sm:text-lg">
                    WGA #2316023
                  </div>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={() => setScriptOpen(true)}
                  className="border-[#536d76] bg-[#536d76] text-white [background-image:none] hover:bg-[#627e88]"
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Read screenplay excerpt
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => scrollTo("film")}
                  className="border-[#536d76]/30 bg-white/35 text-[#2b4249] [background-image:none] backdrop-blur hover:bg-white/55"
                >
                  Enter Sommarøy
                  <ArrowDown className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-[#3f555d]/20 pt-5 text-[10px] uppercase tracking-[0.22em] text-[#50666e] sm:grid-cols-3">
            <span>Sommarøy, Norway</span>
            <span className="sm:text-center">Endless daylight</span>
            <span className="sm:text-right">Love / memory / consequence</span>
          </div>
        </div>
      </section>

      <main>
        <section id="film" className="relative mx-auto max-w-[1500px] px-5 py-28 sm:px-8 lg:px-12 lg:py-40">
          <div className="absolute right-[-10rem] top-20 h-[34rem] w-[34rem] rounded-full border border-[#5f7880]/10" />
          <div className="grid gap-16 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.36em] text-[#617981]">Logline</div>
              <h2 className="mt-6 font-serif text-5xl font-normal leading-[1.02] tracking-[-0.035em] text-[#293e45] sm:text-7xl">
                They came looking for room to breathe.
              </h2>
            </div>
            <div className="space-y-8">
              <p className="font-serif text-2xl leading-10 text-[#334b53] sm:text-3xl sm:leading-[1.45]">
                Jonas believes the island is changing Lena. Lena believes it is the first place that has ever allowed her
                to become herself.
              </p>
              <p className="text-base leading-8 text-[#52676e] sm:text-lg">
                The Grasp is a psychological folk-horror thriller about burnout, intimacy, and the seductive danger of
                finding a community that seems to understand what the person who loves you cannot. Its supernatural
                language remains tactile and restrained: endless light, a low hum, circular patterns, shared rhythm,
                altered memory, and departures that never move in a straight line.
              </p>
              <div className="grid gap-px bg-[#526970]/15 sm:grid-cols-3">
                {[
                  ["The City", "Noise, heat, alerts, clocks, and accumulated demand."],
                  ["The Island", "Water, distance, ritual, and apparent release from time."],
                  ["The Choice", "A relationship tested by two incompatible forms of freedom."],
                ].map(([title, text]) => (
                  <div key={title} className="bg-[#e7eceb] p-6">
                    <h3 className="font-serif text-xl uppercase tracking-[0.12em] text-[#30474e]">{title}</h3>
                    <p className="mt-4 text-sm leading-7 text-[#60747a]">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="island" className="relative overflow-hidden border-y border-[#50666e]/15 bg-[#cad5d4] scroll-mt-8">
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_center,transparent_0%,transparent_38%,rgba(68,91,99,0.12)_38.3%,transparent_38.8%,transparent_52%,rgba(68,91,99,0.08)_52.3%,transparent_52.8%)]" />
          <div className="relative mx-auto grid max-w-[1500px] gap-14 px-5 py-28 sm:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:px-12 lg:py-40">
            <div className="flex items-center justify-center">
              <button
                type="button"
                aria-label="Advance to the next story movement"
                onClick={() => setActiveMovement((activeMovement + 1) % storyMovements.length)}
                className="group relative aspect-square w-full max-w-[430px] rounded-full text-[#536d76] transition hover:text-[#2f4c55]"
              >
                {[100, 81, 62, 43, 24].map((size, index) => (
                  <div
                    key={size}
                    className={`absolute left-1/2 top-1/2 rounded-full border transition duration-700 ${
                      index === activeMovement ? "border-[#3d5d66] bg-white/10" : "border-[#627b83]/30"
                    }`}
                    style={{ width: `${size}%`, height: `${size}%`, transform: "translate(-50%, -50%)" }}
                  />
                ))}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <div className="font-serif text-7xl text-[#3b5760]">{movement.number}</div>
                  <div className="mt-2 text-[9px] uppercase tracking-[0.28em] text-[#60777e]">Touch the pattern</div>
                </div>
              </button>
            </div>

            <div className="flex flex-col justify-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.36em] text-[#617981]">Story Movement</div>
              <div className="mt-5 text-[11px] uppercase tracking-[0.3em] text-[#71868b]">{movement.label}</div>
              <h2 className="mt-3 font-serif text-5xl font-normal tracking-[-0.035em] text-[#293e45] sm:text-7xl">{movement.title}</h2>
              <p className="mt-7 max-w-2xl font-serif text-xl leading-9 text-[#405960] sm:text-2xl">{movement.text}</p>
              <div className="mt-10 flex gap-2">
                {storyMovements.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    aria-label={`Show ${item.title}`}
                    onClick={() => setActiveMovement(index)}
                    className={`h-1 transition-all ${index === activeMovement ? "w-14 bg-[#536d76]" : "w-6 bg-[#536d76]/20"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-5 py-28 sm:px-8 lg:px-12 lg:py-40">
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.36em] text-[#617981]">The Triangle</div>
              <h2 className="mt-6 font-serif text-5xl font-normal tracking-[-0.035em] text-[#293e45] sm:text-7xl">
                Love, belonging, memory.
              </h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {characters.map((character, index) => (
                <article key={character.name} className="border-t border-[#536d76]/30 pt-5">
                  <div className="font-serif text-5xl text-[#536d76]/25">0{index + 1}</div>
                  <div className="mt-7 text-[10px] uppercase tracking-[0.25em] text-[#72868b]">{character.title}</div>
                  <h3 className="mt-3 font-serif text-3xl text-[#30474e]">{character.name}</h3>
                  <p className="mt-5 text-sm leading-7 text-[#5d7278]">{character.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#2e4147] text-[#e8edeb]">
          <div className="mx-auto grid max-w-[1500px] gap-16 px-5 py-28 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-12 lg:py-40">
            <div>
              <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.36em] text-[#b6c5c4]">
                <Infinity className="h-4 w-4" />
                Thematic Core
              </div>
              <h2 className="mt-6 font-serif text-5xl font-normal leading-tight tracking-[-0.035em] sm:text-7xl">
                The island does not take people.
              </h2>
              <p className="mt-6 font-serif text-2xl italic text-[#cbd6d4]">It gives them a reason not to leave.</p>
            </div>
            <div className="grid gap-px bg-white/15 sm:grid-cols-2">
              {themes.map(([title, text]) => (
                <div key={title} className="bg-[#31464c] p-6 sm:p-8">
                  <div className="font-serif text-2xl uppercase tracking-[0.13em] text-white">{title}</div>
                  <p className="mt-4 text-sm leading-7 text-[#bbc8c7]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1600px] px-3 py-24 sm:px-6 lg:px-10 lg:py-32">
          <div className="mx-auto mb-9 grid max-w-[1500px] gap-5 px-2 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.36em] text-[#617981]">Concept Art</div>
              <h2 className="mt-5 font-serif text-5xl font-normal tracking-[-0.035em] text-[#293e45] sm:text-7xl">
                A world without urgency.
              </h2>
            </div>
            <p className="max-w-xl font-serif text-lg leading-8 text-[#536970] lg:text-right">
              Endless daylight, exposed coastline, natural texture, and a spiral that feels less like a symbol than a law.
            </p>
          </div>
          <div className="group relative overflow-hidden border border-[#536d76]/20 bg-[#c9d3d2] shadow-[0_35px_100px_rgba(46,65,71,0.2)]">
            <img src={CONCEPT_ART_PATH} alt="The Grasp full concept board" className="h-auto w-full" />
            <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-[#25383e]/80 via-transparent to-transparent p-4 pt-20 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-white/35 bg-[#263a40]/70 text-white [background-image:none] backdrop-blur hover:bg-[#263a40]/90"
              >
                <a
                  href={CONCEPT_ART_PATH}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackAsset("the_grasp_concept_art", CONCEPT_ART_PATH)}
                >
                  <Expand className="mr-2 h-4 w-4" />
                  Open full size
                </a>
              </Button>
            </div>
          </div>
        </section>

        <section id="creator" className="border-y border-[#536d76]/15 bg-[#d2dcda] scroll-mt-8">
          <div className="mx-auto max-w-[1500px] px-5 py-28 sm:px-8 lg:px-12 lg:py-40">
            <div className="mx-auto max-w-3xl text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.36em] text-[#617981]">Creator / Writer</div>
              <h2 className="mt-6 font-serif text-5xl font-normal tracking-[-0.035em] text-[#293e45] sm:text-7xl">
                Cory Armer
              </h2>
            </div>

            <article className="mx-auto mt-12 grid max-w-5xl overflow-hidden border border-[#536d76]/20 bg-[#e3e9e7] lg:grid-cols-[0.82fr_1.18fr]">
              <div className="min-h-96">
                <img
                  src={CORY_BIO_IMAGE_PATH}
                  alt="Cory Armer profile"
                  className="h-full min-h-96 w-full object-cover object-[42%_center]"
                />
              </div>
              <div className="p-7 sm:p-10">
                <p className="font-serif text-2xl leading-9 text-[#354c53]">
                  Creator of The Grasp and founder of RSF, developing atmospheric, character-driven film and television projects across genres.
                </p>
                <div className="mt-7 space-y-5 border-t border-[#536d76]/20 pt-7 text-sm leading-7 text-[#566b71]">
                  {creatorBio.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="bg-[#e6ebe9]">
          <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-8 lg:px-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-4xl">
                <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.36em] text-[#617981]">
                  <Eye className="h-4 w-4" />
                  Final Image
                </div>
                <p className="mt-6 font-serif text-4xl leading-tight tracking-[-0.03em] text-[#2d444b] sm:text-6xl">
                  The sea is still. The ferry turns. No one is at the wheel.
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                onClick={() => setScriptOpen(true)}
                className="border-[#536d76] bg-[#536d76] text-white [background-image:none] hover:bg-[#627e88]"
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Read screenplay excerpt
              </Button>
            </div>
            <div className="mt-16 flex flex-col gap-3 border-t border-[#536d76]/20 pt-6 text-[10px] uppercase tracking-[0.24em] text-[#6b7d82] sm:flex-row sm:justify-between">
              <span>The Grasp - Written by Cory Armer</span>
              <span>Feature screenplay / Confidential</span>
            </div>
          </div>
        </section>
      </main>

      <GraspScriptExcerptDialog open={scriptOpen} onOpenChange={setScriptOpen} />
    </div>
  );
}
