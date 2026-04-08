import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import { PageShell } from "@/components/layout/PageShell";

export default function LogbookProSuccess() {
  const [status, setStatus] = useState<string>("Processing...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionId = params.get("subscription_id") || params.get("subscriptionId");
    if (!subscriptionId) {
      trackEvent("subscription_confirm_failed", { reason: "missing_subscription_id" });
      setError("Missing subscription ID from PayPal Business/Commerce.");
      setStatus("Failed");
      return;
    }
    apiRequest("GET", `/api/paypal/membership/confirm?subscriptionId=${subscriptionId}`)
      .then((res) => res.json())
      .then((data) => {
        trackEvent("subscription_confirmed", { status: data?.status || "confirmed" });
        if (data?.status) {
          setStatus(`Subscription status: ${data.status}`);
        } else {
          setStatus("Subscription confirmed.");
        }
      })
      .catch((err) => {
        trackEvent("subscription_confirm_failed", { reason: err.message || "unknown" });
        setError(err.message || "Failed to confirm subscription");
        setStatus("Failed");
      });
  }, []);

  return (
    <PageShell
      kicker="Membership"
      title="RSF Pro Activated"
      description="Membership confirmation is complete. Your upgraded logbook workflow is ready."
      canopyClassName="rsf-metal-hero border-b border-white/10"
      contentClassName="rsf-logbook-theme space-y-6"
    >
      <Card className="rsf-metal-panel max-w-2xl text-[#E8EDF4]">
        <CardHeader>
          <CardTitle>RSF Pro Activated</CardTitle>
          <CardDescription>Thanks for upgrading!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">{status}</div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <Button className="rsf-metal-button-primary" asChild>
            <Link href="/logbook">Go to Logbook</Link>
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
