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
import { membershipTierInfo } from "@shared/membership-plans";

const defaultFreeFeatures = [
  "Use core planning and logging with basic summaries.",
  "Live weather + NOTAM snapshots for situational awareness.",
  "Limited saves (single plan) and manual log entries.",
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
          <DialogTitle>Keep the workflow, upgrade the outcome.</DialogTitle>
          <DialogDescription>
            {toolName} works free. RSF Pro and Pro+ become worth it when you want saved time, repeat-use convenience, and cleaner records.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
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
              <Button
                className="mt-4 w-full"
                asChild
                onClick={() => trackEvent("subscription_cta_click", { source_page: path || "/", target: "/logbook/pro", context: toolName, tier: "pro" })}
              >
                <Link href={withSourceParam("/logbook/pro", path || "/")}>See Pro workflow value</Link>
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
              <Button
                className="mt-4 w-full"
                variant="outline"
                asChild
                onClick={() => trackEvent("subscription_cta_click", { source_page: path || "/", target: "/logbook/pro", context: toolName, tier: "pro_plus" })}
              >
                <Link href={withSourceParam("/logbook/pro", path || "/")}>Compare Pro+</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="sm:justify-between">
          <DialogClose asChild>
            <Button variant="ghost">Continue with Free</Button>
          </DialogClose>
          <div className="text-xs text-muted-foreground">
            Upgrade once repeat flights, saved history, and cleaner records are worth paying for.
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
