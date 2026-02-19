import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CfiProfile } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";

const LEGAL_VERSION = "2025-01";

export default function CfiRequestPage() {
  const [, params] = useRoute("/cfi/:slug/request");
  const slug = params?.slug;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [requestedStart, setRequestedStart] = useState("");
  const [requestedEnd, setRequestedEnd] = useState("");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [location, setLocation] = useState("");
  const [sessionType, setSessionType] = useState("Flight training");
  const [notes, setNotes] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const profileQueryKey = useMemo(() => ["/api/cfi/profiles", slug], [slug]);
  const { data: profile } = useQuery<CfiProfile>({
    queryKey: profileQueryKey,
    enabled: !!slug,
  });

  const { data: legalAcceptance } = useQuery<{ id?: string } | null>({
    queryKey: ["/api/cfi/legal-acceptances", slug],
    enabled: !!slug,
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/cfi/legal-acceptances?type=cfi_student_terms`), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to load legal acceptance");
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (slug) {
      trackEvent("cfi_request_view", { slug });
    }
  }, [slug]);

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!profile) {
        throw new Error("CFI profile not available");
      }
      if (!requestedStart || !requestedEnd) {
        throw new Error("Please select a start and end time");
      }
      const start = new Date(requestedStart);
      const end = new Date(requestedEnd);
      if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
        throw new Error("Start time is invalid");
      }
      if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
        throw new Error("End time is invalid");
      }
      if (end <= start) {
        throw new Error("End time must be after start time");
      }
      if (!legalAcceptance && !acceptTerms) {
        throw new Error("Please accept the student terms before booking");
      }
      if (!legalAcceptance && acceptTerms) {
        await apiRequest("POST", "/api/cfi/legal-acceptances", {
          acceptanceType: "cfi_student_terms",
          version: LEGAL_VERSION,
        });
      }

      const payload = {
        requestedStart: start.toISOString(),
        requestedEnd: end.toISOString(),
        timezone,
        location: location || null,
        sessionType: sessionType || "Flight training",
        notes: notes || null,
      };
      const res = await apiRequest("POST", `/api/cfi/profiles/${profile.slug}/requests`, payload);
      return res.json();
    },
    onSuccess: () => {
      trackEvent("cfi_request_submit", { slug });
      toast({ title: "Request sent", description: "The CFI will follow up to confirm details." });
      if (profile?.slug) {
        navigate(`/cfi/${profile.slug}`);
      }
    },
    onError: (error: any) => {
      toast({ title: "Request failed", description: error.message || "Unable to send request", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Request a training session</CardTitle>
            <CardDescription>
              {profile ? `Send a booking request to ${profile.displayName}.` : "Loading CFI profile..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start time</label>
                <Input
                  type="datetime-local"
                  value={requestedStart}
                  onChange={(event) => setRequestedStart(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End time</label>
                <Input
                  type="datetime-local"
                  value={requestedEnd}
                  onChange={(event) => setRequestedEnd(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Timezone</label>
                <Input value={timezone} onChange={(event) => setTimezone(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Session type</label>
                <Input value={sessionType} onChange={(event) => setSessionType(event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Location / airport</label>
                <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. KDAL or Addison" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes for the instructor</label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="cfi-student-terms"
                checked={acceptTerms || !!legalAcceptance}
                onCheckedChange={(checked) => setAcceptTerms(Boolean(checked))}
              />
              <label htmlFor="cfi-student-terms" className="text-sm text-muted-foreground">
                I agree to the <Link href="/cfi/student-terms" className="text-primary underline">CFI student terms</Link>.
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => createRequestMutation.mutate()}
                disabled={createRequestMutation.isPending}
              >
                {createRequestMutation.isPending ? "Sending..." : "Send request"}
              </Button>
              <Button asChild variant="outline">
                <Link href={profile ? `/cfi/${profile.slug}` : "/cfi"}>Back to profile</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
