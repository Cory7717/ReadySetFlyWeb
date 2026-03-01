import { Link } from "wouter";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

export default function LogbookProCancel() {
  useEffect(() => {
    trackEvent("subscription_checkout_cancelled", { page: "/logbook/pro/cancel" });
  }, []);

  return (
    <div className="container mx-auto py-10 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Subscription Cancelled</CardTitle>
          <CardDescription>You can continue using the free tools anytime.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/logbook">Back to Logbook</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
