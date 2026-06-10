import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileImage, FileVideo, FileWarning, Link2, Link2Off, LockKeyhole, Mail, Pencil, Plus, ShieldCheck, Upload, X } from "lucide-react";
import { Link } from "wouter";
import { apiUrl } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const C = {
  page: "min-h-screen bg-[#f3efe7] text-[#201814]",
  shell: "!border-[#d7c8b5] !bg-[#fffaf2] !bg-none !text-[#201814] shadow-[0_18px_45px_rgba(72,52,31,0.10)]",
  field: "!border-[#cdbda8] !bg-white !text-[#201814] placeholder:!text-[#7c6e61]",
  outline: "!border-[#cdbda8] !bg-white !bg-none !text-[#201814] hover:!bg-[#f8efe2]",
  green: "!bg-[#2f5f46] !bg-none !text-white hover:!bg-[#274d39]",
  muted: "!text-[#5f5247]",
};

type Incident = {
  id: string;
  incidentNumber: string;
  incidentDate: string;
  incidentTime: string;
  location: string;
  category: string;
  severity: "low" | "moderate" | "high" | "critical";
  status: "open" | "under_review" | "closed";
  reportedByName: string;
  reportedByPosition: string;
  peopleInvolved: string;
  guestRooms: string;
  witnesses: string;
  description: string;
  immediateActions: string;
  injuries: string;
  propertyDamage: string;
  vehicleDetails: string;
  emergencyServices: string;
  policeReportNumber: string;
  notifications: string;
  followUpRequired: string;
  managerNotes: string;
  emailSentAt: string | null;
  emailError: string;
  evidence: Array<{
    id: string;
    evidenceType: "image" | "video";
    originalFileName: string;
    mimeType: string;
    size: number;
    durationSeconds: number | null;
    uploadedAt: string;
  }>;
  createdAt: string;
};

type AccessResponse = {
  unlocked: boolean;
  hasPin: boolean;
  user: { employeeDisplayName: string; position?: string } | null;
};

const emptyForm = () => ({
  incidentDate: new Date().toISOString().slice(0, 10),
  incidentTime: new Date().toTimeString().slice(0, 5),
  location: "",
  category: "Vehicle / Parking Lot",
  severity: "moderate",
  reportedByName: "",
  reportedByPosition: "",
  peopleInvolved: "",
  guestRooms: "",
  witnesses: "",
  description: "",
  immediateActions: "",
  injuries: "No injuries reported.",
  propertyDamage: "",
  vehicleDetails: "",
  emergencyServices: "",
  policeReportNumber: "",
  notifications: "",
  followUpRequired: "",
  managerNotes: "",
});

function incidentForm(incident: Incident) {
  return {
    incidentDate: incident.incidentDate,
    incidentTime: incident.incidentTime,
    location: incident.location,
    category: incident.category,
    severity: incident.severity,
    reportedByName: incident.reportedByName,
    reportedByPosition: incident.reportedByPosition,
    peopleInvolved: incident.peopleInvolved,
    guestRooms: incident.guestRooms,
    witnesses: incident.witnesses,
    description: incident.description,
    immediateActions: incident.immediateActions,
    injuries: incident.injuries,
    propertyDamage: incident.propertyDamage,
    vehicleDetails: incident.vehicleDetails,
    emergencyServices: incident.emergencyServices,
    policeReportNumber: incident.policeReportNumber,
    notifications: incident.notifications,
    followUpRequired: incident.followUpRequired,
    managerNotes: incident.managerNotes,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(apiUrl(url), { credentials: "include" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5b4b3b]">{label}{required ? " *" : ""}</Label>
      <Input className={`mt-1 ${C.field}`} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TextField({ label, value, onChange, required = false, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5b4b3b]">{label}{required ? " *" : ""}</Label>
      <Textarea className={`mt-1 min-h-[95px] ${C.field}`} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function severityClass(severity: Incident["severity"]) {
  if (severity === "critical") return "bg-rose-700 text-white";
  if (severity === "high") return "bg-orange-600 text-white";
  if (severity === "moderate") return "bg-amber-500 text-white";
  return "bg-[#2f5f46] text-white";
}

export default function IncidentReportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);

  const access = useQuery<AccessResponse>({
    queryKey: ["/api/incidentreport/access"],
    queryFn: () => fetchJson("/api/incidentreport/access"),
  });
  const incidents = useQuery<{ incidents: Incident[] }>({
    queryKey: ["/api/incidentreport"],
    enabled: Boolean(access.data?.unlocked),
    queryFn: () => fetchJson("/api/incidentreport"),
  });
  const unlock = useMutation({
    mutationFn: () => apiRequest("POST", "/api/incidentreport/pin-login", { pin }),
    onSuccess: () => {
      setPin("");
      queryClient.invalidateQueries({ queryKey: ["/api/incidentreport/access"] });
    },
    onError: (error: Error) => toast({ title: "Unable to unlock incident reports", description: error.message, variant: "destructive" }),
  });
  const saveIncident = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(editingIncident ? "PATCH" : "POST", editingIncident ? `/api/incidentreport/${editingIncident.id}` : "/api/incidentreport", form);
      const result = await response.json() as { incident: Incident; emailDelivery?: { sent: boolean; error?: string } };
      let evidenceError = "";
      if (evidenceFiles.length) {
        const body = new FormData();
        evidenceFiles.forEach((file) => body.append("evidence", file));
        const uploadResponse = await fetch(apiUrl(`/api/incidentreport/${result.incident.id}/evidence`), {
          method: "POST",
          credentials: "include",
          body,
        });
        if (!uploadResponse.ok) {
          const errorBody = await uploadResponse.json().catch(() => ({ error: "Evidence upload failed." }));
          evidenceError = errorBody.error || "Evidence upload failed.";
        }
      }
      return { ...result, evidenceError };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidentreport"] });
      setForm({ ...emptyForm(), reportedByName: form.reportedByName, reportedByPosition: form.reportedByPosition });
      setEvidenceFiles([]);
      setShowForm(false);
      const wasEditing = Boolean(editingIncident);
      setEditingIncident(null);
      toast({
        title: wasEditing ? "Incident report updated" : "Incident report saved",
        description: data.evidenceError
          ? `${data.incident.incidentNumber} was saved, but evidence was not uploaded: ${data.evidenceError}`
          : wasEditing
          ? `${data.incident.incidentNumber} was updated. Use Email again to send the revised PDF.`
          : data.emailDelivery?.sent
          ? `${data.incident.incidentNumber} was saved and emailed with its PDF.`
          : `${data.incident.incidentNumber} was saved, but the email could not be sent. Use Email again from the archive.`,
        variant: (wasEditing || data.emailDelivery?.sent) && !data.evidenceError ? "default" : "destructive",
      });
    },
    onError: (error: Error) => toast({ title: "Unable to save incident report", description: error.message, variant: "destructive" }),
  });

  const startNewIncident = () => {
    setEditingIncident(null);
    setEvidenceFiles([]);
    setForm({
      ...emptyForm(),
      reportedByName: access.data?.user?.employeeDisplayName || "",
      reportedByPosition: access.data?.user?.position || "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startEditing = (incident: Incident) => {
    setEditingIncident(incident);
    setForm(incidentForm(incident));
    setEvidenceFiles([]);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingIncident(null);
    setEvidenceFiles([]);
  };
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Incident["status"] }) => apiRequest("PATCH", `/api/incidentreport/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/incidentreport"] }),
    onError: (error: Error) => toast({ title: "Unable to update status", description: error.message, variant: "destructive" }),
  });
  const emailIncident = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/incidentreport/${id}/email`);
      return response.json() as Promise<{ incident: Incident }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidentreport"] });
      toast({ title: "Incident report emailed", description: `${data.incident.incidentNumber} was sent with the PDF attached.` });
    },
    onError: (error: Error) => toast({ title: "Unable to email incident report", description: error.message, variant: "destructive" }),
  });
  const shareIncident = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/incidentreport/${id}/share`);
      return response.json() as Promise<{ shareUrl: string; expiresAt: string }>;
    },
    onSuccess: async (data) => {
      try {
        await navigator.clipboard.writeText(data.shareUrl);
        toast({ title: "PIN-protected share link copied", description: `The recipient must enter the Courtyard PIN. The link expires ${new Date(data.expiresAt).toLocaleString()}.` });
      } catch {
        window.prompt("Copy this incident report share link:", data.shareUrl);
      }
    },
    onError: (error: Error) => toast({ title: "Unable to create share link", description: error.message, variant: "destructive" }),
  });
  const revokeShare = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/incidentreport/${id}/share`),
    onSuccess: () => toast({ title: "Share link revoked", description: "Existing shared access to this report has been disabled." }),
    onError: (error: Error) => toast({ title: "Unable to revoke share link", description: error.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!access.data?.user) return;
    setForm((current) => ({
      ...current,
      reportedByName: current.reportedByName || access.data!.user!.employeeDisplayName || "",
      reportedByPosition: current.reportedByPosition || access.data!.user!.position || "",
    }));
  }, [access.data?.user]);

  if (access.isLoading) return <div className={`${C.page} p-8`}>Loading incident reports...</div>;
  if (!access.data?.unlocked) {
    return (
      <div className={`${C.page} flex items-center justify-center p-4`}>
        <Card className={`w-full max-w-md ${C.shell}`}>
          <CardHeader>
            <div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-[#2f5f46]" /><CardTitle>Incident Report PIN</CardTitle></div>
            <CardDescription className={C.muted}>Enter the established five-digit Courtyard team PIN.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input className={`${C.field} text-center text-2xl tracking-[0.4em]`} type="password" inputMode="numeric" maxLength={5} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 5))} onKeyDown={(event) => event.key === "Enter" && pin.length === 5 && unlock.mutate()} />
            <Button className={`w-full ${C.green}`} disabled={pin.length !== 5 || unlock.isPending} onClick={() => unlock.mutate()}>{unlock.isPending ? "Checking..." : "Open Incident Reports"}</Button>
            {!access.data?.hasPin && <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">No shared Courtyard PIN is configured.</div>}
            <Button asChild variant="outline" className={`w-full ${C.outline}`}><Link href="/courtyard">Back to Associate Portal</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const requiredReady = form.incidentDate && form.incidentTime && form.location.trim() && form.reportedByName.trim() && form.description.trim().length >= 10 && form.immediateActions.trim().length >= 2;

  const chooseEvidence = async (files: FileList | null) => {
    const selected = Array.from(files || []);
    const images = selected.filter((file) => file.type.startsWith("image/"));
    const videos = selected.filter((file) => file.type.startsWith("video/"));
    const existingImages = editingIncident?.evidence.filter((item) => item.evidenceType === "image").length || 0;
    const existingVideoDuration = editingIncident?.evidence
      .filter((item) => item.evidenceType === "video")
      .reduce((total, item) => total + Number(item.durationSeconds || 0), 0) || 0;
    if (existingImages + images.length > 10) {
      toast({ title: "Evidence limit exceeded", description: `This report can accept ${Math.max(0, 10 - existingImages)} more image(s).`, variant: "destructive" });
      return;
    }
    let totalVideoDuration = 0;
    for (const selectedVideo of videos) {
      const duration = await new Promise<number>((resolve, reject) => {
        const video = document.createElement("video");
        const url = URL.createObjectURL(selectedVideo);
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          resolve(video.duration);
        };
        video.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Video metadata could not be read."));
        };
        video.src = url;
      }).catch(() => 0);
      if (!duration) {
        toast({ title: "Video could not be read", description: "Choose an MP4 or QuickTime video.", variant: "destructive" });
        return;
      }
      totalVideoDuration += duration;
    }
    if (existingVideoDuration + totalVideoDuration > 240) {
      toast({ title: "Video is too long", description: `This report has ${Math.max(0, 240 - existingVideoDuration)} seconds of video capacity remaining.`, variant: "destructive" });
      return;
    }
    setEvidenceFiles(selected);
  };

  return (
    <div className={C.page}>
      <header className="border-b border-[#d7c8b5] bg-[#fffaf2] px-4 py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Lakeline</div>
            <h1 className="text-3xl font-semibold tracking-tight">Incident Reports</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className={C.outline}><Link href="/courtyard"><ArrowLeft className="mr-2 h-4 w-4" />Portal</Link></Button>
            {showForm
              ? <Button className={C.outline} variant="outline" onClick={closeForm}><X className="mr-2 h-4 w-4" />Close form</Button>
              : <Button className={C.green} onClick={startNewIncident}><Plus className="mr-2 h-4 w-4" />New incident</Button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <b>Emergency reminder:</b> Call 911 first for immediate threats, serious injuries, fire, or active criminal activity. Preserve video and evidence; record facts without speculation.
        </div>

        {showForm && (
          <Card className={C.shell}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileWarning className="h-5 w-5 text-[#8a6b3f]" />{editingIncident ? `Edit ${editingIncident.incidentNumber}` : "New Hospitality Incident Report"}</CardTitle>
              <CardDescription className={C.muted}>{editingIncident ? "Update the report details or attach evidence received after the original submission. The incident number will not change." : "Fields marked with an asterisk are required. Include objective facts, actions taken, and available case numbers."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Incident date" type="date" required value={form.incidentDate} onChange={(incidentDate) => setForm({ ...form, incidentDate })} />
                <Field label="Incident time" type="time" required value={form.incidentTime} onChange={(incidentTime) => setForm({ ...form, incidentTime })} />
                <Field label="Location" required value={form.location} onChange={(location) => setForm({ ...form, location })} />
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5b4b3b]">Category *</Label>
                  <Select value={form.category} onValueChange={(category) => setForm({ ...form, category })}>
                    <SelectTrigger className={`mt-1 ${C.field}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Vehicle / Parking Lot", "Guest Injury / Medical", "Employee Injury", "Theft / Missing Property", "Security / Disturbance", "Property Damage", "Fire / Life Safety", "Food Safety", "Privacy / Guest Information", "Other"].map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5b4b3b]">Severity *</Label>
                  <Select value={form.severity} onValueChange={(severity) => setForm({ ...form, severity })}>
                    <SelectTrigger className={`mt-1 ${C.field}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Reported by" required value={form.reportedByName} onChange={(reportedByName) => setForm({ ...form, reportedByName })} />
                <Field label="Reporter position" value={form.reportedByPosition} onChange={(reportedByPosition) => setForm({ ...form, reportedByPosition })} />
                <Field label="Guest room(s)" value={form.guestRooms} onChange={(guestRooms) => setForm({ ...form, guestRooms })} />
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <TextField label="People involved" value={form.peopleInvolved} onChange={(peopleInvolved) => setForm({ ...form, peopleInvolved })} placeholder="Names, contact information, guest/employee/vendor relationship..." />
                <TextField label="Witnesses" value={form.witnesses} onChange={(witnesses) => setForm({ ...form, witnesses })} placeholder="Names and contact information; note if written statements were obtained." />
                <TextField label="Detailed incident narrative" required value={form.description} onChange={(description) => setForm({ ...form, description })} placeholder="Describe what was observed, where each party was located, sequence of events, and time references." />
                <TextField label="Immediate actions taken" required value={form.immediateActions} onChange={(immediateActions) => setForm({ ...form, immediateActions })} placeholder="Safety actions, guest assistance, scene preservation, keys/video secured, manager response..." />
                <TextField label="Injuries / medical response" value={form.injuries} onChange={(injuries) => setForm({ ...form, injuries })} />
                <TextField label="Property damage" value={form.propertyDamage} onChange={(propertyDamage) => setForm({ ...form, propertyDamage })} />
                <TextField label="Vehicle details" value={form.vehicleDetails} onChange={(vehicleDetails) => setForm({ ...form, vehicleDetails })} placeholder="Make, model, color, plate, damage location, owner, suspect vehicle..." />
                <TextField label="Police / fire / EMS involvement" value={form.emergencyServices} onChange={(emergencyServices) => setForm({ ...form, emergencyServices })} />
              </section>

              <section className="grid gap-3 md:grid-cols-2">
                <Field label="Police / case report number" value={form.policeReportNumber} onChange={(policeReportNumber) => setForm({ ...form, policeReportNumber })} />
                <Field label="Notifications made" value={form.notifications} onChange={(notifications) => setForm({ ...form, notifications })} />
                <TextField label="Required follow-up" value={form.followUpRequired} onChange={(followUpRequired) => setForm({ ...form, followUpRequired })} />
                <TextField label="Manager notes" value={form.managerNotes} onChange={(managerNotes) => setForm({ ...form, managerNotes })} />
              </section>

              <section className="rounded-lg border border-[#d7c8b5] bg-white p-4">
                <div className="flex items-center gap-2 font-semibold"><Upload className="h-4 w-4 text-[#2f5f46]" />Photo and Video Evidence</div>
                <p className={`mt-1 text-sm ${C.muted}`}>Optional. Attach up to 10 JPEG, PNG, or WebP images and MP4 or QuickTime video clips totaling up to four minutes.</p>
                {editingIncident?.evidence.length ? <p className="mt-1 text-xs font-medium text-[#2f5f46]">{editingIncident.evidence.length} existing evidence file(s) will be retained. New files are added to them.</p> : null}
                <Input className={`mt-3 ${C.field}`} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" onChange={(event) => void chooseEvidence(event.target.files)} />
                {!!evidenceFiles.length && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {evidenceFiles.map((file) => (
                      <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded border border-[#e0d3c1] bg-[#fbf6ee] px-3 py-2 text-sm">
                        {file.type.startsWith("video/") ? <FileVideo className="h-4 w-4" /> : <FileImage className="h-4 w-4" />}
                        <span className="truncate" title={file.name}>{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="flex justify-end">
                <Button className={C.green} disabled={!requiredReady || saveIncident.isPending} onClick={() => saveIncident.mutate()}>
                  <ShieldCheck className="mr-2 h-4 w-4" />{saveIncident.isPending ? "Saving..." : editingIncident ? "Save Changes" : "Submit Incident Report"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={C.shell}>
          <CardHeader>
            <CardTitle>Saved Incident Reports</CardTitle>
            <CardDescription className={C.muted}>The most recent 100 reports are retained here. Download the PDF or send another email copy at any time.</CardDescription>
          </CardHeader>
          <CardContent>
            {incidents.isLoading ? <div className="text-sm text-[#5f5247]">Loading reports...</div> : !incidents.data?.incidents.length ? (
              <div className="rounded-lg border border-dashed border-[#cdbda8] p-6 text-center text-sm text-[#5f5247]">No incident reports have been submitted.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead><tr className="bg-[#243746] text-left text-white">
                    <th className="p-2">Incident</th><th className="p-2">Date / Time</th><th className="p-2">Category</th><th className="p-2">Location</th><th className="p-2">Reported By</th><th className="p-2">Severity</th><th className="p-2">Status</th><th className="p-2">Evidence</th><th className="p-2">Email</th><th className="p-2">Actions</th>
                  </tr></thead>
                  <tbody>
                    {incidents.data.incidents.map((incident) => (
                      <tr key={incident.id} className="border-b border-[#e0d3c1] odd:bg-white even:bg-[#fbf6ee]">
                        <td className="p-2 font-semibold">{incident.incidentNumber}</td>
                        <td className="p-2">{incident.incidentDate}<br /><span className="text-xs text-[#5f5247]">{incident.incidentTime}</span></td>
                        <td className="p-2">{incident.category}</td>
                        <td className="p-2">{incident.location}</td>
                        <td className="p-2">{incident.reportedByName}</td>
                        <td className="p-2"><Badge className={severityClass(incident.severity)}>{incident.severity}</Badge></td>
                        <td className="p-2">
                          <Select value={incident.status} onValueChange={(status: Incident["status"]) => updateStatus.mutate({ id: incident.id, status })}>
                            <SelectTrigger className={`w-36 ${C.field}`}><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="under_review">Under Review</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          {incident.evidence.length ? (
                            <div className="flex max-w-52 flex-wrap gap-1">
                              {incident.evidence.map((item, index) => (
                                <Button key={item.id} asChild size="sm" variant="outline" className={`${C.outline} h-8 px-2`}>
                                  <a href={apiUrl(`/api/incidentreport/${incident.id}/evidence/${item.id}`)} target="_blank" rel="noreferrer" title={item.originalFileName}>
                                    {item.evidenceType === "video" ? <FileVideo className="mr-1 h-3.5 w-3.5" /> : <FileImage className="mr-1 h-3.5 w-3.5" />}
                                    {item.evidenceType === "video" ? "Video" : `Image ${index + 1}`}
                                  </a>
                                </Button>
                              ))}
                            </div>
                          ) : <span className="text-xs text-[#7c6e61]">None</span>}
                        </td>
                        <td className="p-2 text-xs">
                          {incident.emailSentAt
                            ? <span className="font-semibold text-[#2f5f46]">Sent</span>
                            : <span className="font-semibold text-rose-700">Not sent</span>}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className={C.outline} onClick={() => startEditing(incident)}><Pencil className="mr-1 h-4 w-4" />Edit</Button>
                            <Button asChild size="sm" variant="outline" className={C.outline}><a href={apiUrl(`/api/incidentreport/${incident.id}/pdf`)}><Download className="mr-1 h-4 w-4" />PDF</a></Button>
                            <Button size="sm" variant="outline" className={C.outline} disabled={emailIncident.isPending} onClick={() => emailIncident.mutate(incident.id)}><Mail className="mr-1 h-4 w-4" />Email again</Button>
                            <Button size="sm" variant="outline" className={C.outline} disabled={shareIncident.isPending} onClick={() => shareIncident.mutate(incident.id)}><Link2 className="mr-1 h-4 w-4" />Share link</Button>
                            <Button size="sm" variant="outline" className={C.outline} disabled={revokeShare.isPending} onClick={() => revokeShare.mutate(incident.id)} title="Disable any active share link"><Link2Off className="h-4 w-4" /><span className="sr-only">Revoke share link</span></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
