import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";

type FlightPlannerAccountRequirementDialogProps = {
  open: boolean;
  sourceAction: string;
  activeStep: string;
  environment: string;
  showLabDisclosure: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateAccount: () => void;
  onSignIn: () => void;
  onContinueExploring: () => void;
};

const actionLabels: Record<string, string> = {
  save_flight_plan: "save this flight plan",
  save_aircraft_profile: "save this aircraft profile",
  sync_logbook_entry: "send this flight to your logbook",
  file_flight_plan: "manage provider filing actions",
  account_explanation: "continue with account-backed planning",
};

export function FlightPlannerAccountRequirementContent({
  sourceAction,
  activeStep,
  environment,
  showLabDisclosure,
  onCreateAccount,
  onSignIn,
  onContinueExploring,
}: Omit<FlightPlannerAccountRequirementDialogProps, "open" | "onOpenChange">) {
  const actionLabel = actionLabels[sourceAction] ?? "continue";

  return (
    <>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold leading-none tracking-tight">
          Create an RSF account to {actionLabel}
        </h2>
        <p className="text-sm text-[#C8D4E1]">
          You can keep exploring the planner as a guest. An account is needed when RSF has to save, reconnect, or manage a flight plan for you.
        </p>
      </div>
      <div className="space-y-4 text-sm leading-6 text-[#E8EDF4]">
        <div className="rounded-lg border border-[#5d6f85]/35 bg-[#18212b] p-3">
          <div className="font-semibold text-[#F5F8FC]">Why an account is required</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[#D7E2EE]">
            <li>Flight Services requires pilot and contact information for filing and safety support.</li>
            <li>Your RSF account securely connects that information to the plan so provider updates, amendments, cancellation, and lifecycle history stay attached to the right pilot.</li>
            <li>After sign-in, RSF restores this planner draft and returns you to the same step. It will not automatically file, amend, cancel, activate, or close anything.</li>
          </ul>
        </div>
        {showLabDisclosure && (
          <div className="rounded-lg border border-amber-300/45 bg-amber-400/10 p-3 text-amber-50">
            <div className="font-semibold">Current environment: {environment}</div>
            <p className="mt-1">
              This planner is operating in a Flight Service test environment. Test filings are not operational flight plans and are not available to Air Traffic Control.
            </p>
          </div>
        )}
        <p className="text-[#C8D4E1]">
          Ready Set Fly does not sell pilot filing information. Flight-plan data is handled according to RSF privacy and retention policies.
          {" "}
          <a href="/privacy-policy" className="text-[#9CCBFF] underline-offset-4 hover:underline">
            Review the privacy policy.
          </a>
        </p>
        <p className="text-xs text-[#9FB1C5]">
          Current step: {activeStep}
        </p>
      </div>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="ghost" onClick={onContinueExploring}>
          Continue Exploring Without Filing
        </Button>
        <Button type="button" variant="outline" onClick={onSignIn}>
          Sign In
        </Button>
        <Button type="button" onClick={onCreateAccount}>
          Create an Account &amp; Continue
        </Button>
      </DialogFooter>
    </>
  );
}

export function FlightPlannerAccountRequirementDialog({
  open,
  sourceAction,
  activeStep,
  environment,
  showLabDisclosure,
  onOpenChange,
  onCreateAccount,
  onSignIn,
  onContinueExploring,
}: FlightPlannerAccountRequirementDialogProps) {
  const actionLabel = actionLabels[sourceAction] ?? "continue";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#5d6f85]/45 bg-[#11161d] text-[#F5F8FC] sm:max-w-xl">
        <DialogTitle className="sr-only">Create an RSF account to {actionLabel}</DialogTitle>
        <FlightPlannerAccountRequirementContent
          sourceAction={sourceAction}
          activeStep={activeStep}
          environment={environment}
          showLabDisclosure={showLabDisclosure}
          onCreateAccount={onCreateAccount}
          onSignIn={onSignIn}
          onContinueExploring={onContinueExploring}
        />
      </DialogContent>
    </Dialog>
  );
}
