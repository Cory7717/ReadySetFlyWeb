import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ExternalLink, Mail } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface BannerAd {
  id: string;
  orderId?: string | null;
  title: string;
  description?: string;
  imageUrl: string;
  videoUrl?: string | null;
  videoMuted?: boolean | null;
  videoOrientation?: string | null;
  link: string;
  placements: string[];
  category?: string;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  impressions: number;
  clicks: number;
}

const contactAdvertiserSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  email: z.string().email("Valid email is required").max(255),
  phone: z.string().max(40).optional().or(z.literal("")),
  message: z.string().max(2000).optional().or(z.literal("")),
});

type ContactAdvertiserForm = z.infer<typeof contactAdvertiserSchema>;

interface BannerAdRotationProps {
  placement: string;
  category?: string;
  rotationIntervalMs?: number;
  className?: string;
}

export function BannerAdRotation({ 
  placement, 
  category,
  rotationIntervalMs = 8000,
  className = ""
}: BannerAdRotationProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactAd, setContactAd] = useState<BannerAd | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: bannerAds = [], isLoading } = useQuery<BannerAd[]>({
    queryKey: ["/api/banner-ads/active", placement, category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (placement) params.set('placement', placement);
      if (category) params.set('category', category);
      
      const response = await fetch(apiUrl(`/api/banner-ads/active?${params.toString()}`));
      if (!response.ok) {
        throw new Error('Failed to fetch banner ads');
      }
      return response.json();
    },
    staleTime: 60000,
  });

  const trackImpressionMutation = useMutation({
    mutationFn: async (bannerId: string) => {
      return apiRequest("POST", `/api/banner-ads/${bannerId}/impression`, { placement, category });
    },
  });

  const trackClickMutation = useMutation({
    mutationFn: async (bannerId: string) => {
      return apiRequest("POST", `/api/banner-ads/${bannerId}/click`, { placement, category });
    },
  });

  const contactForm = useForm<ContactAdvertiserForm>({
    resolver: zodResolver(contactAdvertiserSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      message: "",
    },
  });

  const sendContactMutation = useMutation({
    mutationFn: async (data: ContactAdvertiserForm) => {
      if (!contactAd) {
        throw new Error("No advertiser selected");
      }
      return apiRequest("POST", `/api/banner-ads/${contactAd.id}/contact`, {
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone?.trim() || undefined,
        message: data.message?.trim() || undefined,
        placement,
        category,
      });
    },
    onSuccess: () => {
      if (contactAd) {
        const page = typeof window !== "undefined" ? window.location.pathname : undefined;
        trackEvent("banner_ad_contact", {
          bannerAdId: contactAd.id,
          advertiserId: contactAd.orderId || undefined,
          placement,
          category,
          page,
        });
      }
      toast({
        title: "Message sent",
        description: "Your message was sent to the advertiser.",
      });
      setContactDialogOpen(false);
      setContactAd(null);
      const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
      contactForm.reset({
        name: fullName || "",
        email: user?.email || "",
        phone: "",
        message: "",
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to send message.";
      toast({
        title: "Message failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const currentAd = bannerAds[currentIndex];
  const isClickable = Boolean(currentAd?.link);
  const canContact = Boolean(currentAd?.orderId);
  const hasVideo = Boolean(currentAd?.videoUrl);
  const hasImage = Boolean(currentAd?.imageUrl);
  const videoOrientation = (currentAd?.videoOrientation ?? "landscape").toLowerCase();
  const isPortraitVideo = videoOrientation === "portrait";
  const isVideoMuted = currentAd?.videoMuted !== false;
  const hasBodyCopy = Boolean(currentAd?.description?.trim());
  const hasMedia = hasImage || hasVideo;
  const showHeroMedia = hasVideo || (!hasBodyCopy && hasMedia);
  const showThumbnail = hasBodyCopy && hasImage;
  const resolveObjectUrl = (value?: string | null) => {
    if (!value) return undefined;
    if (/^https?:\/\//i.test(value)) {
      try {
        const parsed = new URL(value);
        const host = parsed.hostname.toLowerCase();
        if (host.includes("amazonaws.com") || host.includes("s3.")) {
          return `${parsed.origin}${parsed.pathname}`;
        }
        const query = parsed.search.toLowerCase();
        if (query.includes("x-amz-") || query.includes("x-goog-") || query.includes("signature=")) {
          return `${parsed.origin}${parsed.pathname}`;
        }
        if (parsed.pathname.includes("/uploads/")) {
          const idx = parsed.pathname.indexOf("/uploads/");
          if (idx >= 0) {
            return apiUrl(`/objects/${parsed.pathname.slice(idx + 1)}`);
          }
        }
      } catch {
        return value.split("?")[0];
      }
      return value;
    }
    if (value.startsWith("/objects/")) return apiUrl(value);
    if (value.includes("/uploads/")) {
      const idx = value.indexOf("/uploads/");
      return apiUrl(`/objects/${value.slice(idx + 1)}`);
    }
    return value;
  };

  // Reset index and impression tracking when banner ads change
  useEffect(() => {
    if (bannerAds.length > 0) {
      setCurrentIndex(0);
      setHasTrackedImpression(false);
    }
  }, [bannerAds]);

  useEffect(() => {
    if (!contactDialogOpen) return;
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
    contactForm.reset({
      name: fullName || "",
      email: user?.email || "",
      phone: "",
      message: "",
    });
  }, [contactDialogOpen, user?.firstName, user?.lastName, user?.email]);

  // Rotate through ads
  useEffect(() => {
    if (bannerAds.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerAds.length);
      setHasTrackedImpression(false);
    }, rotationIntervalMs);

    return () => clearInterval(interval);
  }, [bannerAds.length, rotationIntervalMs]);

  // Track impression for current ad
  useEffect(() => {
    if (currentAd && !hasTrackedImpression) {
      trackImpressionMutation.mutate(currentAd.id);
      const page = typeof window !== "undefined" ? window.location.pathname : undefined;
      trackEvent("banner_ad_impression", {
        bannerAdId: currentAd.id,
        advertiserId: currentAd.orderId || undefined,
        placement,
        category,
        page,
      });
      setHasTrackedImpression(true);
    }
  }, [currentAd?.id, hasTrackedImpression]);

  // Don't render anything if no ads or still loading
  if (isLoading || !currentAd || bannerAds.length === 0) {
    return null;
  }

  const buildTrackingUrl = (link: string, bannerId: string) => {
    try {
      const url = new URL(link);
      const campaignPlacement = placement || "site";
      const contentCategory = category || "general";

      url.searchParams.set("utm_source", "readysetfly");
      url.searchParams.set("utm_medium", "banner");
      url.searchParams.set("utm_campaign", `rsf-${campaignPlacement}-banner`);
      url.searchParams.set("utm_content", `${contentCategory}-${bannerId}`);

      return url.toString();
    } catch {
      return link;
    }
  };

  const handleClick = () => {
    if (!currentAd?.link) return;
    const trackingUrl = buildTrackingUrl(currentAd.link, currentAd.id);
    trackClickMutation.mutate(currentAd.id);
    const page = typeof window !== "undefined" ? window.location.pathname : undefined;
    trackEvent("banner_ad_click", {
      bannerAdId: currentAd.id,
      advertiserId: currentAd.orderId || undefined,
      placement,
      category,
      page,
      targetUrl: currentAd.link,
    });
    window.open(trackingUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-white/80 px-4 py-3 text-sm">
        <div className="text-muted-foreground">
          Want information on becoming a sponsored business?
        </div>
        <Button asChild size="sm" variant="secondary" data-testid="button-banner-ad-info-public">
          <a href="/banner-advertise" target="_blank" rel="noreferrer">
            Click here
          </a>
        </Button>
      </div>
      <Card
        className={`group relative overflow-hidden border-0 bg-gradient-to-br from-amber-50 via-white to-sky-50 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)] transition-all duration-500 ${
          isClickable ? "cursor-pointer hover:-translate-y-0.5" : "cursor-default"
        }`}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (!isClickable) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleClick();
          }
        }}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : -1}
        data-testid={`banner-ad-${currentAd.id}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(90%_120%_at_0%_0%,rgba(14,165,233,0.18),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(110%_130%_at_100%_0%,rgba(249,115,22,0.22),transparent)]" />

        <div className={`relative grid ${showHeroMedia ? "sm:grid-cols-[1.1fr_0.9fr]" : "sm:grid-cols-1"}`}>
          <div className="flex flex-col justify-between gap-3 p-5 sm:p-6">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Sponsored
            </div>

            <div className="flex items-start gap-4">
              {showThumbnail && (
                <div className="h-32 w-32 sm:h-36 sm:w-36 rounded-xl overflow-hidden bg-muted shadow-sm flex-shrink-0">
                  <img
                    src={resolveObjectUrl(currentAd.imageUrl)}
                    alt={currentAd.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div>
                <h3 className="font-display text-lg sm:text-xl text-foreground line-clamp-2">
                  {currentAd.title}
                </h3>
                {currentAd.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                    {currentAd.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-foreground">
              {currentAd.link && (
                <span className="inline-flex items-center gap-2">
                  <span>Visit sponsor</span>
                  <ExternalLink className="h-4 w-4" />
                </span>
              )}
              {canContact && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setContactAd(currentAd);
                    setContactDialogOpen(true);
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                  }}
                  data-testid="button-contact-advertiser"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Contact advertiser
                </Button>
              )}
            </div>

            {bannerAds.length > 1 && (
              <div className="flex gap-2 pt-1">
                {bannerAds.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      index === currentIndex
                        ? "bg-foreground"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {showHeroMedia && (
            <div className="relative min-h-[150px] sm:min-h-[180px]">
              {hasVideo ? (
                <div
                  className={`h-full w-full ${isPortraitVideo ? "bg-slate-900/10 flex items-center justify-center" : ""}`}
                  onClick={(event) => {
                    if (!isVideoMuted) {
                      event.stopPropagation();
                    }
                  }}
                >
                  <video
                    src={resolveObjectUrl(currentAd.videoUrl)}
                    className={`h-full w-full ${isPortraitVideo ? "object-contain" : "object-cover"}`}
                    autoPlay
                    loop
                    muted
                    poster={resolveObjectUrl(currentAd.imageUrl)}
                    playsInline
                    controls={!isVideoMuted}
                  />
                </div>
              ) : hasImage ? (
                <img
                  src={resolveObjectUrl(currentAd.imageUrl)}
                  alt={currentAd.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-[linear-gradient(140deg,rgba(14,165,233,0.18),rgba(249,115,22,0.2))]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-transparent" />
            </div>
          )}
        </div>
      </Card>

      <Dialog
        open={contactDialogOpen}
        onOpenChange={(open) => {
          setContactDialogOpen(open);
          if (!open) {
            setContactAd(null);
          }
        }}
      >
        <DialogContent className="max-w-md" data-testid="dialog-contact-advertiser">
          <DialogHeader>
            <DialogTitle>Contact advertiser</DialogTitle>
            <DialogDescription>
              Send a message about {contactAd?.title || "this sponsor"}.
            </DialogDescription>
          </DialogHeader>
          <Form {...contactForm}>
            <form
              onSubmit={contactForm.handleSubmit((data) => sendContactMutation.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={contactForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Aviator Alex" {...field} data-testid="input-contact-advertiser-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="alex@example.com" {...field} data-testid="input-contact-advertiser-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 123-4567" {...field} data-testid="input-contact-advertiser-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Let them know how they can help..."
                        className="min-h-[120px]"
                        {...field}
                        data-testid="textarea-contact-advertiser-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setContactDialogOpen(false)}
                  data-testid="button-cancel-contact-advertiser"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={sendContactMutation.isPending}
                  data-testid="button-submit-contact-advertiser"
                >
                  {sendContactMutation.isPending ? "Sending..." : "Send message"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
