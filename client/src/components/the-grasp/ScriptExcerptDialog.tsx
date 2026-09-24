import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Download, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trackEvent } from "@/lib/analytics";

const PDF_PATH = "/downloads/the-grasp-screenplay-excerpt.pdf";

const excerptPages = [
`### ACT ONE ###

SCENE 1

INT. APARTMENT – MORNING

A digital alarm clock BUZZES, loud and shrill, and doesn't stop. It keeps going until it's the only thing in the room.

LENA (late 20s) flings the sheet aside, naked and unselfconscious, and gropes across the nightstand until her palm finds plastic. She slams the alarm off.

It isn't really silent after. The apartment hums with old wiring, and the pipes tick in the wall. It's a small place, lived in and tired: curtains sagging against dirty windows, laundry piled on a chair, and a stack of unopened mail on the counter, the top envelope striped red with FINAL NOTICE.

In the kitchenette, JONAS (early 30s) is already up in boxers and bare feet, hunched over a laptop while the coffee maker gurgles into a stained mug.

Lena sits on the edge of the bed with her spine curved and her hair in her face, just breathing.

                         LENA
                   (thick with sleep)
               What time is it?

                         JONAS
               Late.

He doesn't look up from the screen.

Lena staggers to the bathroom and the shower hisses on. Through the cracked door there's steam and the slap of water on tile, and her hand flat against the wall while she lets her head hang.

Jonas types, deletes, types again. He rubs his temple with the heel of his hand and drinks coffee that's too hot.

In the bathroom mirror, Lena wipes a circle through the steam. Her eyes are rimmed dark. She presses a finger to the spot between her eyebrows where the headache always starts.

She dresses in a rush, dragging jeans up over wet legs and a T-shirt over her head, trips on her shoes, catches herself on the counter, and laughs once at nothing.`,

`Her phone lights up with a stack of notifications: EMAIL (17 NEW). RENT DUE. MISSED CALL: BOSS. "Don't forget to hydrate!" "Stand up!" "Breathe." DENTIST: REMINDER.

She turns it face down.

                         LENA
                  (quietly, to herself)
               We can't keep doing this.

Jonas snaps the laptop shut and grabs his jacket.

                         JONAS
               If we run, we make the train.

They look at each other across the room, a tired, practiced look, the one they give each other every morning. Then they run.

                                                    CUT TO:

SCENE 2

EXT. CITY STREETS – MORNING

Noise and heat. Bus brakes scream, a vendor shouts over a hiss of steam, and a siren threads through all of it. Lena and Jonas shoulder their way down the sidewalk against a crowd that doesn't apologize. A cyclist clips Jonas's arm.

                         CYCLIST (O.S.)
               Watch it!

Jonas half turns, swallows what he was going to say, and keeps moving.

                         LENA
                     (breathless)
               We should've left ten minutes ago.

                         JONAS
               We always should've left ten
               minutes ago. Doesn't matter when we
               leave.

They go down into the subway, where the crowd thickens into one slow river of shoulders and backpacks and someone's perfume, too sweet. Jonas checks his watch and flinches.

                         JONAS (CONT'D)
               If we miss—`,

`                         LENA
               Don't say it.

They push through the turnstiles. On the platform a three-note chime sounds, rising, and the doors start to close. Jonas slips in. Lena wedges through as the doors kiss the back of her coat, and she lets out a shaky breath.

INT. SUBWAY CAR – CONTINUOUS

The car is packed. The fluorescent lights buzz at a pitch you can feel in your teeth. The train jerks forward and everyone leans together and rights themselves.

Lena grips the pole until her knuckles go white. Sweat beads at her hairline. The car smells like yesterday's coffee and someone's shampoo.

She looks up at the digital clock over the doors.

                              8:59

It flickers.

                              9:00

                              9:01

Then it's 8:59 again.

She looks at the dark window. Her reflection looks back at her, pale, and for a breath it doesn't move when she moves. Then it catches up.

Beside her, Jonas thumbs through his email, starts a reply, deletes it, and starts again with his jaw clenched.

The train roars into the tunnel, and the window goes black.

                                                    CUT TO:

SCENE 3

INT. OFFICE – DAY

An open-plan floor of ringing phones and flat, harsh light. The glass doors whoosh open, and Jonas hurries in with his jacket half on and his bag bouncing against his hip. A few heads lift and go back down.

He squeezes between desks, muttering "sorry" when he clips a chair, and drops into his seat. His desk is a mess of crooked papers, with yesterday's coffee ring still on the laminate. He tries to look like he's been there for an hour.`,

`On his monitor, a banner ad flickers: STOP THE CLOCK.

He blinks. It's an ad for car insurance. He rubs his eyes.

His BOSS (40s) leans over the partition.

                         BOSS
               Do you know what time it is?

                         JONAS
               I know.

                         BOSS
               The quarterly analysis was due
               yesterday.

                         JONAS
               You'll have it by end of day.

                         BOSS
                  (friendly, which is worse)
               You said that yesterday.
                       (beat)
               And you've been late all month.
               That isn't like you.

The Boss smiles and moves on down the row. Jonas lets out a slow breath through his nose and turns back to his screen. The sentence he was writing doesn't make sense. He holds down the backspace key and watches it disappear one letter at a time until the page is empty.

Nearby, the printer jams with a loud clack. Jonas flinches. The machine resets with a long, low drone that goes on a little longer than it should.

A CO-WORKER passes and raps on his desk with a knuckle. Jonas nearly comes out of his chair.

                         CO-WORKER
               You good?

                         JONAS
               Great.

                         CO-WORKER
               Meeting in twenty-five.

                         JONAS
               Got it.`,

`The co-worker is already gone. On the wall, the second hand of the office clock jerks forward, loud enough to hear over the phones. Jonas digs his nails into his palm.

INT. CONFERENCE ROOM – DAY

A wall clock ticks too loudly over a glossy table. Jonas sits at the far end with his laptop open and a black notebook with a worn elastic band beside it. Colleagues talk over each other.

                         MANAGER (O.S.)
               So let's push the dashboard review
               to Thursday.

Jonas writes in the notebook in small square capitals, QUARTERLY – EOD, and draws a box around it. Then another box around that. Then a third.

A calendar notification slides onto his screen: CLIENT SYNC IN 25 MIN.

Under it, just for a second, a second notification: FERRY DEPARTS – BOARDING NOW.

Then it's gone.

Jonas stares at the place where it was. He nods at something someone said. The clock ticks.

He shuts the laptop a little too hard, and a couple of people look over.

                                                    CUT TO:

SCENE 4

INT. CREATIVE AGENCY – DAY

Another open-plan office. The wall calendar is a color-coded war map of sticky notes. Lena sits at her desk juggling browser tabs and Slack messages as the notifications pop up faster than she can close them.

                         PROJECT MANAGER (O.S.)
               Lena, where's the Q3 deck?

Lena clicks through to a half-finished slide deck.

                         LENA
               Almost there. I'm waiting on copy
               from Alex.`,
];

function ScriptPage({ text, pageNumber }: { text: string; pageNumber: number }) {
  return (
    <article className="relative mx-auto min-h-[760px] w-full max-w-[650px] bg-[#f1eee7] px-6 py-10 text-[#172126] shadow-[0_24px_80px_rgba(0,0,0,0.38)] sm:min-h-[820px] sm:px-14 sm:py-12">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
        <span className="-rotate-[24deg] select-none whitespace-nowrap text-5xl font-bold uppercase tracking-[0.18em] text-[#536d76]/[0.05] sm:text-7xl">Confidential</span>
      </div>
      <pre className="relative whitespace-pre-wrap font-mono text-[11px] leading-[1.55] sm:text-[12px]">{text}</pre>
      <div className="absolute bottom-5 right-7 font-mono text-[11px] text-black/60 sm:right-10">{pageNumber}.</div>
    </article>
  );
}

export function TheGraspScriptExcerptDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setPageIndex(0);
    trackEvent("the_grasp_script_excerpt_open", { page: "/thegrasp", excerpt_pages: excerptPages.length });
  }, [open]);

  const goToPage = (index: number) => {
    const next = Math.max(0, Math.min(excerptPages.length - 1, index));
    setPageIndex(next);
    trackEvent("the_grasp_script_excerpt_page", { page: "/thegrasp", excerpt_page: next + 1 });
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") setPageIndex((current) => Math.max(0, current - 1));
      if (event.key === "ArrowRight") setPageIndex((current) => Math.min(excerptPages.length - 1, current + 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden border-[#536d76]/35 bg-[#172126] p-0 text-[#edf0ed] shadow-[0_30px_120px_rgba(0,0,0,0.72)] sm:rounded-none">
        <DialogHeader className="shrink-0 border-b border-white/10 px-5 py-4 pr-14 text-left sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#91a9ad]"><BookOpen className="h-4 w-4" />Screenplay Excerpt</div><DialogTitle className="mt-2 font-serif text-2xl font-normal uppercase tracking-[0.1em] text-white">The Grasp</DialogTitle></div>
            <div className="flex items-center gap-4"><a href={PDF_PATH} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[#a8b9bc] hover:text-white"><Download className="h-3.5 w-3.5" />PDF</a><span className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#8f9b9d] sm:flex"><LockKeyhole className="h-3.5 w-3.5" />Confidential / Five-page preview</span></div>
          </div>
          <DialogDescription className="sr-only">A controlled five-page preview of The Grasp screenplay.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#2e3c41] px-3 py-6 sm:px-8 sm:py-8"><ScriptPage text={excerptPages[pageIndex]} pageNumber={pageIndex + 1} /></div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-[#172126] px-4 py-3 sm:px-7">
          <Button type="button" variant="outline" size="sm" aria-label="Previous script page" disabled={pageIndex === 0} onClick={() => goToPage(pageIndex - 1)} className="border-white/15 bg-transparent text-white [background-image:none] hover:bg-white/5"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Previous</span></Button>
          <div className="flex items-center gap-1.5">{excerptPages.map((_, index) => <button key={index} type="button" aria-label={`Go to script page ${index + 1}`} onClick={() => goToPage(index)} className={`h-1.5 transition-all ${index === pageIndex ? "w-8 bg-[#87a2a7]" : "w-3 bg-white/20 hover:bg-white/40"}`} />)}<span className="ml-3 font-mono text-[11px] text-[#9eaaac]">{pageIndex + 1} / {excerptPages.length}</span></div>
          <Button type="button" size="sm" aria-label="Next script page" disabled={pageIndex === excerptPages.length - 1} onClick={() => goToPage(pageIndex + 1)} className="border-[#536d76] bg-[#536d76] text-white [background-image:none] hover:bg-[#627e88]"><span className="hidden sm:inline">Next page</span><ArrowRight className="h-4 w-4" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
