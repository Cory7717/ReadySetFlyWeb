import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trackEvent } from "@/lib/analytics";

type ScriptBlock =
  | { type: "action"; text: string }
  | { type: "character"; text: string }
  | { type: "dialogue"; text: string }
  | { type: "parenthetical"; text: string }
  | { type: "heading"; text: string }
  | { type: "transition"; text: string };

const excerptPages: ScriptBlock[][] = [
  [
    { type: "heading", text: "INT. APARTMENT - MORNING" },
    { type: "action", text: "A digital alarm CLOCK BUZZES - loud, shrill, relentless." },
    { type: "action", text: "The sound doesn't stop. It swells. Becomes the only thing in the room." },
    {
      type: "action",
      text: "LENA (late 20s) flings the sheet aside and gropes over the nightstand until her palm finds plastic. She SLAMS the alarm off.",
    },
    { type: "action", text: "Silence. Not really. The apartment hums with old electricity. Pipes tick in the wall." },
    {
      type: "action",
      text: "The small space is lived-in but tired. Curtains sag against dirty windows. Piles of laundry. A stack of unopened mail with red stripes: FINAL NOTICE.",
    },
    {
      type: "action",
      text: "In the kitchenette, JONAS (early 30s) is already up. He hunches over a laptop like it's the last warm thing in the world. Coffee gurgles into a stained mug.",
    },
    {
      type: "action",
      text: "Lena sits on the edge of the bed, breathing, spine curved, hair in her face. She feels the morning like a weight placed on her shoulders.",
    },
    { type: "character", text: "LENA" },
    { type: "parenthetical", text: "(thick; half-asleep)" },
    { type: "dialogue", text: "What time is it?" },
    { type: "character", text: "JONAS" },
    { type: "dialogue", text: "Late." },
  ],
  [
    {
      type: "action",
      text: "He doesn't look over. His eyes are pinned to the blue-white screen. The cursor blinks with the impatience of a metronome.",
    },
    {
      type: "action",
      text: "Lena staggers to the bathroom. The SHOWER hisses alive. Steam. Her hand flat on the wall while she lets her head hang, eyes closed.",
    },
    { type: "action", text: "Jonas types. Erases. Types. He rubs his temples and drinks coffee that's too hot." },
    {
      type: "action",
      text: "Bathroom mirror: Lena wipes a circle through steam. Eyes rimmed dark. She touches the place between her eyebrows where the headache always begins.",
    },
    {
      type: "action",
      text: "She rushes dressing. Jeans tugged over wet legs. T-shirt dragged down. She trips on her shoes, catches herself on the counter, laughs once at nothing.",
    },
    { type: "action", text: "Phone: a cascade of notifications." },
    {
      type: "action",
      text: 'EMAIL (17 new). RENT DUE. MISSED CALL - BOSS. "Don\'t forget to hydrate!" "Stand up!" "Breathe." Dentist: REMINDER.',
    },
    { type: "action", text: "She turns it face down like it's alive." },
    { type: "character", text: "LENA" },
    { type: "parenthetical", text: "(small, to herself)" },
    { type: "dialogue", text: "We can't keep doing this." },
    { type: "action", text: "Jonas closes the laptop with a snap and reaches for his jacket." },
    { type: "character", text: "JONAS" },
    { type: "dialogue", text: "If we run, we make the train." },
    {
      type: "action",
      text: "They share a look - a tired, practiced truce. It says this is every morning. It says neither knows how to stop.",
    },
    { type: "transition", text: "CUT TO:" },
  ],
  [
    { type: "heading", text: "EXT. CITY STREETS - MORNING" },
    {
      type: "action",
      text: "A wall of NOISE and HEAT. Bus brakes scream. A vendor shouts over a hiss of steam. A siren threads through it all like a needle.",
    },
    {
      type: "action",
      text: "Lena and Jonas shoulder their way down the sidewalk. People brush them without apology. A cyclist clips Jonas's arm.",
    },
    { type: "character", text: "CYCLIST (O.S.)" },
    { type: "dialogue", text: "Watch it!" },
    { type: "action", text: "Jonas half-turns, swallows what he almost says. Keeps moving." },
    { type: "character", text: "LENA" },
    { type: "parenthetical", text: "(breathless)" },
    { type: "dialogue", text: "We should've left ten minutes ago." },
    { type: "character", text: "JONAS" },
    { type: "dialogue", text: "Doesn't matter when we leave - it's always 'we should've left ten minutes ago.'" },
    {
      type: "action",
      text: "They descend into the subway. The CROWDS thicken - a human river. Jonas checks his watch. Flinches like it bit him.",
    },
    { type: "character", text: "JONAS" },
    { type: "parenthetical", text: "(tense)" },
    { type: "dialogue", text: "If we miss-" },
    { type: "character", text: "LENA" },
    { type: "dialogue", text: "Don't say it." },
    { type: "action", text: "They push through turnstiles. Shoulders. Backpacks. Someone's perfume too sweet, too much." },
  ],
  [
    { type: "action", text: "A CHIME. Doors closing." },
    { type: "action", text: "Jonas slips in. Lena wedges through as the doors kiss her coat. She exhales, shaky." },
    { type: "heading", text: "INT. SUBWAY CAR - CONTINUOUS" },
    {
      type: "action",
      text: "Packed. Fluorescent lights buzz with a frequency you can feel in your teeth. The car JERKS forward. Everyone leans as one body, then rights.",
    },
    {
      type: "action",
      text: "Lena grips the pole. Her knuckles go white. Sweat beads at her hairline. The car smells like yesterday's coffee and someone's shampoo.",
    },
    { type: "action", text: "She looks up at the digital clock over the doors." },
    { type: "action", text: "8:59" },
    { type: "action", text: "It flickers." },
    { type: "action", text: "9:00" },
    { type: "action", text: "9:01" },
    { type: "action", text: "Back to 8:59." },
    {
      type: "action",
      text: "She stares at the dark window. Her reflection stares back - pale, a beat behind. For a breath, it doesn't move when she does.",
    },
    { type: "character", text: "LENA" },
    { type: "parenthetical", text: "(under breath)" },
    { type: "dialogue", text: "We can't keep doing this." },
    {
      type: "action",
      text: "Jonas scrolls. His thumb flicks too fast. He starts an email. Deletes it. Starts again, jaw clenched.",
    },
    { type: "action", text: "The train roars into the tunnel and the world goes black outside." },
    { type: "transition", text: "CUT TO:" },
  ],
  [
    { type: "heading", text: "INT. OFFICE - DAY" },
    { type: "action", text: "Open-plan. Ringing phones. Harsh light." },
    { type: "action", text: "The floor is a grid of little anxieties." },
    {
      type: "action",
      text: "The glass doors SWOOSH. Jonas hurries in, jacket half-on, messenger bag bouncing against his side.",
    },
    { type: "action", text: "A few heads lift - tiny judgmental glances." },
    {
      type: "action",
      text: "He reaches his desk - papers crooked, coffee ring from yesterday still there. He drops into his chair and tries to look like he's been there for hours.",
    },
    { type: "action", text: 'On his monitor, a banner ad flickers: "STOP THE CLOCK."' },
    { type: "action", text: "Jonas blinks - it's gone, replaced with a generic insurance ad." },
    { type: "action", text: "He rubs his eyes, unsettled." },
    { type: "action", text: "His BOSS appears over the partition like a storm cloud with teeth." },
    { type: "character", text: "BOSS" },
    {
      type: "dialogue",
      text: "Do you know what time it is? The quarterly analysis report was due yesterday and you come rushing in here, late.",
    },
    { type: "character", text: "JONAS" },
    { type: "dialogue", text: "You'll have it by end of day." },
    { type: "character", text: "BOSS" },
    { type: "parenthetical", text: "(faux-friendly, poisonous)" },
    { type: "dialogue", text: "You said that... yesterday." },
    {
      type: "action",
      text: "The Boss walks away, leaving a smile behind like a fingerprint on glass.",
    },
  ],
];

function ScriptPage({ blocks, pageNumber }: { blocks: ScriptBlock[]; pageNumber: number }) {
  return (
    <article className="relative mx-auto min-h-[760px] w-full max-w-[650px] bg-[#f2f2ed] px-7 py-10 text-[#151a1c] shadow-[0_25px_90px_rgba(11,25,31,0.35)] sm:min-h-[820px] sm:px-14 sm:py-12">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span className="-rotate-[22deg] select-none whitespace-nowrap font-serif text-5xl uppercase tracking-[0.25em] text-[#45606a]/[0.045] sm:text-7xl">
          The Grasp
        </span>
      </div>
      <div className="relative font-mono text-[12px] leading-[1.55] sm:text-[13px]">
        {blocks.map((block, index) => {
          if (block.type === "heading") return <p key={index} className="mb-4 mt-5 font-bold uppercase">{block.text}</p>;
          if (block.type === "character") return <p key={index} className="mb-0 mt-4 pl-[35%] uppercase">{block.text}</p>;
          if (block.type === "dialogue") return <p key={index} className="mb-3 ml-[22%] max-w-[56%]">{block.text}</p>;
          if (block.type === "parenthetical") return <p key={index} className="mb-0 ml-[30%] max-w-[42%]">{block.text}</p>;
          if (block.type === "transition") return <p key={index} className="my-4 text-right font-bold uppercase">{block.text}</p>;
          return <p key={index} className="mb-4">{block.text}</p>;
        })}
      </div>
      <div className="absolute bottom-5 right-7 font-mono text-[11px] text-black/60 sm:right-10">{pageNumber}.</div>
    </article>
  );
}

export function GraspScriptExcerptDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setPageIndex(0);
    trackEvent("the_grasp_script_excerpt_open", { page: "/thegrasp", excerpt_pages: excerptPages.length });
  }, [open]);

  function goToPage(nextIndex: number) {
    setPageIndex(nextIndex);
    trackEvent("the_grasp_script_excerpt_page", { page: "/thegrasp", excerpt_page: nextIndex + 1 });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden border-[#8ca0a6]/25 bg-[#e8ecea] p-0 text-[#1c292d] shadow-[0_30px_120px_rgba(20,40,48,0.5)] sm:rounded-none">
        <DialogHeader className="shrink-0 border-b border-[#60747b]/20 bg-[#dce4e2] px-5 py-4 pr-14 text-left sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#536d76]">
                <Waves className="h-4 w-4" />
                Feature Screenplay Excerpt
              </div>
              <DialogTitle className="mt-2 font-serif text-2xl font-normal uppercase tracking-[0.22em] text-[#23363c]">
                The Grasp
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#687a7e]">
              <Clock3 className="h-3.5 w-3.5" />
              Five-page preview
            </div>
          </div>
          <DialogDescription className="sr-only">
            A controlled five-page preview of The Grasp feature screenplay.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#c8d2d1] px-3 py-6 sm:px-8 sm:py-8">
          <ScriptPage blocks={excerptPages[pageIndex]} pageNumber={pageIndex + 1} />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#60747b]/20 bg-[#dce4e2] px-4 py-3 sm:px-7">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Previous script page"
            disabled={pageIndex === 0}
            onClick={() => goToPage(pageIndex - 1)}
            className="border-[#60747b]/25 bg-transparent text-[#23363c] [background-image:none] hover:bg-white/40"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <div className="flex items-center gap-1.5">
            {excerptPages.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Go to script page ${index + 1}`}
                onClick={() => goToPage(index)}
                className={`h-1.5 transition-all ${
                  index === pageIndex ? "w-8 bg-[#536d76]" : "w-3 bg-[#536d76]/20 hover:bg-[#536d76]/40"
                }`}
              />
            ))}
            <span className="ml-3 font-mono text-[11px] text-[#687a7e]">{pageIndex + 1} / {excerptPages.length}</span>
          </div>

          <Button
            type="button"
            size="sm"
            aria-label="Next script page"
            disabled={pageIndex === excerptPages.length - 1}
            onClick={() => goToPage(pageIndex + 1)}
            className="border-[#536d76] bg-[#536d76] text-white [background-image:none] hover:bg-[#627e88]"
          >
            <span className="hidden sm:inline">Next page</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
