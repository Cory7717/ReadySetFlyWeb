import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Plane, Lock, Edit, Trash2, Download, TrendingUp, Award, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { LogbookEntry, InsertLogbookEntry, Endorsement } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import { UpgradePromptDialog } from "@/components/upgrade/UpgradePromptDialog";

// Helper function to calculate totals from entries
function calculateTotals(entries: LogbookEntry[]) {
  const totals = {
    totalTime: 0,
    pic: 0,
    sic: 0,
    dual: 0,
    night: 0,
    day: 0,
    instrumentActual: 0,
    crossCountry: 0, // Will need XC field in schema later
    approaches: 0,
    landings: 0,
  };

  entries.forEach((entry) => {
    const pic = parseFloat(entry.pic || "0");
    const sic = parseFloat(entry.sic || "0");
    const dual = parseFloat(entry.dual || "0");
    const night = parseFloat(entry.timeNight || "0");
    const day = parseFloat(entry.timeDay || "0");
    const inst = parseFloat(entry.instrumentActual || "0");

    totals.totalTime += pic + sic;
    totals.pic += pic;
    totals.sic += sic;
    totals.dual += dual;
    totals.night += night;
    totals.day += day;
    totals.instrumentActual += inst;
    totals.approaches += entry.approaches || 0;
    totals.landings += (entry.landingsDay || 0) + (entry.landingsNight || 0);
  });

  return totals;
}

// Export to CSV
function exportToCSV(entries: LogbookEntry[]) {
  const headers = [
    "Date",
    "Tail Number",
    "Aircraft Type",
    "Route",
    "Time Day",
    "Time Night",
    "PIC",
    "SIC",
    "Dual",
    "Instrument",
    "Approaches",
    "Landings Day",
    "Landings Night",
    "Holds",
    "Remarks",
  ];

  const rows = entries.map((e) => [
    e.flightDate,
    e.tailNumber || "",
    e.aircraftType || "",
    e.route || "",
    e.timeDay || "0",
    e.timeNight || "0",
    e.pic || "0",
    e.sic || "0",
    e.dual || "0",
    e.instrumentActual || "0",
    e.approaches || "0",
    e.landingsDay || "0",
    e.landingsNight || "0",
    e.holds || "0",
    e.remarks || "",
  ]);

  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `logbook-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDateInput(value?: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export default function Logbook() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LogbookEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<LogbookEntry | null>(null);
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [signRole, setSignRole] = useState<"pilot" | "cfi">("pilot");
  const entitlements = (user as any)?.entitlements;
  const isPro = entitlements?.canUseLogbook ?? (user?.logbookProStatus === "active");
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [proForm, setProForm] = useState({
    medicalClass: "",
    medicalIssuedAt: "",
    medicalExpiresAt: "",
    flightReviewDate: "",
    ipcDate: "",
  });
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailEnabled: true,
    pushEnabled: true,
    inAppEnabled: true,
    alertDaysBefore: 30,
  });
  const [endorsementForm, setEndorsementForm] = useState({
    title: "",
    endorsementType: "",
    issuedAt: "",
    expiresAt: "",
    instructorName: "",
    instructorCertificate: "",
    aircraftType: "",
    notes: "",
    documentUrl: "",
  });
  const [isEndorsementDialogOpen, setIsEndorsementDialogOpen] = useState(false);
  const [editingEndorsement, setEditingEndorsement] = useState<Endorsement | null>(null);
  const endorsementSaveDisabled = !endorsementForm.title.trim() || !endorsementForm.issuedAt;

  const { data: entries = [], isLoading } = useQuery<LogbookEntry[]>({
    queryKey: ["/api/logbook"],
  });

  const { data: proSummary, isLoading: proSummaryLoading } = useQuery<any>({
    queryKey: ["/api/logbook/pro/summary"],
    enabled: isPro,
  });

  const { data: endorsements = [], isLoading: endorsementsLoading } = useQuery<Endorsement[]>({
    queryKey: ["/api/endorsements"],
    enabled: isPro,
  });

  const { data: preferenceData } = useQuery<any>({
    queryKey: ["/api/notifications/preferences"],
    enabled: isPro,
  });

  useEffect(() => {
    if (proSummary?.settings) {
      setProForm({
        medicalClass: proSummary.settings.medicalClass || "",
        medicalIssuedAt: formatDateInput(proSummary.settings.medicalIssuedAt),
        medicalExpiresAt: formatDateInput(proSummary.settings.medicalExpiresAt),
        flightReviewDate: formatDateInput(proSummary.settings.flightReviewDate),
        ipcDate: formatDateInput(proSummary.settings.ipcDate),
      });
    }
  }, [proSummary]);

  useEffect(() => {
    if (!preferenceData) return;
    setNotificationPrefs({
      emailEnabled: preferenceData.emailEnabled ?? true,
      pushEnabled: preferenceData.pushEnabled ?? true,
      inAppEnabled: preferenceData.inAppEnabled ?? true,
      alertDaysBefore: preferenceData.alertDaysBefore ?? 30,
    });
  }, [preferenceData]);

  useEffect(() => {
    if (isPro) return;
    if (typeof window === "undefined") return;
    const key = "rsf_upgrade_prompt_logbook";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    setShowUpgradePrompt(true);
  }, [isPro]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertLogbookEntry) => {
      const res = await apiRequest("POST", "/api/logbook", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logbook"] });
      setIsCreateDialogOpen(false);
      toast({ title: "Entry created" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create entry", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertLogbookEntry> }) => {
      const res = await apiRequest("PATCH", `/api/logbook/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logbook"] });
      setEditingEntry(null);
      toast({ title: "Entry updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update entry", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/logbook/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logbook"] });
      toast({ title: "Entry deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete entry", description: error.message, variant: "destructive" });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async ({ id, signatureDataUrl, signedByName }: { id: string; signatureDataUrl: string; signedByName: string }) => {
      const res = await apiRequest("POST", `/api/logbook/${id}/lock`, { signatureDataUrl, signedByName });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logbook"] });
      setIsSignDialogOpen(false);
      setSelectedEntryId(null);
      toast({ title: "Entry locked and signed" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to lock entry", description: error.message, variant: "destructive" });
    },
  });

  const saveProSettingsMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        medicalClass: proForm.medicalClass || null,
        medicalIssuedAt: proForm.medicalIssuedAt ? proForm.medicalIssuedAt : null,
        medicalExpiresAt: proForm.medicalExpiresAt ? proForm.medicalExpiresAt : null,
        flightReviewDate: proForm.flightReviewDate ? proForm.flightReviewDate : null,
        ipcDate: proForm.ipcDate ? proForm.ipcDate : null,
      };
      const res = await apiRequest("PUT", "/api/logbook/pro/settings", payload);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update RSF Pro settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logbook/pro/summary"] });
      toast({ title: "RSF Pro updated", description: "Your currency settings were saved." });
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const saveNotificationPrefsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/notifications/preferences", notificationPrefs);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update notification preferences");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
      toast({ title: "Preferences updated" });
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const saveEndorsementMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: any }) => {
      const payload = {
        ...data,
        issuedAt: data.issuedAt || null,
        expiresAt: data.expiresAt || null,
        title: data.title,
      };
      const res = id
        ? await apiRequest("PATCH", `/api/endorsements/${id}`, payload)
        : await apiRequest("POST", "/api/endorsements", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/endorsements"] });
      setIsEndorsementDialogOpen(false);
      setEditingEndorsement(null);
      setEndorsementForm({
        title: "",
        endorsementType: "",
        issuedAt: "",
        expiresAt: "",
        instructorName: "",
        instructorCertificate: "",
        aircraftType: "",
        notes: "",
        documentUrl: "",
      });
      toast({ title: "Endorsement saved" });
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteEndorsementMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/endorsements/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/endorsements"] });
      toast({ title: "Endorsement deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/logbook/${id}/unlock`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logbook"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to unlock entry", description: error.message, variant: "destructive" });
    },
  });

  const countersignMutation = useMutation({
    mutationFn: async ({ id, signatureDataUrl, signedByName }: { id: string; signatureDataUrl: string; signedByName: string }) => {
      const res = await apiRequest("POST", `/api/logbook/${id}/countersign`, { signatureDataUrl, signedByName });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logbook"] });
      setIsSignDialogOpen(false);
      setSelectedEntryId(null);
      toast({ title: "Entry countersigned" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to countersign", description: error.message, variant: "destructive" });
    },
  });

  const totalHours = entries.reduce((sum, e) => sum + parseFloat(e.pic || "0") + parseFloat(e.sic || "0"), 0).toFixed(1);
  const totals = calculateTotals(entries);

  return (
    <div className="container mx-auto py-8 px-4">
      <UpgradePromptDialog
        open={showUpgradePrompt}
        onOpenChange={setShowUpgradePrompt}
        toolName="Logbook"
        toolSummary="Capture flights, totals, and currency in one workspace."
        freeFeatures={[
          "Create manual logbook entries with basic totals.",
          "Export logbook data anytime.",
          "Upgrade for currency alerts, endorsements, analytics, and full history.",
        ]}
      />
      {/* Signing requirement callout */}
      {entries.some(e => !e.isLocked) && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Unsigned entries are drafts. Click <span className="font-semibold">Sign</span> to lock and finalize.
        </div>
      )}
      {/* FREE FOREVER Badge */}
      <div className="text-center mb-6">
        <Badge variant="outline" className="text-sm px-4 py-2 bg-green-50 border-green-200">
          ✈️ FREE Digital Logbook - No Credit Card Required
        </Badge>
        <p className="text-xs text-muted-foreground mt-2">
          Your data, always accessible. Export anytime.
        </p>
      </div>

      {/* Totals Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{totals.totalTime.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Total Time</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{totals.pic.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">PIC</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{totals.night.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Night</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{totals.instrumentActual.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Instrument</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Totals */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Flight Time Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">SIC</p>
              <p className="font-semibold">{totals.sic.toFixed(1)} hrs</p>
            </div>
            <div>
              <p className="text-muted-foreground">Dual Received</p>
              <p className="font-semibold">{totals.dual.toFixed(1)} hrs</p>
            </div>
            <div>
              <p className="text-muted-foreground">Day</p>
              <p className="font-semibold">{totals.day.toFixed(1)} hrs</p>
            </div>
            <div>
              <p className="text-muted-foreground">Approaches</p>
              <p className="font-semibold">{totals.approaches}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Landings</p>
              <p className="font-semibold">{totals.landings}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plane className="h-6 w-6" />
                Flight Entries
              </CardTitle>
              <CardDescription>
                Track your flights and build your experience
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(entries)}
                disabled={entries.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entry
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <LogbookEntryForm
                    onSubmit={(data) => createMutation.mutate(data)}
                    isPending={createMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No logbook entries yet. Add your first flight!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Tail #</TableHead>
                  <TableHead>Aircraft</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>PIC</TableHead>
                  <TableHead>SIC</TableHead>
                  <TableHead>Dual</TableHead>
                  <TableHead>Inst</TableHead>
                  <TableHead>Ldg</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setViewingEntry(entry)}
                  >
                    <TableCell>{new Date(entry.flightDate).toLocaleDateString()}</TableCell>
                    <TableCell>{entry.tailNumber || "-"}</TableCell>
                    <TableCell>{entry.aircraftType || "-"}</TableCell>
                    <TableCell>{entry.route || "-"}</TableCell>
                    <TableCell>{entry.pic || "0"}</TableCell>
                    <TableCell>{entry.sic || "0"}</TableCell>
                    <TableCell>{entry.dual || "0"}</TableCell>
                    <TableCell>{entry.instrumentActual || "0"}</TableCell>
                    <TableCell>{(entry.landingsDay || 0) + (entry.landingsNight || 0)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {entry.isLocked ? (
                          <span className="flex items-center gap-1 text-xs text-green-700">
                            <Lock className="h-3 w-3" />
                            {entry.signedByName ? `Signed by ${entry.signedByName}` : "Signed"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Draft – needs signature</span>
                        )}
                        {entry.cfiSignedAt && (
                          <span className="text-[11px] text-blue-700">CFI: {entry.cfiSignedByName || "Signed"}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {!entry.isLocked && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEntry(entry);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEntryId(entry.id);
                                setSignRole("pilot");
                                setIsSignDialogOpen(true);
                              }}
                            >
                              <Lock className="h-4 w-4 mr-1" /> Sign
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Delete this entry?")) deleteMutation.mutate(entry.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {entry.isLocked && !entry.cfiSignedAt && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEntryId(entry.id);
                              setSignRole("cfi");
                              setIsSignDialogOpen(true);
                            }}
                          >
                            CFI Sign
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isPro && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              RSF Pro Dashboard
            </CardTitle>
            <CardDescription>Currency tracking, expirations, and quick actions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {proSummaryLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading RSF Pro summary...
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="text-sm font-semibold">90-Day Currency</div>
                  <div className="text-xs text-muted-foreground">Total landings: {proSummary?.currency?.totalLandings ?? 0}</div>
                  <Badge variant={proSummary?.currency?.dayCurrent ? "default" : "outline"}>
                    {proSummary?.currency?.dayCurrent ? "Current" : "Not current"}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    Due: {formatDisplayDate(proSummary?.currency?.dayCurrencyDueAt)}
                  </div>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="text-sm font-semibold">Night Currency</div>
                  <div className="text-xs text-muted-foreground">Night landings: {proSummary?.currency?.landingsNight ?? 0}</div>
                  <Badge variant={proSummary?.currency?.nightCurrent ? "default" : "outline"}>
                    {proSummary?.currency?.nightCurrent ? "Current" : "Not current"}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    Due: {formatDisplayDate(proSummary?.currency?.nightCurrencyDueAt)}
                  </div>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="text-sm font-semibold">IFR Currency</div>
                  <div className="text-xs text-muted-foreground">
                    Approaches + holds: {proSummary?.currency?.instrumentTotal ?? 0}
                  </div>
                  <Badge variant={proSummary?.currency?.instrumentCurrent ? "default" : "outline"}>
                    {proSummary?.currency?.instrumentCurrent ? "Current" : "Not current"}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    Due: {formatDisplayDate(proSummary?.currency?.instrumentDueAt)}
                  </div>
                </div>
              </div>
            )}

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-semibold">Expiration Tracking</div>
                <div className="text-xs text-muted-foreground">
                  Medical expires: {formatDisplayDate(proSummary?.expirations?.medicalExpiresAt)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Flight review due: {formatDisplayDate(proSummary?.expirations?.flightReviewDueAt)}
                </div>
                <div className="text-xs text-muted-foreground">
                  IPC date: {formatDisplayDate(proSummary?.expirations?.ipcDate)}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/flight-planner">Open Flight Planner</Link>
                </Button>
              </div>
              <div className="space-y-3">
                <div className="text-sm font-semibold">Update RSF Pro dates</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Medical Class</Label>
                    <Input
                      value={proForm.medicalClass}
                      onChange={(e) => setProForm({ ...proForm, medicalClass: e.target.value })}
                      placeholder="Class 1/2/3"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Medical Issued</Label>
                    <Input
                      type="date"
                      value={proForm.medicalIssuedAt}
                      onChange={(e) => setProForm({ ...proForm, medicalIssuedAt: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Medical Expires</Label>
                    <Input
                      type="date"
                      value={proForm.medicalExpiresAt}
                      onChange={(e) => setProForm({ ...proForm, medicalExpiresAt: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Flight Review</Label>
                    <Input
                      type="date"
                      value={proForm.flightReviewDate}
                      onChange={(e) => setProForm({ ...proForm, flightReviewDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>IPC Date</Label>
                    <Input
                      type="date"
                      value={proForm.ipcDate}
                      onChange={(e) => setProForm({ ...proForm, ipcDate: e.target.value })}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => saveProSettingsMutation.mutate()}
                  disabled={saveProSettingsMutation.isPending}
                >
                  {saveProSettingsMutation.isPending ? "Saving..." : "Save RSF Pro Settings"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isPro && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Alert Preferences
            </CardTitle>
            <CardDescription>Choose how you receive RSF Pro alerts (30 days before due).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Email alerts</p>
                <p className="text-xs text-muted-foreground">Get reminders in your inbox.</p>
              </div>
              <Switch
                checked={notificationPrefs.emailEnabled}
                onCheckedChange={(checked) => setNotificationPrefs((prev) => ({ ...prev, emailEnabled: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Push alerts</p>
                <p className="text-xs text-muted-foreground">Mobile push notifications (Expo).</p>
              </div>
              <Switch
                checked={notificationPrefs.pushEnabled}
                onCheckedChange={(checked) => setNotificationPrefs((prev) => ({ ...prev, pushEnabled: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">In-app alerts</p>
                <p className="text-xs text-muted-foreground">Show in your notifications list.</p>
              </div>
              <Switch
                checked={notificationPrefs.inAppEnabled}
                onCheckedChange={(checked) => setNotificationPrefs((prev) => ({ ...prev, inAppEnabled: checked }))}
              />
            </div>
            <Button
              onClick={() => saveNotificationPrefsMutation.mutate()}
              disabled={saveNotificationPrefsMutation.isPending}
            >
              {saveNotificationPrefsMutation.isPending ? "Saving..." : "Save Preferences"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isPro && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Endorsements
            </CardTitle>
            <CardDescription>Track instructor endorsements and sign-offs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {endorsementsLoading ? "Loading endorsements..." : `${endorsements.length} endorsement${endorsements.length === 1 ? "" : "s"}`}
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingEndorsement(null);
                  setEndorsementForm({
                    title: "",
                    endorsementType: "",
                    issuedAt: "",
                    expiresAt: "",
                    instructorName: "",
                    instructorCertificate: "",
                    aircraftType: "",
                    notes: "",
                    documentUrl: "",
                  });
                  setIsEndorsementDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add endorsement
              </Button>
            </div>

            {endorsements.length === 0 && !endorsementsLoading ? (
              <div className="text-sm text-muted-foreground">No endorsements yet.</div>
            ) : (
              <div className="space-y-3">
                {endorsements.map((endorsement) => (
                  <div key={endorsement.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{endorsement.title}</p>
                        <p className="text-xs text-muted-foreground">{endorsement.endorsementType || "General endorsement"}</p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Issued: {formatDisplayDate(endorsement.issuedAt?.toString() || null)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Instructor: {endorsement.instructorName || "—"} {endorsement.instructorCertificate ? `(${endorsement.instructorCertificate})` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">Aircraft: {endorsement.aircraftType || "—"}</div>
                    {endorsement.expiresAt && (
                      <div className="text-xs text-muted-foreground">Expires: {formatDisplayDate(endorsement.expiresAt?.toString() || null)}</div>
                    )}
                    {endorsement.notes && <div className="text-xs text-muted-foreground">Notes: {endorsement.notes}</div>}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingEndorsement(endorsement);
                          setEndorsementForm({
                            title: endorsement.title || "",
                            endorsementType: endorsement.endorsementType || "",
                            issuedAt: formatDateInput(endorsement.issuedAt?.toString() || ""),
                            expiresAt: formatDateInput(endorsement.expiresAt?.toString() || ""),
                            instructorName: endorsement.instructorName || "",
                            instructorCertificate: endorsement.instructorCertificate || "",
                            aircraftType: endorsement.aircraftType || "",
                            notes: endorsement.notes || "",
                            documentUrl: endorsement.documentUrl || "",
                          });
                          setIsEndorsementDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteEndorsementMutation.mutate(endorsement.id)}
                        disabled={deleteEndorsementMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* RSF Pro CTA */}
      <Card className="mt-6 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Upgrade to RSF Pro
          </CardTitle>
          <CardDescription>
            Save, alerts, and analytics require RSF Pro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Currency Tracking</p>
                <p className="text-xs text-muted-foreground">90-day landings, night, IFR alerts</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Award className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Endorsement Tracking</p>
                <p className="text-xs text-muted-foreground">Instructor sign-offs & CFI workflows</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Expiration Alerts</p>
                <p className="text-xs text-muted-foreground">Medical, flight review, IPC reminders</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Award className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Flight Planner</p>
                <p className="text-xs text-muted-foreground">Build and save routes with fuel notes</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Radio Comms Trainer</p>
                <p className="text-xs text-muted-foreground">Full scenarios, audio practice, scoring</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Award className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Advanced Reports</p>
                <p className="text-xs text-muted-foreground">Exportable summaries and insights</p>
              </div>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex flex-col items-center gap-3">
            {isPro && (
              <Badge variant="default">RSF Pro Active</Badge>
            )}
            <p className="text-xs text-muted-foreground text-center">
              Tip: <strong>Your logbook data will always be free and exportable.</strong> Pro adds intelligence and automation.
            </p>
            <Button variant="default" asChild>
              <Link href="/logbook/pro">{isPro ? "Manage Membership" : "Upgrade to RSF Pro"}</Link>
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Cancel anytime. Free logbook access stays available.
            </p>
          </div>
        </CardContent>
      </Card>

      {editingEntry && (
        <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <LogbookEntryForm
              initialData={editingEntry}
              onSubmit={(data) => updateMutation.mutate({ id: editingEntry.id, data })}
              isPending={updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {isSignDialogOpen && selectedEntryId && (
        <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
          <DialogContent>
            <SignatureDialog
              onSign={(signatureDataUrl, signedByName) => {
                if (signRole === "pilot") {
                  lockMutation.mutate({ id: selectedEntryId, signatureDataUrl, signedByName });
                } else {
                  countersignMutation.mutate({ id: selectedEntryId, signatureDataUrl, signedByName });
                }
              }}
              isPending={lockMutation.isPending || countersignMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {viewingEntry && (
        <Dialog open={!!viewingEntry} onOpenChange={() => setViewingEntry(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Logbook Entry Details</DialogTitle>
              <DialogDescription>Review flight details and remarks.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Date</div>
                <div>{new Date(viewingEntry.flightDate).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Tail Number</div>
                <div>{viewingEntry.tailNumber || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Aircraft Type</div>
                <div>{viewingEntry.aircraftType || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Route</div>
                <div>{viewingEntry.route || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">PIC</div>
                <div>{viewingEntry.pic || "0"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">SIC</div>
                <div>{viewingEntry.sic || "0"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Dual</div>
                <div>{viewingEntry.dual || "0"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Instrument</div>
                <div>{viewingEntry.instrumentActual || "0"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Landings (Day/Night)</div>
                <div>
                  {(viewingEntry.landingsDay || 0)} / {(viewingEntry.landingsNight || 0)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Approaches / Holds</div>
                <div>
                  {viewingEntry.approaches || 0} / {viewingEntry.holds || 0}
                </div>
              </div>
            </div>
            <div className="mt-3 text-sm">
              <div className="text-muted-foreground">Remarks</div>
              <div className="rounded-md border border-border bg-muted/40 p-3 min-h-[80px] whitespace-pre-wrap">
                {viewingEntry.remarks || "—"}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <div>
                Status: {viewingEntry.isLocked ? "Locked (signed)" : "Draft"}
                {viewingEntry.cfiSignedAt ? " • CFI signed" : ""}
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setViewingEntry(null)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  if (viewingEntry.isLocked) {
                    if (!confirm("Editing will unlock this entry and clear signatures. You'll need to re-sign. Continue?")) {
                      return;
                    }
                    unlockMutation.mutate(viewingEntry.id, {
                      onSuccess: () => {
                        setViewingEntry(null);
                        setEditingEntry({ ...viewingEntry, isLocked: false });
                      },
                    });
                  } else {
                    setViewingEntry(null);
                    setEditingEntry(viewingEntry);
                  }
                }}
                disabled={unlockMutation.isPending}
              >
                {viewingEntry.isLocked ? "Edit & Re-sign" : "Edit Entry"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isEndorsementDialogOpen && (
        <Dialog
          open={isEndorsementDialogOpen}
          onOpenChange={(open) => {
            setIsEndorsementDialogOpen(open);
            if (!open) {
              setEditingEndorsement(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEndorsement ? "Edit Endorsement" : "Add Endorsement"}</DialogTitle>
              <DialogDescription>Track instructor sign-offs and expiration dates.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input
                  value={endorsementForm.title}
                  onChange={(e) => setEndorsementForm({ ...endorsementForm, title: e.target.value })}
                  placeholder="Complex endorsement, high performance, etc."
                />
              </div>
              <div className="space-y-1">
                <Label>Endorsement Type</Label>
                <Input
                  value={endorsementForm.endorsementType}
                  onChange={(e) => setEndorsementForm({ ...endorsementForm, endorsementType: e.target.value })}
                  placeholder="61.31(e), tailwheel, IPC, etc."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Issued Date</Label>
                  <Input
                    type="date"
                    value={endorsementForm.issuedAt}
                    onChange={(e) => setEndorsementForm({ ...endorsementForm, issuedAt: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Expires Date</Label>
                  <Input
                    type="date"
                    value={endorsementForm.expiresAt}
                    onChange={(e) => setEndorsementForm({ ...endorsementForm, expiresAt: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Instructor Name</Label>
                  <Input
                    value={endorsementForm.instructorName}
                    onChange={(e) => setEndorsementForm({ ...endorsementForm, instructorName: e.target.value })}
                    placeholder="Jane Smith, CFI"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Instructor Certificate #</Label>
                  <Input
                    value={endorsementForm.instructorCertificate}
                    onChange={(e) => setEndorsementForm({ ...endorsementForm, instructorCertificate: e.target.value })}
                    placeholder="CFI-1234567"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Aircraft Type/Class</Label>
                <Input
                  value={endorsementForm.aircraftType}
                  onChange={(e) => setEndorsementForm({ ...endorsementForm, aircraftType: e.target.value })}
                  placeholder="C172, PA-28, ASEL"
                />
              </div>
              <div className="space-y-1">
                <Label>Document URL (optional)</Label>
                <Input
                  value={endorsementForm.documentUrl}
                  onChange={(e) => setEndorsementForm({ ...endorsementForm, documentUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea
                  value={endorsementForm.notes}
                  onChange={(e) => setEndorsementForm({ ...endorsementForm, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEndorsementDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => saveEndorsementMutation.mutate({ id: editingEndorsement?.id, data: endorsementForm })}
                disabled={saveEndorsementMutation.isPending || endorsementSaveDisabled}
              >
                {saveEndorsementMutation.isPending ? "Saving..." : "Save Endorsement"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function LogbookEntryForm({
  initialData,
  onSubmit,
  isPending,
}: {
  initialData?: LogbookEntry;
  onSubmit: (data: InsertLogbookEntry) => void;
  isPending: boolean;
}) {
  // Form state allows strings for all numeric fields to handle empty inputs better
  type FormData = Omit<InsertLogbookEntry, 'approaches' | 'landingsDay' | 'landingsNight' | 'holds'> & {
    approaches: number | string;
    landingsDay: number | string;
    landingsNight: number | string;
    holds: number | string;
  };
  
  const [formData, setFormData] = useState<Partial<FormData>>(
    initialData ? {
      flightDate: typeof initialData.flightDate === 'string' 
        ? new Date(initialData.flightDate)
        : initialData.flightDate,
      tailNumber: initialData.tailNumber,
      aircraftType: initialData.aircraftType,
      route: initialData.route,
      timeDay: initialData.timeDay?.toString() || "",
      timeNight: initialData.timeNight?.toString() || "",
      pic: initialData.pic?.toString() || "",
      sic: initialData.sic?.toString() || "",
      dual: initialData.dual?.toString() || "",
      instrumentActual: initialData.instrumentActual?.toString() || "",
      approaches: initialData.approaches ?? "",
      landingsDay: initialData.landingsDay ?? "",
      landingsNight: initialData.landingsNight ?? "",
      holds: initialData.holds ?? "",
      remarks: initialData.remarks,
      hobbsStart: initialData.hobbsStart?.toString(),
      hobbsEnd: initialData.hobbsEnd?.toString(),
    } : {
      flightDate: new Date(),
      tailNumber: "",
      aircraftType: "",
      route: "",
      timeDay: "",
      timeNight: "",
      pic: "",
      sic: "",
      dual: "",
      instrumentActual: "",
      approaches: "",
      landingsDay: "",
      landingsNight: "",
      holds: "",
      remarks: "",
      hobbsStart: "",
      hobbsEnd: "",
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Clean up empty strings before submission
    const cleanedData = {
      ...formData,
      hobbsStart: formData.hobbsStart?.trim() || undefined,
      hobbsEnd: formData.hobbsEnd?.trim() || undefined,
      timeDay: formData.timeDay?.trim() || undefined,
      timeNight: formData.timeNight?.trim() || undefined,
      pic: formData.pic?.trim() || undefined,
      sic: formData.sic?.trim() || undefined,
      dual: formData.dual?.trim() || undefined,
      instrumentActual: formData.instrumentActual?.trim() || undefined,
      // Convert empty strings to undefined for number fields
      approaches: formData.approaches === "" ? undefined : formData.approaches,
      landingsDay: formData.landingsDay === "" ? undefined : formData.landingsDay,
      landingsNight: formData.landingsNight === "" ? undefined : formData.landingsNight,
      holds: formData.holds === "" ? undefined : formData.holds,
    };
    onSubmit(cleanedData as InsertLogbookEntry);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{initialData ? "Edit Entry" : "New Logbook Entry"}</DialogTitle>
        <DialogDescription>Fill in the flight details</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4 py-4">
        <div>
          <Label htmlFor="flightDate">Flight Date</Label>
          <Input
            id="flightDate"
            type="date"
            value={formData.flightDate instanceof Date ? formData.flightDate.toISOString().split("T")[0] : ""}
            onChange={(e) => setFormData({ ...formData, flightDate: new Date(e.target.value) })}
            required
          />
        </div>
        <div>
          <Label htmlFor="tailNumber">Tail Number</Label>
          <Input
            id="tailNumber"
            value={formData.tailNumber || ""}
            onChange={(e) => setFormData({ ...formData, tailNumber: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="aircraftType">Aircraft Type</Label>
          <Input
            id="aircraftType"
            value={formData.aircraftType || ""}
            onChange={(e) => setFormData({ ...formData, aircraftType: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="route">Route</Label>
          <Input
            id="route"
            value={formData.route || ""}
            onChange={(e) => setFormData({ ...formData, route: e.target.value })}
            placeholder="e.g. KDEN-KCOS"
          />
        </div>
        <div>
          <Label htmlFor="pic">PIC (hours)</Label>
          <Input
            id="pic"
            type="number"
            step="0.1"
            placeholder="0.0"
            value={formData.pic || ""}
            onChange={(e) => setFormData({ ...formData, pic: e.target.value })}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <Label htmlFor="sic">SIC (hours)</Label>
          <Input
            id="sic"
            type="number"
            step="0.1"
            placeholder="0.0"
            value={formData.sic || ""}
            onChange={(e) => setFormData({ ...formData, sic: e.target.value })}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <Label htmlFor="dual">Dual (hours)</Label>
          <Input
            id="dual"
            type="number"
            step="0.1"
            placeholder="0.0"
            value={formData.dual || ""}
            onChange={(e) => setFormData({ ...formData, dual: e.target.value })}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <Label htmlFor="instrumentActual">Instrument (hours)</Label>
          <Input
            id="instrumentActual"
            type="number"
            step="0.1"
            placeholder="0.0"
            value={formData.instrumentActual || ""}
            onChange={(e) => setFormData({ ...formData, instrumentActual: e.target.value })}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <Label htmlFor="landingsDay">Day Landings</Label>
          <Input
            id="landingsDay"
            type="number"
            placeholder="0"
            value={formData.landingsDay || ""}
            onChange={(e) => setFormData({ ...formData, landingsDay: e.target.value === "" ? "" : parseInt(e.target.value) })}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <Label htmlFor="landingsNight">Night Landings</Label>
          <Input
            id="landingsNight"
            type="number"
            placeholder="0"
            value={formData.landingsNight || ""}
            onChange={(e) => setFormData({ ...formData, landingsNight: e.target.value === "" ? "" : parseInt(e.target.value) })}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <Label htmlFor="approaches">Approaches</Label>
          <Input
            id="approaches"
            type="number"
            placeholder="0"
            value={formData.approaches || ""}
            onChange={(e) => setFormData({ ...formData, approaches: e.target.value === "" ? "" : parseInt(e.target.value) })}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <Label htmlFor="holds">Holds</Label>
          <Input
            id="holds"
            type="number"
            placeholder="0"
            value={formData.holds || ""}
            onChange={(e) => setFormData({ ...formData, holds: e.target.value === "" ? "" : parseInt(e.target.value) })}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="remarks">Remarks</Label>
          <Textarea
            id="remarks"
            value={formData.remarks || ""}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            rows={3}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {initialData ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SignatureDialog({
  onSign,
  isPending,
}: {
  onSign: (signatureDataUrl: string, signedByName: string) => void;
  isPending: boolean;
}) {
  const [signedByName, setSignedByName] = useState("");
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typedSignature, setTypedSignature] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  // Resize canvas to container width for crisp signature
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const width = canvas.parentElement?.clientWidth || 600;
      canvas.width = width;
      canvas.height = 220;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasDrawn(true);
  };

  const endDrawing = () => {
    isDrawing.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const getDrawnDataUrl = () => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    return canvas.toDataURL("image/png");
  };

  const getTypedDataUrl = () => {
    if (!typedSignature.trim()) return "";
    const temp = document.createElement("canvas");
    temp.width = 800;
    temp.height = 200;
    const ctx = temp.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, temp.width, temp.height);
    ctx.fillStyle = "#111827";
    ctx.font = "48px 'Segoe Script', 'Pacifico', cursive";
    ctx.textBaseline = "middle";
    ctx.fillText(typedSignature.trim(), 40, temp.height / 2);
    return temp.toDataURL("image/png");
  };

  const handleSign = () => {
    if (!signedByName.trim()) {
      alert("Please enter the signer name/title");
      return;
    }

    const dataUrl = mode === "draw" ? getDrawnDataUrl() : getTypedDataUrl();
    if (!dataUrl || (mode === "draw" && !hasDrawn)) {
      alert("Please add a signature first");
      return;
    }

    onSign(dataUrl, signedByName.trim());
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Sign and Lock Entry</DialogTitle>
        <DialogDescription>Draw on phone/tablet or type a signature from desktop.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="signedByName">Signer name & title</Label>
          <Input
            id="signedByName"
            value={signedByName}
            onChange={(e) => setSignedByName(e.target.value)}
            placeholder="e.g. Jane Smith, CFI"
          />
        </div>

        <div className="flex gap-2 text-sm">
          <Button
            type="button"
            variant={mode === "draw" ? "default" : "outline"}
            onClick={() => setMode("draw")}
          >
            Draw Signature
          </Button>
          <Button
            type="button"
            variant={mode === "type" ? "default" : "outline"}
            onClick={() => setMode("type")}
          >
            Type Signature
          </Button>
        </div>

        {mode === "draw" ? (
          <div className="space-y-2">
            <div className="border rounded-md overflow-hidden touch-none">
              <canvas
                ref={canvasRef}
                className="w-full h-52 bg-white"
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={endDrawing}
                onPointerLeave={endDrawing}
              />
            </div>
            <div className="flex gap-2 text-sm">
              <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
                Clear
              </Button>
              <p className="text-xs text-muted-foreground self-center">Use finger/stylus on mobile or mouse on desktop.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="typedSignature">Type your name</Label>
            <Input
              id="typedSignature"
              value={typedSignature}
              onChange={(e) => setTypedSignature(e.target.value)}
              placeholder="e.g. Jane Smith"
            />
            <p className="text-xs text-muted-foreground">A styled signature image will be generated.</p>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button onClick={handleSign} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Sign & Lock
        </Button>
      </DialogFooter>
    </>
  );
}
