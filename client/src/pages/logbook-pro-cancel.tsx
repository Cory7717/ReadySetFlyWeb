import { Link } from "wouter";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { PageShell } from "@/components/layout/PageShell";

export default function LogbookProCancel() {
  useEffect(() => {
    trackEvent("subscription_checkout_cancelled", { page: "/logbook/pro/cancel" });
  }, []);

  return (
    <PageShell
      kicker="Membership"
      title="Subscription Cancelled"
      description="No changes were applied. Free logbook tools remain available on this account."
      canopyClassName="rsf-metal-hero border-b border-white/10"
      contentClassName="rsf-logbook-theme space-y-6"
    >
      <Card className="rsf-metal-panel max-w-2xl text-[#E8EDF4]">
        <CardHeader>
          <CardTitle>Subscription Cancelled</CardTitle>
          <CardDescription>You can continue using the free tools anytime.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="rsf-metal-button-secondary" asChild>
            <Link href="/logbook">Back to Logbook</Link>
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
