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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Plane, Lock, Edit, Trash2, Download, TrendingUp, Award, Bell, FileArchive, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { LogbookEntry, InsertLogbookEntry, Endorsement, LogbookArchive } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import { UpgradePromptDialog } from "@/components/upgrade/UpgradePromptDialog";
import { ObjectUploader } from "@/components/ObjectUploader";
import { PageShell } from "@/components/layout/PageShell";

const AIRCRAFT_CATEGORY_OPTIONS = [
  "Airplane",
  "Rotorcraft",
  "Glider",
  "Lighter-Than-Air",
  "Powered Lift",
  "Powered Parachute",
  "Weight-Shift-Control",
] as const;

const AIRCRAFT_CLASS_OPTIONS: Record<string, string[]> = {
  Airplane: ["ASEL", "AMEL", "ASES", "AMES"],
  Rotorcraft: ["Helicopter", "Gyroplane"],
  Glider: ["Glider"],
  "Lighter-Than-Air": ["Airship", "Balloon"],
  "Powered Lift": ["Powered Lift"],
  "Powered Parachute": ["Powered Parachute"],
  "Weight-Shift-Control": ["Weight-Shift-Control"],
};

function getClassOptions(category?: string | null) {
  if (!category) return [];
  return AIRCRAFT_CLASS_OPTIONS[category] ?? [category];
}

function getAircraftDescriptor(entry: Pick<LogbookEntry, "aircraftType" | "aircraftCategory" | "aircraftClass" | "isSimulator">) {
  const type = entry.aircraftType || (entry.isSimulator ? "Simulator device" : "-");
  if (entry.aircraftCategory && entry.aircraftClass) {
    return `${type} / ${entry.aircraftCategory} ${entry.aircraftClass}`;
  }
  return type;
}

function csvEscape(value: unknown) {
  const stringValue = value == null ? "" : String(value);
  if (/["\n,]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
}

// Helper function to calculate totals from entries
function calculateTotals(entries: LogbookEntry[]) {
  const totals = {
    totalTime: 0,
    pic: 0,
    sic: 0,
    dual: 0,
    solo: 0,
    night: 0,
    day: 0,
    instrumentActual: 0,
    crossCountry: 0,
    approaches: 0,
    landings: 0,
  };

  entries.forEach((entry) => {
    const pic = parseFloat(entry.pic || "0");
    const sic = parseFloat(entry.sic || "0");
    const dual = parseFloat(entry.dual || "0");
    const solo = parseFloat(entry.solo || "0");
    const night = parseFloat(entry.timeNight || "0");
    const day = parseFloat(entry.timeDay || "0");
    const inst = parseFloat(entry.instrumentActual || "0");
    const xc = parseFloat(entry.crossCountry || "0");

    totals.totalTime += pic + sic;
    totals.pic += pic;
    totals.sic += sic;
    totals.dual += dual;
    totals.solo += solo;
    totals.night += night;
    totals.day += day;
    totals.instrumentActual += inst;
    totals.crossCountry += xc;
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
    "Is Simulator",
    "Device Type",
    "Aircraft Type",
    "Aircraft Category",
    "Aircraft Class",
    "Route",
    "Time Day",
    "Time Night",
    "PIC",
    "SIC",
    "Dual",
    "Solo",
    "Cross Country",
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
    e.isSimulator ? "Yes" : "No",
    e.deviceType || "",
    e.aircraftType || "",
    e.aircraftCategory || "",
    e.aircraftClass || "",
    e.route || "",
    e.timeDay || "0",
    e.timeNight || "0",
    e.pic || "0",
    e.sic || "0",
    e.dual || "0",
    e.solo || "0",
    e.crossCountry || "0",
    e.instrumentActual || "0",
    e.approaches || "0",
    e.landingsDay || "0",
    e.landingsNight || "0",
    e.holds || "0",
    e.remarks || "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((value) => csvEscape(value)).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `logbook-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}


function exportToPDF(entries: LogbookEntry[]) {
  const popup = window.open("", "_blank", "width=1200,height=900");
  if (!popup) return;

  const rowsHtml = entries
    .map((entry) => {
      const cfiSignedBlock = entry.cfiSignedAt
        ? `
          <div class="signature-group">
            <div class="label">CFI: ${entry.cfiSignedByName || "—"} | Cert: ${entry.cfiCertNumber || "—"} | Exp: ${formatDisplayDate(entry.cfiCertExpires)}</div>
            ${entry.cfiSignatureDataUrl ? `<img src="${entry.cfiSignatureDataUrl}" alt="CFI signature" />` : ""}
          </div>
        `
        : "";

      return `
        <tr>
          <td>${formatDisplayDate(entry.flightDate)}</td>
          <td>${entry.tailNumber || "—"}</td>
          <td>${entry.isSimulator ? "SIM" : "Aircraft"}</td>
          <td>${entry.deviceType || "—"}</td>
          <td>${getAircraftDescriptor(entry)}</td>
          <td>${entry.route || "—"}</td>
          <td>${entry.timeDay || "0"}</td>
          <td>${entry.timeNight || "0"}</td>
          <td>${entry.pic || "0"}</td>
          <td>${entry.sic || "0"}</td>
          <td>${entry.dual || "0"}</td>
          <td>${entry.solo || "0"}</td>
          <td>${entry.crossCountry || "0"}</td>
          <td>${entry.instrumentActual || "0"}</td>
          <td>${entry.approaches || 0}</td>
          <td>${entry.landingsDay || 0}</td>
          <td>${entry.landingsNight || 0}</td>
          <td>${entry.holds || 0}</td>
          <td>${entry.remarks || "—"}</td>
          <td>
            ${
              entry.isLocked
                ? `
              <div class="signature-group">
                <div class="label">Pilot: ${entry.signedByName || "—"}</div>
                ${entry.signatureDataUrl ? `<img src="${entry.signatureDataUrl}" alt="Pilot signature" />` : ""}
              </div>
              ${cfiSignedBlock}
            `
                : "Draft"
            }
          </td>
        </tr>
      `;
    })
    .join("");

  popup.document.write(`
    <html>
      <head>
        <title>RSF Logbook Export</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #0f172a; }
          h1 { margin: 0 0 8px; }
          p { margin: 0 0 16px; color: #475569; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px; vertical-align: top; text-align: left; }
          th { background: #eff6ff; font-weight: 700; }
          .signature-group { margin-bottom: 6px; }
          .signature-group .label { font-size: 10px; margin-bottom: 2px; color: #1e293b; }
          .signature-group img { max-height: 52px; max-width: 220px; display: block; border: 1px solid #e2e8f0; background: white; }
          @media print { body { margin: 10px; } }
        </style>
      </head>
      <body>
        <h1>Ready Set Fly — Digital Logbook Export</h1>
        <p>Generated ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Tail / Device</th>
              <th>Type</th>
              <th>Device</th>
              <th>Aircraft / Cat-Class</th>
              <th>Route</th>
              <th>Day</th>
              <th>Night</th>
              <th>PIC</th>
              <th>SIC</th>
              <th>Dual</th>
              <th>Solo</th>
              <th>XC</th>
              <th>Inst</th>
              <th>Appr</th>
              <th>Ldg Day</th>
              <th>Ldg Night</th>
              <th>Holds</th>
              <th>Remarks</th>
              <th>Signatures</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

function formatDateInput(value?: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function formatBytes(value?: number | null) {
  if (!value) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[idx]}`;
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
  const isGuest = !user;
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
  const archiveUploadMeta = useRef(new Map<string, { storageProvider: string; storagePath: string; fileName: string; fileSizeBytes?: number | null }>());

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

  const { data: archives = [], isLoading: archivesLoading } = useQuery<LogbookArchive[]>({
    queryKey: ["/api/logbook/archives"],
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

  const handleArchiveUploadParameters = async (file?: { id?: string; name?: string; type?: string; size?: number }) => {
    const res = await apiRequest("POST", "/api/logbook/archives/upload", {
      fileName: file?.name || "logbook.pdf",
      contentType: file?.type || "application/pdf",
    });
    const data = await res.json();
    if (file?.id) {
      archiveUploadMeta.current.set(file.id, {
        storageProvider: data.storageProvider,
        storagePath: data.storagePath,
        fileName: file.name || "logbook.pdf",
        fileSizeBytes: file.size,
      });
    }
    return { method: "PUT" as const, url: data.uploadURL };
  };

  const handleArchiveUploadComplete = async (result: any) => {
    const successfulFiles = (result?.successful ?? []) as Array<{ id?: string }>;
    if (successfulFiles.length === 0) {
      toast({ title: "No uploads detected", description: "Please try again.", variant: "destructive" });
      return;
    }
    let created = 0;
    for (const file of successfulFiles) {
      if (!file?.id) continue;
      const meta = archiveUploadMeta.current.get(file.id);
      if (!meta) continue;
      await apiRequest("POST", "/api/logbook/archives", {
        fileName: meta.fileName,
        fileSizeBytes: meta.fileSizeBytes ?? null,
        storageProvider: meta.storageProvider,
        storagePath: meta.storagePath,
      });
      created += 1;
    }
    archiveUploadMeta.current.clear();
    if (created > 0) {
      queryClient.invalidateQueries({ queryKey: ["/api/logbook/archives"] });
      toast({ title: "Archive uploaded", description: `${created} file(s) added.` });
    }
  };

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

  const deleteArchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/logbook/archives/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logbook/archives"] });
      toast({ title: "Archive deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete archive", description: error.message, variant: "destructive" });
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
    mutationFn: async ({
      id,
      signatureDataUrl,
      signedByName,
      cfiCertNumber,
      cfiCertExpires,
    }: {
      id: string;
      signatureDataUrl: string;
      signedByName: string;
      cfiCertNumber: string;
      cfiCertExpires: string;
    }) => {
      const res = await apiRequest("POST", `/api/logbook/${id}/countersign`, {
        signatureDataUrl,
        signedByName,
        cfiCertNumber,
        cfiCertExpires,
      });
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
    <PageShell
      kicker="Records"
      title="Digital Logbook"
      description="Capture flights, endorsements, totals, and currency in one working logbook."
      actions={
        <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">
          Free digital logbook
        </Badge>
      }
      contentClassName="space-y-6"
    >
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
      <section className="rounded-[1.6rem] border border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.96),rgba(255,255,255,0.68))] p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-green-200 bg-green-50 text-green-800">
                Free digital logbook
              </Badge>
              <Badge variant="outline">Export anytime</Badge>
              <Badge variant="outline">{entries.length} entries</Badge>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900">Keep flights, endorsements, and totals in one working logbook.</h2>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Add entries as you fly, export records anytime, and move into RSF Pro only when you want alerts, endorsements, or deeper currency tracking.
              </p>
            </div>
            {entries.some((e) => !e.isLocked) && (
              <div className="rounded-[1rem] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
                Unsigned entries are still drafts. Use <span className="font-semibold">Sign</span> when an entry is final.
              </div>
            )}
            {isGuest && (
              <div className="rounded-[1rem] border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">Create a free account to keep your logbook tied to RSF.</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Save entries, export anytime, and grow into Pro only when you want alerts and advanced workflow.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link
                      href="/register"
                      onClick={() => trackEvent("cta_click", { label: "logbook_guest_register", target: "/register" })}
                    >
                      Create free account
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href="/login"
                      onClick={() => trackEvent("cta_click", { label: "logbook_guest_sign_in", target: "/login" })}
                    >
                      Sign in
                    </Link>
                  </Button>
                </div>
              </div>
            )}
            {!isGuest && !isPro && (
              <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50/90 px-4 py-3">
                <div className="text-sm font-semibold text-emerald-900">Ready for alerts, endorsements, and deeper currency tracking?</div>
                <div className="mt-1 text-xs text-emerald-800">
                  Start a 14-day Pro trial once the free logbook workflow is working for you.
                </div>
                <div className="mt-3">
                  <Button asChild size="sm" variant="outline" className="border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100">
                    <Link
                      href="/logbook/pro"
                      onClick={() => trackEvent("cta_click", { label: "logbook_start_trial_banner", target: "/logbook/pro" })}
                    >
                      Start 14-day Pro trial
                    </Link>
                  </Button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                { label: "Total Time", value: totals.totalTime.toFixed(1) },
                { label: "PIC", value: totals.pic.toFixed(1) },
                { label: "Night", value: totals.night.toFixed(1) },
                { label: "Instrument", value: totals.instrumentActual.toFixed(1) },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1.1rem] border border-primary/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(255,255,255,0.56))] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
                >
                  <div className="text-2xl font-semibold text-primary">{item.value}</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.3rem] border border-primary/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.58))] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <span className="rsf-kicker">Start here</span>
            <h3 className="mt-3 text-xl font-semibold text-slate-900">Most pilots use this page for three things.</h3>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div>
                <div className="font-semibold text-slate-900">Add a flight</div>
                <div>Record the route, aircraft, time, landings, and instrument work.</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Lock the entry when it is final</div>
                <div>Signed entries stay protected while draft entries can still be edited.</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Export or add Pro later</div>
                <div>Keep the free logbook or add alerts, endorsements, and currency tracking when you need them.</div>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row xl:flex-col">
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add flight entry
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <LogbookEntryForm
                    onSubmit={(data) => createMutation.mutate(data)}
                    isPending={createMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => exportToCSV(entries)}
                disabled={entries.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => exportToPDF(entries)}
                disabled={entries.length === 0}
              >
                <FileText className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Totals */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Flight Time Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-muted-foreground">SIC</p>
              <p className="font-semibold">{totals.sic.toFixed(1)} hrs</p>
            </div>
            <div>
              <p className="text-muted-foreground">Dual Received</p>
              <p className="font-semibold">{totals.dual.toFixed(1)} hrs</p>
            </div>
            <div>
              <p className="text-muted-foreground">Solo</p>
              <p className="font-semibold">{totals.solo.toFixed(1)} hrs</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cross-Country</p>
              <p className="font-semibold">{totals.crossCountry.toFixed(1)} hrs</p>
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
              <Badge variant="outline">{entries.length} logged flights</Badge>
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
                  <TableHead>Aircraft / Class</TableHead>
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
                    <TableCell>{entry.tailNumber || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{getAircraftDescriptor(entry)}</span>
                        {entry.isSimulator && (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                            SIM
                          </Badge>
                        )}
                      </div>
                    </TableCell>
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

      {isPro ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-primary" />
              Hard-copy logbook archive
            </CardTitle>
            <CardDescription>Upload combined PDFs of your paper logbooks for secure backup.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                PDF only. Bulk uploads supported.
              </div>
              <ObjectUploader
                maxNumberOfFiles={10}
                maxFileSize={50 * 1024 * 1024}
                allowedFileTypes={["application/pdf"]}
                enableImageEditor={false}
                buttonVariant="outline"
                onGetUploadParameters={handleArchiveUploadParameters}
                onComplete={handleArchiveUploadComplete}
                onError={(message) => toast({ title: "Upload failed", description: message, variant: "destructive" })}
              >
                Upload PDFs
              </ObjectUploader>
            </div>

            {archivesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading archives...
              </div>
            ) : archives.length === 0 ? (
              <div className="text-sm text-muted-foreground">No archives uploaded yet.</div>
            ) : (
              <div className="space-y-2">
                {archives.map((archive) => (
                  <div key={archive.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">{archive.fileName}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatBytes(archive.fileSizeBytes)} • Uploaded {formatDisplayDate(archive.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={apiUrl(`/api/logbook/archives/${archive.id}/download`)} target="_blank" rel="noopener noreferrer">
                          Download
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Delete this archive?")) deleteArchiveMutation.mutate(archive.id);
                        }}
                        disabled={deleteArchiveMutation.isPending}
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
      ) : (
        <Card className="mt-6 border-primary/10 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-primary" />
              Hard-copy logbook archive (Pro)
            </CardTitle>
            <CardDescription>Keep a secure PDF backup of your paper logbooks.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="default" asChild>
              <Link href="/logbook/pro">Upgrade to RSF Pro</Link>
            </Button>
          </CardContent>
        </Card>
      )}

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
            Keep the free digital logbook forever. Upgrade when you want currency automation, endorsements, and deeper workflow intelligence.
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
              Tip: <strong>Your logbook data stays free and exportable.</strong> Pro adds saved workflow value through currency tracking, reminders, and instructor-ready records.
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
              role={signRole}
              onSign={(signatureDataUrl, signedByName, cfiCertNumber, cfiCertExpires) => {
                if (signRole === "pilot") {
                  lockMutation.mutate({ id: selectedEntryId, signatureDataUrl, signedByName });
                } else {
                  countersignMutation.mutate({
                    id: selectedEntryId,
                    signatureDataUrl,
                    signedByName,
                    cfiCertNumber: cfiCertNumber || "",
                    cfiCertExpires: cfiCertExpires || "",
                  });
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
                <div className="text-muted-foreground">Category / Class</div>
                <div>
                  {viewingEntry.aircraftCategory && viewingEntry.aircraftClass
                    ? `${viewingEntry.aircraftCategory} ${viewingEntry.aircraftClass}`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Entry Type</div>
                <div>
                  {viewingEntry.isSimulator
                    ? `Simulator (${viewingEntry.deviceType || "Device"})`
                    : "Actual flight"}
                </div>
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
                <div className="text-muted-foreground">Solo</div>
                <div>{viewingEntry.solo || "0"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Cross-Country</div>
                <div>{viewingEntry.crossCountry || "0"}</div>
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
            {viewingEntry.cfiSignedAt && (
              <div className="mt-3 rounded-md border border-blue-200 bg-blue-50/60 p-3 text-sm">
                <div className="font-semibold text-blue-900">CFI Countersignature</div>
                <div className="mt-1 text-blue-900/90">
                  {viewingEntry.cfiSignedByName || "—"}
                </div>
                <div className="text-xs text-blue-900/80">
                  Cert: {viewingEntry.cfiCertNumber || "—"} | Exp: {formatDisplayDate(viewingEntry.cfiCertExpires)}
                </div>
              </div>
            )}
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
    </PageShell>
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
  type FormData = Omit<InsertLogbookEntry, "approaches" | "landingsDay" | "landingsNight" | "holds"> & {
    approaches: number | string;
    landingsDay: number | string;
    landingsNight: number | string;
    holds: number | string;
    solo: string;
    crossCountry: string;
  };
  
  const [formData, setFormData] = useState<Partial<FormData>>(
    initialData ? {
      flightDate: typeof initialData.flightDate === 'string' 
        ? new Date(initialData.flightDate)
        : initialData.flightDate,
      tailNumber: initialData.tailNumber,
      aircraftType: initialData.aircraftType,
      aircraftCategory: initialData.aircraftCategory,
      aircraftClass: initialData.aircraftClass,
      isSimulator: initialData.isSimulator ?? false,
      deviceType: initialData.deviceType,
      route: initialData.route,
      timeDay: initialData.timeDay?.toString() || "",
      timeNight: initialData.timeNight?.toString() || "",
      pic: initialData.pic?.toString() || "",
      sic: initialData.sic?.toString() || "",
      dual: initialData.dual?.toString() || "",
      solo: initialData.solo?.toString() || "",
      crossCountry: initialData.crossCountry?.toString() || "",
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
      aircraftCategory: "",
      aircraftClass: "",
      isSimulator: false,
      deviceType: "",
      route: "",
      timeDay: "",
      timeNight: "",
      pic: "",
      sic: "",
      dual: "",
      solo: "",
      crossCountry: "",
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
      tailNumber: formData.tailNumber?.trim() || undefined,
      aircraftType: formData.aircraftType?.trim() || undefined,
      aircraftCategory: formData.aircraftCategory?.trim() || undefined,
      aircraftClass: formData.aircraftClass?.trim() || undefined,
      route: formData.route?.trim() || undefined,
      remarks: formData.remarks?.trim() || undefined,
      hobbsStart: formData.hobbsStart?.trim() || undefined,
      hobbsEnd: formData.hobbsEnd?.trim() || undefined,
      timeDay: formData.timeDay?.trim() || undefined,
      timeNight: formData.timeNight?.trim() || undefined,
      pic: formData.pic?.trim() || undefined,
      sic: formData.sic?.trim() || undefined,
      dual: formData.dual?.trim() || undefined,
      solo: formData.solo?.trim() || undefined,
      crossCountry: formData.crossCountry?.trim() || undefined,
      instrumentActual: formData.instrumentActual?.trim() || undefined,
      deviceType: formData.isSimulator ? formData.deviceType?.trim() || undefined : undefined,
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
          <Label htmlFor="tailNumber">{formData.isSimulator ? "Device Identifier" : "Tail Number"}</Label>
          <Input
            id="tailNumber"
            value={formData.tailNumber || ""}
            onChange={(e) => setFormData({ ...formData, tailNumber: e.target.value })}
            placeholder={formData.isSimulator ? "e.g. SIM-42" : "e.g. N123AB"}
          />
        </div>
        <div className="col-span-2 flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
          <div>
            <div className="text-sm font-medium">This is a simulator/ATD/FTD entry (not an actual flight)</div>
            <div className="text-xs text-muted-foreground">Simulator time logged per Sec 61.51(g)</div>
          </div>
          <Switch
            checked={Boolean(formData.isSimulator)}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                isSimulator: checked,
                deviceType: checked ? prev.deviceType || "AATD" : "",
              }))
            }
          />
        </div>
        <div>
          <Label htmlFor="aircraftType">Aircraft Type</Label>
          <Input
            id="aircraftType"
            value={formData.aircraftType || ""}
            onChange={(e) => setFormData({ ...formData, aircraftType: e.target.value })}
            placeholder={formData.isSimulator ? "e.g. Redbird FMX" : "e.g. C172"}
          />
        </div>
        {formData.isSimulator && (
          <div>
            <Label htmlFor="deviceType">Device Type</Label>
            <Select
              value={formData.deviceType || "AATD"}
              onValueChange={(value) => setFormData({ ...formData, deviceType: value })}
            >
              <SelectTrigger id="deviceType">
                <SelectValue placeholder="Select device type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AATD">AATD</SelectItem>
                <SelectItem value="BATD">BATD</SelectItem>
                <SelectItem value="FTD">FTD</SelectItem>
                <SelectItem value="FFS">FFS (Full Flight Sim)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="aircraftCategory">Category</Label>
          <Select
            value={formData.aircraftCategory || ""}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                aircraftCategory: value,
                aircraftClass: getClassOptions(value)[0] || "",
              }))
            }
          >
            <SelectTrigger id="aircraftCategory">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {AIRCRAFT_CATEGORY_OPTIONS.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="aircraftClass">Class</Label>
          <Select
            value={formData.aircraftClass || ""}
            onValueChange={(value) => setFormData({ ...formData, aircraftClass: value })}
            disabled={!formData.aircraftCategory}
          >
            <SelectTrigger id="aircraftClass">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {getClassOptions(formData.aircraftCategory).map((classOption) => (
                <SelectItem key={classOption} value={classOption}>
                  {classOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Label htmlFor="solo">Solo (hours)</Label>
          <Input
            id="solo"
            type="number"
            step="0.1"
            placeholder="0.0"
            value={formData.solo || ""}
            onChange={(e) => setFormData({ ...formData, solo: e.target.value })}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div>
          <Label htmlFor="crossCountry">XC Time (hours)</Label>
          <Input
            id="crossCountry"
            type="number"
            step="0.1"
            placeholder="0.0"
            value={formData.crossCountry || ""}
            onChange={(e) => setFormData({ ...formData, crossCountry: e.target.value })}
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
  role,
  onSign,
  isPending,
}: {
  role: "pilot" | "cfi";
  onSign: (
    signatureDataUrl: string,
    signedByName: string,
    cfiCertNumber?: string,
    cfiCertExpires?: string
  ) => void;
  isPending: boolean;
}) {
  const [signedByName, setSignedByName] = useState("");
  const [cfiCertNumber, setCfiCertNumber] = useState("");
  const [cfiCertExpires, setCfiCertExpires] = useState("");
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
    if (role === "cfi") {
      if (!cfiCertNumber.trim()) {
        alert("Please enter the CFI certificate number");
        return;
      }
      if (!cfiCertExpires) {
        alert("Please enter the CFI certificate expiration date");
        return;
      }
    }

    const dataUrl = mode === "draw" ? getDrawnDataUrl() : getTypedDataUrl();
    if (!dataUrl || (mode === "draw" && !hasDrawn)) {
      alert("Please add a signature first");
      return;
    }

    onSign(
      dataUrl,
      signedByName.trim(),
      role === "cfi" ? cfiCertNumber.trim() : undefined,
      role === "cfi" ? cfiCertExpires : undefined
    );
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
            placeholder={role === "cfi" ? "e.g. Jane Smith, CFI" : "e.g. Jane Smith"}
          />
        </div>
        {role === "cfi" && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="cfiCertNumber">CFI Certificate Number</Label>
              <Input
                id="cfiCertNumber"
                value={cfiCertNumber}
                onChange={(e) => setCfiCertNumber(e.target.value)}
                placeholder="e.g. CFI-1234567"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cfiCertExpires">CFI Certificate Expiration</Label>
              <Input
                id="cfiCertExpires"
                type="date"
                value={cfiCertExpires}
                onChange={(e) => setCfiCertExpires(e.target.value)}
                required
              />
            </div>
          </>
        )}

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
          {role === "cfi" ? "CFI Countersign" : "Sign & Lock"}
        </Button>
      </DialogFooter>
    </>
  );
}
