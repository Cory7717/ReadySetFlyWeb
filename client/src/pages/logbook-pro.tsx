import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageShell } from "@/components/layout/PageShell";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { membershipPlanOptions, membershipTierInfo, type MembershipInterval, type MembershipTier } from "@shared/membership-plans";
import { trackEvent } from "@/lib/analytics";
import { pixelEvent } from "@/lib/pixel";
import { getSourceFromWindow } from "@/lib/returnTo";

export default function LogbookProPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<MembershipTier>("pro");
  const [selectedInterval, setSelectedInterval] = useState<MembershipInterval>("monthly");
  const [loading, setLoading] = useState(false);
  const sourcePage = getSourceFromWindow();

  useEffect(() => {
    trackEvent("upgrade_page_viewed", { page: "/logbook/pro", source_page: sourcePage });
    trackEvent("subscription_offer_viewed", { page: "/logbook/pro", source_page: sourcePage });
  }, [sourcePage]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-10">
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
        source_page: sourcePage,
        tier: selectedTier,
        interval: selectedPlan.interval,
        totalToday: selectedPlanTotal,
      });
      pixelEvent("StartTrial", {
        content_name: selectedTier === "pro_plus" ? "RSF Pro Plus Trial" : "RSF Pro Core Trial",
        currency: "USD",
        value: selectedTier === "pro_plus" ? 11.99 : 5.99,
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
    <PageShell
      kicker="Membership"
      title="Upgrade when RSF starts saving you real time."
      description="Free gets you browsing, core tools, and basic workflow. RSF Pro becomes worth it once you want saved planning, repeat-flight convenience, cleaner records, and fewer moving parts."
      actions={
        <>
          <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">14-day monthly trial</Badge>
          <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">PayPal Business/Commerce</Badge>
        </>
      }
      contentClassName="space-y-8"
    >
      <section className="rounded-[1.6rem] border border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.96),rgba(255,255,255,0.68))] p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Save plans</Badge>
              <Badge variant="outline">Track currency</Badge>
              <Badge variant="outline">Logbook continuity</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.05rem] border border-primary/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(255,255,255,0.56))] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Save your work</div>
                <div className="mt-2 text-sm text-slate-700">Keep routes, aircraft profiles, and training history from disappearing between sessions.</div>
              </div>
              <div className="rounded-[1.05rem] border border-primary/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(255,255,255,0.56))] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Stay current</div>
                <div className="mt-2 text-sm text-slate-700">Track landings, IFR recency, medical, flight review, and IPC deadlines without separate reminders.</div>
              </div>
              <div className="rounded-[1.05rem] border border-primary/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(255,255,255,0.56))] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Train with context</div>
                <div className="mt-2 text-sm text-slate-700">Keep logbook records, radio comms practice, and guided training workflows in one system.</div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-primary/16 bg-white/80 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.08)] sm:p-5">
              <span className="rsf-kicker">When pilots upgrade</span>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1rem] border border-primary/12 bg-white/78 p-4">
                  <div className="text-sm font-semibold text-slate-900">Repeat routes start piling up</div>
                  <div className="mt-2 text-xs leading-5 text-muted-foreground">
                    Pro pays off when you are rebuilding the same planning setup, notes, and aircraft assumptions more than once.
                  </div>
                </div>
                <div className="rounded-[1rem] border border-primary/12 bg-white/78 p-4">
                  <div className="text-sm font-semibold text-slate-900">Deadlines matter</div>
                  <div className="mt-2 text-xs leading-5 text-muted-foreground">
                    Alerts become valuable when medical, flight review, IPC, and landing currency need one system of record.
                  </div>
                </div>
                <div className="rounded-[1rem] border border-primary/12 bg-white/78 p-4">
                  <div className="text-sm font-semibold text-slate-900">You want continuity</div>
                  <div className="mt-2 text-xs leading-5 text-muted-foreground">
                    Saved training history, logbook depth, and cross-tool continuity matter more than one-off feature access.
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-white/12 bg-white/80 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.08)] sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="rsf-kicker">Your current plan</span>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">{currentTierLabel}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {hasAccess
                      ? isTrialing
                        ? "Your trial is active now."
                        : "Your paid membership is active."
                      : "You are currently on the free plan."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={hasAccess ? "default" : "outline"}>
                    Status: {hasAccess ? (isTrialing ? "trialing" : "active") : membershipStatus}
                  </Badge>
                  {membershipInterval && hasAccess ? (
                    <Badge variant="outline">Billing: {membershipInterval}</Badge>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 rounded-[1rem] border border-primary/14 bg-white/72 p-4">
                <div className="text-sm font-semibold">What {membershipTierInfo[selectedTier].title} changes in daily use</div>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  {membershipTierInfo[selectedTier].features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>

              {hasAccess ? (
                <div className="mt-4 space-y-2">
                  {isTrialing && membershipTrialEndsAt ? (
                    <p className="text-xs text-muted-foreground">
                      Trial ends {new Date(membershipTrialEndsAt).toLocaleDateString()}.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <Button variant="destructive" onClick={handleCancel} disabled={loading}>Cancel membership</Button>
                    <Badge variant="outline">Free tools remain available if you cancel</Badge>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 rounded-[1.4rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0.56))] p-5 shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
            <div>
              <span className="rsf-kicker">Choose a plan</span>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">Pick the point where saved workflow becomes worth paying for.</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(membershipTierInfo) as MembershipTier[]).map((tier) => {
                const monthly = membershipPlanOptions[tier].find((plan) => plan.interval === "monthly")?.price;
                return (
                  <button
                    key={tier}
                    className={`rounded-[1rem] border px-4 py-3 text-left transition-all ${
                      selectedTier === tier
                        ? "border-primary/50 bg-primary/10 shadow-[0_12px_24px_rgba(15,23,42,0.10)]"
                        : "border-primary/14 bg-white/70"
                    }`}
                    onClick={() => setSelectedTier(tier)}
                  >
                    <div className="text-sm font-semibold text-slate-900">{membershipTierInfo[tier].title}</div>
                    <div className="text-xs text-muted-foreground">{membershipTierInfo[tier].subtitle}</div>
                    {monthly !== undefined ? (
                      <div className="mt-2 text-xs text-muted-foreground">From ${monthly.toFixed(2)}/mo</div>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {hasAccess ? null : (
              <>
                <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
                  {planOptions.map((plan) => {
                    const isSelected = plan.interval === selectedInterval;
                    return (
                      <button
                        key={plan.interval}
                        className={`rounded-[1rem] border p-4 text-left transition-all ${
                          isSelected
                            ? "border-primary/50 bg-primary/10 shadow-[0_12px_24px_rgba(15,23,42,0.10)]"
                            : "border-primary/14 bg-white/72"
                        }`}
                        onClick={() => setSelectedInterval(plan.interval)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-slate-700">{plan.label}</div>
                          {plan.badge ? <Badge variant="outline">{plan.badge}</Badge> : null}
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-900">${plan.price.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">{membershipTierInfo[selectedTier].subtitle}</div>
                        {plan.trialDays ? (
                          <div className="mt-2 text-xs text-emerald-600">{plan.trialDays}-day free trial</div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <Separator />

                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="text-muted-foreground">Selected plan</div>
                    <div className="font-medium">{selectedPlan.label}</div>
                    {hasTrial ? (
                      <div className="text-xs text-muted-foreground">
                        {selectedPlan.trialDays}-day free trial — cancel before day {selectedPlan.trialDays}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground">Total today</div>
                    <div className="font-semibold">${selectedPlanTotal.toFixed(2)}</div>
                  </div>
                </div>

                <Button onClick={handleSubscribe} disabled={loading}>
                  {loading
                    ? "Redirecting..."
                    : hasTrial
                      ? "Start 14-day trial"
                      : "Start subscription"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Recurring billing applies at the selected interval.
                  {hasTrial ? " Monthly billing begins automatically after the 14-day trial unless canceled first." : ""}
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}

