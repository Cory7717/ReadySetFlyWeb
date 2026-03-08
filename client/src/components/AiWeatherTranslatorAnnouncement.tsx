import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
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

const ANNOUNCEMENT_KEY = "rsf.ai_weather_translator_announcement_seen_v1";

const HIDE_PREFIXES = [
  "/login",
  "/register",
  "/verify-email",
  "/admin",
  "/dashboard",
  "/settings",
  "/messages",
  "/marketplace/listing/checkout",
  "/rental-payment",
  "/banner-ad-payment",
  "/404",
];

function shouldShowOnPath(path: string) {
  if (!path) return true;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return !HIDE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function hasSeenAnnouncement() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(ANNOUNCEMENT_KEY) === "true";
  } catch {
    return true;
  }
}

function markAnnouncementSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANNOUNCEMENT_KEY, "true");
  } catch {}
}

export function AiWeatherTranslatorAnnouncement() {
  const [path, setPath] = useLocation();
  const { isLoading, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const visible = useMemo(() => {
    if (!ready || isLoading) return false;
    if (!shouldShowOnPath(path)) return false;
    return !hasSeenAnnouncement();
  }, [isLoading, path, ready]);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setOpen(true);
    trackEvent("ai_weather_announcement_shown", {
      page: path || "/",
      authenticated: isAuthenticated,
    });
  }, [isAuthenticated, path, visible]);

  const dismiss = () => {
    markAnnouncementSeen();
    setOpen(false);
    trackEvent("ai_weather_announcement_dismissed", { page: path || "/" });
  };

  const closeFromDialog = () => {
    markAnnouncementSeen();
    setOpen(false);
    trackEvent("ai_weather_announcement_closed", { page: path || "/" });
  };

  const openWeatherTools = () => {
    markAnnouncementSeen();
    setOpen(false);
    trackEvent("ai_weather_announcement_clicked", {
      page: path || "/",
      target: "/aviation-weather",
    });
    setPath("/aviation-weather");
  };

  if (!ready || !visible) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next) {
        closeFromDialog();
        return;
      }
      setOpen(next);
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">New</Badge>
            <Badge variant="outline">AI Weather Assistant</Badge>
          </div>
          <DialogTitle>
            AI-assisted translation is now available for METAR, TAF, and NOTAM briefings
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            RSF now offers a professional plain-English assist layer inside Current Conditions and Airport Briefing.
            Use it to translate raw METARs, TAFs, and NOTAMs faster, then verify with official sources before flight.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          Look for the AI summary and AI translator toggles directly inside the weather and NOTAM cards across RSF.
          {!isAuthenticated ? " Sign in to generate AI output." : ""}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={dismiss}>
            Dismiss
          </Button>
          <Button type="button" onClick={openWeatherTools}>
            Open weather tools
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AiWeatherTranslatorAnnouncement;
