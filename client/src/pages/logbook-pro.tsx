import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { membershipPlanOptions, membershipTierInfo, type MembershipInterval, type MembershipTier } from "@shared/membership-plans";
import { trackEvent } from "@/lib/analytics";

export default function LogbookProPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<MembershipTier>("pro");
  const [selectedInterval, setSelectedInterval] = useState<MembershipInterval>("monthly");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackEvent("upgrade_page_viewed", { page: "/logbook/pro" });
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-10 px-4">
        <Card>
          <CardHeader>
            <CardTitle>RSF Pro Membership</CardTitle>
            <CardDescription>Please sign in to manage membership.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const entitlements = (user as any)?.entitlements;
  const membershipTier = (user as any)?.membershipTier || entitlements?.tier || "free";
  const membershipStatus = (user as any)?.membershipStatus || "inactive";
  const membershipEndsAt = (user as any)?.membershipEndsAt || entitlements?.membershipEndsAt;
  const membershipTrialEndsAt =
    (user as any)?.membershipTrialEndsAt || entitlements?.membershipTrialEndsAt;
  const membershipInterval = (user as any)?.membershipInterval || entitlements?.membershipInterval;
  const hasAccess =
    entitlements?.tier
      ? entitlements.tier !== "free"
      : membershipStatus === "active" ||
        (membershipEndsAt && new Date(membershipEndsAt) > new Date());
  const isTrialing = membershipStatus === "trialing";

  const currentTierLabel =
    membershipTierInfo[membershipTier as MembershipTier]?.title || "Free";

  const planOptions = membershipPlanOptions[selectedTier];
  const selectedPlan = useMemo(
    () => planOptions.find((plan) => plan.interval === selectedInterval) || planOptions[0],
    [planOptions, selectedInterval]
  );
  const hasTrial = Boolean(selectedPlan?.trialDays);
  const selectedPlanTotal = hasTrial ? 0 : selectedPlan.price;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      trackEvent("subscription_checkout_started", {
        page: "/logbook/pro",
        tier: selectedTier,
        interval: selectedPlan.interval,
        totalToday: selectedPlanTotal,
      });
      const res = await apiRequest("POST", "/api/paypal/membership/subscribe", {
        tier: selectedTier,
        interval: selectedPlan.interval,
      });
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
    if (!confirm("Cancel RSF Pro? You can continue using the free tools.")) return;
    setLoading(true);
    try {
      trackEvent("subscription_cancel_requested", { page: "/logbook/pro" });
      const res = await apiRequest("POST", "/api/paypal/membership/cancel", { reason: "User cancellation" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to cancel subscription");
      }
      toast({ title: "Subscription cancelled", description: "RSF Pro is now cancelled." });
      window.location.reload();
    } catch (error: any) {
      toast({ title: "Cancellation failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 space-y-6">
      <Card>
          <CardHeader>
            <CardTitle>RSF Pro Membership</CardTitle>
            <CardDescription>
            Start with a free account for marketplace access and open tools. Upgrade when you want saved workflow, tracked records, and a 14-day paid-tier trial before billing starts.
            </CardDescription>
          </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm font-semibold">Save workflow</div>
                <p className="mt-1 text-xs text-muted-foreground">
                Keep flight plans, favorites, aircraft profiles, and training history tied together after users find what they need in RSF.
                </p>
              </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm font-semibold">Stay current</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Track landings, IFR recency, medical, flight review, and IPC dates without manual spreadsheets.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm font-semibold">Train smarter</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Unlock saved trainer history, guided workflows, and instructor-friendly records.
              </p>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="text-sm font-semibold mb-2">
              Included with {membershipTierInfo[selectedTier].title}
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
              {membershipTierInfo[selectedTier].features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={hasAccess ? "default" : "outline"}>
              Status: {hasAccess ? (isTrialing ? "trialing" : "active") : membershipStatus}
            </Badge>
            <Badge variant="secondary">Tier: {currentTierLabel}</Badge>
            {membershipInterval && hasAccess && (
              <Badge variant="outline">Billing: {membershipInterval}</Badge>
            )}
          </div>

          {hasAccess ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {isTrialing ? "Your RSF trial is active." : "Your RSF Pro membership is active."}
              </p>
              {isTrialing && membershipTrialEndsAt && (
                <p className="text-xs text-muted-foreground">
                  Trial ends {new Date(membershipTrialEndsAt).toLocaleDateString()}.
                </p>
              )}
              <Button variant="destructive" onClick={handleCancel} disabled={loading}>Cancel RSF Pro</Button>
              <p className="text-xs text-muted-foreground">
                Cancel anytime. Your free tools remain available.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                {(Object.keys(membershipTierInfo) as MembershipTier[]).map((tier) => {
                  const monthly = membershipPlanOptions[tier].find((plan) => plan.interval === "monthly")?.price;
                  return (
                  <button
                    key={tier}
                    className={`rounded-xl border px-4 py-3 text-left transition-all ${
                      selectedTier === tier ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => setSelectedTier(tier)}
                  >
                    <div className="text-sm text-muted-foreground">{membershipTierInfo[tier].title}</div>
                    <div className="text-xs text-muted-foreground">{membershipTierInfo[tier].subtitle}</div>
                    {monthly !== undefined && (
                      <div className="text-xs text-muted-foreground mt-2">From ${monthly.toFixed(2)}/mo</div>
                    )}
                  </button>
                );
              })}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {planOptions.map((plan) => {
                  const isSelected = plan.interval === selectedInterval;
                  return (
                    <button
                      key={plan.interval}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        isSelected ? "border-primary bg-primary/5" : "border-border"
                      }`}
                      onClick={() => setSelectedInterval(plan.interval)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">{plan.label}</div>
                        {plan.badge && <Badge variant="outline">{plan.badge}</Badge>}
                      </div>
                      <div className="text-2xl font-semibold">${plan.price.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">
                        {membershipTierInfo[selectedTier].subtitle}
                      </div>
                      {plan.trialDays && (
                        <div className="text-xs text-emerald-600 mt-2">
                          {plan.trialDays}-day free trial
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <Separator />

              <div className="flex items-center justify-between text-sm">
                <div>
                  <div className="text-muted-foreground">Selected plan</div>
                  <div className="font-medium">{selectedPlan.label}</div>
                  {hasTrial && (
                    <div className="text-xs text-muted-foreground">
                      {selectedPlan.trialDays}-day free trial - cancel before day {selectedPlan.trialDays}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground">Total today</div>
                  <div className="font-semibold">${selectedPlanTotal.toFixed(2)}</div>
                </div>
              </div>

              <Button onClick={handleSubscribe} disabled={loading}>
                {loading ? "Redirecting..." : hasTrial ? "Start free trial with PayPal Business/Commerce" : "Become a Member with PayPal Business/Commerce"}
              </Button>
              <p className="text-xs text-muted-foreground">
                By subscribing you agree to recurring billing at the selected interval.
                {hasTrial && " Monthly subscriptions start with a 14-day trial and convert automatically unless canceled."}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

