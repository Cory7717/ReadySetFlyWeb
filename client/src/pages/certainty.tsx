import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, BookOpen, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CertaintyScriptExcerptDialog } from "@/components/certainty/CertaintyScriptExcerptDialog";

const ART = "/downloads/certainty-concept-art.png";
const META_DESCRIPTION = "CERTAINTY is a 10-episode TV-MA prestige survival thriller about automation, irreversible risk, misinformation and five people rebuilding life after the systems civilization trusted collapse.";

const characters = [
  { name: "Marcus Webb", role: "Founder & CTO, Webb Infrastructure Group", arc: "Expertise as control -> resilience through shared knowledge.", text: "An infrastructure expert who sees independent recovery capability disappearing before the collapse. At The Junction, he learns that resilience means documentation, cross-training and systems that can continue without him." },
  { name: "Elena Cho", role: "Architect and public face of Nexus", arc: "Certainty -> clarity without absolution.", text: "Brilliant and sincere, Elena believes automation can improve lives. Repeated success leads her to accept the removal of safeguards. After the collapse she hides as Ellen, contributes real value and confronts the risk she accepted on behalf of people who never consented." },
  { name: "Mary Stacy", role: "Owner, Mary's Diner", arc: "Serving people -> being responsible for them.", text: "A practical small-business owner with exceptional instincts about people, inventory and community. Her rebuilt diner becomes The Junction's civic heart, where caring for people sometimes means rationing, refusing requests and making painful choices." },
  { name: "Danny Faulk", role: "Electrician and tradesman", arc: "Undervalued expert -> indispensable builder -> shared knowledge.", text: "Danny understands the physical problems smart dashboards cannot. His knowledge restores wells, pumps, solar, batteries and wiring—until he recognizes that being indispensable creates another single point of failure." },
  { name: "Sydney Cole", role: "Social media influencer", arc: "Certainty without competence -> judgment earned through experience.", text: "Once rewarded for polished confidence, Sydney enters the new world without practical skills or reliable judgment. She slowly learns to observe, fail, verify and say: “I don't know yet. Here's what we do know.”" },
];

const episodes = [
  { n: "01", title: "Legacy Systems", focus: "Dual timeline / the first recovery layer disappears", plot: "Sixteen months after collapse, The Junction introduces Marcus, Mary, Danny, Ellen, Sydney and Evan Mercer. Sixteen months earlier, automation reshapes their lives as Marcus loses a major client, Elena champions controlled Nexus testing and Site 04 enters cold standby. Nothing fails. No alarm sounds. SYSTEM STATUS — NORMAL." },
  { n: "02", title: "Redundant", focus: "Marcus, Elena and Mary / water and human knowledge", plot: "The Junction's measured water allotments reveal how survival now works. The NRC offers useful regional coordination in exchange for registration. Before the collapse, successful testing accelerates Phase Three while the operators required to make backup meaningful leave. Does redundancy exist if nobody remains who knows how to use it?" },
  { n: "03", title: "Single Point of Failure", focus: "Institutional knowledge / checkpoints / remembered blame", plot: "Recovery becomes socially and operationally impossible as operators, vendors, parts and procedures disappear. Danny sees smart infrastructure diagnose problems without preserving the ability to repair them. In the present, NRC checkpoints tighten and travelers bring word of The Judgement and its handwritten ledger." },
  { n: "04", title: "Failover", focus: "Propagation / the price of integration", plot: "Localized outages, banking problems and logistics failures appear manageable in isolation. Marcus and Elena recognize that rollback now depends on people and systems that only technically exist. At The Junction, NRC integration promises security and medicine while making participation steadily less optional." },
  { n: "05", title: "Cascade", focus: "The collapse", plot: "Power instability spreads through communications, banking, fuel, water, hospitals, logistics and public order. Mary turns her diner into a refuge; Sydney's apartment becomes uninhabitable; Danny is pulled into continuous emergency work. The early NRC saves lives, and the first seeds of The Judgement form. The old world ends without a single giant explosion." },
  { n: "06", title: "Blackout", focus: "Separate roads toward Front Royal", plot: "The five survivors move through a world that no longer supports their assumptions. Elena vanishes into the displaced population, Danny becomes a local lifeline and the NRC turns temporary coordination into permanent authority. Mary reaches the future site of The Junction and begins rebuilding Mary's Diner." },
  { n: "07", title: "Island Mode", focus: "A fragile island of stability", plot: "The Junction takes form around food, water, shelter and limited power. Marcus learns that resilient systems must be simple, physical, documented and shared. Sydney begins the humiliating work of becoming competent; Evan builds a communal record collection. The NRC's offer of medicine, trade and security divides the settlement." },
  { n: "08", title: "Integration", focus: "The timelines converge", plot: "The Junction is austere, functioning and surprisingly warm. Elena arrives as Ellen; Marcus recognizes her and says nothing. The NRC crosses from assistance into compulsory integration, while Mary rejects the idea that cooperation requires submission. Surviving material exposes Ellen, and word moves toward The Judgement." },
  { n: "09", title: "Due Process", focus: "True accusation / illegitimate process", plot: "The Judgement identifies Elena and demands her surrender. Marcus admits he knew who she was and argues that guilt does not justify execution. Elena refuses a chance to run because others would again absorb the consequences. The accusation is substantially true; the tribunal is not legitimate. She reaches clarity, not absolution, and does not survive the verdict." },
  { n: "10", title: "Root Cause", focus: "A closed story / an open world", plot: "The Junction resists the NRC without surrendering cooperation. Shared knowledge, earned judgment, consent and difficult leadership keep the community alive. A limited equilibrium replaces restoration. A distant transmission opens the wider CERTAINTY world, and the depleted aquifer shows its first small return of water." },
];

const thesis = ["Being wrong is not the tragedy. Making being wrong irreversible is.", "A safeguard often looks unnecessary precisely because it has worked.", "Systems fail socially before they fail technically.", "Efficiency and resilience are not the same thing.", "Information systems reward certainty faster than understanding.", "A society can rebuild order without rebuilding legitimacy."];

function setMeta(selector: string, attribute: "name" | "property", value: string, content: string) {
  let node = document.head.querySelector<HTMLMetaElement>(selector);
  const created = !node;
  if (!node) { node = document.createElement("meta"); node.setAttribute(attribute, value); document.head.appendChild(node); }
  const previous = node.content;
  node.content = content;
  return () => created ? node?.remove() : node && (node.content = previous);
}

export default function CertaintyPage() {
  const [excerptOpen, setExcerptOpen] = useState(false);
  const [episodeOpen, setEpisodeOpen] = useState<number | null>(0);

  useEffect(() => {
    const oldTitle = document.title;
    document.title = "CERTAINTY | A Limited Series by Cory Armer";
    const metaCleanups = [
      setMeta('meta[name="description"]', "name", "description", META_DESCRIPTION),
      setMeta('meta[property="og:title"]', "property", "og:title", document.title),
      setMeta('meta[property="og:description"]', "property", "og:description", META_DESCRIPTION),
      setMeta('meta[property="og:image"]', "property", "og:image", ART),
    ];
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const createdCanonical = !canonical;
    const oldCanonical = canonical?.href;
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = "https://readysetfly.us/certainty";
    return () => {
      document.title = oldTitle;
      metaCleanups.forEach((clean) => clean());
      if (createdCanonical) canonical?.remove(); else if (canonical && oldCanonical) canonical.href = oldCanonical;
    };
  }, []);

  const openExcerpt = () => {
    setExcerptOpen(true);
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#090d10] text-[#e8e1d4] selection:bg-[#b57931] selection:text-white">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 sm:px-10 lg:px-16">
        <a href="/coryarmer" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#e8e1d4]/80 transition hover:text-[#d5a45f]"><ArrowLeft className="h-4 w-4" />Cory Armer</a>
        <button onClick={openExcerpt} className="border border-[#d5a45f]/45 bg-[#090d10]/70 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#e8e1d4] backdrop-blur transition hover:border-[#d5a45f] hover:bg-[#d5a45f]/10">Read the pilot</button>
      </header>

      <section className="relative isolate min-h-screen border-b border-[#c78a43]/20 lg:grid lg:grid-cols-[minmax(0,0.82fr)_minmax(420px,0.7fr)]">
        <div className="order-2 flex items-end px-6 pb-14 pt-28 sm:px-12 lg:order-1 lg:px-16 lg:pb-20 xl:px-24">
          <div className="max-w-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700">
            <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d5a45f]">10-Episode Limited Series · TV-MA · Prestige Thriller</p>
            <h1 className="font-serif text-6xl font-normal tracking-[0.06em] text-[#f0eadf] sm:text-7xl xl:text-8xl">CERTAINTY</h1>
            <p className="mt-7 max-w-xl font-serif text-2xl leading-snug text-[#e0d3c0] sm:text-3xl">Nobody attacked us. We were certain we knew better.</p>
            <p className="mt-7 max-w-md text-base leading-7 text-[#aeb7b7]">People built a safer world.<br />Then they took the safeguards away.</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button onClick={openExcerpt} className="rounded-none bg-[#aa6c27] px-6 text-white [background-image:none] hover:bg-[#c18137]"><BookOpen className="mr-2 h-4 w-4" />Read a five-page excerpt</Button>
              <button onClick={() => document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-2 border border-white/20 px-5 py-2 text-xs uppercase tracking-[0.17em] text-[#d7d9d6] hover:border-[#d5a45f]/70">Enter the world <ArrowDown className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
        <figure className="order-1 flex min-h-[62vh] items-center justify-center bg-[#11191e] px-4 pb-2 pt-20 lg:order-2 lg:min-h-screen lg:px-0 lg:pb-0 lg:pt-0">
          <img src={ART} alt="CERTAINTY concept art showing the five central survivors, The Junction, and the ruined infrastructure of Northern Virginia" className="h-auto max-h-[calc(100vh-2rem)] w-auto max-w-full object-contain object-center shadow-[0_20px_100px_rgba(0,0,0,0.65)]" fetchPriority="high" />
        </figure>
      </section>

      <section id="overview" className="mx-auto max-w-6xl px-6 py-24 sm:px-10 lg:py-32">
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#c18a48]">Series Overview</p>
        <div className="mt-8 grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <h2 className="font-serif text-4xl leading-tight text-[#f1eadf] sm:text-5xl">Confidence was mistaken for permission.</h2>
          <div className="space-y-6 text-base leading-8 text-[#b7bebd]">
            <p>CERTAINTY is a grounded, character-driven prestige survival thriller set in a near future where autonomous infrastructure makes power, logistics, communications, banking and utilities faster, cheaper and more reliable.</p>
            <p>Because it works, manual control rooms shrink. Operators leave. Physical redundancies disappear. Institutional knowledge is consolidated or forgotten. Then something happens that the system was never designed to understand.</p>
            <p className="border-l-2 border-[#b97831] pl-5 font-serif text-2xl leading-relaxed text-[#e5d8c5]">The catastrophe is not an attack. The AI does not become conscious. There is no evil machine. The technology does what human institutions authorized it to do.</p>
            <p>Sixteen months after the cascade fractures modern infrastructure, five people shaped by the old world try to build something smaller, harsher and perhaps more human from what remains.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-white/8 bg-[#11181c] px-6 py-24 sm:px-10 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#c18a48]">Core Thesis</p>
          <h2 className="mt-7 max-w-4xl font-serif text-4xl leading-tight text-[#f0e9dd] sm:text-6xl">Being wrong is not the tragedy.<br /><span className="text-[#c28a46]">Making being wrong irreversible is.</span></h2>
          <p className="mt-8 max-w-3xl text-lg leading-8 text-[#acb5b5]">CERTAINTY is not ultimately a warning that AI is evil. It asks what happens when safeguards, dissent, redundancy, verification and consent begin to look inefficient.</p>
          <div className="mt-14 grid border-t border-[#c18a48]/25 sm:grid-cols-2 lg:grid-cols-3">
            {thesis.map((idea) => <p key={idea} className="border-b border-[#c18a48]/20 px-0 py-6 pr-7 font-serif text-xl leading-7 text-[#ddd4c6] sm:border-r sm:px-6 sm:first:pl-0">{idea}</p>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24 sm:px-10 lg:py-32">
        <div className="max-w-3xl"><p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#c18a48]">The Five</p><h2 className="mt-6 font-serif text-4xl sm:text-5xl">Lives shaped by the world that failed.</h2></div>
        <div className="mt-14 divide-y divide-[#c18a48]/20 border-y border-[#c18a48]/20">
          {characters.map((character, index) => (
            <article key={character.name} className="grid gap-5 py-10 md:grid-cols-[60px_0.7fr_1.3fr] md:gap-8">
              <span className="font-mono text-sm text-[#927252]">0{index + 1}</span>
              <div><h3 className="font-serif text-3xl text-[#f1eadd]">{character.name}</h3><p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#c18a48]">{character.role}</p></div>
              <div><p className="leading-7 text-[#afb7b6]">{character.text}</p><p className="mt-4 font-serif italic text-[#d5c5af]">{character.arc}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#c18a48]/20 bg-[#0e1418] px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#c18a48]">Story Structure</p>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div><span className="font-mono text-xs text-[#927252]">01—04</span><h3 className="mt-3 font-serif text-2xl">Controlled dual timeline</h3><p className="mt-3 text-sm leading-6 text-[#aab3b2]">The failed future turns ordinary, successful decisions in the old world ominous.</p></div>
            <div><span className="font-mono text-xs text-[#927252]">05</span><h3 className="mt-3 font-serif text-2xl">Cascade</h3><p className="mt-3 text-sm leading-6 text-[#aab3b2]">The systems lose their ability to recover from one another, and the old world ends.</p></div>
            <div><span className="font-mono text-xs text-[#927252]">06—08</span><h3 className="mt-3 font-serif text-2xl">Toward The Junction</h3><p className="mt-3 text-sm leading-6 text-[#aab3b2]">Separate survival stories converge near Front Royal in the Shenandoah Valley.</p></div>
            <div><span className="font-mono text-xs text-[#927252]">09—10</span><h3 className="mt-3 font-serif text-2xl">Reckoning</h3><p className="mt-3 text-sm leading-6 text-[#aab3b2]">The Judgement, the NRC and the five character arcs reach a definitive ending.</p></div>
          </div>
        </div>
      </section>

      <section className="bg-[#dcd4c5] px-6 py-24 text-[#182126] sm:px-10 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#8b581f]">The World · The Junction</p>
          <div className="mt-8 grid gap-12 lg:grid-cols-2">
            <div><h2 className="font-serif text-4xl leading-tight sm:text-5xl">The new world is harder to live in, but sometimes easier to understand.</h2><p className="mt-7 leading-8 text-[#3f494c]">Near Front Royal, Virginia, roughly 275 people have made a settlement one to two miles from a highway turned regional trade route. Infrastructure is visible now. People know where water comes from, which battery keeps the clinic refrigerator cold, who can repair the pump and who gets power first.</p></div>
            <div className="grid grid-cols-2 gap-x-7 gap-y-5 border-t border-[#182126]/25 pt-6 text-sm leading-6"><span>Mary's Diner</span><span>Guarded water storage</span><span>Wells & rain collection</span><span>Solar & battery storage</span><span>Clinic & housing</span><span>Trade checkpoint</span><span>Workshops & salvage</span><span>Noise & Fury</span></div>
          </div>
          <div className="mt-16 grid gap-px bg-[#182126]/20 md:grid-cols-2">
            <div className="bg-[#dcd4c5] p-8 md:p-10"><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8b581f]">What returned</p><p className="mt-5 font-serif text-2xl leading-9">Shared meals. Music. Records. Dancing. Conversation. Practical work. Visible purpose. Genuine community.</p></div>
            <div className="bg-[#dcd4c5] p-8 md:p-10"><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8b581f]">What remains</p><p className="mt-5 font-serif text-2xl leading-9">Disease. Scarcity. Violence. Black markets. Coercion. Armed security. One failed pump or contaminated water source away from disaster.</p></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24 sm:px-10 lg:py-32">
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#c18a48]">Principal Antagonist Systems</p>
        <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <article className="border-t-2 border-[#a4682a] pt-7"><h2 className="font-serif text-3xl">The National Recovery Council</h2><p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#c18a48]">Coordination becomes authority</p><p className="mt-6 leading-8 text-[#adb6b5]">The NRC begins with people who save lives by coordinating scarce resources. Over time it claims control over water, power, food, medicine, labor, movement, trade and security. Independent communities become dangerous inefficiency, and consent becomes optional.</p></article>
          <article className="border-t-2 border-[#a4682a] pt-7"><h2 className="font-serif text-3xl">The Judgement</h2><p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#c18a48]">Procedure without legitimacy</p><p className="mt-6 leading-8 text-[#adb6b5]">Former legal professionals preserve the language and theater of due process while stripping away its safeguards. A Magistrate presides; accusations, testimony and verdicts enter a handwritten ledger. Its case against Elena is substantially true. Its process is not legitimate.</p></article>
        </div>
      </section>

      <section className="border-y border-white/8 bg-[#10171b] px-6 py-24 sm:px-10 lg:py-32">
        <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-2">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#c18a48]">Tone</p><h2 className="mt-6 font-serif text-4xl sm:text-5xl">Dark, adult and human.</h2><p className="mt-7 leading-8 text-[#adb6b5]">TV-MA is a dramatic register, not a quota. Violence is intimate and consequential. Sexuality and vice exist because adults remain adults after civilization collapses. Warmth, humor, music and community can live beside disease, scarcity, coercion and death without erasing them.</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#c18a48]">The Second Failure</p><h2 className="mt-6 font-serif text-4xl sm:text-5xl">Information.</h2><p className="mt-7 leading-8 text-[#adb6b5]">Before the collapse, algorithms reward confidence, speed, outrage, repetition and virality. After the networks fall, misinformation becomes local: rumor, memory, fear and confident people repeating what they cannot verify.</p><blockquote className="mt-7 border-l-2 border-[#c18a48] pl-5 font-serif text-2xl italic text-[#dfd2bf]">“I don't know yet” can be more useful than a confident wrong answer.</blockquote></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24 sm:px-10 lg:py-32">
        <div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr]">
          <div className="lg:sticky lg:top-10 lg:self-start"><p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#c18a48]">Episode Guide</p><h2 className="mt-6 font-serif text-5xl">Ten episodes.<br />One ending.</h2><p className="mt-6 max-w-sm leading-7 text-[#aab3b2]">Episodes 1–4 use a controlled dual timeline. Episode 5 is the cascade. Episodes 6–10 move toward The Junction, reckoning and a definitive close.</p></div>
          <div className="divide-y divide-[#c18a48]/25 border-y border-[#c18a48]/25">
            {episodes.map((episode, index) => {
              const open = episodeOpen === index;
              return <article key={episode.n}>
                <button type="button" aria-expanded={open} onClick={() => setEpisodeOpen(open ? null : index)} className="grid w-full grid-cols-[42px_1fr_auto] items-center gap-4 py-6 text-left sm:grid-cols-[56px_1fr_auto]">
                  <span className="font-mono text-sm text-[#8f7456]">{episode.n}</span><span><strong className="block font-serif text-2xl font-normal text-[#eee6d9]">{episode.title}</strong><span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-[#b77c39]">{episode.focus}</span></span><ChevronDown className={`h-5 w-5 text-[#c18a48] transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && <div className="pb-8 pl-[58px] text-sm leading-7 text-[#abb4b3] sm:pl-[72px]">{episode.plot}</div>}
              </article>;
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
        <div className="grid items-center gap-10 border-y border-[#c18a48]/25 py-10 sm:grid-cols-[180px_1fr] lg:gap-16">
          <img src="/downloads/cory-armer-creator-bio.png" alt="Cory Armer" loading="lazy" className="aspect-[4/5] w-36 object-cover grayscale sm:w-full" />
          <div><p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#c18a48]">Creator</p><h2 className="mt-4 font-serif text-4xl">Cory Armer</h2><p className="mt-5 max-w-3xl leading-7 text-[#adb6b5]">Cory Armer is a writer and creator developing original television and feature projects across prestige drama, psychological thriller, mystery, horror and political suspense. CERTAINTY continues that slate's focus on character, consequence and people confronting systems larger than themselves.</p><a href="/coryarmer" className="mt-7 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#d3a15e] hover:text-[#f0c887]"><ArrowLeft className="h-4 w-4" />View the full portfolio</a></div>
        </div>
      </section>

      <section className="border-t border-[#c18a48]/20 bg-[#151b1e] px-6 py-24 text-center sm:px-10 lg:py-32">
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#c18a48]">Closed Story · Open World</p>
        <h2 className="mx-auto mt-7 max-w-4xl font-serif text-4xl leading-tight sm:text-6xl">Some systems can't be rebuilt.<br />But people can.</h2>
        <p className="mx-auto mt-8 max-w-2xl leading-8 text-[#adb5b4]">The five-character story ends completely. The wider world remains available for unrelated standalone stories in other regions—not as a conventional Season 2 cliffhanger, but as proof that one settlement's survival is not the whole story.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3"><Button onClick={openExcerpt} className="rounded-none bg-[#aa6c27] text-white [background-image:none] hover:bg-[#c18137]"><BookOpen className="mr-2 h-4 w-4" />Read Episode One excerpt</Button><a href="/coryarmer" className="inline-flex items-center border border-white/20 px-5 py-2 text-xs uppercase tracking-[0.17em] hover:border-[#c18a48]"><ArrowLeft className="mr-2 h-4 w-4" />Back to Cory Armer</a></div>
      </section>

      <footer className="flex flex-col gap-2 border-t border-white/10 px-6 py-8 text-[10px] uppercase tracking-[0.2em] text-[#7f8989] sm:flex-row sm:items-center sm:justify-between sm:px-10"><span>CERTAINTY · Created by Cory Armer</span><span>10-Episode Limited Series · TV-MA</span></footer>
      <CertaintyScriptExcerptDialog open={excerptOpen} onOpenChange={setExcerptOpen} />
    </main>
  );
}
