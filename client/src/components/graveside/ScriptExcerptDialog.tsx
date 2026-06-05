import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, LockKeyhole } from "lucide-react";
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
  | { type: "transition"; text: string }
  | { type: "title"; text: string };

const excerptPages: ScriptBlock[][] = [
  [
    { type: "title", text: "COLD OPEN" },
    { type: "heading", text: "EXT. MERRIMACK RIVER / SWENSON GRANITE WORKS - NIGHT - 1887" },
    { type: "action", text: "Dark." },
    {
      type: "action",
      text: "The quarry is silent. Second shift ended hours ago. The only sound is the river -- low and constant, the specific sound of water that has been running past the same stone for a thousand years and has no opinion about it.",
    },
    {
      type: "action",
      text: "The Swenson Granite Works sits on the near bank. The main building. The equipment sheds. The boarding house behind them, windows dark. A single lamp burning in one upstairs window.",
    },
    { type: "action", text: "It should not be burning at this hour." },
    { type: "transition", text: "CUT TO:" },
    { type: "heading", text: "INT. BRIDIE'S APARTMENT - BOARDING HOUSE - CONTINUOUS" },
    { type: "action", text: "Dark. Moonlight through a single window." },
    {
      type: "action",
      text: "BRIDIE HALLORAN lies in bed, eyes open, staring at the ceiling. She is fifty-one years old. Strong-shouldered, thick-handed, the face of a woman who has been carrying things her whole life and stopped expecting them to get lighter.",
    },
  ],
  [
    { type: "action", text: "She is awake in the specific way of someone who has not been asleep." },
    { type: "action", text: "She heard something." },
    { type: "action", text: "She is deciding what she heard." },
    {
      type: "action",
      text: "A crack. From above. Not the building settling. Not the river. From the foreman's office on the floor above the kitchen.",
    },
    { type: "action", text: "She stares at the ceiling." },
    { type: "character", text: "MARA (V.O.)" },
    { type: "dialogue", text: "Okay. Okay." },
    { type: "action", text: "Bridie sits up." },
    { type: "character", text: "MARA (V.O.)" },
    { type: "dialogue", text: "Don't." },
    { type: "action", text: "Bridie reaches for the shawl draped over the bedpost." },
    {
      type: "action",
      text: "Wraps it around her shoulders over the nightdress. Her feet find the floor.",
    },
    {
      type: "action",
      text: "She crosses to the door that opens onto the back staircase landing. Opens it.",
    },
    {
      type: "action",
      text: "The staircase runs two directions from here -- down to the kitchen, up to the foreman's office. She looks up.",
    },
    { type: "action", text: "A thin line of lamplight under the office door at the top of the stairs." },
    { type: "action", text: "It should not be there." },
  ],
  [
    { type: "action", text: "She listens." },
    { type: "action", text: "Nothing now." },
    { type: "character", text: "MARA (V.O.)" },
    { type: "dialogue", text: "Go back." },
    { type: "transition", text: "CUT TO:" },
    { type: "heading", text: "INT. BACK STAIRCASE - BOARDING HOUSE - CONTINUOUS" },
    {
      type: "action",
      text: "Bridie begins to climb. Her feet are bare. She knows this staircase -- knows which treads will speak and which won't. She climbs in silence, one hand flat against the wall instead of the railing.",
    },
    { type: "action", text: "The lamplight under the door grows as she rises." },
    { type: "action", text: "Halfway up she stops." },
    { type: "action", text: "Listens." },
    { type: "action", text: "Nothing." },
    { type: "character", text: "MARA (V.O.)" },
    { type: "dialogue", text: "Cora." },
    {
      type: "action",
      text: "She climbs the rest of the stairs. The door to the foreman's office is partially open. Yellow lamplight spilling onto the landing floorboards.",
    },
    { type: "action", text: "She approaches. Stops in the doorway." },
  ],
  [
    {
      type: "action",
      text: "A man's silhouette moves across the spill of light inside the room. Broad. Young. Unhurried. He is bent over something we cannot see. He does not notice her.",
    },
    { type: "action", text: "His shirtsleeve catches the lamplight." },
    { type: "action", text: "There is a dark stain on the cuff." },
    { type: "action", text: "We do not see Bridie's face. We stay on the stain." },
    { type: "action", text: "We do not hear Mara's voiceover." },
    { type: "action", text: "We do not need to." },
    {
      type: "action",
      text: "Bridie steps back from the doorway. Once. Twice. She does not make a sound. She turns. She descends the stairs the same careful way she came up -- knowing which treads will speak.",
    },
    { type: "action", text: "At the bottom she does not stop. She goes into the kitchen." },
    { type: "transition", text: "CUT TO:" },
    { type: "heading", text: "INT. BOARDING HOUSE KITCHEN - CONTINUOUS" },
    { type: "action", text: "Dark. Moonlight through the window above the sink." },
    { type: "action", text: "Bridie crosses to the worktable. Puts both hands flat on the cold surface." },
    { type: "action", text: "She stands there." },
  ],
  [
    { type: "character", text: "MARA (V.O.)" },
    { type: "dialogue", text: "Say something. Why aren't you saying anything?" },
    {
      type: "action",
      text: "Bridie stands at the table with her hands flat on it and does not move.",
    },
    { type: "transition", text: "HARD CUT TO BLACK." },
    { type: "title", text: "TITLE CARD: GRAVESIDE" },
    { type: "action", text: "Silence." },
    { type: "action", text: "Then underneath it, barely --" },
    { type: "action", text: "Two people breathing. Disoriented. Present." },
    { type: "transition", text: "FADE OUT." },
    { type: "title", text: "TITLE CARD: EARLIER TODAY" },
    { type: "title", text: "ACT ONE" },
    { type: "heading", text: "INT. ELI'S CAR - DAY - PRESENT" },
    {
      type: "action",
      text: "I-93 North. October. The trees of southern New Hampshire going bare at the edges, still holding color at the crowns.",
    },
    {
      type: "action",
      text: "ELI COLE drives. Late thirties. The kind of person who reads every historical marker at every roadside stop and means it.",
    },
    {
      type: "action",
      text: "MARA VOSS rides shotgun. Mid-thirties. Precise posture that isn't effort, it's just how she's built.",
    },
    {
      type: "action",
      text: "They have been together long enough that silence doesn't need filling and conversation doesn't need starting.",
    },
    { type: "character", text: "MARA" },
    { type: "dialogue", text: "How much further." },
    { type: "character", text: "ELI" },
    { type: "dialogue", text: "Forty minutes." },
  ],
];

function ScriptPage({ blocks, pageNumber }: { blocks: ScriptBlock[]; pageNumber: number }) {
  return (
    <article className="relative mx-auto min-h-[760px] w-full max-w-[650px] bg-[#f4f0e7] px-7 py-10 text-[#111] shadow-[0_24px_80px_rgba(0,0,0,0.42)] sm:min-h-[820px] sm:px-14 sm:py-12">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span className="-rotate-[24deg] select-none whitespace-nowrap text-5xl font-bold uppercase tracking-[0.18em] text-[#7d1f1a]/[0.045] sm:text-7xl">
          Confidential
        </span>
      </div>

      <div className="relative font-mono text-[12px] leading-[1.55] sm:text-[13px]">
        {blocks.map((block, index) => {
          if (block.type === "heading") {
            return <p key={index} className="mb-4 mt-5 font-bold uppercase">{block.text}</p>;
          }
          if (block.type === "character") {
            return <p key={index} className="mb-0 mt-4 pl-[35%] uppercase">{block.text}</p>;
          }
          if (block.type === "dialogue") {
            return <p key={index} className="mb-3 ml-[22%] max-w-[56%]">{block.text}</p>;
          }
          if (block.type === "parenthetical") {
            return <p key={index} className="mb-0 ml-[30%] max-w-[42%]">{block.text}</p>;
          }
          if (block.type === "transition") {
            return <p key={index} className="my-4 text-right font-bold uppercase">{block.text}</p>;
          }
          if (block.type === "title") {
            return <p key={index} className="my-6 text-center font-bold uppercase">{block.text}</p>;
          }
          return <p key={index} className="mb-4">{block.text}</p>;
        })}
      </div>

      <div className="absolute bottom-5 right-7 font-mono text-[11px] text-black/65 sm:right-10">{pageNumber}.</div>
    </article>
  );
}

export function ScriptExcerptDialog({
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
    trackEvent("graveside_script_excerpt_open", { page: "/graveside", excerpt_pages: excerptPages.length });
  }, [open]);

  function goToPage(nextIndex: number) {
    setPageIndex(nextIndex);
    trackEvent("graveside_script_excerpt_page", {
      page: "/graveside",
      excerpt_page: nextIndex + 1,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden border-white/15 bg-[#090c0d] p-0 text-[#ece9df] shadow-[0_30px_120px_rgba(0,0,0,0.8)] sm:rounded-none">
        <DialogHeader className="shrink-0 border-b border-white/10 px-5 py-4 pr-14 text-left sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#a94137]">
                <BookOpen className="h-4 w-4" />
                Pilot Script Excerpt
              </div>
              <DialogTitle className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em] text-white">
                Graveside
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#89857c]">
              <LockKeyhole className="h-3.5 w-3.5" />
              Confidential / Five-page preview
            </div>
          </div>
          <DialogDescription className="sr-only">
            A controlled five-page preview of the Graveside pilot screenplay.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#171a1b] px-3 py-6 sm:px-8 sm:py-8">
          <ScriptPage blocks={excerptPages[pageIndex]} pageNumber={pageIndex + 1} />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-[#090c0d] px-4 py-3 sm:px-7">
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
            {excerptPages.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Go to script page ${index + 1}`}
                onClick={() => goToPage(index)}
                className={`h-1.5 transition-all ${
                  index === pageIndex ? "w-8 bg-[#a94137]" : "w-3 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
            <span className="ml-3 font-mono text-[11px] text-[#8d8981]">
              {pageIndex + 1} / {excerptPages.length}
            </span>
          </div>

          <Button
            type="button"
            size="sm"
            aria-label="Next script page"
            disabled={pageIndex === excerptPages.length - 1}
            onClick={() => goToPage(pageIndex + 1)}
            className="border-[#a43d34] bg-[#a43d34] text-white [background-image:none] hover:bg-[#bb4a40]"
          >
            <span className="hidden sm:inline">Next page</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
