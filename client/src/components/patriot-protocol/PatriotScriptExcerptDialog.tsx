import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, FileLock2, RadioTower } from "lucide-react";
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
    { type: "heading", text: "EXT. AMERICAN SKYLINE - DAWN" },
    {
      type: "action",
      text: "A golden sunrise washes over iconic U.S. landmarks - the Statue of Liberty, the Lincoln Memorial, Mount Rushmore.",
    },
    { type: "action", text: "Peaceful. Reverent. Almost sacred." },
    { type: "action", text: "A warm orchestral score rises..." },
    { type: "transition", text: "SMASH CUT TO:" },
    { type: "heading", text: "INT. LBN STUDIO - CONTINUOUS" },
    {
      type: "action",
      text: 'A sleek, immaculate news set. The ANCHOR (40s, photogenic, unsettlingly polished) sits before a colossal digital screen reading: "SPECIAL STABILITY BULLETIN"',
    },
    {
      type: "action",
      text: "A faint patriotic music bed hums under his voice - subtle, engineered to soothe.",
    },
    { type: "character", text: "ANCHOR" },
    {
      type: "dialogue",
      text: "Good morning, America. In a historic action to protect our children and restore national unity, the Department of Education has been officially dissolved effective immediately.",
    },
    { type: "transition", text: "CUT TO:" },
    { type: "heading", text: "MONTAGE - ACROSS THE COUNTRY" },
    { type: "action", text: "- ARMED ACADEMIC COMPLIANCE OFFICERS escort bewildered teachers from classrooms." },
    { type: "action", text: "- A STUDENT screams as officers force her school into lockdown." },
    { type: "action", text: '- TEXTBOOKS dumped into industrial bins labeled: "OBSOLETE MATERIAL - DO NOT RETAIN"' },
  ],
  [
    { type: "action", text: "- A PRINCIPAL shoved into a police car." },
    { type: "character", text: "PRINCIPAL" },
    { type: "parenthetical", text: "(shouting)" },
    { type: "dialogue", text: "You cannot remove entire chapters of history!" },
    { type: "action", text: "- A CONFISCATED MURAL of civil rights leaders lies shattered." },
    { type: "character", text: "ANCHOR (V.O.)" },
    {
      type: "dialogue",
      text: "The new Patriot Curriculum Centers begin activation today, ensuring our youth receive unity-driven, fact-based instruction - free from harmful ideological influence.",
    },
    { type: "transition", text: "CUT TO:" },
    { type: "heading", text: "EXT. SMALL-TOWN BAR - MORNING" },
    {
      type: "action",
      text: "Militia members in tactical gear - patches reading CIVIL DEFENSE FRONT - watch the broadcast, smirking with pride.",
    },
    { type: "character", text: "MILITIA MAN" },
    { type: "dialogue", text: "'Bout damn time somebody cleaned house." },
    { type: "transition", text: "CUT TO:" },
    { type: "heading", text: "INT. SENATOR'S TOWNHOUSE - SAME" },
    {
      type: "action",
      text: 'A FEMALE SENATOR stands frozen, watching the bulletin. Her phone BUZZES: "THEY\'RE COMING TONIGHT." "GET OUT NOW." "FOUNDATION NAMES YOU IN PHASE II."',
    },
    { type: "action", text: "Her hand trembles." },
    { type: "character", text: "ANCHOR (V.O.)" },
    {
      type: "dialogue",
      text: "Citizens should disregard unauthorized sources. In uncertain times, trust only verified Liberty channels.",
    },
    { type: "transition", text: "SMASH TO BLACK." },
    { type: "title", text: "THE PATRIOT PROTOCOL" },
  ],
  [
    { type: "heading", text: "INT. PENTAGON - GENERAL SHAW'S OFFICE - MORNING" },
    { type: "action", text: "A quiet, shadowed office tucked deep within the Pentagon." },
    {
      type: "action",
      text: "GENERAL ADRIAN SHAW (50s), sharp, stoic, burdened, watches the broadcast on a muted wall-mounted screen.",
    },
    { type: "action", text: "Education dissolving. Teachers detained. Patriot Centers rising." },
    { type: "action", text: "Shaw's face reveals nothing - but his eyes betray everything." },
    { type: "action", text: "He slowly reaches forward..." },
    { type: "action", text: "CLICK." },
    { type: "action", text: "The TV goes black." },
    {
      type: "action",
      text: "He remains still, staring at his own reflection in the dark glass - a man seeing the fracture of the republic he swore to protect.",
    },
    { type: "action", text: "A young AIDE appears at the doorway." },
    { type: "character", text: "AIDE" },
    { type: "dialogue", text: "Sir, Joint Command is waiting for your-" },
    { type: "action", text: "Shaw raises a hand. Silence." },
    { type: "character", text: "SHAW" },
    { type: "dialogue", text: "Tell them I'll be there when I have something worth saying." },
    { type: "action", text: "The aide withdraws. Shaw stands alone, the weight of history on his shoulders." },
    { type: "transition", text: "CUT TO:" },
    { type: "heading", text: "EXT. AUSTIN HIGHWAY - MORNING" },
    { type: "action", text: "Rush hour. A crawling mass of vehicles under a blazing Texas sun." },
  ],
  [
    {
      type: "action",
      text: "Inside an aging pickup truck, JACOB HALE (late 30s), rugged, observant, quietly intense, listens to overlapping radio broadcasts.",
    },
    { type: "character", text: "RADIO HOST (V.O.)" },
    { type: "dialogue", text: "-cities still adjusting after yesterday's dissolution-" },
    { type: "character", text: "SECOND HOST (V.O.)" },
    { type: "dialogue", text: "-Fourth Foundation advisors insist this is the necessary first step-" },
    { type: "character", text: "CALLER (V.O.)" },
    { type: "dialogue", text: "-my kid's school locked without warning! No answers, no nothing-" },
    { type: "action", text: "Jacob turns the volume down. His thumb slides along a worn 101st Airborne WWII coin." },
    { type: "action", text: "His grandfather's. His grounding ritual." },
    { type: "action", text: "A DIGITAL BILLBOARD overhead flashes: REAL PATRIOTS OBEY TRUTH" },
    { type: "action", text: "Then: QUESTIONING AUTHORITY IS A FALSE NARRATIVE" },
    {
      type: "action",
      text: "Jacob stares at it, unnerved. Not shocked - just... recognizing.",
    },
    { type: "character", text: "JACOB" },
    { type: "parenthetical", text: "(under his breath)" },
    { type: "dialogue", text: "I've seen this movie..." },
    {
      type: "action",
      text: "Traffic inches forward. A horn blares. Jacob exhales slowly, gripping the wheel tighter as miles of brake lights glow before him.",
    },
    { type: "transition", text: "CUT TO:" },
    { type: "heading", text: "INT. LUXURY CAR DEALERSHIP - SERVICE DRIVE - MORNING" },
  ],
  [
    {
      type: "action",
      text: "A polished, high-end dealership - gleaming floors, fresh espresso, luxury vehicles reflecting overhead lights.",
    },
    {
      type: "action",
      text: "SERVICE MANAGERS hustle. SERVICE TECHS rev engines in bays. SALES STAFF float around like sharks in suits.",
    },
    { type: "action", text: "Jacob steps through the service bay doors, wearing a SERVICE MANAGER badge." },
    {
      type: "action",
      text: "He's met immediately with noise - ringing phones, customers talking loudly, pneumatic tools firing.",
    },
    {
      type: "action",
      text: "At a nearby workstation, FINANCE MANAGER DOUG RICHMOND (50s, smug confidence) watches the LBN broadcast on his tablet.",
    },
    { type: "character", text: "ANCHOR (V.O.)" },
    { type: "dialogue", text: "Today marks the beginning of educational renewal..." },
    { type: "action", text: "Doug nods approvingly." },
    { type: "character", text: "DOUG" },
    { type: "dialogue", text: "'Bout damn time. Schools have been a mess for years." },
    { type: "character", text: "KELLY" },
    {
      type: "dialogue",
      text: "The new Patriot Curriculum looks amazing. I wish we had this when I was a kid.",
    },
    { type: "action", text: "Jacob, sorting work orders nearby, pauses - listening." },
    {
      type: "action",
      text: "A CUSTOMER overhears as he sips an overpriced cappuccino.",
    },
    { type: "character", text: "CUSTOMER" },
    {
      type: "dialogue",
      text: "Foundation brief says they caught ideological subversion in the curriculum. My Facebook group's been warning about it for years.",
    },
    { type: "action", text: "Jacob looks up, troubled." },
  ],
];

function ScriptPage({ blocks, pageNumber }: { blocks: ScriptBlock[]; pageNumber: number }) {
  return (
    <article className="relative mx-auto min-h-[760px] w-full max-w-[650px] bg-[#f0ede5] px-7 py-10 text-[#111] shadow-[0_25px_90px_rgba(0,0,0,0.55)] sm:min-h-[820px] sm:px-14 sm:py-12">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span className="-rotate-[24deg] select-none whitespace-nowrap text-5xl font-bold uppercase tracking-[0.17em] text-[#8f1f19]/[0.045] sm:text-7xl">
          Confidential
        </span>
      </div>
      <div className="relative font-mono text-[12px] leading-[1.55] sm:text-[13px]">
        {blocks.map((block, index) => {
          if (block.type === "heading") return <p key={index} className="mb-4 mt-5 font-bold uppercase">{block.text}</p>;
          if (block.type === "character") return <p key={index} className="mb-0 mt-4 pl-[35%] uppercase">{block.text}</p>;
          if (block.type === "dialogue") return <p key={index} className="mb-3 ml-[22%] max-w-[56%]">{block.text}</p>;
          if (block.type === "parenthetical") return <p key={index} className="mb-0 ml-[30%] max-w-[42%]">{block.text}</p>;
          if (block.type === "transition") return <p key={index} className="my-4 text-right font-bold uppercase">{block.text}</p>;
          if (block.type === "title") return <p key={index} className="my-7 text-center font-bold uppercase">{block.text}</p>;
          return <p key={index} className="mb-4">{block.text}</p>;
        })}
      </div>
      <div className="absolute bottom-5 right-7 font-mono text-[11px] text-black/65 sm:right-10">{pageNumber}.</div>
    </article>
  );
}

export function PatriotScriptExcerptDialog({
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
    trackEvent("patriot_protocol_script_excerpt_open", {
      page: "/patriotprotocol",
      excerpt_pages: excerptPages.length,
    });
  }, [open]);

  function goToPage(nextIndex: number) {
    setPageIndex(nextIndex);
    trackEvent("patriot_protocol_script_excerpt_page", {
      page: "/patriotprotocol",
      excerpt_page: nextIndex + 1,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden border-white/15 bg-[#080a0b] p-0 text-[#ece9df] shadow-[0_30px_120px_rgba(0,0,0,0.85)] sm:rounded-none">
        <DialogHeader className="shrink-0 border-b border-white/10 px-5 py-4 pr-14 text-left sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#c64438]">
                <RadioTower className="h-4 w-4" />
                Pilot Script Excerpt
              </div>
              <DialogTitle className="mt-2 font-display text-2xl font-semibold uppercase tracking-[-0.04em] text-white">
                The Quiet Coup
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#8d8981]">
              <FileLock2 className="h-3.5 w-3.5" />
              Controlled five-page preview
            </div>
          </div>
          <DialogDescription className="sr-only">
            A controlled five-page preview of The Patriot Protocol pilot screenplay.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#181b1c] px-3 py-6 sm:px-8 sm:py-8">
          <ScriptPage blocks={excerptPages[pageIndex]} pageNumber={pageIndex + 1} />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-[#080a0b] px-4 py-3 sm:px-7">
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
                  index === pageIndex ? "w-8 bg-[#bc3027]" : "w-3 bg-white/20 hover:bg-white/40"
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
            className="border-[#a42d26] bg-[#a42d26] text-white [background-image:none] hover:bg-[#bd3d34]"
          >
            <span className="hidden sm:inline">Next page</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
