import { Smartphone, ArrowUpRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

type OpenInAppBannerProps = {
  title: string;
  description: string;
  deepLink: string;
  note?: string;
};

export function OpenInAppBanner({ title, description, deepLink, note }: OpenInAppBannerProps) {
  const handleOpenInApp = () => {
    trackEvent("open_in_app_click", { deepLink });
    if (typeof window === "undefined") return;
    window.location.href = deepLink;
  };

  return (
    <Alert className="border-sky-200 bg-sky-50 text-sky-950">
      <Smartphone className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <div>{description}</div>
        {note ? <div className="text-sky-900/80">{note}</div> : null}
        <Button type="button" size="sm" onClick={handleOpenInApp} className="w-fit">
          Open in RSF App
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
