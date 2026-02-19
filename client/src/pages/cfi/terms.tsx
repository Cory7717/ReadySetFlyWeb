import { useEffect } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <Badge variant="outline">CFI Terms</Badge>
            <CardTitle>Ready Set Fly CFI Marketplace Terms</CardTitle>
            <CardDescription>Version {LEGAL_VERSION}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
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

            <div className="flex flex-wrap items-center gap-3 pt-2">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
