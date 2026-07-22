import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageShell } from "@/components/layout/PageShell";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  PREMIUM_ANNUAL_PRICE,
  PREMIUM_ANNUAL_SAVINGS,
  PREMIUM_ANNUAL_SAVINGS_PERCENT,
  PREMIUM_MONTHLY_PRICE,
  membershipPlanOptions,
  membershipTierInfo,
  type MembershipInterval,
  type MembershipTier,
} from "@shared/membership-plans";
import { trackEvent } from "@/lib/analytics";
import { pixelEvent } from "@/lib/pixel";
import { getSourceFromWindow, withReturnTo } from "@/lib/returnTo";
import { Calculator, DollarSign, Gauge, Scale, Wind } from "lucide-react";

type MembershipPartnerOfferDetails = {
  id: string;
  name: string;
  partnerName: string;
  slug: string;
  description?: string | null;
  tier: "premium";
  durationDays: number;
  acceptsFlexibleIdentifier?: boolean;
  memberInputLabel?: string;
  memberInputHint?: string;
};

type LogbookProPageProps = {
  offerSlugOverride?: string;
  offerBasePath?: string;
};

export default function LogbookProPage({ offerSlugOverride, offerBasePath = "/logbook/pro" }: LogbookProPageProps = {}) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTier, setSelectedTier] = useState<MembershipTier>("premium");
  const [selectedInterval, setSelectedInterval] = useState<MembershipInterval>("monthly");
  const [loading, setLoading] = useState(false);
  const [lockedPreviewTool, setLockedPreviewTool] = useState<string | null>(null);
  const sourcePage = getSourceFromWindow();
  const offerSlug = useMemo(() => {
    if (offerSlugOverride) return offerSlugOverride;
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("offer")?.trim().toLowerCase() || "";
  }, [offerSlugOverride]);
  const claimToken = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("claim")?.trim() || "";
  }, []);
  const [partnerMemberNumber, setPartnerMemberNumber] = useState("");
  const buildPartnerOfferPath = (claim?: string) => {
    const base = offerSlugOverride
      ? offerBasePath
      : `/logbook/pro?offer=${encodeURIComponent(offerSlug)}`;
    if (!claim) return base;
    return `${base}${base.includes("?") ? "&" : "?"}claim=${encodeURIComponent(claim)}`;
  };
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
      const returnTarget = buildPartnerOfferPath(data.claimToken);
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
        description: `${data.offer?.partnerName || "Partner"} unlocked RSF Premium on this account.`,
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
    const returnTarget = offerSlug ? buildPartnerOfferPath() : "/logbook/pro";
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>RSF Premium Membership</CardTitle>
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
    membershipTier === "free" ? "RSF Basic" : membershipTierInfo.premium.title;

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
        content_name: "RSF Premium",
        currency: "USD",
        value: selectedPlan.price,
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
    if (!confirm("Cancel RSF Premium? You can continue using the free tools.")) return;
    setLoading(true);
    try {
      trackEvent("subscription_cancel_requested", { page: "/logbook/pro" });
      const res = await apiRequest("POST", "/api/paypal/membership/cancel", { reason: "User cancellation" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to cancel subscription");
      }
      toast({ title: "Subscription cancelled", description: "RSF Premium is now cancelled." });
      window.location.reload();
    } catch (error: any) {
      toast({ title: "Cancellation failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLockedPreviewInteraction = (tool: string) => {
    trackEvent("premium_locked_preview_interaction", {
      page: "/logbook/pro",
      source_page: sourcePage,
      tool,
    });
    setLockedPreviewTool(tool);
  };

  return (
    <PageShell
      kicker="Membership"
      title="Simple plans for Ready Set Fly."
      description={`RSF Basic includes Flight Planner Basic. RSF Premium unlocks the complete aviation ecosystem for $${PREMIUM_MONTHLY_PRICE.toFixed(2)}/month or $${PREMIUM_ANNUAL_PRICE.toFixed(2)}/year.`}
      actions={
        <>
          <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">${PREMIUM_MONTHLY_PRICE.toFixed(2)}/month</Badge>
          <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">${PREMIUM_ANNUAL_PRICE.toFixed(2)}/year</Badge>
          <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">PayPal Business/Commerce</Badge>
        </>
      }
      canopyClassName="rsf-metal-hero border-b border-white/10"
      contentClassName="rsf-logbook-theme space-y-8"
    >
      <section className={`${logbookPanelClass} mx-auto max-w-2xl rounded-[1.6rem] p-5 sm:p-6`}>
        <div className="grid gap-5">
          <div className="hidden">
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

            {!hasAccess ? (
              <div className={`${logbookSubpanelClass} p-4 sm:p-5`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <span className="rsf-kicker">Premium EFB previews</span>
                    <h2 className="mt-2 text-2xl font-semibold text-[#F5F8FC]">Preview the tools before you upgrade.</h2>
                  </div>
                  <Badge variant="outline" className="border-[#5d6f85]/28 bg-[#141b24] text-[#A9BBCD]">
                    Click any preview
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-5">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleLockedPreviewInteraction("Density Altitude Calculator")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleLockedPreviewInteraction("Density Altitude Calculator");
                      }
                    }}
                    className={`${logbookSubpanelClass} group min-h-[17rem] p-4 text-left transition-all hover:border-[#7f98b3]/45 hover:bg-[#18212c]`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F8FC]">
                        <Gauge className="h-4 w-4 text-[#D9A441]" />
                        Density Altitude
                      </div>
                      <Badge variant="outline" className="border-[#7f6327]/40 bg-[#241c0d] text-[#F2DCA4]">Premium</Badge>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <div>
                        <Label className="text-xs text-[#8FA6C0]">Field elevation</Label>
                        <Input readOnly value="1,240 ft" onFocus={() => handleLockedPreviewInteraction("Density Altitude Calculator")} className="mt-1 border-[#5d6f85]/30 bg-[#0A0E14] text-[#DCE6F2]" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-[#8FA6C0]">Altimeter</Label>
                          <Input readOnly value="29.84" onFocus={() => handleLockedPreviewInteraction("Density Altitude Calculator")} className="mt-1 border-[#5d6f85]/30 bg-[#0A0E14] text-[#DCE6F2]" />
                        </div>
                        <div>
                          <Label className="text-xs text-[#8FA6C0]">OAT</Label>
                          <Input readOnly value="31 C" onFocus={() => handleLockedPreviewInteraction("Density Altitude Calculator")} className="mt-1 border-[#5d6f85]/30 bg-[#0A0E14] text-[#DCE6F2]" />
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#5d6f85]/22 bg-[#0A0E14] p-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-[#8FA6C0]">Density altitude</div>
                        <div className="mt-1 text-2xl font-semibold text-[#F5F8FC]">3,780 ft</div>
                      </div>
                      <Button type="button" className={logbookSecondaryButtonClass}>Calculate</Button>
                    </div>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleLockedPreviewInteraction("Crosswind Calculator")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleLockedPreviewInteraction("Crosswind Calculator");
                      }
                    }}
                    className={`${logbookSubpanelClass} group min-h-[17rem] p-4 text-left transition-all hover:border-[#7f98b3]/45 hover:bg-[#18212c]`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F8FC]">
                        <Wind className="h-4 w-4 text-[#D9A441]" />
                        Crosswind
                      </div>
                      <Badge variant="outline" className="border-[#7f6327]/40 bg-[#241c0d] text-[#F2DCA4]">Premium</Badge>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-[#8FA6C0]">Runway</Label>
                          <Input readOnly value="180 deg" onFocus={() => handleLockedPreviewInteraction("Crosswind Calculator")} className="mt-1 border-[#5d6f85]/30 bg-[#0A0E14] text-[#DCE6F2]" />
                        </div>
                        <div>
                          <Label className="text-xs text-[#8FA6C0]">Wind</Label>
                          <Input readOnly value="220 / 18" onFocus={() => handleLockedPreviewInteraction("Crosswind Calculator")} className="mt-1 border-[#5d6f85]/30 bg-[#0A0E14] text-[#DCE6F2]" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-[#5d6f85]/22 bg-[#0A0E14] p-3">
                          <div className="text-xs text-[#8FA6C0]">Crosswind</div>
                          <div className="mt-1 text-xl font-semibold text-[#F5F8FC]">11.6 kt</div>
                        </div>
                        <div className="rounded-lg border border-[#5d6f85]/22 bg-[#0A0E14] p-3">
                          <div className="text-xs text-[#8FA6C0]">Headwind</div>
                          <div className="mt-1 text-xl font-semibold text-[#F5F8FC]">13.8 kt</div>
                        </div>
                      </div>
                      <div className="h-16 rounded-lg border border-[#5d6f85]/22 bg-[#0A0E14] p-3">
                        <div className="relative h-full rounded border border-[#7f98b3]/24 bg-[linear-gradient(90deg,rgba(9,13,19,0.98),rgba(18,25,34,0.98))]">
                          <div className="absolute left-1/2 top-1/2 h-12 w-2 -translate-x-1/2 -translate-y-1/2 rounded bg-[#DCE6F2]/70" />
                          <div className="absolute left-[58%] top-[28%] h-0.5 w-12 rotate-[28deg] rounded bg-[#D9A441]" />
                        </div>
                      </div>
                      <Button type="button" className={logbookSecondaryButtonClass}>Compute wind</Button>
                    </div>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleLockedPreviewInteraction("Weight & Balance Calculator")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleLockedPreviewInteraction("Weight & Balance Calculator");
                      }
                    }}
                    className={`${logbookSubpanelClass} group min-h-[17rem] p-4 text-left transition-all hover:border-[#7f98b3]/45 hover:bg-[#18212c]`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F8FC]">
                        <Scale className="h-4 w-4 text-[#D9A441]" />
                        Weight & Balance
                      </div>
                      <Badge variant="outline" className="border-[#7f6327]/40 bg-[#241c0d] text-[#F2DCA4]">Premium</Badge>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-[#8FA6C0]">Pilot</Label>
                          <Input readOnly value="185 lb" onFocus={() => handleLockedPreviewInteraction("Weight & Balance Calculator")} className="mt-1 border-[#5d6f85]/30 bg-[#0A0E14] text-[#DCE6F2]" />
                        </div>
                        <div>
                          <Label className="text-xs text-[#8FA6C0]">Fuel</Label>
                          <Input readOnly value="38 gal" onFocus={() => handleLockedPreviewInteraction("Weight & Balance Calculator")} className="mt-1 border-[#5d6f85]/30 bg-[#0A0E14] text-[#DCE6F2]" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-[#5d6f85]/22 bg-[#0A0E14] p-3">
                          <div className="text-xs text-[#8FA6C0]">Takeoff CG</div>
                          <div className="mt-1 text-xl font-semibold text-[#F5F8FC]">42.8 in</div>
                        </div>
                        <div className="rounded-lg border border-[#5d6f85]/22 bg-[#0A0E14] p-3">
                          <div className="text-xs text-[#8FA6C0]">Weight</div>
                          <div className="mt-1 text-xl font-semibold text-[#F5F8FC]">2,248 lb</div>
                        </div>
                      </div>
                      <div className="h-16 rounded-lg border border-[#5d6f85]/22 bg-[linear-gradient(135deg,rgba(16,23,31,0.98),rgba(9,13,19,0.98))] p-3">
                        <div className="h-full rounded border border-[#7f98b3]/24 bg-[#0A0E14]">
                          <div className="ml-[54%] mt-5 h-3 w-3 rounded-full bg-[#D9A441] shadow-[0_0_18px_rgba(217,164,65,0.45)]" />
                        </div>
                      </div>
                      <Button type="button" className={logbookSecondaryButtonClass}>Check envelope</Button>
                    </div>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleLockedPreviewInteraction("E6B Flight Computer")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleLockedPreviewInteraction("E6B Flight Computer");
                      }
                    }}
                    className={`${logbookSubpanelClass} group min-h-[17rem] p-4 text-left transition-all hover:border-[#7f98b3]/45 hover:bg-[#18212c]`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F8FC]">
                        <Calculator className="h-4 w-4 text-[#D9A441]" />
                        E6B Flight Computer
                      </div>
                      <Badge variant="outline" className="border-[#7f6327]/40 bg-[#241c0d] text-[#F2DCA4]">Premium</Badge>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-[#8FA6C0]">Course</Label>
                          <Input readOnly value="182 deg" onFocus={() => handleLockedPreviewInteraction("E6B Flight Computer")} className="mt-1 border-[#5d6f85]/30 bg-[#0A0E14] text-[#DCE6F2]" />
                        </div>
                        <div>
                          <Label className="text-xs text-[#8FA6C0]">Wind</Label>
                          <Input readOnly value="220 / 18" onFocus={() => handleLockedPreviewInteraction("E6B Flight Computer")} className="mt-1 border-[#5d6f85]/30 bg-[#0A0E14] text-[#DCE6F2]" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg border border-[#5d6f85]/22 bg-[#0A0E14] p-3">
                          <div className="text-xs text-[#8FA6C0]">WCA</div>
                          <div className="mt-1 text-lg font-semibold text-[#F5F8FC]">6R</div>
                        </div>
                        <div className="rounded-lg border border-[#5d6f85]/22 bg-[#0A0E14] p-3">
                          <div className="text-xs text-[#8FA6C0]">GS</div>
                          <div className="mt-1 text-lg font-semibold text-[#F5F8FC]">112</div>
                        </div>
                        <div className="rounded-lg border border-[#5d6f85]/22 bg-[#0A0E14] p-3">
                          <div className="text-xs text-[#8FA6C0]">Fuel</div>
                          <div className="mt-1 text-lg font-semibold text-[#F5F8FC]">8.7</div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#5d6f85]/22 bg-[#0A0E14] p-3 text-xs leading-5 text-[#A9BBCD]">
                        Save custom output sets, copy results, and keep EFB settings across sessions.
                      </div>
                      <Button type="button" className={logbookSecondaryButtonClass}>Run E6B</Button>
                    </div>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleLockedPreviewInteraction("Cost of Ownership Calculator")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleLockedPreviewInteraction("Cost of Ownership Calculator");
                      }
                    }}
                    className={`${logbookSubpanelClass} group min-h-[17rem] p-4 text-left transition-all hover:border-[#7f98b3]/45 hover:bg-[#18212c]`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F8FC]">
                        <DollarSign className="h-4 w-4 text-[#D9A441]" />
                        Ownership Cost
                      </div>
                      <Badge variant="outline" className="border-[#7f6327]/40 bg-[#241c0d] text-[#F2DCA4]">Premium</Badge>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-[#8FA6C0]">Fixed costs</Label>
                          <Input readOnly value="$12,400" onFocus={() => handleLockedPreviewInteraction("Cost of Ownership Calculator")} className="mt-1 border-[#5d6f85]/30 bg-[#0A0E14] text-[#DCE6F2]" />
                        </div>
                        <div>
                          <Label className="text-xs text-[#8FA6C0]">Hours / yr</Label>
                          <Input readOnly value="95" onFocus={() => handleLockedPreviewInteraction("Cost of Ownership Calculator")} className="mt-1 border-[#5d6f85]/30 bg-[#0A0E14] text-[#DCE6F2]" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-[#5d6f85]/22 bg-[#0A0E14] p-3">
                          <div className="text-xs text-[#8FA6C0]">Hourly cost</div>
                          <div className="mt-1 text-xl font-semibold text-[#F5F8FC]">$168</div>
                        </div>
                        <div className="rounded-lg border border-[#5d6f85]/22 bg-[#0A0E14] p-3">
                          <div className="text-xs text-[#8FA6C0]">Annual total</div>
                          <div className="mt-1 text-xl font-semibold text-[#F5F8FC]">$15.9k</div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#5d6f85]/22 bg-[#0A0E14] p-3 text-xs leading-5 text-[#A9BBCD]">
                        Compare fixed, variable, reserve, fuel, hangar, insurance, and maintenance assumptions.
                      </div>
                      <Button type="button" className={logbookSecondaryButtonClass}>Estimate cost</Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className={`${logbookSubpanelClass} p-4 sm:p-5`}>
              <span className="rsf-kicker">When pilots upgrade</span>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className={`${logbookSubpanelClass} p-4`}>
                  <div className="text-sm font-semibold text-[#F5F8FC]">Repeat routes start piling up</div>
                  <div className="mt-2 text-xs leading-5 text-[#A9BBCD]">
                    Premium pays off when you are rebuilding the same planning setup, notes, and aircraft assumptions more than once.
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
                  <h2 className="mt-2 text-2xl font-semibold text-[#F5F8FC]">{currentTierLabel}</h2>
                  <p className="mt-2 text-sm text-[#A9BBCD]">
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
                <div className="text-sm font-semibold">What {membershipTierInfo.premium.title} changes in daily use</div>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-[#A9BBCD]">
                  {membershipTierInfo.premium.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>

              {hasAccess ? (
                <div className="mt-4 space-y-2">
                  {isTrialing && membershipTrialEndsAt ? (
                    <p className="text-xs text-[#A9BBCD]">
                      Trial ends {new Date(membershipTrialEndsAt).toLocaleDateString()}.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <Button variant="destructive" onClick={handleCancel} disabled={loading}>Cancel Premium</Button>
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
                        {partnerOffer.partnerName} members can unlock RSF Premium for {partnerOffer.durationDays} days by entering their member number below.
                      </p>
                      {partnerOffer.description ? (
                        <p className="mt-2 text-xs text-[#A9BBCD]">{partnerOffer.description}</p>
                      ) : null}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-[1rem] border border-[#5d6f85]/28 bg-[#121923] p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-[#8FA6C0]">Tier</div>
                        <div className="mt-2 text-sm font-semibold text-[#F5F8FC]">
                          RSF Premium
                        </div>
                      </div>
                      <div className="rounded-[1rem] border border-[#5d6f85]/28 bg-[#121923] p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-[#8FA6C0]">Length</div>
                        <div className="mt-2 text-sm font-semibold text-[#F5F8FC]">{partnerOffer.durationDays} days</div>
                      </div>
                      <div className="rounded-[1rem] border border-[#5d6f85]/28 bg-[#121923] p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-[#8FA6C0]">Redemption</div>
                        <div className="mt-2 text-sm font-semibold text-[#F5F8FC]">
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
                                buildPartnerOfferPath()
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
                        This applies temporary RSF Premium access and does not start recurring billing.
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-[#A9BBCD]">
                    This partner offer link is not active right now. Contact support if you expected access.
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className={`${logbookSubpanelClass} space-y-4 p-5`}>
            <div>
              <span className="rsf-kicker">Choose a plan</span>
              <h3 className="mt-2 text-2xl font-semibold text-[#F5F8FC]">Choose Free or RSF Premium.</h3>
            </div>
            <div className="grid gap-3">
              <div className="rounded-[1rem] border border-[#5d6f85]/28 bg-[#121923] px-4 py-3 text-left">
                <div className="text-sm font-semibold text-[#F5F8FC]">Free</div>
                <div className="text-xs text-[#A9BBCD]">Plan and file flights with RSF Flight Planner Basic.</div>
                <div className="mt-2 text-xs font-medium text-[#C9D6E4]">Free</div>
              </div>
              <div className="rounded-[1rem] border border-[#4f7cff]/55 bg-[#18263a] px-4 py-3 text-left shadow-[0_12px_24px_rgba(4,11,22,0.24)]">
                <div className="text-sm font-semibold text-[#F5F8FC]">{membershipTierInfo.premium.title}</div>
                <div className="text-xs text-[#C7D7EA]">{membershipTierInfo.premium.subtitle}</div>
                <div className="mt-2 text-xs font-medium text-[#D9E4F0]">${PREMIUM_MONTHLY_PRICE.toFixed(2)}/month or ${PREMIUM_ANNUAL_PRICE.toFixed(2)}/year</div>
              </div>
            </div>

            {hasAccess ? null : (
              <>
                <div className="grid gap-4">
                  {planOptions.map((plan) => {
                    const isSelected = plan.interval === selectedInterval;
                    return (
                      <button
                        key={plan.interval}
                        className={`rounded-[1rem] border p-4 text-left transition-all ${
                          isSelected
                            ? "border-[#4f7cff]/60 bg-[#18263a] shadow-[0_12px_24px_rgba(4,11,22,0.24)]"
                            : "border-[#5d6f85]/28 bg-[#121923]"
                        }`}
                        onClick={() => setSelectedInterval(plan.interval)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-[#C7D7EA]">{plan.label}</div>
                          {plan.badge ? <Badge variant="outline">{plan.badge}</Badge> : null}
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-[#F5F8FC]">${plan.price.toFixed(2)}</div>
                        <div className="text-xs text-[#A9BBCD]">
                          {plan.interval === "annual"
                            ? `Save $${PREMIUM_ANNUAL_SAVINGS.toFixed(2)} per year, about ${PREMIUM_ANNUAL_SAVINGS_PERCENT}% off monthly billing.`
                            : membershipTierInfo.premium.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Separator />

                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="text-[#A9BBCD]">Selected plan</div>
                    <div className="font-medium text-[#F5F8FC]">{selectedPlan.label}</div>
                    {hasTrial ? (
                      <div className="text-xs text-[#A9BBCD]">
                        {selectedPlan.trialDays}-day free trial — cancel before day {selectedPlan.trialDays}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div className="text-[#A9BBCD]">Total today</div>
                    <div className="font-semibold text-[#F5F8FC]">${selectedPlanTotal.toFixed(2)}</div>
                  </div>
                </div>

                <Button className={logbookPrimaryButtonClass} onClick={handleSubscribe} disabled={loading}>
                  {loading ? "Redirecting..." : "Upgrade to Premium"}
                </Button>
                <p className="text-xs text-[#A9BBCD]">
                  Recurring billing is ${selectedPlan.interval === "annual" ? `$${PREMIUM_ANNUAL_PRICE.toFixed(2)}/year` : `$${PREMIUM_MONTHLY_PRICE.toFixed(2)}/month`} until cancelled.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <Dialog open={Boolean(lockedPreviewTool)} onOpenChange={(open) => !open && setLockedPreviewTool(null)}>
        <DialogContent className="rsf-logbook-theme rsf-metal-panel border-[#5d6f85]/30 text-[#E8EDF4] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#F5F8FC]">{lockedPreviewTool || "Premium tool"}</DialogTitle>
            <DialogDescription className="text-[#A9BBCD]">
              This is available for RSF Premium subscribers. Upgrade to use the full calculator with live inputs, saved settings, and connected RSF workflow support.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-[1rem] border border-[#5d6f85]/24 bg-[#101720] p-4 text-sm text-[#DCE6F2]">
            The preview shows the tool surface and result layout. Premium unlocks interaction, calculation, copying, and saved continuity across RSF.
          </div>
          <DialogFooter>
            {isAuthenticated ? (
              <Button className={logbookPrimaryButtonClass} onClick={handleSubscribe} disabled={loading}>
                {loading ? "Redirecting..." : "Subscribe to Premium"}
              </Button>
            ) : (
              <Button asChild className={logbookPrimaryButtonClass}>
                <a href={withReturnTo("/register", "/logbook/pro")}>Subscribe to Premium</a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

