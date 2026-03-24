import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell } from "@/components/layout/PageShell";
import { apiUrl } from "@/lib/api";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type {
  FlyingClub,
  FlyingClubAircraft,
  FlyingClubAnnouncement,
  FlyingClubBlackout,
  FlyingClubDocument,
  FlyingClubJoinRequest,
  FlyingClubLegalAcceptance,
  FlyingClubMaintenanceItem,
  FlyingClubMember,
  FlyingClubReservation,
  FlyingClubSquawk,
} from "@shared/schema";

type FlyingClubDetailResponse = {
  club: FlyingClub;
  members: FlyingClubMember[];
  aircraft: FlyingClubAircraft[];
  reservations: FlyingClubReservation[];
  announcements: FlyingClubAnnouncement[];
  squawks: FlyingClubSquawk[];
  maintenanceItems: FlyingClubMaintenanceItem[];
  blackouts: FlyingClubBlackout[];
  documents: FlyingClubDocument[];
  viewerAcceptances: FlyingClubLegalAcceptance[];
  pendingRequiredDocuments: FlyingClubDocument[];
  joinRequests: FlyingClubJoinRequest[];
  viewerJoinRequest: FlyingClubJoinRequest | null;
  viewerMembership: FlyingClubMember | null;
  canManage: boolean;
  canReserve: boolean;
};

const EMPTY_AIRCRAFT = {
  displayName: "",
  tailNumber: "",
  makeModel: "",
  hourlyRateWet: "",
  hourlyRateDry: "",
  notes: "",
};

const EMPTY_RESERVATION = {
  aircraftId: "",
  startAt: "",
  endAt: "",
  purpose: "",
  notes: "",
};

const EMPTY_ANNOUNCEMENT = {
  title: "",
  body: "",
};

const EMPTY_JOIN_REQUEST = {
  message: "",
};

const EMPTY_DOCUMENT = {
  title: "",
  category: "club_rules",
  version: "1.0",
  requiresAcceptance: true,
};

const EMPTY_SQUAWK = {
  aircraftId: "",
  title: "",
  description: "",
  severity: "minor",
  groundsAircraft: false,
};

const EMPTY_MAINTENANCE = {
  aircraftId: "",
  itemType: "maintenance",
  title: "",
  description: "",
  status: "open",
  dueDate: "",
  blocksScheduling: false,
  complianceReference: "",
  notes: "",
};

const EMPTY_BLACKOUT = {
  aircraftId: "",
  title: "",
  reason: "",
  startAt: "",
  endAt: "",
};

function formatDateTime(value?: string | Date | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString();
}

function formatDocumentCategory(value?: string | null) {
  if (!value) return "General";
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function FlyingClubDetailPage() {
  const [, params] = useRoute("/flying-clubs/:slug");
  const slug = params?.slug;
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [aircraftForm, setAircraftForm] = useState(EMPTY_AIRCRAFT);
  const [reservationForm, setReservationForm] = useState(EMPTY_RESERVATION);
  const [announcementForm, setAnnouncementForm] = useState(EMPTY_ANNOUNCEMENT);
  const [fleetCsvText, setFleetCsvText] = useState("");
  const [joinRequestForm, setJoinRequestForm] = useState(EMPTY_JOIN_REQUEST);
  const [documentForm, setDocumentForm] = useState(EMPTY_DOCUMENT);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [squawkForm, setSquawkForm] = useState(EMPTY_SQUAWK);
  const [maintenanceForm, setMaintenanceForm] = useState(EMPTY_MAINTENANCE);
  const [blackoutForm, setBlackoutForm] = useState(EMPTY_BLACKOUT);
  const [isSavingAircraft, setIsSavingAircraft] = useState(false);
  const [isImportingFleet, setIsImportingFleet] = useState(false);
  const [isSavingReservation, setIsSavingReservation] = useState(false);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [isSubmittingJoinRequest, setIsSubmittingJoinRequest] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isSavingSquawk, setIsSavingSquawk] = useState(false);
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);
  const [isSavingBlackout, setIsSavingBlackout] = useState(false);
  const [acceptingDocumentId, setAcceptingDocumentId] = useState<string | null>(null);
  const [reviewingJoinRequestId, setReviewingJoinRequestId] = useState<string | null>(null);
  const [updatingOpsId, setUpdatingOpsId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<FlyingClubDetailResponse>({
    queryKey: slug ? [`/api/flying-clubs/${slug}`] : ["flying-club-detail", "missing"],
    enabled: !!slug,
  });

  const upcomingReservations = useMemo(() => {
    const reservations = data?.reservations ?? [];
    return [...reservations].sort(
      (a, b) => new Date(a.startAt as any).getTime() - new Date(b.startAt as any).getTime(),
    );
  }, [data?.reservations]);

  const aircraftOptions = data?.aircraft ?? [];
  const requiredDocuments = useMemo(
    () => (data?.documents ?? []).filter((document) => document.isActive && document.requiresAcceptance),
    [data?.documents],
  );
  const acceptedDocumentKeys = useMemo(
    () =>
      new Set(
        (data?.viewerAcceptances ?? []).map(
          (acceptance) => `${acceptance.documentId}:${acceptance.version}`,
        ),
      ),
    [data?.viewerAcceptances],
  );

  const refreshClub = async () => {
    if (!slug) return;
    await queryClient.invalidateQueries({ queryKey: [`/api/flying-clubs/${slug}`] });
    await queryClient.invalidateQueries({ queryKey: ["/api/flying-clubs"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/flying-clubs/mine"] });
  };

  const handleFleetFile = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    setFleetCsvText(text);
  };

  const createAircraft = async () => {
    if (!data) return;
    if (!aircraftForm.displayName.trim()) {
      toast({ title: "Aircraft name required", variant: "destructive" });
      return;
    }
    setIsSavingAircraft(true);
    try {
      await apiRequest("POST", `/api/flying-clubs/${data.club.id}/aircraft`, {
        ...aircraftForm,
        status: "active",
      });
      setAircraftForm(EMPTY_AIRCRAFT);
      await refreshClub();
      toast({ title: "Club aircraft added" });
    } catch (error: any) {
      toast({ title: "Could not add aircraft", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingAircraft(false);
    }
  };

  const importFleetCsv = async () => {
    if (!data) return;
    if (!fleetCsvText.trim()) {
      toast({
        title: "Fleet CSV required",
        description: "Paste CSV text or upload a .csv file first.",
        variant: "destructive",
      });
      return;
    }
    setIsImportingFleet(true);
    try {
      const response = await apiRequest("POST", `/api/flying-clubs/${data.club.id}/aircraft/import`, {
        csvText: fleetCsvText,
      });
      const payload = await response.json();
      setFleetCsvText("");
      await refreshClub();
      toast({ title: "Fleet imported", description: `${payload.importedCount} aircraft added.` });
    } catch (error: any) {
      toast({ title: "Fleet import failed", description: error.message, variant: "destructive" });
    } finally {
      setIsImportingFleet(false);
    }
  };

  const createReservation = async () => {
    if (!data) return;
    if (!reservationForm.aircraftId || !reservationForm.startAt || !reservationForm.endAt) {
      toast({
        title: "Reservation fields missing",
        description: "Aircraft, start, and end time are required.",
        variant: "destructive",
      });
      return;
    }
    setIsSavingReservation(true);
    try {
      await apiRequest("POST", `/api/flying-clubs/${data.club.id}/reservations`, reservationForm);
      setReservationForm(EMPTY_RESERVATION);
      await refreshClub();
      toast({ title: "Reservation created" });
    } catch (error: any) {
      toast({ title: "Reservation failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingReservation(false);
    }
  };

  const createAnnouncement = async () => {
    if (!data) return;
    if (!announcementForm.title.trim() || !announcementForm.body.trim()) {
      toast({ title: "Announcement fields missing", variant: "destructive" });
      return;
    }
    setIsSavingAnnouncement(true);
    try {
      await apiRequest("POST", `/api/flying-clubs/${data.club.id}/announcements`, announcementForm);
      setAnnouncementForm(EMPTY_ANNOUNCEMENT);
      await refreshClub();
      toast({ title: "Announcement posted" });
    } catch (error: any) {
      toast({ title: "Announcement failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  const submitJoinRequest = async () => {
    if (!data) return;
    setIsSubmittingJoinRequest(true);
    try {
      await apiRequest("POST", `/api/flying-clubs/${data.club.id}/join-requests`, joinRequestForm);
      setJoinRequestForm(EMPTY_JOIN_REQUEST);
      await refreshClub();
      toast({ title: "Join request submitted" });
    } catch (error: any) {
      toast({ title: "Join request failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmittingJoinRequest(false);
    }
  };

  const reviewJoinRequest = async (requestId: string, action: "approve" | "decline") => {
    if (!data) return;
    setReviewingJoinRequestId(requestId);
    try {
      await apiRequest("PATCH", `/api/flying-clubs/${data.club.id}/join-requests/${requestId}`, { action });
      await refreshClub();
      toast({ title: action === "approve" ? "Member approved" : "Request declined" });
    } catch (error: any) {
      toast({ title: "Join request update failed", description: error.message, variant: "destructive" });
    } finally {
      setReviewingJoinRequestId(null);
    }
  };

  const uploadClubDocument = async () => {
    if (!data) return;
    if (!documentForm.title.trim()) {
      toast({ title: "Document title required", variant: "destructive" });
      return;
    }
    if (!documentFile) {
      toast({ title: "Document file required", variant: "destructive" });
      return;
    }

    setIsUploadingDocument(true);
    try {
      const initResponse = await fetch(apiUrl(`/api/flying-clubs/${data.club.id}/documents/upload`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          contentType: documentFile.type || "application/octet-stream",
        }),
      });
      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        throw new Error(errorText || "Failed to prepare document upload");
      }

      const { uploadURL, storageProvider, storagePath } = (await initResponse.json()) as {
        uploadURL: string;
        storageProvider: string;
        storagePath: string;
      };

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: documentFile,
        headers: {
          "Content-Type": documentFile.type || "application/octet-stream",
        },
      });
      if (!uploadResponse.ok) {
        throw new Error("Failed to upload document file");
      }

      await apiRequest("POST", `/api/flying-clubs/${data.club.id}/documents`, {
        title: documentForm.title.trim(),
        category: documentForm.category.trim() || "general",
        fileName: documentFile.name,
        storageProvider,
        storagePath,
        mimeType: documentFile.type || null,
        version: documentForm.version.trim() || "1.0",
        requiresAcceptance: documentForm.requiresAcceptance,
        isActive: true,
      });

      setDocumentForm(EMPTY_DOCUMENT);
      setDocumentFile(null);
      await refreshClub();
      toast({ title: "Club document uploaded" });
    } catch (error: any) {
      toast({ title: "Document upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploadingDocument(false);
    }
  };

  const acceptDocument = async (documentId: string) => {
    if (!data) return;
    setAcceptingDocumentId(documentId);
    try {
      await apiRequest("POST", `/api/flying-clubs/${data.club.id}/legal-acceptances`, { documentId });
      await refreshClub();
      toast({ title: "Club document accepted" });
    } catch (error: any) {
      toast({ title: "Acceptance failed", description: error.message, variant: "destructive" });
    } finally {
      setAcceptingDocumentId(null);
    }
  };

  const createSquawk = async () => {
    if (!data) return;
    if (!squawkForm.aircraftId || !squawkForm.title.trim()) {
      toast({ title: "Aircraft and squawk title are required", variant: "destructive" });
      return;
    }
    setIsSavingSquawk(true);
    try {
      await apiRequest("POST", `/api/flying-clubs/${data.club.id}/squawks`, squawkForm);
      setSquawkForm(EMPTY_SQUAWK);
      await refreshClub();
      toast({ title: "Squawk reported" });
    } catch (error: any) {
      toast({ title: "Could not report squawk", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingSquawk(false);
    }
  };

  const updateSquawkStatus = async (squawkId: string, status: string) => {
    if (!data) return;
    setUpdatingOpsId(squawkId);
    try {
      await apiRequest("PATCH", `/api/flying-clubs/${data.club.id}/squawks/${squawkId}`, { status });
      await refreshClub();
      toast({ title: "Squawk updated" });
    } catch (error: any) {
      toast({ title: "Could not update squawk", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingOpsId(null);
    }
  };

  const updateAircraftStatus = async (aircraftId: string, status: string) => {
    if (!data) return;
    setUpdatingOpsId(aircraftId);
    try {
      await apiRequest("PATCH", `/api/flying-clubs/${data.club.id}/aircraft/${aircraftId}`, { status });
      await refreshClub();
      toast({ title: "Aircraft status updated" });
    } catch (error: any) {
      toast({ title: "Could not update aircraft", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingOpsId(null);
    }
  };

  const createMaintenanceItem = async () => {
    if (!data) return;
    if (!maintenanceForm.aircraftId || !maintenanceForm.title.trim()) {
      toast({ title: "Aircraft and maintenance title are required", variant: "destructive" });
      return;
    }
    setIsSavingMaintenance(true);
    try {
      await apiRequest("POST", `/api/flying-clubs/${data.club.id}/maintenance-items`, {
        ...maintenanceForm,
        dueDate: maintenanceForm.dueDate ? maintenanceForm.dueDate : null,
      });
      setMaintenanceForm(EMPTY_MAINTENANCE);
      await refreshClub();
      toast({ title: "Maintenance item added" });
    } catch (error: any) {
      toast({ title: "Could not add maintenance item", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingMaintenance(false);
    }
  };

  const updateMaintenanceStatus = async (itemId: string, status: string) => {
    if (!data) return;
    setUpdatingOpsId(itemId);
    try {
      await apiRequest("PATCH", `/api/flying-clubs/${data.club.id}/maintenance-items/${itemId}`, { status });
      await refreshClub();
      toast({ title: "Maintenance item updated" });
    } catch (error: any) {
      toast({ title: "Could not update maintenance item", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingOpsId(null);
    }
  };

  const createBlackout = async () => {
    if (!data) return;
    if (!blackoutForm.aircraftId || !blackoutForm.title.trim() || !blackoutForm.startAt || !blackoutForm.endAt) {
      toast({ title: "Aircraft, title, start, and end are required", variant: "destructive" });
      return;
    }
    setIsSavingBlackout(true);
    try {
      await apiRequest("POST", `/api/flying-clubs/${data.club.id}/blackouts`, blackoutForm);
      setBlackoutForm(EMPTY_BLACKOUT);
      await refreshClub();
      toast({ title: "Aircraft blackout added" });
    } catch (error: any) {
      toast({ title: "Could not add blackout", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingBlackout(false);
    }
  };

  const updateBlackoutStatus = async (blackoutId: string, status: string) => {
    if (!data) return;
    setUpdatingOpsId(blackoutId);
    try {
      await apiRequest("PATCH", `/api/flying-clubs/${data.club.id}/blackouts/${blackoutId}`, { status });
      await refreshClub();
      toast({ title: "Blackout updated" });
    } catch (error: any) {
      toast({ title: "Could not update blackout", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingOpsId(null);
    }
  };

  if (isLoading || !data) {
    return (
      <PageShell
        kicker="Flying Clubs"
        title="Loading club..."
        description="Preparing the club workspace."
        contentClassName="space-y-6"
      >
        <div className="text-sm text-muted-foreground">Loading flying club...</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      kicker="Flying Club"
      title={data.club.name}
      description={data.club.description || "Club profile, fleet, member roster, governance, and scheduling workspace."}
      actions={
        <>
          <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">
            {data.club.homeAirport || "Club profile"}
          </Badge>
          <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">
            {data.club.status}
          </Badge>
        </>
      }
      contentClassName="space-y-8"
    >
      <section className="grid gap-4 md:grid-cols-4">
        <Card className="border-white/12 bg-white/82">
          <CardHeader>
            <CardTitle>{data.members.filter((member) => member.status === "active").length}</CardTitle>
            <CardDescription>Active members</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-white/12 bg-white/82">
          <CardHeader>
            <CardTitle>{data.aircraft.length}</CardTitle>
            <CardDescription>Fleet records</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-white/12 bg-white/82">
          <CardHeader>
            <CardTitle>{upcomingReservations.length}</CardTitle>
            <CardDescription>Scheduled reservations</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-white/12 bg-white/82">
          <CardHeader>
            <CardTitle>{data.viewerMembership?.role || (data.canManage ? "manager" : "visitor")}</CardTitle>
            <CardDescription>Your access level</CardDescription>
          </CardHeader>
        </Card>
      </section>

      {data.pendingRequiredDocuments.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-950">Review required club documents before booking</CardTitle>
            <CardDescription className="text-amber-900">
              {data.pendingRequiredDocuments.length} required document
              {data.pendingRequiredDocuments.length === 1 ? "" : "s"} still need acceptance for this club.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-950">
            {data.pendingRequiredDocuments.map((document) => (
              <div key={document.id}>
                {document.title} (v{document.version})
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-slate-300 bg-white p-1 md:grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="fleet">Fleet</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="ops">Ops</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card className="border-white/12 bg-white/86">
            <CardHeader>
              <CardTitle>Club Details</CardTitle>
              <CardDescription>
                {[data.club.city, data.club.state].filter(Boolean).join(", ") || "Location coming soon"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              <div>{data.club.policiesSummary || data.club.bookingNotes || "This club is building its operating workflow inside RSF."}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="font-medium text-slate-900">Club booking governance</div>
                <div className="mt-2 text-sm text-slate-600">
                  {data.club.requirePolicyAcceptanceBeforeBooking
                    ? "Members must accept required club rules and agreement documents before booking aircraft."
                    : "This club currently allows booking without a required policy acceptance gate."}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {data.club.websiteUrl ? (
                  <a href={data.club.websiteUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                    Visit website
                  </a>
                ) : null}
                {data.club.contactEmail ? (
                  <a href={`mailto:${data.club.contactEmail}`} className="text-primary underline">
                    Email club
                  </a>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {!data.viewerMembership && !data.canManage ? (
            <Card className="border-white/12 bg-white/86">
              <CardHeader>
                <CardTitle>Join This Club</CardTitle>
                <CardDescription>Send a membership request to the club manager.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isAuthenticated ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-muted-foreground">
                    Sign in to apply for club membership.
                    <div className="mt-3 flex gap-3">
                      <Button asChild size="sm">
                        <Link href="/login">Sign in</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/register">Create account</Link>
                      </Button>
                    </div>
                  </div>
                ) : data.viewerJoinRequest?.status === "pending" ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
                    Your join request is pending review.
                  </div>
                ) : (
                  <>
                    <Textarea
                      value={joinRequestForm.message}
                      onChange={(event) => setJoinRequestForm({ message: event.target.value })}
                      placeholder="Short note to the club manager (optional)"
                      rows={4}
                    />
                    <Button onClick={submitJoinRequest} disabled={isSubmittingJoinRequest}>
                      {isSubmittingJoinRequest ? "Submitting..." : "Apply to join club"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-white/12 bg-white/86">
            <CardHeader>
              <CardTitle>Member Roster</CardTitle>
              <CardDescription>Current members and club roles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900">{member.userId}</div>
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{member.status}</div>
                  </div>
                  <Badge variant="outline">{member.role}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {data.canManage ? (
            <Card className="border-white/12 bg-white/86">
              <CardHeader>
                <CardTitle>Join Requests</CardTitle>
                <CardDescription>Review new membership requests from pilots who want to join this club.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.joinRequests.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-muted-foreground">
                    No join requests yet.
                  </div>
                ) : (
                  data.joinRequests.map((request) => (
                    <div key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-slate-900">{request.applicantUserId}</div>
                          <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{request.status}</div>
                        </div>
                        {request.status === "pending" ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => reviewJoinRequest(request.id, "approve")}
                              disabled={reviewingJoinRequestId === request.id}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reviewJoinRequest(request.id, "decline")}
                              disabled={reviewingJoinRequestId === request.id}
                            >
                              Decline
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      {request.message ? <div className="mt-3 text-sm text-slate-700">{request.message}</div> : null}
                      <div className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-500">
                        {formatDateTime(request.createdAt)}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="fleet" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card className="border-white/12 bg-white/86">
              <CardHeader>
                <CardTitle>Fleet Directory</CardTitle>
                <CardDescription>Aircraft assigned to this club for member visibility and scheduling.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.aircraft.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-muted-foreground">
                    No club aircraft added yet.
                  </div>
                ) : (
                  data.aircraft.map((aircraft) => (
                    <div key={aircraft.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{aircraft.displayName}</div>
                          <div className="text-sm text-muted-foreground">
                            {[aircraft.tailNumber, aircraft.makeModel].filter(Boolean).join(" / ") || "Club aircraft"}
                          </div>
                        </div>
                        <Badge variant="outline">{aircraft.status}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                        {aircraft.hourlyRateWet ? <div>Wet: ${aircraft.hourlyRateWet}/hr</div> : null}
                        {aircraft.hourlyRateDry ? <div>Dry: ${aircraft.hourlyRateDry}/hr</div> : null}
                      </div>
                      {aircraft.notes ? <div className="mt-3 text-sm text-muted-foreground">{aircraft.notes}</div> : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              {data.canManage ? (
                <>
                  <Card className="border-white/12 bg-white/86">
                    <CardHeader>
                      <CardTitle>Add Aircraft</CardTitle>
                      <CardDescription>Add one fleet record manually for scheduling and member visibility.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Input
                        value={aircraftForm.displayName}
                        onChange={(event) => setAircraftForm((current) => ({ ...current, displayName: event.target.value }))}
                        placeholder="Display name"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          value={aircraftForm.tailNumber}
                          onChange={(event) => setAircraftForm((current) => ({ ...current, tailNumber: event.target.value }))}
                          placeholder="Tail number"
                        />
                        <Input
                          value={aircraftForm.makeModel}
                          onChange={(event) => setAircraftForm((current) => ({ ...current, makeModel: event.target.value }))}
                          placeholder="Make / model"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          value={aircraftForm.hourlyRateWet}
                          onChange={(event) => setAircraftForm((current) => ({ ...current, hourlyRateWet: event.target.value }))}
                          placeholder="Wet rate"
                        />
                        <Input
                          value={aircraftForm.hourlyRateDry}
                          onChange={(event) => setAircraftForm((current) => ({ ...current, hourlyRateDry: event.target.value }))}
                          placeholder="Dry rate"
                        />
                      </div>
                      <Textarea
                        value={aircraftForm.notes}
                        onChange={(event) => setAircraftForm((current) => ({ ...current, notes: event.target.value }))}
                        placeholder="Notes"
                        rows={3}
                      />
                      <Button onClick={createAircraft} disabled={isSavingAircraft} className="w-full">
                        {isSavingAircraft ? "Saving aircraft..." : "Add club aircraft"}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-white/12 bg-white/86">
                    <CardHeader>
                      <CardTitle>Upload Fleet CSV</CardTitle>
                      <CardDescription>
                        Accepted headers: <code>display_name, tail_number, make_model, hourly_rate_wet, hourly_rate_dry, status, notes</code>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Input
                        type="file"
                        accept=".csv"
                        onChange={(event) => handleFleetFile(event.target.files?.[0] ?? null)}
                        aria-label="Upload fleet CSV"
                        title="Upload fleet CSV"
                      />
                      <Textarea
                        value={fleetCsvText}
                        onChange={(event) => setFleetCsvText(event.target.value)}
                        placeholder="Paste fleet CSV here or upload a file"
                        rows={8}
                      />
                      <Button onClick={importFleetCsv} disabled={isImportingFleet} className="w-full">
                        {isImportingFleet ? "Importing fleet..." : "Import fleet CSV"}
                      </Button>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="border-white/12 bg-white/86">
                  <CardHeader>
                    <CardTitle>Club Fleet Access</CardTitle>
                    <CardDescription>Only club managers can add or import aircraft records.</CardDescription>
                  </CardHeader>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card className="border-white/12 bg-white/86">
              <CardHeader>
                <CardTitle>Reservation Schedule</CardTitle>
                <CardDescription>Upcoming club aircraft bookings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {upcomingReservations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-muted-foreground">
                    No reservations have been created yet.
                  </div>
                ) : (
                  upcomingReservations.map((reservation) => {
                    const aircraft = aircraftOptions.find((entry) => entry.id === reservation.aircraftId);
                    return (
                      <div key={reservation.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">{aircraft?.displayName || "Club aircraft"}</div>
                            <div className="text-sm text-muted-foreground">{reservation.purpose || "Club reservation"}</div>
                          </div>
                          <Badge variant="outline">{reservation.status}</Badge>
                        </div>
                        <div className="mt-3 grid gap-1 text-sm text-slate-700">
                          <div>Start: {formatDateTime(reservation.startAt)}</div>
                          <div>End: {formatDateTime(reservation.endAt)}</div>
                        </div>
                        {reservation.notes ? <div className="mt-3 text-sm text-muted-foreground">{reservation.notes}</div> : null}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="border-white/12 bg-white/86">
              <CardHeader>
                <CardTitle>Create Reservation</CardTitle>
                <CardDescription>Reserve a club aircraft time slot. Conflicts are blocked automatically.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isAuthenticated ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-muted-foreground">
                    Sign in to reserve aircraft time.
                    <div className="mt-3 flex gap-3">
                      <Button asChild size="sm">
                        <Link href="/login">Sign in</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/register">Create account</Link>
                      </Button>
                    </div>
                  </div>
                ) : data.pendingRequiredDocuments.length > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-950">
                    Accept the required club documents in the Documents tab before creating a reservation.
                  </div>
                ) : !data.canReserve ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-muted-foreground">
                    Active club membership is required to make reservations.
                  </div>
                ) : (
                  <>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={reservationForm.aircraftId}
                      onChange={(event) => setReservationForm((current) => ({ ...current, aircraftId: event.target.value }))}
                    >
                      <option value="">Select club aircraft</option>
                      {aircraftOptions.map((aircraft) => (
                        <option key={aircraft.id} value={aircraft.id}>
                          {aircraft.displayName}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="datetime-local"
                      value={reservationForm.startAt}
                      onChange={(event) => setReservationForm((current) => ({ ...current, startAt: event.target.value }))}
                    />
                    <Input
                      type="datetime-local"
                      value={reservationForm.endAt}
                      onChange={(event) => setReservationForm((current) => ({ ...current, endAt: event.target.value }))}
                    />
                    <Input
                      value={reservationForm.purpose}
                      onChange={(event) => setReservationForm((current) => ({ ...current, purpose: event.target.value }))}
                      placeholder="Purpose of flight"
                    />
                    <Textarea
                      value={reservationForm.notes}
                      onChange={(event) => setReservationForm((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="Notes"
                      rows={3}
                    />
                    <Button onClick={createReservation} disabled={isSavingReservation} className="w-full">
                      {isSavingReservation ? "Saving reservation..." : "Create reservation"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ops" className="space-y-6">
          <div className="grid gap-6">
            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="border-white/12 bg-white/86">
                <CardHeader>
                  <CardTitle>Aircraft Status</CardTitle>
                  <CardDescription>Set aircraft availability before members book time.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.aircraft.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No aircraft available yet.</div>
                  ) : (
                    data.aircraft.map((aircraft) => (
                      <div key={aircraft.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-900">{aircraft.displayName}</div>
                            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{aircraft.status}</div>
                          </div>
                          {data.canManage ? (
                            <select
                              className="flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                              value={aircraft.status}
                              onChange={(event) => updateAircraftStatus(aircraft.id, event.target.value)}
                              disabled={updatingOpsId === aircraft.id}
                            >
                              <option value="active">Active</option>
                              <option value="limited">Limited</option>
                              <option value="maintenance">Maintenance</option>
                              <option value="grounded">Grounded</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          ) : (
                            <Badge variant="outline">{aircraft.status}</Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/12 bg-white/86">
                <CardHeader>
                  <CardTitle>Open Squawks</CardTitle>
                  <CardDescription>Members can report discrepancies; managers can review and clear them.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.squawks.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No squawks reported.</div>
                  ) : (
                    data.squawks.map((squawk) => {
                      const aircraft = aircraftOptions.find((entry) => entry.id === squawk.aircraftId);
                      return (
                        <div key={squawk.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-slate-900">{squawk.title}</div>
                              <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
                                {[aircraft?.displayName, squawk.severity, squawk.status].filter(Boolean).join(" / ")}
                              </div>
                            </div>
                            {squawk.groundsAircraft ? <Badge>Grounds aircraft</Badge> : null}
                          </div>
                          {squawk.description ? <div className="mt-2 text-sm text-slate-700">{squawk.description}</div> : null}
                          {data.canManage && squawk.status !== "resolved" ? (
                            <div className="mt-3 flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => updateSquawkStatus(squawk.id, "in_review")} disabled={updatingOpsId === squawk.id}>
                                Review
                              </Button>
                              <Button size="sm" onClick={() => updateSquawkStatus(squawk.id, "resolved")} disabled={updatingOpsId === squawk.id}>
                                Resolve
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/12 bg-white/86">
                <CardHeader>
                  <CardTitle>Blackout Windows</CardTitle>
                  <CardDescription>Reserve downtime for maintenance, inspections, and club events.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.blackouts.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No blackout windows created yet.</div>
                  ) : (
                    data.blackouts.map((blackout) => {
                      const aircraft = aircraftOptions.find((entry) => entry.id === blackout.aircraftId);
                      return (
                        <div key={blackout.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-medium text-slate-900">{blackout.title}</div>
                              <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
                                {[aircraft?.displayName, blackout.status].filter(Boolean).join(" / ")}
                              </div>
                            </div>
                            {data.canManage && blackout.status === "active" ? (
                              <Button size="sm" variant="outline" onClick={() => updateBlackoutStatus(blackout.id, "completed")} disabled={updatingOpsId === blackout.id}>
                                Clear
                              </Button>
                            ) : null}
                          </div>
                          <div className="mt-2 text-sm text-slate-700">
                            {formatDateTime(blackout.startAt)} to {formatDateTime(blackout.endAt)}
                          </div>
                          {blackout.reason ? <div className="mt-2 text-sm text-muted-foreground">{blackout.reason}</div> : null}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="border-white/12 bg-white/86">
                <CardHeader>
                  <CardTitle>Report Squawk</CardTitle>
                  <CardDescription>Log an issue the club needs to review before the next flight.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!data.canReserve ? (
                    <div className="text-sm text-muted-foreground">Active club membership is required to report squawks.</div>
                  ) : (
                    <>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={squawkForm.aircraftId} onChange={(event) => setSquawkForm((current) => ({ ...current, aircraftId: event.target.value }))}>
                        <option value="">Select club aircraft</option>
                        {aircraftOptions.map((aircraft) => (
                          <option key={aircraft.id} value={aircraft.id}>{aircraft.displayName}</option>
                        ))}
                      </select>
                      <Input value={squawkForm.title} onChange={(event) => setSquawkForm((current) => ({ ...current, title: event.target.value }))} placeholder="Squawk title" />
                      <Textarea value={squawkForm.description} onChange={(event) => setSquawkForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the discrepancy" rows={4} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={squawkForm.severity} onChange={(event) => setSquawkForm((current) => ({ ...current, severity: event.target.value }))}>
                          <option value="info">Info</option>
                          <option value="minor">Minor</option>
                          <option value="major">Major</option>
                          <option value="critical">Critical</option>
                        </select>
                        <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
                          <input type="checkbox" checked={squawkForm.groundsAircraft} onChange={(event) => setSquawkForm((current) => ({ ...current, groundsAircraft: event.target.checked }))} />
                          Grounds aircraft
                        </label>
                      </div>
                      <Button onClick={createSquawk} disabled={isSavingSquawk} className="w-full">
                        {isSavingSquawk ? "Saving squawk..." : "Report squawk"}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/12 bg-white/86">
                <CardHeader>
                  <CardTitle>Maintenance & AD Tracking</CardTitle>
                  <CardDescription>Track inspections, ADs, oil, and maintenance tasks with scheduling impact.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-3">
                    {data.maintenanceItems.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No maintenance items logged yet.</div>
                    ) : (
                      data.maintenanceItems.map((item) => {
                        const aircraft = aircraftOptions.find((entry) => entry.id === item.aircraftId);
                        return (
                          <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-slate-900">{item.title}</div>
                                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
                                  {[aircraft?.displayName, item.itemType, item.status].filter(Boolean).join(" / ")}
                                </div>
                              </div>
                              {item.blocksScheduling ? <Badge variant="secondary">Blocks scheduling</Badge> : null}
                            </div>
                            {item.dueDate ? <div className="mt-2 text-sm text-slate-700">Due: {formatDateTime(item.dueDate)}</div> : null}
                            {data.canManage && item.status !== "completed" ? (
                              <div className="mt-3 flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => updateMaintenanceStatus(item.id, "scheduled")} disabled={updatingOpsId === item.id}>
                                  Schedule
                                </Button>
                                <Button size="sm" onClick={() => updateMaintenanceStatus(item.id, "completed")} disabled={updatingOpsId === item.id}>
                                  Complete
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                  {data.canManage ? (
                    <>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={maintenanceForm.aircraftId} onChange={(event) => setMaintenanceForm((current) => ({ ...current, aircraftId: event.target.value }))}>
                        <option value="">Select club aircraft</option>
                        {aircraftOptions.map((aircraft) => (
                          <option key={aircraft.id} value={aircraft.id}>{aircraft.displayName}</option>
                        ))}
                      </select>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={maintenanceForm.itemType} onChange={(event) => setMaintenanceForm((current) => ({ ...current, itemType: event.target.value }))}>
                          <option value="maintenance">Maintenance</option>
                          <option value="inspection">Inspection</option>
                          <option value="ad">AD</option>
                          <option value="oil_change">Oil Change</option>
                          <option value="other">Other</option>
                        </select>
                        <Input type="datetime-local" value={maintenanceForm.dueDate} onChange={(event) => setMaintenanceForm((current) => ({ ...current, dueDate: event.target.value }))} />
                      </div>
                      <Input value={maintenanceForm.title} onChange={(event) => setMaintenanceForm((current) => ({ ...current, title: event.target.value }))} placeholder="Maintenance item title" />
                      <Input value={maintenanceForm.complianceReference} onChange={(event) => setMaintenanceForm((current) => ({ ...current, complianceReference: event.target.value }))} placeholder="Compliance reference / AD number" />
                      <Textarea value={maintenanceForm.description} onChange={(event) => setMaintenanceForm((current) => ({ ...current, description: event.target.value }))} placeholder="Maintenance notes" rows={3} />
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={maintenanceForm.blocksScheduling} onChange={(event) => setMaintenanceForm((current) => ({ ...current, blocksScheduling: event.target.checked }))} />
                        Block scheduling until completed
                      </label>
                      <Button onClick={createMaintenanceItem} disabled={isSavingMaintenance} className="w-full">
                        {isSavingMaintenance ? "Saving item..." : "Add maintenance item"}
                      </Button>
                    </>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-white/12 bg-white/86">
                <CardHeader>
                  <CardTitle>Create Blackout Window</CardTitle>
                  <CardDescription>Protect time for inspections, repairs, ferry flights, or club events.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!data.canManage ? (
                    <div className="text-sm text-muted-foreground">Only club managers can create blackout windows.</div>
                  ) : (
                    <>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={blackoutForm.aircraftId} onChange={(event) => setBlackoutForm((current) => ({ ...current, aircraftId: event.target.value }))}>
                        <option value="">Select club aircraft</option>
                        {aircraftOptions.map((aircraft) => (
                          <option key={aircraft.id} value={aircraft.id}>{aircraft.displayName}</option>
                        ))}
                      </select>
                      <Input value={blackoutForm.title} onChange={(event) => setBlackoutForm((current) => ({ ...current, title: event.target.value }))} placeholder="Blackout title" />
                      <Input type="datetime-local" value={blackoutForm.startAt} onChange={(event) => setBlackoutForm((current) => ({ ...current, startAt: event.target.value }))} />
                      <Input type="datetime-local" value={blackoutForm.endAt} onChange={(event) => setBlackoutForm((current) => ({ ...current, endAt: event.target.value }))} />
                      <Textarea value={blackoutForm.reason} onChange={(event) => setBlackoutForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Reason for blackout" rows={3} />
                      <Button onClick={createBlackout} disabled={isSavingBlackout} className="w-full">
                        {isSavingBlackout ? "Saving blackout..." : "Create blackout"}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card className="border-white/12 bg-white/86">
              <CardHeader>
                <CardTitle>Club Documents</CardTitle>
                <CardDescription>Rules, agreements, bylaws, and documents that govern club operations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.documents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-muted-foreground">
                    No club documents uploaded yet.
                  </div>
                ) : (
                  data.documents.map((document) => {
                    const acceptanceKey = `${document.id}:${document.version}`;
                    const isAccepted = acceptedDocumentKeys.has(acceptanceKey);
                    const isPending = data.pendingRequiredDocuments.some((entry) => entry.id === document.id);
                    return (
                      <div key={document.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">{document.title}</div>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                              <span>{formatDocumentCategory(document.category)}</span>
                              <span>v{document.version}</span>
                              {document.requiresAcceptance ? <span>Requires acceptance</span> : null}
                              {!document.isActive ? <span>Inactive</span> : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={document.requiresAcceptance ? "default" : "outline"}>
                              {document.requiresAcceptance ? "Required" : "Reference"}
                            </Badge>
                            {isAccepted ? <Badge variant="outline">Accepted</Badge> : null}
                            {isPending ? <Badge variant="secondary">Pending</Badge> : null}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {isAuthenticated ? (
                            <Button asChild size="sm" variant="outline">
                              <a
                                href={apiUrl(`/api/flying-clubs/${data.club.id}/documents/${document.id}/download`)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Download
                              </a>
                            </Button>
                          ) : (
                            <Button asChild size="sm" variant="outline">
                              <Link href="/login">Sign in to view</Link>
                            </Button>
                          )}
                          {document.requiresAcceptance && isAuthenticated && !isAccepted ? (
                            <Button
                              size="sm"
                              onClick={() => acceptDocument(document.id)}
                              disabled={acceptingDocumentId === document.id}
                            >
                              {acceptingDocumentId === document.id ? "Saving..." : "Accept document"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}

                {requiredDocuments.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    {data.club.requirePolicyAcceptanceBeforeBooking
                      ? "This club blocks reservations until all active required documents are accepted."
                      : "This club has required documents, but booking is not currently gated on acceptance."}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="space-y-6">
              {data.canManage ? (
                <Card className="border-white/12 bg-white/86">
                  <CardHeader>
                    <CardTitle>Upload Club Document</CardTitle>
                    <CardDescription>Post agreements, bylaws, SOPs, waivers, and club rules for members.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      value={documentForm.title}
                      onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Document title"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        value={documentForm.category}
                        onChange={(event) => setDocumentForm((current) => ({ ...current, category: event.target.value }))}
                        placeholder="Category"
                      />
                      <Input
                        value={documentForm.version}
                        onChange={(event) => setDocumentForm((current) => ({ ...current, version: event.target.value }))}
                        placeholder="Version"
                      />
                    </div>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                      onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                      aria-label="Upload club document"
                      title="Upload club document"
                    />
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={documentForm.requiresAcceptance}
                        onChange={(event) =>
                          setDocumentForm((current) => ({
                            ...current,
                            requiresAcceptance: event.target.checked,
                          }))
                        }
                      />
                      Require member acceptance
                    </label>
                    <Button onClick={uploadClubDocument} disabled={isUploadingDocument} className="w-full">
                      {isUploadingDocument ? "Uploading..." : "Upload club document"}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-white/12 bg-white/86">
                  <CardHeader>
                    <CardTitle>Club Governance</CardTitle>
                    <CardDescription>Managers control which documents govern booking and club operations.</CardDescription>
                  </CardHeader>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="announcements" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card className="border-white/12 bg-white/86">
              <CardHeader>
                <CardTitle>Club Announcements</CardTitle>
                <CardDescription>Updates for members, scheduling notes, and club notices.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.announcements.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-muted-foreground">
                    No announcements yet.
                  </div>
                ) : (
                  data.announcements.map((announcement) => (
                    <div key={announcement.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-slate-900">{announcement.title}</div>
                        {announcement.isPinned ? <Badge>Pinned</Badge> : null}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-700">{announcement.body}</div>
                      <div className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-500">
                        {formatDateTime(announcement.createdAt)}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-white/12 bg-white/86">
              <CardHeader>
                <CardTitle>Post Announcement</CardTitle>
                <CardDescription>Club managers can post scheduling notes and club-wide updates.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!data.canManage ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-muted-foreground">
                    Only club managers can post announcements.
                  </div>
                ) : (
                  <>
                    <Input
                      value={announcementForm.title}
                      onChange={(event) => setAnnouncementForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Announcement title"
                    />
                    <Textarea
                      value={announcementForm.body}
                      onChange={(event) => setAnnouncementForm((current) => ({ ...current, body: event.target.value }))}
                      placeholder="Announcement details"
                      rows={6}
                    />
                    <Button onClick={createAnnouncement} disabled={isSavingAnnouncement} className="w-full">
                      {isSavingAnnouncement ? "Posting..." : "Post announcement"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
