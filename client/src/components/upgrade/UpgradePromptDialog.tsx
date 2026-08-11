import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trackEvent } from "@/lib/analytics";
import { withSourceParam } from "@/lib/returnTo";
import { PREMIUM_ANNUAL_PRICE, PREMIUM_MONTHLY_PRICE, membershipTierInfo } from "@shared/membership-plans";

const defaultFreeFeatures = [
  "Create, save, file, amend, activate, close, and cancel flight plans.",
  "Maintain one active flight plan at a time.",
  "Keep flight history, aircraft profiles, airport data, and weather data accessible.",
];

type UpgradePromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolName: string;
  toolSummary?: string;
  freeFeatures?: string[];
};

export function UpgradePromptDialog({
  open,
  onOpenChange,
  toolName,
  toolSummary,
  freeFeatures = defaultFreeFeatures,
}: UpgradePromptDialogProps) {
  const [path] = useLocation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Unlock RSF Premium</DialogTitle>
          <DialogDescription>
            Upgrade to unlock AI tools, training tools, logbook, compliance tracking, synthetic vision, instructor tools, flight school management, and advanced aviation features.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-muted-foreground/30">
            <CardHeader className="space-y-1">
              <Badge variant="outline" className="w-fit">Free</Badge>
              <CardTitle className="text-base">Continue with Free</CardTitle>
              {toolSummary && (
                <p className="text-xs text-muted-foreground">{toolSummary}</p>
              )}
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4">
                {freeFeatures.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-primary/40">
            <CardHeader className="space-y-1">
              <Badge className="w-fit">${PREMIUM_MONTHLY_PRICE.toFixed(2)}/month or ${PREMIUM_ANNUAL_PRICE.toFixed(2)}/year</Badge>
              <CardTitle className="text-base">{membershipTierInfo.premium.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{membershipTierInfo.premium.subtitle}</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4">
                {membershipTierInfo.premium.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Button
                className="mt-4 w-full"
                asChild
                onClick={() => trackEvent("subscription_cta_click", { source_page: path || "/", target: "/membership", context: toolName, tier: "premium" })}
              >
                <Link href={withSourceParam("/membership", path || "/")}>Upgrade to Premium</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="sm:justify-between">
          <DialogClose asChild>
            <Button variant="ghost">Continue with Free</Button>
          </DialogClose>
          <div className="text-xs text-muted-foreground">
            RSF Premium is ${PREMIUM_MONTHLY_PRICE.toFixed(2)}/month or ${PREMIUM_ANNUAL_PRICE.toFixed(2)}/year.
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
