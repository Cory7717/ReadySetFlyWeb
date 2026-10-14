import { useEffect, useRef, useState, type RefObject } from "react";

const DEFAULT_VISIBLE_RATIO = 0.5;
const DEFAULT_VISIBLE_DURATION_MS = 1000;

type TimerHandle = ReturnType<typeof setTimeout>;

type QualifiedExposureTrackerOptions = {
  visibleDurationMs?: number;
  schedule?: (callback: () => void, delayMs: number) => TimerHandle;
  cancel?: (timer: TimerHandle) => void;
  onQualified: (exposureKey: string) => void | Promise<void>;
};

/**
 * Small state machine kept separate from the browser observer so qualification
 * timing, cancellation, and deduplication can be tested deterministically.
 */
export function createQualifiedExposureTracker({
  visibleDurationMs = DEFAULT_VISIBLE_DURATION_MS,
  schedule = (callback, delayMs) => setTimeout(callback, delayMs),
  cancel = (timer) => clearTimeout(timer),
  onQualified,
}: QualifiedExposureTrackerOptions) {
  let exposureKey: string | null = null;
  let elementVisible = false;
  let documentVisible = false;
  let pendingTimer: TimerHandle | null = null;
  const submittedExposures = new Set<string>();

  const cancelPending = () => {
    if (pendingTimer !== null) {
      cancel(pendingTimer);
      pendingTimer = null;
    }
  };

  const evaluate = () => {
    if (
      !exposureKey ||
      !elementVisible ||
      !documentVisible ||
      pendingTimer !== null ||
      submittedExposures.has(exposureKey)
    ) {
      return;
    }

    const scheduledKey = exposureKey;
    pendingTimer = schedule(() => {
      pendingTimer = null;
      if (
        exposureKey !== scheduledKey ||
        !elementVisible ||
        !documentVisible ||
        submittedExposures.has(scheduledKey)
      ) {
        return;
      }

      // Mark before starting asynchronous work so observer callbacks, React
      // effects, and rapid visibility changes cannot submit the same exposure.
      submittedExposures.add(scheduledKey);
      void Promise.resolve(onQualified(scheduledKey)).catch((error) => {
        console.error("Failed to track qualified banner impression:", error);
      });
    }, visibleDurationMs);
  };

  return {
    setExposure(nextExposureKey: string | null) {
      if (nextExposureKey === exposureKey) return;
      cancelPending();
      exposureKey = nextExposureKey;
      elementVisible = false;
      evaluate();
    },
    setElementVisible(visible: boolean) {
      elementVisible = visible;
      if (!visible) cancelPending();
      evaluate();
    },
    setDocumentVisible(visible: boolean) {
      documentVisible = visible;
      if (!visible) cancelPending();
      evaluate();
    },
    cancelPending,
  };
}

export function useDocumentVisibility() {
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => typeof document !== "undefined" && document.visibilityState === "visible",
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === "visible");
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return isDocumentVisible;
}

type UseQualifiedBannerImpressionOptions = {
  exposureKey: string | null;
  isDocumentVisible: boolean;
  onQualified: (qualifiedExposureKey: string) => void | Promise<void>;
  minimumVisibleRatio?: number;
  visibleDurationMs?: number;
};

export function useQualifiedBannerImpression({
  exposureKey,
  isDocumentVisible,
  onQualified,
  minimumVisibleRatio = DEFAULT_VISIBLE_RATIO,
  visibleDurationMs = DEFAULT_VISIBLE_DURATION_MS,
}: UseQualifiedBannerImpressionOptions): RefObject<HTMLDivElement> {
  const elementRef = useRef<HTMLDivElement>(null);
  const onQualifiedRef = useRef(onQualified);
  onQualifiedRef.current = onQualified;

  const trackerRef = useRef<ReturnType<typeof createQualifiedExposureTracker> | null>(null);
  if (!trackerRef.current) {
    trackerRef.current = createQualifiedExposureTracker({
      visibleDurationMs,
      onQualified: (qualifiedExposureKey) => onQualifiedRef.current(qualifiedExposureKey),
    });
  }
  const tracker = trackerRef.current;

  useEffect(() => {
    tracker.setExposure(exposureKey);
  }, [exposureKey, tracker]);

  useEffect(() => {
    tracker.setDocumentVisible(isDocumentVisible);
  }, [isDocumentVisible, tracker]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !exposureKey || typeof IntersectionObserver === "undefined") {
      tracker.setElementVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        tracker.setElementVisible(
          Boolean(entry?.isIntersecting) && (entry?.intersectionRatio ?? 0) >= minimumVisibleRatio,
        );
      },
      { threshold: [0, minimumVisibleRatio] },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      tracker.setElementVisible(false);
    };
  }, [exposureKey, minimumVisibleRatio, tracker]);

  useEffect(() => () => tracker.cancelPending(), [tracker]);

  return elementRef;
}
