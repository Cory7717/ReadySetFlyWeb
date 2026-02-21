import { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { cancelAuthGate, completeAuthGate, subscribeAuthGate } from "@/utils/authGate";

const POPUP_NAME = "rsf_auth_popup";

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

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && handleCancel()}>
      <AlertDialogContent data-testid="dialog-auth-gate">
        <AlertDialogHeader>
          <AlertDialogTitle>Sign in to save this</AlertDialogTitle>
          <AlertDialogDescription>
            Create a free RSF account to save, sync across devices, and access your tools anywhere.
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
