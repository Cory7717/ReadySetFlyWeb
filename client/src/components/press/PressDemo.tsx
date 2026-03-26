import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PressDemoStep = {
  id: string;
  title: string;
  body: string;
};

function readPressDemoState() {
  if (typeof window === "undefined") {
    return { enabled: false, stepIndex: 0 };
  }
  const params = new URLSearchParams(window.location.search);
  const enabled = params.get("demo") === "press";
  const stepRaw = Number(params.get("pressStep") || "1");
  const stepIndex = Number.isFinite(stepRaw) && stepRaw > 0 ? stepRaw - 1 : 0;
  return { enabled, stepIndex };
}

export function usePressDemo(steps: PressDemoStep[]) {
  const initial = readPressDemoState();
  const [enabled] = useState(initial.enabled);
  const [stepIndex, setStepIndexState] = useState(initial.stepIndex);

  const clampedStepIndex = Math.min(Math.max(stepIndex, 0), Math.max(steps.length - 1, 0));
  const currentStep = steps[clampedStepIndex] ?? null;

  const writeStepToUrl = useCallback((nextIndex: number) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("demo", "press");
    params.set("pressStep", String(nextIndex + 1));
    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, []);

  const setStepIndex = useCallback((nextIndex: number) => {
    const bounded = Math.min(Math.max(nextIndex, 0), Math.max(steps.length - 1, 0));
    setStepIndexState(bounded);
    writeStepToUrl(bounded);
  }, [steps.length, writeStepToUrl]);

  const nextStep = useCallback(() => setStepIndex(clampedStepIndex + 1), [clampedStepIndex, setStepIndex]);
  const previousStep = useCallback(() => setStepIndex(clampedStepIndex - 1), [clampedStepIndex, setStepIndex]);

  const exitDemo = useCallback(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.delete("demo");
    params.delete("pressStep");
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
    window.location.reload();
  }, []);

  const stepMap = useMemo(
    () =>
      new Map(
        steps.map((step, index) => [
          step.id,
          { ...step, index },
        ]),
      ),
    [steps],
  );

  const getStep = useCallback(
    (id: string) => stepMap.get(id) ?? null,
    [stepMap],
  );

  const isActive = useCallback(
    (id: string) => enabled && currentStep?.id === id,
    [currentStep?.id, enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nextStep();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        previousStep();
      } else if (event.key === "Escape") {
        event.preventDefault();
        exitDemo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, exitDemo, nextStep, previousStep]);

  return {
    enabled,
    steps,
    stepIndex: clampedStepIndex,
    currentStep,
    setStepIndex,
    nextStep,
    previousStep,
    exitDemo,
    getStep,
    isActive,
  };
}

export function PressDemoBanner({
  pageLabel,
  stepIndex,
  totalSteps,
  currentStep,
  onPrevious,
  onNext,
  onExit,
}: {
  pageLabel: string;
  stepIndex: number;
  totalSteps: number;
  currentStep: PressDemoStep | null;
  onPrevious: () => void;
  onNext: () => void;
  onExit: () => void;
}) {
  if (!currentStep) return null;

  return (
    <div className="sticky top-20 z-40 rounded-2xl border border-sky-300 bg-sky-50/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-sky-600 text-white hover:bg-sky-600">Press Demo</Badge>
            <Badge variant="outline" className="border-sky-300 text-sky-900">{pageLabel}</Badge>
            <span className="text-xs font-medium text-sky-900/80">
              Step {stepIndex + 1} of {totalSteps}
            </span>
          </div>
          <div className="text-sm font-semibold text-slate-900">{currentStep.title}</div>
          <div className="text-sm text-slate-700">{currentStep.body}</div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <span
                key={`press-demo-step-${index + 1}`}
                className={cn(
                  "h-2.5 w-2.5 rounded-full border border-sky-300",
                  index === stepIndex ? "bg-sky-600" : "bg-white",
                )}
              />
            ))}
            <span className="text-[11px] text-slate-600">Use ← / → to step, Esc to exit</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onExit}>
            Exit Demo
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onPrevious} disabled={stepIndex <= 0}>
            Previous
          </Button>
          <Button type="button" size="sm" onClick={onNext} disabled={stepIndex >= totalSteps - 1}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PressDemoSpotlight({
  active,
  stepNumber,
  title,
  body,
  children,
  className,
}: {
  active: boolean;
  stepNumber: number;
  title: string;
  body: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active]);

  return (
    <div
      ref={ref}
      className={cn(
        "relative scroll-mt-32 transition-all",
        active && "rounded-3xl ring-4 ring-sky-300/90 ring-offset-4 ring-offset-white shadow-[0_22px_60px_rgba(14,165,233,0.18)]",
        className,
      )}
    >
      {active && (
        <div className="pointer-events-none absolute left-4 top-4 z-20 max-w-sm rounded-2xl border border-sky-300 bg-white/96 p-3 shadow-xl">
          <div className="flex items-center gap-2">
            <Badge className="bg-sky-600 text-white hover:bg-sky-600">Step {stepNumber}</Badge>
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-500 animate-pulse" />
            <div className="text-sm font-semibold text-slate-900">{title}</div>
          </div>
          <div className="mt-2 text-sm text-slate-700">{body}</div>
        </div>
      )}
      {children}
    </div>
  );
}
