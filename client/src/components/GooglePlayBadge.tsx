import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export const GOOGLE_PLAY_APP_URL = "https://play.google.com/store/apps/details?id=com.readysetfly.app";
export const APP_STORE_APP_URL = String(import.meta.env.VITE_APP_STORE_URL || "").trim();
const APP_STORE_BADGE_URL = "https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg";

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

type AppStoreBadgeProps = {
  className?: string;
  imageClassName?: string;
  source?: string;
};

export function AppStoreBadge({ className, imageClassName, source = "unknown" }: AppStoreBadgeProps) {
  const isAvailable = APP_STORE_APP_URL.length > 0;
  const image = (
    <img
      src={APP_STORE_BADGE_URL}
      alt="Download on the App Store"
      className={cn("h-10 w-auto max-w-full object-contain", imageClassName)}
    />
  );

  if (isAvailable) {
    return (
      <a
        href={APP_STORE_APP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download Ready Set Fly on the App Store"
        className={cn(
          "inline-flex min-h-[48px] w-full items-center justify-center rounded-[0.7rem] transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#74a7ff] focus:ring-offset-2 focus:ring-offset-[#0c1118] sm:w-fit",
          className,
        )}
        onClick={() => trackEvent("app_store_badge_click", { source, target: APP_STORE_APP_URL })}
      >
        {image}
      </a>
    );
  }

  return (
    <div
      role="button"
      aria-disabled="true"
      aria-label="iPhone version coming soon"
      title="The iPhone version is currently in development."
      className={cn(
        "inline-flex min-h-[48px] w-full cursor-not-allowed flex-col items-center justify-center rounded-[0.7rem] focus:outline-none sm:w-fit",
        className,
      )}
    >
      {image}
      <span className="mt-1 rounded-full border border-[#5d6f85]/35 bg-[#141d29] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8D8EA]">
        Coming Soon
      </span>
    </div>
  );
}

type AppDownloadBadgesProps = {
  className?: string;
  badgeClassName?: string;
  rowClassName?: string;
  source?: string;
  forceRow?: boolean;
  showSupportText?: boolean;
};

export function AppDownloadBadges({
  className,
  badgeClassName,
  rowClassName,
  source = "unknown",
  forceRow = false,
  showSupportText = true,
}: AppDownloadBadgesProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn(
        forceRow
          ? "flex flex-row flex-wrap items-start justify-center gap-3"
          : "flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-center",
        rowClassName,
      )}>
        <GooglePlayBadge
          source={source}
          className={cn(forceRow ? "w-fit" : "sm:w-fit", badgeClassName)}
          imageClassName="h-14"
        />
        <AppStoreBadge
          source={source}
          className={cn(forceRow ? "w-fit" : "sm:w-fit", badgeClassName)}
          imageClassName="h-10"
        />
      </div>
      {showSupportText ? (
        <p className="text-center text-xs leading-5 text-[#A9BBCD] sm:text-left">
          Available today on Android. iPhone version coming soon.
        </p>
      ) : null}
    </div>
  );
}
