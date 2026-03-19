import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { getCurrentReturnTo, withReturnTo } from "@/lib/returnTo";
import { dismissSignupBanner, isSoftAuthEnabled, shouldShowSignupBanner } from "@/utils/anonUsage";

export function SignupNudgeBanner() {
  const { isAuthenticated } = useAuth();
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const shownRef = useRef(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!isSoftAuthEnabled() || isAuthenticated) return;
    startRef.current = Date.now();
    const handleUsage = () => {
      if (shownRef.current) return;
      if (shouldShowSignupBanner(Date.now() - startRef.current)) {
        shownRef.current = true;
        setReady(true);
        setVisible(true);
        trackEvent("signup_banner_shown");
      }
    };
    const timer = window.setTimeout(handleUsage, 60_000);
    window.addEventListener("rsf_anon_usage", handleUsage);
    handleUsage();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("rsf_anon_usage", handleUsage);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      handleDismiss();
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, [visible]);

  const handleDismiss = () => {
    if (!visible) return;
    dismissSignupBanner(7);
    setVisible(false);
    trackEvent("signup_banner_dismissed");
  };

  const handleSignup = () => {
    trackEvent("signup_banner_clicked");
    window.location.href = apiUrl(withReturnTo("/api/auth/google", getCurrentReturnTo()));
  };

  if (!isSoftAuthEnabled() || isAuthenticated || !ready) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[90]">
      <Card
        className={`w-[320px] p-4 shadow-lg transition-all duration-300 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Keep Your Workflow Moving</div>
            <p className="text-xs text-muted-foreground mt-1">
              Create a free account to save plans, keep your logbook tied together, and return to the same tools later.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" className="flex-1" onClick={handleSignup}>
            Continue with Google
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            Maybe Later
          </Button>
        </div>
      </Card>
    </div>
  );
}
