import { useEffect } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/layout/PageShell";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";

const LEGAL_VERSION = "2025-01";

export default function CfiTermsPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    trackEvent("cfi_terms_view");
  }, []);

  const { data: acceptance } = useQuery<{ id?: string } | null>({
    queryKey: ["/api/cfi/legal-acceptances", "cfi_terms"],
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/cfi/legal-acceptances?type=cfi_terms"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load legal acceptance");
      return res.json();
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cfi/legal-acceptances", {
        acceptanceType: "cfi_terms",
        version: LEGAL_VERSION,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "CFI terms accepted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to accept terms", description: error.message, variant: "destructive" });
    },
  });

  return (
    <PageShell
      kicker="CFI Terms"
      title="Ready Set Fly CFI Marketplace Terms"
      description="Review the instructor marketplace terms before publishing or continuing inside the CFI workflow."
      className="rsf-community-theme"
      canopyClassName="rsf-metal-hero border-b border-white/10"
      contentClassName="max-w-2xl space-y-6"
    >
          <div className="space-y-2">
            <Badge variant="outline">CFI Terms</Badge>
            <h1 className="text-3xl font-bold">
              Ready Set Fly CFI Marketplace Terms
            </h1>
            <p className="text-sm text-muted-foreground">
              Version {LEGAL_VERSION} · Last updated January 2025
            </p>
          </div>

          <div className="rsf-community-legal-copy space-y-5 p-6 text-sm leading-relaxed text-muted-foreground sm:p-8">
            <p>
              By publishing a CFI profile on Ready Set Fly, you agree to maintain accurate certifications, respond to
              students promptly, and uphold professional safety standards.
            </p>
            <p>
              Ready Set Fly does not process payments for CFI sessions. Instructors and students coordinate training
              logistics directly and assume responsibility for aircraft, insurance, and regulatory compliance.
            </p>
            <p>
              You consent to provide truthful credentials and keep your availability up to date. Misrepresentation may
              result in removal from the directory.
            </p>
            <p>
              For questions, contact support@readysetfly.us.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm">
              {acceptance ? "Accepted. You have already approved these terms." : "Please review and accept before continuing."}
            </div>
            <div className="flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending || !!acceptance}>
                  {acceptance ? "Already accepted" : acceptMutation.isPending ? "Accepting..." : "Accept CFI terms"}
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/login">Sign in to accept</Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/dashboard/cfi">Back to CFI dashboard</Link>
              </Button>
            </div>
          </div>
    </PageShell>
  );
}
