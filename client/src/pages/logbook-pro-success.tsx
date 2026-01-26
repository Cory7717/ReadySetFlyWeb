import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

export default function LogbookProSuccess() {
  const [status, setStatus] = useState<string>("Processing...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionId = params.get("subscription_id") || params.get("subscriptionId");
    if (!subscriptionId) {
      setError("Missing subscription ID from PayPal.");
      setStatus("Failed");
      return;
    }
    apiRequest("GET", `/api/paypal/logbook/confirm?subscriptionId=${subscriptionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.status) {
          setStatus(`Subscription status: ${data.status}`);
        } else {
          setStatus("Subscription confirmed.");
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to confirm subscription");
        setStatus("Failed");
      });
  }, []);

  return (
    <div className="container mx-auto py-10 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Logbook Pro Activated</CardTitle>
          <CardDescription>Thanks for upgrading!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">{status}</div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <Button asChild>
            <Link href="/logbook">Go to Logbook</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
