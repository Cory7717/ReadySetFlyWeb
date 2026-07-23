import * as React from "react";
import { ArrowLeft, ArrowUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PlannerWorkflowStepId = "route" | "weather" | "navlog" | "analysis" | "file";

export type PlannerWorkflowStep = {
  id: PlannerWorkflowStepId;
  label: string;
  step: number;
};

type PlannerWorkflowFooterProps = {
  currentStep: PlannerWorkflowStep;
  previousStep?: PlannerWorkflowStep;
  nextStep?: PlannerWorkflowStep;
  status: string;
  onNavigate: (toStep: PlannerWorkflowStepId, direction: "forward" | "back") => void;
  onReturnToTop?: () => void;
  className?: string;
};

export function PlannerWorkflowFooter({
  currentStep,
  previousStep,
  nextStep,
  status,
  onNavigate,
  onReturnToTop,
  className,
}: PlannerWorkflowFooterProps) {
  return (
    <nav
      aria-label="Flight planner workflow navigation"
      className={cn(
        "rounded-[1.2rem] border border-[#60758C]/55 bg-[linear-gradient(180deg,rgba(24,33,43,0.98),rgba(12,18,25,0.98))] p-3 text-[#E3EDF7] shadow-[0_18px_42px_-30px_rgba(0,0,0,0.9)] sm:p-4",
        className,
      )}
    >
      <div className="grid gap-3 md:grid-cols-2 md:items-center">
        <div className="flex min-w-0 justify-start">
          {previousStep ? (
            <Button
              type="button"
              variant="outline"
              className="w-full min-w-0 border-[#60758C] bg-[#141b24] text-[#E8EDF4] hover:bg-[#1d2a36] hover:text-white focus-visible:ring-[#9CB4CC] sm:w-auto"
              onClick={() => onNavigate(previousStep.id, "back")}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Back to {previousStep.label}</span>
            </Button>
          ) : (
            <span className="hidden md:block" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 text-center md:order-3 md:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9CB4CC]">
            Step {currentStep.step} of 5 - {currentStep.label}
          </div>
          <div className="mx-auto mt-1 max-w-[48rem] text-sm leading-5 text-[#DCE6F2]" aria-live="polite">
            {status}
          </div>
        </div>

        <div className="flex min-w-0 flex-col-reverse gap-2 sm:flex-row md:justify-end">
          {currentStep.id === "file" && onReturnToTop ? (
            <Button
              type="button"
              variant="outline"
              className="w-full min-w-0 border-[#60758C] bg-[#141b24] text-[#E8EDF4] hover:bg-[#1d2a36] hover:text-white focus-visible:ring-[#9CB4CC] sm:w-auto"
              onClick={onReturnToTop}
            >
              <ArrowUp className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Return to Top</span>
            </Button>
          ) : null}
          {nextStep ? (
            <Button
              type="button"
              className="w-full min-w-0 border border-[#7aa6ff]/70 bg-[linear-gradient(180deg,#2563EB,#1D4ED8)] text-white shadow-[0_14px_28px_-18px_rgba(37,99,235,0.9)] hover:bg-[linear-gradient(180deg,#2f6fff,#1f55e8)] focus-visible:ring-[#A7C4FF] sm:w-auto"
              onClick={() => onNavigate(nextStep.id, "forward")}
            >
              <span className="truncate">Continue to {nextStep.label}</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
