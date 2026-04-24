import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/layout/PageShell";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { membershipPlanOptions, membershipTierInfo, type MembershipInterval, type MembershipTier } from "@shared/membership-plans";
import { trackEvent } from "@/lib/analytics";
import { pixelEvent } from "@/lib/pixel";
import { getSourceFromWindow, withReturnTo } from "@/lib/returnTo";

type MembershipPartnerOfferDetails = {
  id: string;
  name: string;
  partnerName: string;
  slug: string;
  description?: string | null;
  tier: "pro" | "pro_plus";
  durationDays: number;
  acceptsFlexibleIdentifier?: boolean;
  memberInputLabel?: string;
  memberInputHint?: string;
};

export default function LogbookProPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTier, setSelectedTier] = useState<MembershipTier>("pro");
  const [selectedInterval, setSelectedInterval] = useState<MembershipInterval>("monthly");
  const [loading, setLoading] = useState(false);
  const sourcePage = getSourceFromWindow();
  const offerSlug = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("offer")?.trim().toLowerCase() || "";
  }, []);
  const claimToken = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("claim")?.trim() || "";
  }, []);
  const [partnerMemberNumber, setPartnerMemberNumber] = useState("");
  const logbookPanelClass = "rsf-metal-panel text-[#E8EDF4]";
  const logbookSubpanelClass = "rsf-logbook-subpanel rounded-[1rem] text-[#DCE6F2]";
  const logbookMetricClass = "rsf-logbook-metric px-4 py-4";
  const logbookPrimaryButtonClass = "rsf-metal-button-primary";
  const logbookSecondaryButtonClass = "rsf-metal-button-secondary";

  const {
    data: partnerOffer,
    isLoading: partnerOfferLoading,
  } = useQuery<MembershipPartnerOfferDetails>({
    queryKey: [`/api/membership-partner-offers/${offerSlug}`],
    enabled: !!offerSlug,
  });

  const clearClaimFromUrl = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("claim");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const validatePartnerOfferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/membership-partner-offers/validate-member", {
        slug: offerSlug,
        memberNumber: partnerMemberNumber,
      });
      return res.json();
    },
    onSuccess: async (data) => {
      const returnTarget = `/logbook/pro?offer=${encodeURIComponent(offerSlug)}&claim=${encodeURIComponent(
        data.claimToken
      )}`;
      window.location.href = withReturnTo("/register", returnTarget);
    },
    onError: (error: Error) => {
      toast({
        title: "Could not validate member number",
        description: error.message || "Check the member number and try again.",
        variant: "destructive",
      });
    },
  });

  const redeemPartnerOfferMutation = useMutation({
    mutationFn: async (payload?: { claimToken?: string; memberNumber?: string }) => {
      const res = await apiRequest("POST", "/api/membership-partner-offers/redeem", {
        ...(payload?.claimToken
          ? { claimToken: payload.claimToken }
          : {
              slug: offerSlug,
              memberNumber: payload?.memberNumber ?? partnerMemberNumber,
            }),
      });
      return res.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Offer redeemed",
        description: `${data.offer?.partnerName || "Partner"} unlocked ${data.offer?.tier === "pro_plus" ? "RSF Pro+" : "RSF Pro"} on this account.`,
      });
      setPartnerMemberNumber("");
      clearClaimFromUrl();
    },
    onError: (error: Error) => {
      toast({
        title: "Could not redeem offer",
        description: error.message || "Check the member number and try again.",
        variant: "destructive",
      });
      clearClaimFromUrl();
    },
  });

  useEffect(() => {
    trackEvent("upgrade_page_viewed", { page: "/logbook/pro", source_page: sourcePage });
    trackEvent("subscription_offer_viewed", { page: "/logbook/pro", source_page: sourcePage });
  }, [sourcePage]);

  useEffect(() => {
    if (!isAuthenticated || !offerSlug || !claimToken || redeemPartnerOfferMutation.isPending) return;
    if (redeemPartnerOfferMutation.isSuccess) return;
    redeemPartnerOfferMutation.mutate({ claimToken });
  }, [claimToken, isAuthenticated, offerSlug]);

  if (!isAuthenticated && !offerSlug) {
    const returnTarget = offerSlug ? `/logbook/pro?offer=${encodeURIComponent(offerSlug)}` : "/logbook/pro";
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>RSF Pro Membership</CardTitle>
            <CardDescription>
              {offerSlug
                ? "Create or sign in to a free RSF account first, then redeem your partner membership offer."
                : "Please sign in to manage membership."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <a href={withReturnTo("/register", returnTarget)}>Create free account</a>
            </Button>
            <Button asChild variant="outline">
              <a href={withReturnTo("/login", returnTarget)}>Sign in</a>
            </Button>
          </CardContent>
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
      canopyClassName="rsf-metal-hero border-b border-white/10"
      contentClassName="rsf-logbook-theme space-y-8"
    >
      <section className={`${logbookPanelClass} rounded-[1.6rem] p-5 sm:p-6`}>
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-[#5d6f85]/24 bg-[#141b24] text-[#E8EDF4]">Save plans</Badge>
              <Badge variant="outline" className="border-[#5d6f85]/24 bg-[#141b24] text-[#E8EDF4]">Track currency</Badge>
              <Badge variant="outline" className="border-[#5d6f85]/24 bg-[#141b24] text-[#E8EDF4]">Logbook continuity</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className={logbookMetricClass}>
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-[#8FA6C0]">Save your work</div>
                <div className="mt-2 text-sm text-[#DCE6F2]">Keep routes, aircraft profiles, and training history from disappearing between sessions.</div>
              </div>
              <div className={logbookMetricClass}>
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-[#8FA6C0]">Stay current</div>
                <div className="mt-2 text-sm text-[#DCE6F2]">Track landings, IFR recency, medical, flight review, and IPC deadlines without separate reminders.</div>
              </div>
              <div className={logbookMetricClass}>
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-[#8FA6C0]">Train with context</div>
                <div className="mt-2 text-sm text-[#DCE6F2]">Keep logbook records, radio comms practice, and guided training workflows in one system.</div>
              </div>
            </div>

            <div className={`${logbookSubpanelClass} p-4 sm:p-5`}>
              <span className="rsf-kicker">When pilots upgrade</span>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className={`${logbookSubpanelClass} p-4`}>
                  <div className="text-sm font-semibold text-[#F5F8FC]">Repeat routes start piling up</div>
                  <div className="mt-2 text-xs leading-5 text-[#A9BBCD]">
                    Pro pays off when you are rebuilding the same planning setup, notes, and aircraft assumptions more than once.
                  </div>
                </div>
                <div className={`${logbookSubpanelClass} p-4`}>
                  <div className="text-sm font-semibold text-[#F5F8FC]">Deadlines matter</div>
                  <div className="mt-2 text-xs leading-5 text-[#A9BBCD]">
                    Alerts become valuable when medical, flight review, IPC, and landing currency need one system of record.
                  </div>
                </div>
                <div className={`${logbookSubpanelClass} p-4`}>
                  <div className="text-sm font-semibold text-[#F5F8FC]">You want continuity</div>
                  <div className="mt-2 text-xs leading-5 text-[#A9BBCD]">
                    Saved training history, logbook depth, and cross-tool continuity matter more than one-off feature access.
                  </div>
                </div>
              </div>
            </div>

            <div className={`${logbookSubpanelClass} p-4 sm:p-5`}>
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

              <div className={`${logbookSubpanelClass} mt-4 p-4`}>
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

            {offerSlug ? (
              <div className={`${logbookSubpanelClass} p-4 sm:p-5`}>
                <span className="rsf-kicker">Partner offer</span>
                {partnerOfferLoading ? (
                  <div className="mt-3 text-sm text-[#A9BBCD]">Loading partner offer...</div>
                ) : partnerOffer ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="mt-2 text-xl font-semibold text-[#F5F8FC]">{partnerOffer.name}</h3>
                      <p className="mt-2 text-sm text-[#A9BBCD]">
                        {partnerOffer.partnerName} members can unlock {partnerOffer.tier === "pro_plus" ? "RSF Pro+" : "RSF Pro"} for {partnerOffer.durationDays} days by entering their member number below.
                      </p>
                      {partnerOffer.description ? (
                        <p className="mt-2 text-xs text-[#A9BBCD]">{partnerOffer.description}</p>
                      ) : null}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-[1rem] border border-primary/12 bg-white/70 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Tier</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">
                          {partnerOffer.tier === "pro_plus" ? "RSF Pro+" : "RSF Pro"}
                        </div>
                      </div>
                      <div className="rounded-[1rem] border border-primary/12 bg-white/70 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Length</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{partnerOffer.durationDays} days</div>
                      </div>
                      <div className="rounded-[1rem] border border-primary/12 bg-white/70 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Redemption</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">
                          {partnerOffer.acceptsFlexibleIdentifier ? "Member number or email accepted" : "One member number per account"}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="partner-member-number">{partnerOffer.memberInputLabel || "Member number"}</Label>
                      <Input
                        id="partner-member-number"
                        value={partnerMemberNumber}
                        onChange={(event) => setPartnerMemberNumber(event.target.value)}
                        placeholder={
                          partnerOffer.acceptsFlexibleIdentifier
                            ? `Enter your ${partnerOffer.partnerName} member number or email`
                            : `Enter your ${partnerOffer.partnerName} member number`
                        }
                        data-testid="input-partner-member-number"
                        disabled={Boolean(claimToken) || redeemPartnerOfferMutation.isPending}
                      />
                      <div className="text-xs text-[#8FA6C0]">
                        {partnerOffer.memberInputHint || "Spaces and dashes are ignored during verification."}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {!isAuthenticated ? (
                        <>
                          <Button
                            onClick={() => validatePartnerOfferMutation.mutate()}
                            disabled={validatePartnerOfferMutation.isPending || !partnerMemberNumber.trim()}
                            data-testid="button-redeem-partner-offer"
                          >
                            {validatePartnerOfferMutation.isPending ? "Checking..." : "Continue to free account"}
                          </Button>
                          <Button asChild variant="outline">
                            <a
                              href={withReturnTo(
                                "/login",
                                `/logbook/pro?offer=${encodeURIComponent(offerSlug)}`
                              )}
                            >
                              I already have an account
                            </a>
                          </Button>
                        </>
                      ) : claimToken ? (
                        <Badge variant="outline">Finishing your partner offer on this RSF account...</Badge>
                      ) : (
                        <Button
                          onClick={() => redeemPartnerOfferMutation.mutate({ memberNumber: partnerMemberNumber })}
                          disabled={redeemPartnerOfferMutation.isPending || !partnerMemberNumber.trim()}
                          data-testid="button-redeem-partner-offer"
                        >
                          {redeemPartnerOfferMutation.isPending ? "Redeeming..." : "Apply partner offer"}
                        </Button>
                      )}
                      <Badge variant="outline">
                        This applies a temporary RSF grant and does not start recurring billing.
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-muted-foreground">
                    This partner offer link is not active right now. Contact support if you expected access.
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className={`${logbookSubpanelClass} space-y-4 p-5`}>
            <div>
              <span className="rsf-kicker">Choose a plan</span>
              <h3 className="mt-2 text-2xl font-semibold text-[#F5F8FC]">Pick the point where saved workflow becomes worth paying for.</h3>
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

                <Button className={logbookPrimaryButtonClass} onClick={handleSubscribe} disabled={loading}>
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

