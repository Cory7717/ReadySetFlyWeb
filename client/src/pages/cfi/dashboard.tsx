import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CfiAvailabilityRule, CfiBookingRequest, CfiCredential, CfiProfile, CfiSchool } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { PageShell } from "@/components/layout/PageShell";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import type { UploadResult } from "@uppy/core";
import { getCfiVerificationReadiness } from "@shared/cfi-verification";

const LEGAL_VERSION = "2025-01";

const weekdayOptions = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
];

const splitCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const listToCsv = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean).join(", ");
  }
  if (typeof value === "string") return value;
  return "";
};

const normalizeTimeValue = (value?: string | null) => {
  if (!value) return "";
  return value.length > 5 ? value.slice(0, 5) : value;
};

const toOptional = (value: string) => (value.trim() ? value.trim() : null);
const resolveHeadshotUrl = (value?: string | null) => {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/objects/")) return apiUrl(value);
  if (value.includes("/uploads/")) {
    const idx = value.indexOf("/uploads/");
    if (idx >= 0) {
      return apiUrl(`/objects/${value.slice(idx + 1)}`);
    }
  }
  return value;
};

type DashboardResponse = {
  profile: CfiProfile;
  credentials: CfiCredential[];
  availability: CfiAvailabilityRule[];
  legal: { cfi_terms: boolean };
  credentialReadiness?: ReturnType<typeof getCfiVerificationReadiness>;
} | null;

const cfiCredentialTypeOptions = [
  "CFI Certificate",
  "Pilot Certificate",
  "Medical Certificate",
  "Driver License",
  "Passport",
  "Insurance",
  "Other",
];

export default function CfiDashboard() {
  const { user } = useAuth();
  const entitlements = (user as any)?.entitlements;
  const canUseCfi = !!entitlements?.canUseCfi;
  const cfiAccessEndsAt = entitlements?.cfiAccessEndsAt;
  const trialRedeemed = !!(user as any)?.cfiTrialRedeemed;
  const { toast } = useToast();

  useEffect(() => {
    trackEvent("cfi_dashboard_view");
  }, []);

  const { data: dashboardData, isLoading } = useQuery<DashboardResponse>({
    queryKey: ["/api/cfi/profile"],
    enabled: canUseCfi,
  });

  const { data: bookingRequests = [] } = useQuery<CfiBookingRequest[]>({
    queryKey: ["/api/cfi/booking-requests"],
    enabled: canUseCfi,
  });

  const { data: schools = [] } = useQuery<CfiSchool[]>({
    queryKey: ["/api/cfi/schools"],
    enabled: canUseCfi,
  });

  const profile = dashboardData?.profile;
  const [formState, setFormState] = useState({
    displayName: "",
    slug: "",
    headline: "",
    bio: "",
    headshotUrl: "",
    schoolId: "",
    locationCity: "",
    locationState: "",
    airportHome: "",
    hourlyRate: "",
    ratingsHeld: "",
    aircraftTypes: "",
    languages: "",
    contactNote: "",
    preferredPayments: "",
  });

  const [availabilityRules, setAvailabilityRules] = useState<CfiAvailabilityRule[]>([]);
  const [credentialForm, setCredentialForm] = useState({
    type: "CFI Certificate",
    fileUrl: "",
    fileName: "",
    expiresOn: "",
    notes: "",
  });
  const profileCompleteness = useMemo(() => {
    if (!profile) return 0;
    const fields = [
      formState.displayName,
      formState.headline,
      formState.bio,
      formState.headshotUrl,
      formState.locationCity,
      formState.airportHome,
      formState.hourlyRate,
      formState.ratingsHeld,
      formState.aircraftTypes,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [formState, profile]);
  const credentialReadiness = useMemo(() => {
    if (dashboardData?.credentialReadiness) return dashboardData.credentialReadiness;
    return getCfiVerificationReadiness(dashboardData?.credentials ?? []);
  }, [dashboardData]);
  const missingCredentialLabels = credentialReadiness.checks
    .filter((check) => !check.met)
    .map((check) => check.label);

  const startTrialMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cfi/trial/start", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/profile"] });
      toast({
        title: "CFI trial activated",
        description: "Your 30-day CFI scheduler access is now active.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to start trial",
        description: error.message || "Please contact support if this persists.",
        variant: "destructive",
      });
    },
  });

  if (!canUseCfi) {
    return (
      <PageShell
        kicker="CFI Dashboard"
        title="Become a CFI on Ready Set Fly"
        description="Unlock the instructor profile, booking workflow, and scheduling workspace with the CFI trial or RSF Pro."
        className="rsf-community-theme"
        canopyClassName="rsf-metal-hero border-b border-white/10"
        contentClassName="max-w-3xl space-y-6"
      >
          <Badge variant="outline">CFI Dashboard</Badge>
          <h1 className="text-3xl font-bold">Become a CFI on Ready Set Fly</h1>
          <p className="text-muted-foreground">
            Start a 30-day free trial to unlock the CFI scheduler, profile management, and booking requests.
          </p>
          <Card>
            <CardHeader>
              <CardTitle>30-Day CFI Trial</CardTitle>
              <CardDescription>
                One-time trial access for instructors. You can upgrade to RSF Pro anytime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {trialRedeemed ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    Your one-time CFI trial has already been used. Upgrade to RSF Pro for continued access.
                  </AlertDescription>
                </Alert>
              ) : (
                <Button
                  onClick={() => startTrialMutation.mutate()}
                  disabled={startTrialMutation.isPending}
                  data-testid="button-start-cfi-trial"
                >
                  {startTrialMutation.isPending ? "Activating..." : "Start 30-Day Trial"}
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/logbook/pro">View RSF Pro plans</Link>
              </Button>
            </CardContent>
          </Card>
      </PageShell>
    );
  }

  useEffect(() => {
    if (!profile) return;
    setFormState({
      displayName: profile.displayName || "",
      slug: profile.slug || "",
      headline: profile.headline || "",
      bio: profile.bio || "",
      headshotUrl: profile.headshotUrl || "",
      schoolId: profile.schoolId || "",
      locationCity: profile.locationCity || "",
      locationState: profile.locationState || "",
      airportHome: profile.airportHome || "",
      hourlyRate: profile.hourlyRateCents ? String(Math.round(profile.hourlyRateCents / 100)) : "",
      ratingsHeld: listToCsv(profile.ratingsHeld),
      aircraftTypes: listToCsv(profile.aircraftTypes),
      languages: listToCsv(profile.languages),
      contactNote: profile.contactNote || "",
      preferredPayments: profile.preferredPayments || "",
    });
  }, [profile]);

  useEffect(() => {
    if (dashboardData?.availability) {
      setAvailabilityRules(
        dashboardData.availability.map((rule) => ({
          ...rule,
          startTime: normalizeTimeValue(rule.startTime as any),
          endTime: normalizeTimeValue(rule.endTime as any),
        }))
      );
    }
  }, [dashboardData?.availability]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        displayName: formState.displayName,
        slug: formState.slug,
        headline: toOptional(formState.headline),
        bio: toOptional(formState.bio),
        headshotUrl: toOptional(formState.headshotUrl),
        schoolId: formState.schoolId ? formState.schoolId : null,
        locationCity: toOptional(formState.locationCity),
        locationState: toOptional(formState.locationState),
        airportHome: toOptional(formState.airportHome),
        hourlyRateCents: formState.hourlyRate ? Math.round(Number(formState.hourlyRate) * 100) : null,
        ratingsHeld: splitCsv(formState.ratingsHeld),
        aircraftTypes: splitCsv(formState.aircraftTypes),
        languages: splitCsv(formState.languages),
        contactNote: toOptional(formState.contactNote),
        preferredPayments: toOptional(formState.preferredPayments),
      };
      if (profile) {
        const res = await apiRequest("PATCH", "/api/cfi/profile", payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/cfi/profile", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/profile"] });
      toast({ title: "CFI profile saved" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to save profile", description: error.message, variant: "destructive" });
    },
  });

  const handleHeadshotGetUploadParameters = async () => {
    const response = await fetch(apiUrl("/api/objects/upload"), {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to get upload URL");
    }
    const data = await response.json();
    return { method: "PUT" as const, url: data.uploadURL };
  };

  const handleHeadshotUploadComplete = async (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => {
    try {
      for (const file of result.successful || []) {
        if (!file.uploadURL) continue;
        const aclResponse = await fetch(apiUrl("/api/objects/set-acl"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            path: file.uploadURL,
            access: "publicRead",
          }),
        });
        const aclData = aclResponse.ok ? await aclResponse.json() : null;
        const imageUrl = aclData?.objectPath || file.uploadURL.split("?")[0];
        setFormState((prev) => ({ ...prev, headshotUrl: imageUrl }));
        toast({
          title: "Headshot uploaded",
          description: "Your instructor photo is ready to use.",
        });
      }
    } catch (error) {
      console.error("Headshot upload failed:", error);
      toast({
        title: "Upload failed",
        description: "Please try uploading the image again.",
        variant: "destructive",
      });
    }
  };

  const handleCredentialGetUploadParameters = async () => {
    const response = await fetch(apiUrl("/api/objects/upload"), {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to get upload URL");
    }
    const data = await response.json();
    return { method: "PUT" as const, url: data.uploadURL };
  };

  const extractUploaderFileUrl = (file: Record<string, unknown>) => {
    const directUrl = typeof file.uploadURL === "string" ? file.uploadURL : "";
    if (directUrl) return directUrl.split("?")[0];
    const response = file.response as Record<string, unknown> | undefined;
    if (!response) return "";
    const responseUrl = typeof response.uploadURL === "string" ? response.uploadURL : "";
    if (responseUrl) return responseUrl.split("?")[0];
    const body = response.body as Record<string, unknown> | undefined;
    if (body && typeof body.uploadURL === "string") {
      return body.uploadURL.split("?")[0];
    }
    return "";
  };

  const handleCredentialUploadComplete = (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => {
    const firstFile = result.successful?.[0] as Record<string, unknown> | undefined;
    if (!firstFile) return;
    const fileUrl = extractUploaderFileUrl(firstFile);
    const fileName = typeof firstFile.name === "string" ? firstFile.name : "";
    if (!fileUrl) {
      toast({
        title: "Upload failed",
        description: "Unable to capture uploaded file URL.",
        variant: "destructive",
      });
      return;
    }
    setCredentialForm((prev) => ({
      ...prev,
      fileUrl,
      fileName: prev.fileName || fileName,
    }));
    toast({
      title: "Credential file uploaded",
      description: "Review the type and expiration date, then click Add credential.",
    });
  };

  const saveAvailabilityMutation = useMutation({
    mutationFn: async () => {
      const payload = availabilityRules.map((rule) => ({
        timezone: rule.timezone,
        weekday: rule.weekday,
        startTime: rule.startTime,
        endTime: rule.endTime,
        isActive: rule.isActive,
      }));
      const res = await apiRequest("PUT", "/api/cfi/availability", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/profile"] });
      toast({ title: "Availability updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update availability", description: error.message, variant: "destructive" });
    },
  });

  const createCredentialMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        type: credentialForm.type,
        fileUrl: credentialForm.fileUrl,
        fileName: credentialForm.fileName,
        expiresOn: credentialForm.expiresOn || null,
        notes: toOptional(credentialForm.notes),
      };
      const res = await apiRequest("POST", "/api/cfi/credentials", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/profile"] });
      setCredentialForm({ type: "CFI Certificate", fileUrl: "", fileName: "", expiresOn: "", notes: "" });
      toast({ title: "Credential added" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add credential", description: error.message, variant: "destructive" });
    },
  });

  const deleteCredentialMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/cfi/credentials/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/profile"] });
      toast({ title: "Credential removed" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove credential", description: error.message, variant: "destructive" });
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/cfi/booking-requests/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/booking-requests"] });
      toast({ title: "Booking request updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update request", description: error.message, variant: "destructive" });
    },
  });

  const acceptTermsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cfi/legal-acceptances", {
        acceptanceType: "cfi_terms",
        version: LEGAL_VERSION,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/profile"] });
      toast({ title: "CFI terms accepted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to accept terms", description: error.message, variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cfi/profile/publish");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/profile"] });
      toast({ title: "Profile published" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to publish profile", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="rsf-community-theme container mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Loading CFI dashboard...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const pendingBookingCount = bookingRequests.filter((request) => request.status === "PENDING").length;

  return (
    <PageShell
      kicker="CFI Dashboard"
      title="Manage your instructor profile, credentials, and bookings."
      description="Keep the instructor profile current, manage availability, and handle incoming booking activity from one workspace."
      className="rsf-community-theme"
      canopyClassName="rsf-metal-hero border-b border-white/10"
      contentClassName="space-y-8"
    >
        <div className="space-y-2">
          <Badge variant="outline">CFI Dashboard</Badge>
          <h1 className="text-3xl font-bold">Manage your CFI profile</h1>
          <p className="text-muted-foreground">Update your public profile, availability, and booking requests.</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/cfi-school">School dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/cfi-training">Training center</Link>
            </Button>
          </div>
        </div>
        {cfiAccessEndsAt && (
          <Alert>
            <AlertDescription>
              CFI access is active until{" "}
              <strong>{new Date(cfiAccessEndsAt).toLocaleDateString()}</strong>.
            </AlertDescription>
          </Alert>
        )}
        {profile && profileCompleteness < 100 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-4">
            <div className="space-y-1 flex-1">
              <div className="text-sm font-semibold text-amber-800">
                Profile {profileCompleteness}% complete
              </div>
              <Progress value={profileCompleteness} className="h-2 bg-amber-100 [&>div]:bg-amber-500" />
              <div className="text-xs text-amber-700">
                Students are more likely to reach out to instructors with complete profiles.
              </div>
            </div>
            {profile.slug && (
              <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100">
                <Link href={`/cfi/${profile.slug}`}>Preview</Link>
              </Button>
            )}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Publish & compliance</CardTitle>
            <CardDescription>Accept terms and upload required CFI documents before going live.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 bg-muted/30">
              <div className="flex-1 space-y-0.5">
                <div className="text-sm font-semibold">
                  {profile?.isPublished ? "Profile live" : "Your profile is not yet published"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {profile?.isPublished
                    ? "Students can find and contact you from the CFI directory."
                    : "Accept terms and upload required credentials to publish in the directory."}
                </div>
              </div>
              {profile?.slug && profile.isPublished && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/cfi/${profile.slug}`}>View live profile</Link>
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={dashboardData?.legal?.cfi_terms ? "default" : "outline"}>
                {dashboardData?.legal?.cfi_terms ? "CFI terms accepted" : "CFI terms required"}
              </Badge>
              <Badge variant={credentialReadiness.isReady ? "default" : "outline"}>
                {credentialReadiness.isReady ? "Required credentials uploaded" : "Required credentials missing"}
              </Badge>
              <Badge variant={profile?.isVerified ? "default" : "outline"}>
                {profile?.isVerified ? "Instructor verified by RSF" : "Awaiting admin verification"}
              </Badge>
              {!dashboardData?.legal?.cfi_terms && (
                <Button
                  variant="outline"
                  onClick={() => acceptTermsMutation.mutate()}
                  disabled={acceptTermsMutation.isPending}
                >
                  Accept CFI terms
                </Button>
              )}
              <Button
                onClick={() => publishMutation.mutate()}
                disabled={
                  publishMutation.isPending ||
                  !profile ||
                  !dashboardData?.legal?.cfi_terms ||
                  !credentialReadiness.isReady
                }
              >
                {profile?.isPublished ? "Re-publish profile" : "Publish profile"}
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/cfi/terms">Review CFI terms</Link>
              </Button>
            </div>
            {!credentialReadiness.isReady && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Missing: {missingCredentialLabels.join(", ")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile details</CardTitle>
            <CardDescription>Keep your profile current for students searching the directory.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                    {formState.headshotUrl ? (
                      <img
                        src={resolveHeadshotUrl(formState.headshotUrl)}
                        alt="Instructor headshot"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">No photo</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Instructor headshot</p>
                    <p className="text-xs text-muted-foreground">
                      Add a clear photo so students can verify your identity.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    allowedFileTypes={["image/*"]}
                    maxFileSize={5 * 1024 * 1024}
                    onGetUploadParameters={handleHeadshotGetUploadParameters}
                    onComplete={handleHeadshotUploadComplete}
                    onError={(message) => {
                      toast({
                        title: "Upload failed",
                        description: message,
                        variant: "destructive",
                      });
                    }}
                    buttonVariant="secondary"
                  >
                    Upload headshot
                  </ObjectUploader>
                  {formState.headshotUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setFormState((prev) => ({ ...prev, headshotUrl: "" }))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Display name</label>
                <Input
                  value={formState.displayName}
                  onChange={(event) => setFormState({ ...formState, displayName: event.target.value })}
                  placeholder="Jane Smith, CFI"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Profile slug</label>
                <Input
                  value={formState.slug}
                  onChange={(event) => setFormState({ ...formState, slug: event.target.value })}
                  placeholder="jane-smith"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Headline</label>
                <Input
                  value={formState.headline}
                  onChange={(event) => setFormState({ ...formState, headline: event.target.value })}
                  placeholder="Instrument + multi-engine specialist"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Bio</label>
                <Textarea
                  value={formState.bio}
                  onChange={(event) => setFormState({ ...formState, bio: event.target.value })}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">City</label>
                <Input
                  value={formState.locationCity}
                  onChange={(event) => setFormState({ ...formState, locationCity: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">State</label>
                <Input
                  value={formState.locationState}
                  onChange={(event) => setFormState({ ...formState, locationState: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Home airport</label>
                <Input
                  value={formState.airportHome}
                  onChange={(event) => setFormState({ ...formState, airportHome: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">School affiliation</label>
                <Select
                  value={formState.schoolId || "independent"}
                  onValueChange={(value) =>
                    setFormState({ ...formState, schoolId: value === "independent" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Independent CFI" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="independent">Independent CFI</SelectItem>
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hourly rate (USD)</label>
                <Input
                  type="number"
                  value={formState.hourlyRate}
                  onChange={(event) => setFormState({ ...formState, hourlyRate: event.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Ratings held (comma separated)</label>
                <Input
                  value={formState.ratingsHeld}
                  onChange={(event) => setFormState({ ...formState, ratingsHeld: event.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Aircraft types (comma separated)</label>
                <Input
                  value={formState.aircraftTypes}
                  onChange={(event) => setFormState({ ...formState, aircraftTypes: event.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Languages (comma separated)</label>
                <Input
                  value={formState.languages}
                  onChange={(event) => setFormState({ ...formState, languages: event.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Contact note</label>
                <Textarea
                  value={formState.contactNote}
                  onChange={(event) => setFormState({ ...formState, contactNote: event.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Preferred payments</label>
                <Input
                  value={formState.preferredPayments}
                  onChange={(event) => setFormState({ ...formState, preferredPayments: event.target.value })}
                  placeholder="Cash, Zelle, Venmo"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending}>
                {saveProfileMutation.isPending ? "Saving..." : "Save profile"}
              </Button>
              {profile?.slug && (
                <Button asChild variant="outline">
                  <Link href={`/cfi/${profile.slug}`}>Preview public profile</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Availability rules</CardTitle>
            <CardDescription>Set weekly availability windows. Times are local to your timezone.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {availabilityRules.length === 0 && (
              <p className="text-sm text-muted-foreground">No availability rules yet.</p>
            )}
            <div className="space-y-3">
              {availabilityRules.map((rule, index) => (
                <div key={rule.id || index} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] items-center">
                  <Select
                    value={String(rule.weekday)}
                    onValueChange={(value) => {
                      const next = [...availabilityRules];
                      next[index] = { ...rule, weekday: Number(value) };
                      setAvailabilityRules(next);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weekdayOptions.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="space-y-1">
                    <Input
                      value={rule.timezone}
                      onChange={(event) => {
                        const next = [...availabilityRules];
                        next[index] = { ...rule, timezone: event.target.value };
                        setAvailabilityRules(next);
                      }}
                      placeholder="Timezone"
                    />
                    {rule.timezone && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        {rule.timezone}
                      </div>
                    )}
                  </div>
                  <Input
                    type="time"
                    value={normalizeTimeValue(rule.startTime as any)}
                    onChange={(event) => {
                      const next = [...availabilityRules];
                      next[index] = { ...rule, startTime: event.target.value };
                      setAvailabilityRules(next);
                    }}
                  />
                  <Input
                    type="time"
                    value={normalizeTimeValue(rule.endTime as any)}
                    onChange={(event) => {
                      const next = [...availabilityRules];
                      next[index] = { ...rule, endTime: event.target.value };
                      setAvailabilityRules(next);
                    }}
                  />
                  <Button
                    variant="ghost"
                    onClick={() => setAvailabilityRules(availabilityRules.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                  <Button
                    variant={rule.isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const next = [...availabilityRules];
                      next[index] = { ...rule, isActive: !rule.isActive };
                      setAvailabilityRules(next);
                    }}
                  >
                    {rule.isActive ? "Active" : "Inactive"}
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  setAvailabilityRules([
                    ...availabilityRules,
                    {
                      id: "",
                      cfiProfileId: profile?.id || "",
                      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
                      weekday: 1,
                      startTime: "09:00",
                      endTime: "17:00",
                      isActive: true,
                    } as CfiAvailabilityRule,
                  ])
                }
              >
                Add rule
              </Button>
              <Button onClick={() => saveAvailabilityMutation.mutate()} disabled={saveAvailabilityMutation.isPending}>
                {saveAvailabilityMutation.isPending ? "Saving..." : "Save availability"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credentials</CardTitle>
            <CardDescription>Upload CFI, pilot, and medical documents for publish and verification.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-sm font-semibold mb-2">Required before publish</div>
              <div className="flex flex-wrap gap-2">
                {credentialReadiness.checks.map((check) => (
                  <Badge key={check.key} variant={check.met ? "default" : "outline"}>
                    {check.met ? "OK" : "Required"} {check.label}
                  </Badge>
                ))}
              </div>
            </div>
            {dashboardData?.credentials?.length ? (
              <div className="space-y-3">
                {dashboardData.credentials.map((credential) => (
                  <div key={credential.id} className="flex flex-col gap-2 border rounded-lg p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{credential.type}</div>
                        <div className="text-xs text-muted-foreground">{credential.fileName}</div>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => deleteCredentialMutation.mutate(credential.id)}
                        disabled={deleteCredentialMutation.isPending}
                      >
                        Remove
                      </Button>
                    </div>
                    {credential.expiresOn && (
                      <div className="text-xs text-muted-foreground">
                        Expires: {new Date(credential.expiresOn).toLocaleDateString()}
                      </div>
                    )}
                    {credential.notes && <div className="text-xs text-muted-foreground">{credential.notes}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No credentials uploaded yet.</p>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <Select
                value={credentialForm.type}
                onValueChange={(value) => setCredentialForm({ ...credentialForm, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Credential type" />
                </SelectTrigger>
                <SelectContent>
                  {cfiCredentialTypeOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={credentialForm.fileName}
                onChange={(event) => setCredentialForm({ ...credentialForm, fileName: event.target.value })}
                placeholder="File name"
              />
              <Input
                type="date"
                value={credentialForm.expiresOn}
                onChange={(event) => setCredentialForm({ ...credentialForm, expiresOn: event.target.value })}
              />
              <div className="flex items-center gap-2">
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={20 * 1024 * 1024}
                  allowedFileTypes={["image/*", ".pdf"]}
                  enableImageEditor={false}
                  onGetUploadParameters={handleCredentialGetUploadParameters}
                  onComplete={handleCredentialUploadComplete}
                  onError={(message) => {
                    toast({
                      title: "Upload failed",
                      description: message,
                      variant: "destructive",
                    });
                  }}
                  buttonVariant="outline"
                >
                  Upload document
                </ObjectUploader>
                {credentialForm.fileName ? (
                  <span className="text-xs text-muted-foreground truncate">{credentialForm.fileName}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">PDF or image</span>
                )}
              </div>
              <Input
                value={credentialForm.fileUrl}
                onChange={(event) => setCredentialForm({ ...credentialForm, fileUrl: event.target.value })}
                placeholder="File URL"
                className="md:col-span-2"
              />
            </div>
            <Textarea
              value={credentialForm.notes}
              onChange={(event) => setCredentialForm({ ...credentialForm, notes: event.target.value })}
              placeholder="Notes"
              rows={2}
            />
            <Button
              onClick={() => createCredentialMutation.mutate()}
              disabled={
                createCredentialMutation.isPending ||
                !credentialForm.type.trim() ||
                !credentialForm.fileName.trim() ||
                !credentialForm.fileUrl.trim()
              }
            >
              {createCredentialMutation.isPending ? "Adding..." : "Add credential"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Booking requests
              {pendingBookingCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {pendingBookingCount} pending
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Respond to incoming training requests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {bookingRequests.length === 0 && (
              <p className="text-sm text-muted-foreground">No booking requests yet.</p>
            )}
            {[...bookingRequests]
              .sort((a, b) => {
                if (a.status === "PENDING" && b.status !== "PENDING") return -1;
                if (a.status !== "PENDING" && b.status === "PENDING") return 1;
                return 0;
              })
              .map((request) => (
              <div
                key={request.id}
                className={`border rounded-lg p-3 space-y-2 ${
                  request.status === "PENDING"
                    ? "border-amber-200 bg-amber-50/40"
                    : request.status === "CONFIRMED"
                      ? "border-emerald-200 bg-emerald-50/40"
                      : "border-muted"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{request.sessionType}</div>
                  <Badge variant="outline">{request.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(request.requestedStart).toLocaleString()} - {new Date(request.requestedEnd).toLocaleString()}
                </div>
                {request.location && <div className="text-xs text-muted-foreground">Location: {request.location}</div>}
                {request.notes && <div className="text-xs text-muted-foreground">Notes: {request.notes}</div>}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => updateBookingMutation.mutate({ id: request.id, status: "CONFIRMED" })}
                    disabled={updateBookingMutation.isPending}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateBookingMutation.mutate({ id: request.id, status: "DECLINED" })}
                    disabled={updateBookingMutation.isPending}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
    </PageShell>
  );
}
