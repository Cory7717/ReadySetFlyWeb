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

        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            The wind side combines your true airspeed with the wind direction and speed to
            compute the wind correction angle (WCA), the heading to fly, and the resulting
            ground speed.
          </p>
          <p>
            The performance side handles pressure altitude, density altitude, time enroute,
            fuel burn, and range calculations. It is a mechanical flight computer translated
            into a digital workflow.
          </p>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="font-semibold text-foreground">Quick example</div>
            <div>Course 180 deg, Wind 210 deg at 15 kt, TAS 120 kt</div>
            <div className="mt-1">Result: apply a small right WCA, expect a slightly lower ground speed.</div>
          </div>
        </div>

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
