import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";
import { useLocation } from "wouter";

const HIDE_PREFIXES = [
  "/login",
  "/register",
  "/verify-email",
  "/admin",
  "/404",
];

function shouldShowOnPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return !HIDE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function normalizeDateKeyPart(value?: string | Date | null) {
  if (!value) return "unknown";
  if (value instanceof Date) return value.toISOString();
  return value;
}

function getStorageKey(userId: string, grantedAt?: string | Date | null, endsAt?: string | Date | null) {
  return `rsf.membership_grant_announcement.${userId}.${normalizeDateKeyPart(grantedAt)}.${normalizeDateKeyPart(endsAt)}`;
}

function formatGrantRemaining(endsAtRaw?: string | Date | null) {
  if (!endsAtRaw) return "a limited time";
  const endsAt = endsAtRaw instanceof Date ? endsAtRaw : new Date(endsAtRaw);
  if (Number.isNaN(endsAt.getTime())) return "a limited time";
  const diffMs = endsAt.getTime() - Date.now();
  const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  if (diffDays >= 60) {
    const months = Math.round(diffDays / 30);
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  if (diffDays >= 14) {
    const weeks = Math.round(diffDays / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

export function MembershipGrantAnnouncement() {
  const [path] = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const grantTier = ["premium", "pro", "pro_plus"].includes(String(user?.membershipGrantTier || ""))
    ? "premium"
    : null;
  const grantEndsAt = user?.membershipGrantEndsAt || null;
  const grantGrantedAt = user?.membershipGrantGrantedAt || null;
  const grantActive = useMemo(() => {
    if (!grantTier || !grantEndsAt) return false;
    const endsAt = grantEndsAt instanceof Date ? grantEndsAt : new Date(grantEndsAt);
    return !Number.isNaN(endsAt.getTime()) && endsAt.getTime() > Date.now();
  }, [grantEndsAt, grantTier]);

  const storageKey = useMemo(() => {
    if (!user?.id || !grantActive) return null;
    return getStorageKey(user.id, grantGrantedAt, grantEndsAt);
  }, [grantActive, grantEndsAt, grantGrantedAt, user?.id]);

  const visible = useMemo(() => {
    if (!ready || isLoading || !isAuthenticated || !grantActive || !storageKey) return false;
    if (!shouldShowOnPath(path || "/")) return false;
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) !== "true";
    } catch {
      return false;
    }
  }, [grantActive, isAuthenticated, isLoading, path, ready, storageKey]);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setOpen(true);
    trackEvent("membership_grant_announcement_shown", {
      page: path || "/",
      tier: grantTier,
    });
  }, [grantTier, path, visible]);

  const markSeen = (eventName: string) => {
    if (storageKey && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(storageKey, "true");
      } catch {}
    }
    setOpen(false);
    trackEvent(eventName, {
      page: path || "/",
      tier: grantTier,
    });
  };

  if (!visible || !grantTier) return null;

  const tierLabel = "RSF Premium";
  const remaining = formatGrantRemaining(grantEndsAt);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          markSeen("membership_grant_announcement_closed");
          return;
        }
        setOpen(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Account update</Badge>
            <Badge variant="outline">{tierLabel}</Badge>
          </div>
          <DialogTitle>
            RSF has granted you temporary {tierLabel} access
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Your account now includes {tierLabel} access for {remaining}.
            {grantEndsAt ? ` Access is currently scheduled to end on ${(grantEndsAt instanceof Date ? grantEndsAt : new Date(grantEndsAt)).toLocaleString()}.` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          This grant is typically used for support, issue resolution, onboarding, or limited access review.
          Your normal subscription state will remain unchanged after the grant ends.
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => markSeen("membership_grant_announcement_acknowledged")}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MembershipGrantAnnouncement;
