import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export const GOOGLE_PLAY_APP_URL = "https://play.google.com/store/apps/details?id=com.readysetfly.app";

type GooglePlayBadgeProps = {
  className?: string;
  imageClassName?: string;
  source?: string;
};

export function GooglePlayBadge({ className, imageClassName, source = "unknown" }: GooglePlayBadgeProps) {
  return (
    <a
      href={GOOGLE_PLAY_APP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download Ready Set Fly on Google Play"
      className={cn(
        "inline-flex min-h-[48px] w-full items-center justify-center rounded-[0.7rem] transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#74a7ff] focus:ring-offset-2 focus:ring-offset-[#0c1118] sm:w-fit",
        className,
      )}
      onClick={() => trackEvent("google_play_badge_click", { source, target: GOOGLE_PLAY_APP_URL })}
    >
      <img
        src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
        alt="Get it on Google Play"
        className={cn("h-14 w-auto max-w-full object-contain", imageClassName)}
      />
    </a>
  );
}
