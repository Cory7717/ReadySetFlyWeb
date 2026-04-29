import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { withReturnTo } from "@/lib/returnTo";

type PostActionSignupPromptProps = {
  visible: boolean;
  source: "planner" | "logbook" | "rentals";
  returnTo: string;
  onDismiss: () => void;
};

export function PostActionSignupPrompt({
  visible,
  source,
  returnTo,
  onDismiss,
}: PostActionSignupPromptProps) {
  const shownRef = useRef(false);

  useEffect(() => {
    if (!visible || shownRef.current) return;
    shownRef.current = true;
    trackEvent("post_action_signup_prompt_shown", { source });
  }, [visible, source]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[95] max-w-[calc(100vw-2rem)]">
      <Card className="w-[340px] border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),rgba(255,255,255,0.74))] p-4 shadow-[0_20px_40px_rgba(15,23,42,0.24)]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">Want to save this and track your activity?</div>
            <p className="text-xs leading-5 text-muted-foreground">
              Create a free account to keep your work, come back later, and connect the rest of your pilot workflow.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss signup prompt"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => {
              trackEvent("signup_after_action", { source, target: "/register" });
              window.location.href = apiUrl(withReturnTo("/register", returnTo));
            }}
          >
            Create free account
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Later
          </Button>
        </div>
      </Card>
    </div>
  );
}
