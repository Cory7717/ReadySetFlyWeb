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
    <Alert className="border-[#5d6f85]/24 bg-[linear-gradient(180deg,rgba(20,24,31,0.98),rgba(13,17,22,0.98))] text-[#E8EDF4] shadow-[0_18px_38px_-30px_rgba(0,0,0,0.9)]">
      <Smartphone className="h-4 w-4 text-[#A9BBCD]" />
      <AlertTitle className="text-[#F5F8FC]">{title}</AlertTitle>
      <AlertDescription className="space-y-3 text-[#A9BBCD]">
        <div>{description}</div>
        {note ? <div className="text-[#8fa6c0]">{note}</div> : null}
        <Button type="button" size="sm" onClick={handleOpenInApp} className="w-fit rsf-metal-button-primary">
          Open in RSF App
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
