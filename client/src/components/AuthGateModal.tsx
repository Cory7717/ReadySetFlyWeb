import { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import { cancelAuthGate, completeAuthGate, subscribeAuthGate } from "@/utils/authGate";

const POPUP_NAME = "rsf_auth_popup";

const authGateMessages: Record<string, { title: string; description: string }> = {
  save_flight_plan: {
    title: "Create a free account to save this plan",
    description: "Save your route, fuel notes, and departure timing so you can return to it from any device.",
  },
  save_aircraft_profile: {
    title: "Create a free account to save this aircraft profile",
    description: "Keep your aircraft details attached to future planning sessions without re-entering them.",
  },
  sync_logbook_entry: {
    title: "Sign in to continue to Pro sync",
    description: "RSF Pro connects planner workflow to your digital logbook, currency, and training history.",
  },
};

export function AuthGateModal() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [actionName, setActionName] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.name === POPUP_NAME && window.opener) {
      window.opener.postMessage({ type: "rsf_auth_complete" }, window.location.origin);
      window.close();
    }
  }, []);

  useEffect(() => {
    return subscribeAuthGate((request) => {
      setActionName(request?.actionName ?? null);
      setOpen(Boolean(request));
      setWaiting(false);
      if (request?.actionName) {
        trackEvent("auth_gate_viewed", { action: request.actionName });
      }
    });
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "rsf_auth_complete") return;
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!open || !isAuthenticated) return;
    setWaiting(false);
    completeAuthGate().catch(() => {
      toast({
        title: "Signed in",
        description: "You're signed in. Please retry the action if it did not complete.",
      });
    });
  }, [open, isAuthenticated, toast]);

  const handleContinue = () => {
    setWaiting(true);
    const popup = window.open(
      apiUrl("/api/auth/google"),
      POPUP_NAME,
      "width=520,height=720,menubar=no,toolbar=no,location=no,status=no"
    );
    if (!popup) {
      window.location.href = apiUrl("/api/auth/google");
    }
  };

  const handleCancel = () => {
    cancelAuthGate(actionName ?? undefined);
    setOpen(false);
    toast({
      title: "Create a free account to save and access it anywhere.",
    });
  };

  const message = actionName ? authGateMessages[actionName] : undefined;

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && handleCancel()}>
      <AlertDialogContent data-testid="dialog-auth-gate">
        <AlertDialogHeader>
          <AlertDialogTitle>{message?.title ?? "Sign in to save this"}</AlertDialogTitle>
          <AlertDialogDescription>
            {message?.description ?? "Create a free RSF account to save, sync across devices, and access your tools anywhere."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={waiting}>Maybe later</AlertDialogCancel>
          <AlertDialogAction onClick={handleContinue} disabled={waiting}>
            <LogIn className="h-4 w-4 mr-2" />
            Continue with Google
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
