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

export default function CfiStudentTermsPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    trackEvent("cfi_student_terms_view");
  }, []);

  const { data: acceptance } = useQuery<{ id?: string } | null>({
    queryKey: ["/api/cfi/legal-acceptances", "cfi_student_terms"],
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/cfi/legal-acceptances?type=cfi_student_terms"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load legal acceptance");
      return res.json();
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cfi/legal-acceptances", {
        acceptanceType: "cfi_student_terms",
        version: LEGAL_VERSION,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Student terms accepted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to accept terms", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="space-y-6">
          <div className="space-y-2">
            <Badge variant="outline">Student Terms</Badge>
            <h1 className="text-3xl font-bold">
              Ready Set Fly CFI Student Agreement
            </h1>
            <p className="text-sm text-muted-foreground">
              Version {LEGAL_VERSION} · Last updated January 2025
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6 sm:p-8 space-y-5 text-sm text-muted-foreground leading-relaxed">
            <p>
              By requesting a session with a CFI through Ready Set Fly, you agree to coordinate training directly with
              the instructor. Ready Set Fly does not broker or process payments for instruction.
            </p>
            <p>
              You are responsible for verifying aircraft availability, insurance coverage, and any airport access
              requirements. Always comply with FAA regulations and local flight school policies.
            </p>
            <p>
              Instructors may accept or decline requests at their discretion. You may withdraw requests at any time.
            </p>
            <p>
              For questions, contact support@readysetfly.us.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm">
              {acceptance ? "✓ You have accepted these terms." : "Please review and accept before continuing."}
            </div>
            <div className="flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending || !!acceptance}>
                  {acceptance ? "Already accepted" : acceptMutation.isPending ? "Accepting..." : "Accept student terms"}
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/login">Sign in to accept</Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/cfi">Back to directory</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
