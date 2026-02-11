import { Link } from "wouter";
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
import { membershipTierInfo } from "@shared/membership-plans";

const defaultFreeFeatures = [
  "Access core tools with basic planning, logging, and summaries.",
  "Live weather and NOTAM snapshots for situational awareness.",
  "One saved plan and manual log entries with export-ready data.",
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Unlock more with RSF Pro</DialogTitle>
          <DialogDescription>
            {toolName} is ready to go. Choose to continue free or upgrade for deeper tools.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-muted-foreground/30">
            <CardHeader className="space-y-1">
              <Badge variant="outline" className="w-fit">Free</Badge>
              <CardTitle className="text-base">Continue with Free Tools</CardTitle>
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
              <Badge className="w-fit">RSF Pro</Badge>
              <CardTitle className="text-base">{membershipTierInfo.pro.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{membershipTierInfo.pro.subtitle}</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4">
                {membershipTierInfo.pro.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Button className="mt-4 w-full" asChild>
                <Link href="/logbook/pro">Upgrade to RSF Pro</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-amber-400/60">
            <CardHeader className="space-y-1">
              <Badge variant="secondary" className="w-fit">RSF Pro+</Badge>
              <CardTitle className="text-base">{membershipTierInfo.pro_plus.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{membershipTierInfo.pro_plus.subtitle}</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4">
                {membershipTierInfo.pro_plus.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Button className="mt-4 w-full" variant="outline" asChild>
                <Link href="/logbook/pro">Upgrade to Pro+</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="sm:justify-between">
          <DialogClose asChild>
            <Button variant="ghost">Continue with Free Tools</Button>
          </DialogClose>
          <div className="text-xs text-muted-foreground">
            You can upgrade anytime. Your free access stays available.
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
