import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Gift, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";
import { withReturnTo } from "@/lib/returnTo";

const PENDING_PROMO_KEY = "rsf.pendingMembershipPromoCode";

export default function RedeemPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const urlCode = useMemo(() => new URLSearchParams(window.location.search).get("code") || "", []);
  const [code, setCode] = useState(() => urlCode || localStorage.getItem(PENDING_PROMO_KEY) || "");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("membership_promo_redeem_page_viewed", { authenticated: isAuthenticated });
  }, [isAuthenticated]);

  useEffect(() => {
    if (urlCode) {
      localStorage.setItem(PENDING_PROMO_KEY, urlCode);
    }
  }, [urlCode]);

  const redeemMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/membership-promotions/redeem", { code });
      return await res.json();
    },
    onSuccess: (data) => {
      localStorage.removeItem(PENDING_PROMO_KEY);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setSuccessMessage(data.message || data.promotion?.successMessage || "Your promo code was redeemed successfully.");
    },
  });

  const startGoogle = () => {
    if (code.trim()) localStorage.setItem(PENDING_PROMO_KEY, code.trim());
    window.location.href = apiUrl(withReturnTo("/api/auth/google", "/redeem"));
  };

  const startEmailSignup = () => {
    if (code.trim()) localStorage.setItem(PENDING_PROMO_KEY, code.trim());
    setLocation(`/register?code=${encodeURIComponent(code.trim())}&returnTo=${encodeURIComponent("/redeem")}`);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_34%),linear-gradient(135deg,#f8fafc,#eef6ff_54%,#ffffff)] px-4 py-10">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
            <Gift className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-3xl font-bold">Redeem RSF Premium access</h1>
          <p className="mt-3 text-sm leading-6 text-slate-200">
            Create or sign in to your Ready Set Fly account, enter your partner, event, or giveaway code, and RSF will apply the membership benefit the code is valid for.
          </p>
          <div className="mt-6 space-y-3 text-sm text-slate-100">
            <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4" /> Codes are redeemed server-side against your account.</div>
            <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4" /> Complimentary access does not create or alter a PayPal subscription.</div>
            <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4" /> Your account remains eligible for normal billing later.</div>
          </div>
        </section>

        <Card className="border-white/80 bg-white/95 shadow-xl">
          <CardHeader>
            <CardTitle>Promo or invitation code</CardTitle>
            <CardDescription>
              Have a partner, event, or giveaway code? Enter it here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="redeem-code">Code</Label>
              <Input
                id="redeem-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Enter your code"
                data-testid="input-redeem-code"
              />
            </div>

            {successMessage && (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            {redeemMutation.error && (
              <Alert variant="destructive">
                <AlertDescription>{(redeemMutation.error as Error).message}</AlertDescription>
              </Alert>
            )}

            {isLoading ? (
              <div className="text-sm text-muted-foreground">Checking your account...</div>
            ) : isAuthenticated ? (
              <Button
                className="w-full"
                disabled={!code.trim() || redeemMutation.isPending}
                onClick={() => redeemMutation.mutate()}
                data-testid="button-redeem-code"
              >
                {redeemMutation.isPending ? "Redeeming..." : "Redeem code"}
              </Button>
            ) : (
              <div className="space-y-3">
                <Button className="w-full" onClick={startGoogle} data-testid="button-redeem-google">
                  Continue with Google
                </Button>
                <Button variant="outline" className="w-full" onClick={startEmailSignup} data-testid="button-redeem-register">
                  Create account with email
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setLocation("/login?returnTo=%2Fredeem")}>
                  Already have an account? Sign in
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
