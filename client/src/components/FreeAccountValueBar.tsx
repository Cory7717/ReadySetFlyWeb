import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";

const DISMISS_KEY = "rsf.free_account_value_bar.dismissed_until";
const DISMISS_DAYS = 7;

const HIDE_PREFIXES = [
  "/login",
  "/register",
  "/verify-email",
  "/dashboard",
  "/admin",
  "/profile",
  "/settings",
  "/messages",
  "/favorites",
  "/my-listings",
  "/marketplace/listing/checkout",
  "/rental-payment",
  "/banner-ad-payment",
  "/owner-payout-setup",
  "/owner-withdrawals",
  "/verify-identity",
  "/delete-account",
  "/notifications",
  "/404",
];

const shouldShowOnPath = (path: string) => {
  if (!path) return true;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return !HIDE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const readDismissedUntil = () => {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const writeDismissedUntil = (until: number) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISS_KEY, String(until));
  } catch {}
};

export function FreeAccountValueBar() {
  const [path, setPath] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const [dismissedUntil, setDismissedUntil] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDismissedUntil(readDismissedUntil());
    setReady(true);
  }, []);

  const visible = useMemo(() => {
    if (!ready || isLoading || isAuthenticated) return false;
    if (!shouldShowOnPath(path)) return false;
    return dismissedUntil <= Date.now();
  }, [dismissedUntil, isAuthenticated, isLoading, path, ready]);

  useEffect(() => {
    if (!visible) return;
    trackEvent("free_account_bar_shown", { page: path || "/" });
  }, [path, visible]);

  const dismiss = () => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    writeDismissedUntil(until);
    setDismissedUntil(until);
    trackEvent("free_account_bar_dismissed", { page: path || "/" });
  };

  const goToRegister = () => {
    trackEvent("free_account_bar_create_clicked", { page: path || "/" });
    setPath("/register");
  };

  const goToLogin = () => {
    trackEvent("free_account_bar_signin_clicked", { page: path || "/" });
    setPath("/login");
  };

  if (!visible) return null;

  return (
    <div className="border-b border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">Free Account Benefits</p>
            <p className="text-sm font-semibold text-slate-900">Create your free Ready Set Fly account</p>
            <p className="text-xs text-slate-700">
              Save flight plans, log flights, track training progress, and manage instructor or marketplace messages from one dashboard.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={goToRegister}>
              Create Free Account
            </Button>
            <Button size="sm" variant="outline" onClick={goToLogin}>
              Sign In
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Dismiss" onClick={dismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
