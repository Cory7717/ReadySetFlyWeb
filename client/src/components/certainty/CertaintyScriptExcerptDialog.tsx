import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Radio, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trackEvent } from "@/lib/analytics";

const excerptPages = [
`CERTAINTY
Episode 1 - "Legacy Systems"

FADE IN:

EXT. THE JUNCTION - FARM ROAD - DAWN

Fog sitting low over the fields on either side of a two lane road, the mountains just starting to catch the first gray light behind them. No power lines humming, no glow from anywhere in the distance. A single pickup truck idles on the shoulder with its hood up, and MARCUS WEBB, forties, sun worn now in a way he never used to be, leans over the engine with a flashlight clenched in his teeth, working through a problem that has nothing to do with servers or clients anymore.

He used to run a company that other companies called when their own people ran out of answers. Now he's squinting at a belt that's slipping and trying to remember what a mechanic told him once, years ago, back when it was somebody else's job to know.

Somewhere beyond the fog, out on the highway, an old diesel engine labors through a gear change. The sound carries across the fields for a few seconds before fading into the distance. Marcus straightens up, listens to it go, then gets back to work. Behind him, a scatter of rooftops and one thin line of smoke marks where the road ends and the Junction begins.

CUT TO:

INT. MARY'S DINER - THE JUNCTION - MORNING

Not open in any official sense, but the door isn't locked either. The diner sits at the crossroads that gave the settlement its name, and the lights run off the settlement's battery bank, a generator idling somewhere out back for backup somebody rigged months back, humming low and steady under everything. MARY STACY, forties, warm in a way that's gotten more watchful over the last year, counts out cans on the counter like she's balancing a ledger, lips moving slightly with the numbers.

Behind her, a chalkboard that used to list daily specials now lists something else. Names, mostly, and beside each one a number of days.

A KID, eight or nine, sits at the counter drawing on the back of an old order pad. Mary glances over without losing her count.

                              MARY
                    Not on the good paper.`,
`The kid flips to a blank page without much protest. Mary almost smiles. Almost.

CUT TO:

EXT. THE JUNCTION - SOLAR FIELD - CONTINUOUS

A cluster of mismatched panels, wired together with the particular confidence of someone who's done it enough times that his hands know it better than his head does. DANNY FAULK, late twenties, checks a charge controller salvaged from three different systems and now working as one.

Below him, an OLDER MAN stands with his arms crossed, deeply unconvinced, watching Danny the way you'd watch someone half your age claim they know something you don't.

                         OLDER MAN
               And this is what's keeping the
               clinic fridge cold.

                         DANNY
               This and about four other things I
               don't feel like explaining before
               coffee.

                         OLDER MAN
               I don't drink coffee.

                         DANNY
               I know. I've seen what you trade
               for it.

The Older Man doesn't have an answer for that. Danny doesn't wait for one, already moving to the next panel.

CUT TO:

EXT. ABANDONED DATA CENTER COMPLEX - ASHBURN, VIRGINIA - DAY

Wide shot. A long, low building, corrugated and windowless, the kind of place most people used to drive past a thousand times without a second thought when it was still running. Now the parking lot is cracked and threaded with weeds, and a chain link gate hangs open on one bent hinge. No hum. No sound at all, really. The particular stillness of something that used to breathe and doesn't anymore.

A hand painted sign has been nailed to the fence, crude but legible.

"NOTHING IN HERE WORKS. DON'T WASTE YOUR TIME."

Underneath it, in different handwriting, smaller:`,
`"it never did."

Hold on it a beat longer than feels comfortable.

CUT TO:

INT. STORAGE ROOM - THE JUNCTION - DAY

A cramped, sparse room in the back of a repurposed building, blankets nailed over the one window instead of curtains. A woman sits on the edge of a cot that isn't hers, hair pulled back and dressed plainer than she'd have ever chosen a year and a half ago, the kind of plain that's meant to help a person disappear into a room rather than stand out in one.

She's holding a laminated conference badge, corners worn soft from handling. ELENA CHO. NEXUS CLOUD SOLUTIONS. She looks at it a long moment, then works it free of its lanyard clip and feeds it into the small woodstove in the corner. It curls and blackens slowly, the lamination taking its time to catch.

A voice calls from just outside the door, not urgent, just ordinary.

                         VOICE (O.S.)
               Ellen? You in there?

Elena, now Ellen, closes her eyes for half a second before she answers, the way you'd steady yourself before stepping onto ice you already know is thin.

                         ELENA
                    (a beat too long)
               Yeah. Coming.

She watches the badge finish burning before she stands.

CUT TO:

EXT. MARY'S DINER - THE JUNCTION - CONTINUOUS

Back outside the diner, a young woman stands across the street, hesitating like she isn't sure the place is actually open, or maybe isn't sure she's allowed to want it to be. SYDNEY COLE, mid twenties, is thinner than she used to be and dressed in clothes that don't quite fit her anymore, the kind of person who clearly used to know exactly how to look put together and hasn't had the tools for that in a long time.

She's holding a phone that hasn't worked in months, out of habit more than hope, turning it over once in her hand before finally shoving it in her pocket and crossing the street.

CUT TO:`,
`EXT. TRADE MARKET - THE JUNCTION - CONTINUOUS

A row of tables and tailgates set up along the crossroads, the closest thing the Junction has to a market day. A scavenging team is unloading crates from a truck bed, and a small crowd has already gathered, trading eyes moving over the goods before anyone's said a word.

EVAN MERCER, thirties, pushes through toward the front of it with the specific urgency of a man who has done this every single time a team comes back and has been disappointed every single time before this one. He starts digging through a milk crate of water damaged records like it might be the one that finally matters.

                         EVAN
                    (not looking up)
               Tell me you hit a house on the way
               back. Anybody with a decent
               collection. Anybody.

                         SCAVENGER
               We hit three houses.

                         EVAN
               And?

The Scavenger holds up a single warped record sleeve, mostly intact. Evan takes it like it's made of glass, turns it over, and his face falls.

                         EVAN (CONT'D)
               This is a Kenny G record.

                         SCAVENGER
               I don't know what that means.

                         EVAN
               It means the universe is still
               funny.

He sets it down gently anyway, because it's still a record, and keeps digging.

                         EVAN (CONT'D)
               Ninety-four. Seven tracks. Opens
               with "Rotten Apple." You'd know it
               by "Nutshell" alone.

                         SCAVENGER
               That's oddly specific.`,
`                         EVAN
               It's been oddly specific for
               sixteen months.

The Scavenger shrugs and moves on to the next customer. Evan keeps sorting through the crate anyway, unwilling to let the day end on a maybe. Somewhere behind him, the ordinary noise of the market goes on, people trading batteries for bandages, seed for solder, one kind of survival for another.

SUPER: SIXTEEN MONTHS EARLIER

FADE OUT:

ACT 1

SCENE 1

INT. WEBB INFRASTRUCTURE GROUP - OPERATIONS FLOOR - RESTON, VIRGINIA - DAY

A glass-walled operations floor built for more people than are currently sitting in it. The company name, WEBB INFRASTRUCTURE GROUP, is etched across the conference room glass overlooking rows of monitors, network maps, and several desks that have already been cleared out.

MARCUS WEBB, forties, sixteen months younger and a good deal less tired, stands over a JUNIOR ENGINEER'S shoulder with coffee in one hand. Founder and CTO. The kind of man who spent twenty years becoming the person companies called when their own people ran out of answers.

On the monitor, an enterprise migration moves through its final handoff.

                         MARCUS
               Hold there. Let it finish the
               handoff before you touch anything.

                         JUNIOR ENGINEER
               It already finished.

Marcus looks closer. It has, four minutes ahead of the timeline he'd mentally budgeted for it, which isn't nothing when you've been doing this long enough to know what these systems are actually capable of on a good day.

                         MARCUS
                    (half to himself)
               Huh.`,
];

function ScriptPage({ text, pageNumber }: { text: string; pageNumber: number }) {
  return (
    <article className="relative mx-auto min-h-[760px] w-full max-w-[680px] bg-[#eee9df] px-6 py-10 text-[#171b1d] shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:min-h-[860px] sm:px-14 sm:py-12">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
        <span className="-rotate-[28deg] select-none whitespace-nowrap font-serif text-6xl uppercase tracking-[0.3em] text-[#9a6425]/[0.045] sm:text-8xl">Certainty</span>
      </div>
      <pre className="relative whitespace-pre-wrap font-mono text-[11px] leading-[1.55] sm:text-[12px]">{text}</pre>
      <div className="absolute bottom-5 right-7 font-mono text-[11px] text-black/55">{pageNumber}.</div>
    </article>
  );
}

export function CertaintyScriptExcerptDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setPageIndex(0);
    trackEvent("certainty_script_excerpt_open", { page: "/certainty", excerpt_pages: excerptPages.length });
  }, [open]);

  function goToPage(nextIndex: number) {
    setPageIndex(nextIndex);
    trackEvent("certainty_script_excerpt_page", { page: "/certainty", excerpt_page: nextIndex + 1 });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden border-[#a56d2d]/30 bg-[#11191e] p-0 text-[#f0eadf] shadow-[0_35px_140px_rgba(0,0,0,0.8)] sm:rounded-none">
        <DialogHeader className="shrink-0 border-b border-[#c08742]/20 bg-[#11191e] px-5 py-4 pr-14 text-left sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d3a35e]"><Radio className="h-4 w-4" />Episode One Excerpt</div>
              <DialogTitle className="mt-2 font-serif text-2xl font-normal uppercase tracking-[0.2em] text-[#f3eee4]">Legacy Systems</DialogTitle>
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#9ca7aa]"><ShieldAlert className="h-3.5 w-3.5" />Five-page preview</div>
          </div>
          <DialogDescription className="sr-only">A controlled five-page preview of the Certainty Episode One screenplay.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#263137] px-3 py-6 sm:px-8 sm:py-8">
          <ScriptPage text={excerptPages[pageIndex]} pageNumber={pageIndex + 1} />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#c08742]/20 bg-[#11191e] px-4 py-3 sm:px-7">
          <Button type="button" variant="outline" size="sm" disabled={pageIndex === 0} onClick={() => goToPage(pageIndex - 1)} className="border-[#d3a35e]/30 bg-transparent text-[#f0eadf] [background-image:none] hover:bg-white/10 hover:text-white"><ArrowLeft className="mr-1 h-4 w-4" /><span className="hidden sm:inline">Previous</span></Button>
          <div className="flex items-center gap-1.5">
            {excerptPages.map((_, index) => <button key={index} type="button" aria-label={`Go to script page ${index + 1}`} onClick={() => goToPage(index)} className={`h-1.5 transition-all ${index === pageIndex ? "w-8 bg-[#d3a35e]" : "w-3 bg-[#d3a35e]/25 hover:bg-[#d3a35e]/45"}`} />)}
            <span className="ml-3 font-mono text-[11px] text-[#9ca7aa]">{pageIndex + 1} / {excerptPages.length}</span>
          </div>
          <Button type="button" size="sm" disabled={pageIndex === excerptPages.length - 1} onClick={() => goToPage(pageIndex + 1)} className="border-[#b47731] bg-[#a56322] text-white [background-image:none] hover:bg-[#bd792e]"><span className="hidden sm:inline">Next page</span><ArrowRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
