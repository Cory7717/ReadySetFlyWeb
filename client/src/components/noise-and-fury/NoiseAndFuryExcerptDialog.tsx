import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trackEvent } from "@/lib/analytics";

export type NoiseAndFuryExcerptId = "the-audition" | "rooster";

type ScriptBlock =
  | { type: "scene"; text: string }
  | { type: "heading"; text: string }
  | { type: "action"; text: string }
  | { type: "character"; text: string }
  | { type: "parenthetical"; text: string }
  | { type: "dialogue"; text: string }
  | { type: "transition"; text: string };

type Excerpt = {
  id: NoiseAndFuryExcerptId;
  title: string;
  episode: string;
  scenes: string;
  pages: ScriptBlock[][];
};

// Transcribed from the visible V7.3 print excerpt pages; original page breaks preserved.
export const noiseAndFuryExcerpts: Record<NoiseAndFuryExcerptId, Excerpt> = {
  "the-audition": {
    "id": "the-audition",
    "title": "The Audition",
    "episode": "Episode 1: We Die Young",
    "scenes": "Scenes 22–23",
    "pages": [
      [
        { type: "scene", text: "SCENE 22" },
        { type: "heading", text: "INT. THE MUSIC BANK — REHEARSAL ROOM — NIGHT" },
        { type: "action", text: "The door opens and a MAN in his late 20s steps inside, shirtless, oiled and carrying himself like the room is already his." },
        { type: "action", text: "He looks at the microphone, then at the band." },
        { type: "character", text: "STRIPPER" },
        { type: "dialogue", text: "Heard you're looking for a frontman." },
        { type: "action", text: "Sean presses his lips together to keep from laughing. Mike looks toward the ceiling." },
        { type: "action", text: "Jerry gives nothing away." },
        { type: "action", text: "The Stripper steps to the microphone, grips it with both hands and begins to sing. His voice is not terrible, but within seconds his shoulders start rolling with the melody as he works the room with practiced confidence." },
        { type: "action", text: "On the busted couch, Layne watches with his arms crossed." },
        { type: "action", text: "The Stripper leans into another note and rolls his shoulders again." },
        { type: "character", text: "LAYNE" },
        { type: "dialogue", text: "Enough." },
        { type: "action", text: "The Stripper stops." },
        { type: "action", text: "Layne looks at him." }
      ],
      [
        { type: "character", text: "LAYNE (CONT'D)" },
        { type: "dialogue", text: "That's enough." },
        { type: "action", text: "The Stripper glances around the room, shrugs and reaches for his jacket." },
        { type: "character", text: "STRIPPER" },
        { type: "dialogue", text: "Your loss." },
        { type: "action", text: "He leaves." },
        { type: "action", text: "Layne gets to his feet and turns toward Jerry." },
        { type: "character", text: "LAYNE" },
        { type: "dialogue", text: "If that's what you're auditioning..." },
        { type: "character", text: "JERRY" },
        { type: "dialogue", text: "We weren't auditioning anybody." },
        { type: "character", text: "LAYNE" },
        { type: "dialogue", text: "Then what was this?" },
        { type: "action", text: "Jerry steps closer." },
        { type: "character", text: "JERRY" },
        { type: "dialogue", text: "Waiting for you to say it." },
        { type: "action", text: "Layne studies him for a moment." },
        { type: "action", text: "Then he exhales, sits back down and finally pulls off his jacket." },
        { type: "character", text: "LAYNE" },
        { type: "dialogue", text: "Alright." },
        { type: "action", text: "He looks around at Sean and Mike before returning to Jerry." },
        { type: "character", text: "LAYNE (CONT'D)" },
        { type: "dialogue", text: "I'm in." },
        { type: "action", text: "Sean's grin breaks through immediately. Mike leans back against his amp and exhales." },
        { type: "action", text: "Jerry gives Layne a small nod." },
        { type: "transition", text: "CUT TO:" },
        { type: "scene", text: "SCENE 23" }
      ],
      [
        { type: "heading", text: "INT. THE MUSIC BANK — REHEARSAL ROOM — LATER THAT NIGHT" },
        { type: "action", text: "The amps are cooling and the air is still hazy with smoke. Jerry, Layne, Sean and Mike sit in a loose circle on the floor with beers in hand, exhausted enough that everything is funny." },
        { type: "character", text: "SEAN" },
        { type: "dialogue", text: "Okay, if we're actually doing this... we need a name." },
        { type: "character", text: "MIKE" },
        { type: "dialogue", text: "A real one. Not what we've been calling ourselves for two weeks." },
        { type: "character", text: "SEAN" },
        { type: "dialogue", text: "That was a statement." },
        { type: "character", text: "MIKE" },
        { type: "dialogue", text: "It was one word. You can't put it on a flyer. Club owners kept hanging up on us." },
        { type: "action", text: "Jerry starts tossing out ideas." },
        { type: "character", text: "JERRY" },
        { type: "dialogue", text: "Rust Pit. Bone Orchard." },
        { type: "action", text: "Sean laughs and shakes his head." },
        { type: "character", text: "SEAN" },
        { type: "dialogue", text: "Sounds like a bad metal cover band." },
        { type: "character", text: "JERRY" },
        { type: "dialogue", text: "We're still technically Diamond Lie." },
        { type: "character", text: "SEAN" },
        { type: "dialogue", text: "We are not going back to Diamond Lie." },
        { type: "action", text: "Layne sits cross-legged with his beer between his hands, listening as the others settle down." },
        { type: "character", text: "LAYNE" },
        { type: "dialogue", text: "What about Alice in Chains?" },
        { type: "action", text: "The room quiets." },
        { type: "character", text: "MIKE" },
        { type: "dialogue", text: "Isn't that your old band?" }
      ],
      [
        { type: "character", text: "LAYNE" },
        { type: "dialogue", text: "Alice N' Chains. Different band, different me." },
        { type: "action", text: "A small smile crosses his face." },
        { type: "character", text: "LAYNE (CONT'D)" },
        { type: "dialogue", text: "This one's spelled better. And I already asked the guys. They said take it." },
        { type: "character", text: "SEAN" },
        { type: "dialogue", text: "Dark." },
        { type: "action", text: "Jerry leans back and considers it." },
        { type: "character", text: "JERRY" },
        { type: "dialogue", text: "Yeah. It's got teeth." },
        { type: "character", text: "MIKE" },
        { type: "dialogue", text: "It sounds... dangerous." },
        { type: "character", text: "LAYNE" },
        { type: "dialogue", text: "Exactly." },
        { type: "action", text: "Jerry looks around the circle." },
        { type: "action", text: "Nobody offers another name." },
        { type: "action", text: "He raises his beer." },
        { type: "character", text: "JERRY" },
        { type: "dialogue", text: "To Alice in Chains." },
        { type: "action", text: "The others raise theirs." },
        { type: "action", text: "The bottles CLINK together." },
        { type: "transition", text: "CUT TO:" }
      ]
    ]
  },
  "rooster": {
    "id": "rooster",
    "title": "Rooster",
    "episode": "Episode 3: Rooster",
    "scenes": "Scenes 6–8",
    "pages": [
      [
        { type: "scene", text: "SCENE 6" },
        { type: "heading", text: "INT. THE MUSIC BANK — REHEARSAL ROOM — NIGHT" },
        { type: "action", text: "Christmas lights hang above duct-taped amps and cold concrete walls. SEAN sits behind the kit while MIKE tunes his bass. LAYNE leans against the far wall with a cigarette between his fingers." },
        { type: "action", text: "The door opens and JERRY comes in carrying his guitar case." },
        { type: "action", text: "Sean stops tapping his sticks." },
        { type: "character", text: "MIKE" },
        { type: "dialogue", text: "Great. Everybody's here." },
        { type: "action", text: "Jerry sets down the case, straps on the guitar and plays the \"Rooster\" riff." },
        { type: "action", text: "The room changes." },
        { type: "action", text: "Mike stops tuning. Layne looks up. Sean listens through the phrase, then waits for Jerry to play it again." },
        { type: "character", text: "SEAN" },
        { type: "dialogue", text: "Where'd that come from?" },
        { type: "character", text: "JERRY" },
        { type: "dialogue", text: "My dad." },
        { type: "character", text: "MIKE" },
        { type: "dialogue", text: "Vietnam?" },
        { type: "action", text: "Jerry nods." },
        { type: "character", text: "JERRY" },
        { type: "dialogue", text: "Yeah." },
        { type: "action", text: "He plays the riff again." },
        { type: "action", text: "Mike finds the root underneath it. Sean comes in carefully behind him, building a slow, heavy pocket around Jerry's guitar." },
        { type: "action", text: "Layne crosses to the microphone and listens for an opening." }
      ],
      [
        { type: "action", text: "When it comes, he answers the riff with a rough, wordless vocal." },
        { type: "action", text: "Jerry looks up." },
        { type: "action", text: "The four of them stay with it until the sound finally winds down." },
        { type: "character", text: "LAYNE" },
        { type: "dialogue", text: "What's it called?" },
        { type: "character", text: "JERRY" },
        { type: "dialogue", text: "\"Rooster.\"" },
        { type: "action", text: "Layne nods." },
        { type: "action", text: "Sean points a drumstick at Jerry." },
        { type: "character", text: "SEAN" },
        { type: "dialogue", text: "You still owe me forty bucks." },
        { type: "character", text: "JERRY" },
        { type: "dialogue", text: "I know." },
        { type: "character", text: "SEAN" },
        { type: "dialogue", text: "Just so we're clear." },
        { type: "action", text: "Mike laughs." },
        { type: "action", text: "Sean raises his sticks." },
        { type: "character", text: "SEAN (CONT'D)" },
        { type: "dialogue", text: "Again." },
        { type: "action", text: "He counts them in." },
        { type: "transition", text: "CUT TO:" },
        { type: "scene", text: "SCENE 7" },
        { type: "heading", text: "EXT. SEATTLE SIDEWALK — NIGHT" },
        { type: "action", text: "Cold air hangs over the wet pavement. JERRY and LAYNE walk side by side after rehearsal, their breath visible under the streetlights." },
        { type: "action", text: "For a while, neither says anything." },
        { type: "character", text: "LAYNE" },
        { type: "dialogue", text: "He's still in it, huh." },
        { type: "action", text: "Jerry knows who he means." }
      ],
      [
        { type: "character", text: "JERRY" },
        { type: "dialogue", text: "Yeah." },
        { type: "action", text: "A car passes, headlights moving across them." },
        { type: "character", text: "LAYNE" },
        { type: "dialogue", text: "You were a kid." },
        { type: "character", text: "JERRY" },
        { type: "dialogue", text: "One of my first memories is him coming home. I was three. My mom had to tell me he was my dad." },
        { type: "action", text: "Layne looks down at the sidewalk." },
        { type: "character", text: "JERRY (CONT'D)" },
        { type: "dialogue", text: "He came back, but part of him was still over there." },
        { type: "action", text: "Layne kicks at a pebble." },
        { type: "character", text: "LAYNE" },
        { type: "dialogue", text: "At least yours came home." },
        { type: "action", text: "Jerry looks over, but Layne keeps his eyes ahead." },
        { type: "action", text: "Jerry lets it go." },
        { type: "action", text: "They walk another few steps." },
        { type: "character", text: "JERRY" },
        { type: "dialogue", text: "You think the song's too much?" },
        { type: "character", text: "LAYNE" },
        { type: "dialogue", text: "Did he?" },
        { type: "character", text: "JERRY" },
        { type: "dialogue", text: "He said I got too close." },
        { type: "action", text: "Layne considers that." },
        { type: "character", text: "LAYNE" },
        { type: "dialogue", text: "Then you got it right." },
        { type: "action", text: "Jerry takes that in as they continue down the block." },
        { type: "transition", text: "CUT TO:" },
        { type: "scene", text: "SCENE 8" },
        { type: "heading", text: "INT. CLUB — NIGHT" },
        { type: "heading", text: "SUPER: OPENING FOR IGGY POP." }
      ],
      [
        { type: "action", text: "The room is packed and loud, most of the crowd waiting for the headliner." },
        { type: "action", text: "Alice in Chains drops into \"Rooster.\"" },
        { type: "action", text: "At the back of the room, near the soundboard, JERRY SR. stands in his gray Stetson and cowboy boots." },
        { type: "action", text: "Jerry spots him from the stage." },
        { type: "action", text: "LAYNE grips the microphone and sings." },
        { type: "character", text: "LAYNE" },
        { type: "parenthetical", text: "(singing)" },
        { type: "dialogue", text: "[ROOSTER — FIRST VERSE]" },
        { type: "action", text: "Jerry keeps glancing toward the back of the room as the song builds." },
        { type: "action", text: "Jerry Sr. stands motionless at first. Then his arms come loose at his sides." },
        { type: "action", text: "By the time the band reaches the chorus, tears are running down his face." },
        { type: "action", text: "Jerry sees it." },
        { type: "action", text: "The final chord rings through the room." },
        { type: "action", text: "Jerry Sr. removes the Stetson and raises it over his head." },
        { type: "action", text: "He holds it there." },
        { type: "action", text: "Jerry stands onstage with his guitar hanging from his shoulder, looking back at his father through the crowd." },
        { type: "action", text: "Layne follows Jerry's gaze and sees him too." },
        { type: "action", text: "Jerry Sr. keeps the hat raised." },
        { type: "transition", text: "END OF ACT ONE" }
      ]
    ]
  }
};

function ScriptPage({ blocks, pageNumber }: { blocks: ScriptBlock[]; pageNumber: number }) {
  return (
    <article className="relative mx-auto min-h-[760px] w-full max-w-[650px] bg-[#f3eee5] px-5 py-10 text-[#111] shadow-[0_28px_90px_rgba(0,0,0,0.55)] sm:min-h-[820px] sm:px-14 sm:py-12">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
        <span className="-rotate-[24deg] select-none whitespace-nowrap font-display text-5xl font-semibold uppercase tracking-[0.18em] text-[#8d6631]/[0.045] sm:text-7xl">
          Noise &amp; Fury
        </span>
      </div>
      <div className="relative font-mono text-[13px] leading-[1.65] sm:text-[14px]">
        {blocks.map((block, index) => {
          if (block.type === "scene") return <p key={index} className="mb-5 text-center font-bold uppercase">{block.text}</p>;
          if (block.type === "heading") return <p key={index} className="mb-4 mt-5 font-bold uppercase">{block.text}</p>;
          if (block.type === "character") return <p key={index} className="mb-0 mt-4 pl-[35%] uppercase">{block.text}</p>;
          if (block.type === "parenthetical") return <p key={index} className="mb-0 ml-[30%] max-w-[42%]">{block.text}</p>;
          if (block.type === "dialogue") return <p key={index} className="mb-3 ml-[15%] max-w-[75%] sm:ml-[20%] sm:max-w-[60%]">{block.text}</p>;
          if (block.type === "transition") return <p key={index} className="my-4 text-right font-bold uppercase">{block.text}</p>;
          return <p key={index} className="mb-4">{block.text}</p>;
        })}
      </div>
      <div className="absolute bottom-5 right-7 font-mono text-[11px] text-black/60 sm:right-10">{pageNumber}.</div>
    </article>
  );
}

export function NoiseAndFuryExcerptDialog({
  open,
  excerptId,
  onExcerptChange,
  onOpenChange,
}: {
  open: boolean;
  excerptId: NoiseAndFuryExcerptId;
  onExcerptChange: (excerptId: NoiseAndFuryExcerptId) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const excerpt = noiseAndFuryExcerpts[excerptId];

  useEffect(() => {
    if (!open) return;
    setPageIndex(0);
    scrollAreaRef.current?.scrollTo({ top: 0 });
    trackEvent("noise_fury_script_excerpt_open", {
      page: "/noiseandfury",
      excerpt: excerptId,
      excerpt_pages: excerpt.pages.length,
    });
  }, [excerpt.pages.length, excerptId, open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" && pageIndex > 0) {
        event.preventDefault();
        goToPage(pageIndex - 1);
      }
      if (event.key === "ArrowRight" && pageIndex < excerpt.pages.length - 1) {
        event.preventDefault();
        goToPage(pageIndex + 1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [excerpt.pages.length, open, pageIndex]);

  function goToPage(nextIndex: number) {
    setPageIndex(nextIndex);
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    trackEvent("noise_fury_script_excerpt_page", {
      page: "/noiseandfury",
      excerpt: excerptId,
      excerpt_page: nextIndex + 1,
    });
  }

  function switchExcerpt(nextExcerptId: NoiseAndFuryExcerptId) {
    if (nextExcerptId === excerptId) return;
    setPageIndex(0);
    scrollAreaRef.current?.scrollTo({ top: 0 });
    onExcerptChange(nextExcerptId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="nf-reader flex h-[94dvh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden border-[#9d7540]/35 bg-[#0b0a0a] p-0 text-[#f2ebe4] shadow-[0_35px_140px_rgba(0,0,0,0.85)] sm:rounded-none">
        <DialogHeader className="shrink-0 border-b border-[#c59a5e]/20 bg-[#0b0a0a] py-4 pl-5 pr-20 text-left sm:pl-7 sm:pr-20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d3a869]">
                <BookOpen className="h-4 w-4" />
                Dramatized screenplay excerpt
              </div>
              <DialogTitle className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em] text-white">
                {excerpt.title}
              </DialogTitle>
              <div className="mt-1 text-xs text-[#b8aa9c]">{excerpt.episode} · {excerpt.scenes}</div>
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#9b9186]">
              <ShieldAlert className="h-3.5 w-3.5" />
              Complete selected excerpt
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Choose screenplay excerpt">
            {(Object.keys(noiseAndFuryExcerpts) as NoiseAndFuryExcerptId[]).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={id === excerptId}
                onClick={() => switchExcerpt(id)}
                className={`border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
                  id === excerptId
                    ? "border-[#d3a869] bg-[#d3a869] text-[#141414]"
                    : "border-white/15 bg-white/[0.03] text-[#d8ccc0] hover:border-[#d3a869]/55 hover:text-white"
                }`}
              >
                {noiseAndFuryExcerpts[id].title}
              </button>
            ))}
          </div>
          <DialogDescription className="sr-only">
            A complete selected excerpt from Noise &amp; Fury. {excerpt.episode}, {excerpt.scenes}.
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollAreaRef} className="min-h-0 flex-1 overflow-y-auto bg-[#211d19] px-3 py-6 sm:px-8 sm:py-8">
          <ScriptPage blocks={excerpt.pages[Math.min(pageIndex, excerpt.pages.length - 1)]} pageNumber={pageIndex + 1} />
        </div>

        <div className="shrink-0 border-t border-[#c59a5e]/20 bg-[#0b0a0a]">
          <p className="border-b border-white/10 px-4 py-2 text-center text-[10px] leading-4 text-[#9b9186] sm:px-7">
            Dramatized scenes inspired by historical events. Dialogue and private interactions have been fictionalized. Not presented as a verbatim historical record.
          </p>
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-7">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Previous script page"
              disabled={pageIndex === 0}
              onClick={() => goToPage(pageIndex - 1)}
              className="border-white/15 bg-transparent text-white [background-image:none] hover:bg-white/5"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <div className="flex items-center gap-1.5">
              {excerpt.pages.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Go to script page ${index + 1}`}
                  aria-current={index === pageIndex ? "page" : undefined}
                  onClick={() => goToPage(index)}
                  className={`h-1.5 transition-all ${index === pageIndex ? "w-8 bg-[#d3a869]" : "w-3 bg-white/20 hover:bg-white/40"}`}
                />
              ))}
              <span className="ml-2 font-mono text-[11px] text-[#9b9186] sm:ml-3">{pageIndex + 1} / {excerpt.pages.length}</span>
            </div>
            <Button
              type="button"
              size="sm"
              aria-label="Next script page"
              disabled={pageIndex === excerpt.pages.length - 1}
              onClick={() => goToPage(pageIndex + 1)}
              className="border-[#b88a50] bg-[#b88a50] text-[#141414] [background-image:none] hover:bg-[#d3a869]"
            >
              <span className="hidden sm:inline">Next page</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
