import { Button } from "@/components/ui/button";
import { BannerAdRotation } from "@/components/banners/BannerAdRotation";
import { cn } from "@/lib/utils";

type SponsoredRightRailProps = {
  placement: string;
  category?: string;
  className?: string;
  infoTestId?: string;
};

export function SponsoredRightRail({
  placement,
  category,
  className,
  infoTestId = "button-banner-ad-info-public",
}: SponsoredRightRailProps) {
  return (
    <aside className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-white/80 px-4 py-3 text-sm">
        <div className="text-muted-foreground">
          Want information on becoming a sponsored business?
        </div>
        <Button asChild size="sm" variant="secondary" data-testid={infoTestId}>
          <a href="/banner-advertise" target="_blank" rel="noopener noreferrer">
            Click here
          </a>
        </Button>
      </div>
      <BannerAdRotation
        placement={placement}
        category={category}
        variant="compact"
        showLeadIn={false}
      />
    </aside>
  );
}
