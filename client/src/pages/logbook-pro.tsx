import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const SALES_TAX_RATE = 0.0825;

const PLANS = [
  { key: "MONTHLY", label: "Monthly", price: 5.99 },
  { key: "BIANNUAL", label: "6 Months", price: 34.99 },
  { key: "YEARLY", label: "Yearly", price: 49.99 },
] as const;

function formatMoney(value: number) {
  return value.toFixed(2);
}

export default function LogbookProPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<(typeof PLANS)[number]["key"]>("MONTHLY");
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-10 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Logbook Pro</CardTitle>
            <CardDescription>Please sign in to upgrade your logbook.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const plan = PLANS.find((p) => p.key === selectedPlan)!;
  const tax = plan.price * SALES_TAX_RATE;
  const total = plan.price + tax;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/paypal/logbook/subscribe", { plan: selectedPlan });
      const data = await res.json();
      if (!res.ok || !data.approveUrl) {
        throw new Error(data.error || "Unable to start subscription");
      }
      window.location.href = data.approveUrl;
    } catch (error: any) {
      toast({ title: "Subscription failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel Logbook Pro? You can continue using the free logbook.")) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/paypal/logbook/cancel", { reason: "User cancellation" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to cancel subscription");
      }
      toast({ title: "Subscription cancelled", description: "Logbook Pro is now cancelled." });
      window.location.reload();
    } catch (error: any) {
      toast({ title: "Cancellation failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const proStatus = user?.logbookProStatus || "free";
  const isActive = proStatus === "active";

  return (
    <div className="container mx-auto py-10 px-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Logbook Pro</CardTitle>
          <CardDescription>Upgrade for advanced analytics and automation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={isActive ? "default" : "outline"}>
              Status: {proStatus}
            </Badge>
            {user?.logbookProPlan && (
              <Badge variant="secondary">Plan: {user.logbookProPlan}</Badge>
            )}
          </div>

          {isActive ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Your Logbook Pro subscription is active.
              </p>
              <Button variant="destructive" onClick={handleCancel} disabled={loading}>
                Cancel Logbook Pro
              </Button>
              <p className="text-xs text-muted-foreground">
                Cancel anytime. Your free logbook remains available.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {PLANS.map((p) => {
                  const pTax = p.price * SALES_TAX_RATE;
                  const pTotal = p.price + pTax;
                  const isSelected = p.key === selectedPlan;
                  return (
                    <button
                      key={p.key}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        isSelected ? "border-primary bg-primary/5" : "border-border"
                      }`}
                      onClick={() => setSelectedPlan(p.key)}
                    >
                      <div className="text-sm text-muted-foreground">{p.label}</div>
                      <div className="text-2xl font-semibold">${formatMoney(p.price)}</div>
                      <div className="text-xs text-muted-foreground">
                        + tax (${formatMoney(pTax)}) = ${formatMoney(pTotal)}
                      </div>
                    </button>
                  );
                })}
              </div>

              <Separator />

              <div className="flex items-center justify-between text-sm">
                <div>
                  <div className="text-muted-foreground">Selected plan</div>
                  <div className="font-medium">{plan.label}</div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground">Total today</div>
                  <div className="font-semibold">${formatMoney(total)}</div>
                </div>
              </div>

              <Button onClick={handleSubscribe} disabled={loading}>
                {loading ? "Redirecting..." : "Upgrade with PayPal"}
              </Button>
              <p className="text-xs text-muted-foreground">
                By subscribing you agree to recurring billing at the selected interval.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
