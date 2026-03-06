import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trackEvent } from "@/lib/analytics";

type E6BHowItWorksModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadExample: () => void;
};

export default function E6BHowItWorksModal({
  open,
  onOpenChange,
  onLoadExample,
}: E6BHowItWorksModalProps) {
  useEffect(() => {
    if (open) {
      trackEvent("e6b_how_it_works_opened");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>How E6Bs Work</DialogTitle>
          <DialogDescription>
            The E6B flight computer solves wind correction, ground speed, time, fuel, and
            altitude performance in one place.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="wind" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="wind">Wind Triangle</TabsTrigger>
            <TabsTrigger value="altitude">Altitude</TabsTrigger>
            <TabsTrigger value="fuel">Fuel &amp; Range</TabsTrigger>
          </TabsList>

          <TabsContent value="wind" className="space-y-3 text-sm text-muted-foreground">
            <p>
              The wind triangle solves three vectors: your True Airspeed (TAS)
              vector, the wind vector, and the resulting ground track vector.
            </p>
            <p>
              You point the nose along the <strong>heading</strong> — not the
              course — to compensate for wind drift. The angle between heading
              and course is the Wind Correction Angle (WCA).
            </p>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <div className="font-semibold text-foreground">Memory aid</div>
              <div>WCA right → wind from the left</div>
              <div>WCA left → wind from the right</div>
              <div>Headwind → reduces ground speed</div>
              <div>Tailwind → increases ground speed</div>
            </div>
          </TabsContent>

          <TabsContent value="altitude" className="space-y-3 text-sm text-muted-foreground">
            <p><strong>Pressure Altitude (PA)</strong> is field elevation corrected for non-standard altimeter setting.</p>
            <p><strong>Density Altitude (DA)</strong> is PA corrected for non-standard temperature. High DA means the air is thin — the aircraft performs as if at a higher altitude. Hot, humid, high elevations are highest risk.</p>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <div className="font-semibold text-foreground">Rule of thumb</div>
              <div>DA ≈ PA + 120 × (OAT°C − ISA temp)</div>
              <div>ISA temp = 15°C − 2°C per 1,000 ft</div>
            </div>
          </TabsContent>

          <TabsContent value="fuel" className="space-y-3 text-sm text-muted-foreground">
            <p>Endurance is how long you can fly: fuel available ÷ burn rate.</p>
            <p>Range is how far you can fly: ground speed × endurance.</p>
            <p>Always plan fuel for trip + reserve. FAA VFR day minimum is 30 minutes reserve; night is 45 minutes.</p>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <div className="font-semibold text-foreground">Example</div>
              <div>40 gal ÷ 8 GPH = 5.0 hrs endurance</div>
              <div>5.0 hrs × 120 kt GS = 600 nm range</div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => {
              onLoadExample();
              trackEvent("e6b_example_loaded", { exampleId: "wind_triangle_basics" });
              onOpenChange(false);
            }}
          >
            Try this example
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
