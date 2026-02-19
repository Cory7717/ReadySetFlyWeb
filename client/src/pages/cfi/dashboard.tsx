import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CfiAvailabilityRule, CfiBookingRequest, CfiCredential, CfiProfile } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";

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

type DashboardResponse = {
  profile: CfiProfile;
  credentials: CfiCredential[];
  availability: CfiAvailabilityRule[];
  legal: { cfi_terms: boolean };
} | null;

export default function CfiDashboard() {
  const { user } = useAuth();
  const entitlements = (user as any)?.entitlements;
  const isPro = entitlements?.tier && entitlements.tier !== "free";
  const { toast } = useToast();

  useEffect(() => {
    trackEvent("cfi_dashboard_view");
  }, []);

  const { data: dashboardData, isLoading } = useQuery<DashboardResponse>({
    queryKey: ["/api/cfi/profile"],
    enabled: !!isPro,
  });

  const { data: bookingRequests = [] } = useQuery<CfiBookingRequest[]>({
    queryKey: ["/api/cfi/booking-requests"],
    enabled: !!isPro,
  });

  const profile = dashboardData?.profile;
  const [formState, setFormState] = useState({
    displayName: "",
    slug: "",
    headline: "",
    bio: "",
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

  useEffect(() => {
    if (!profile) return;
    setFormState({
      displayName: profile.displayName || "",
      slug: profile.slug || "",
      headline: profile.headline || "",
      bio: profile.bio || "",
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

  if (!isPro) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-10">
          <Card>
            <CardHeader>
              <CardTitle>RSF Pro required</CardTitle>
              <CardDescription>CFI booking tools are included with Pro Core.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upgrade to RSF Pro to publish a CFI profile, manage availability, and receive booking requests.
              </p>
              <Button asChild>
                <Link href="/logbook/pro">Upgrade to RSF Pro</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Loading CFI dashboard...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <div className="space-y-2">
          <Badge variant="outline">CFI Dashboard</Badge>
          <h1 className="text-3xl font-bold">Manage your CFI profile</h1>
          <p className="text-muted-foreground">Update your public profile, availability, and booking requests.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile details</CardTitle>
            <CardDescription>Keep your profile current for students searching the directory.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                <div key={rule.id || index} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto] items-center">
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
                  <Input
                    value={rule.timezone}
                    onChange={(event) => {
                      const next = [...availabilityRules];
                      next[index] = { ...rule, timezone: event.target.value };
                      setAvailabilityRules(next);
                    }}
                    placeholder="Timezone"
                  />
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
            <CardDescription>Upload certificates or documents to build trust.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Input
                value={credentialForm.type}
                onChange={(event) => setCredentialForm({ ...credentialForm, type: event.target.value })}
                placeholder="Credential type"
              />
              <Input
                value={credentialForm.fileName}
                onChange={(event) => setCredentialForm({ ...credentialForm, fileName: event.target.value })}
                placeholder="File name"
              />
              <Input
                value={credentialForm.fileUrl}
                onChange={(event) => setCredentialForm({ ...credentialForm, fileUrl: event.target.value })}
                placeholder="File URL"
              />
              <Input
                type="date"
                value={credentialForm.expiresOn}
                onChange={(event) => setCredentialForm({ ...credentialForm, expiresOn: event.target.value })}
              />
            </div>
            <Textarea
              value={credentialForm.notes}
              onChange={(event) => setCredentialForm({ ...credentialForm, notes: event.target.value })}
              placeholder="Notes"
              rows={2}
            />
            <Button onClick={() => createCredentialMutation.mutate()} disabled={createCredentialMutation.isPending}>
              {createCredentialMutation.isPending ? "Adding..." : "Add credential"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booking requests</CardTitle>
            <CardDescription>Respond to incoming training requests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {bookingRequests.length === 0 && (
              <p className="text-sm text-muted-foreground">No booking requests yet.</p>
            )}
            {bookingRequests.map((request) => (
              <div key={request.id} className="border rounded-lg p-3 space-y-2">
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

        <Card>
          <CardHeader>
            <CardTitle>Publish & compliance</CardTitle>
            <CardDescription>Accept the CFI terms before going live.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={dashboardData?.legal?.cfi_terms ? "default" : "outline"}>
                {dashboardData?.legal?.cfi_terms ? "CFI terms accepted" : "CFI terms required"}
              </Badge>
              <Button
                variant="outline"
                onClick={() => acceptTermsMutation.mutate()}
                disabled={acceptTermsMutation.isPending}
              >
                Accept CFI terms
              </Button>
              <Button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending || !dashboardData?.legal?.cfi_terms}
              >
                Publish profile
              </Button>
            </div>
            {profile?.isPublished && <p className="text-sm text-muted-foreground">Your profile is live.</p>}
            <Button asChild variant="ghost">
              <Link href="/cfi/terms">Review CFI terms</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
