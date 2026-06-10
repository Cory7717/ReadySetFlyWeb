import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileImage, FileVideo, LockKeyhole, ShieldAlert } from "lucide-react";
import { useParams } from "wouter";
import { apiUrl } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SharedIncident = {
  id: string;
  incidentNumber: string;
  incidentDate: string;
  incidentTime: string;
  location: string;
  category: string;
  severity: string;
  status: string;
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
  evidence: Array<{ id: string; evidenceType: "image" | "video"; originalFileName: string; durationSeconds: number | null }>;
};

async function fetchShare(token: string) {
  const response = await fetch(apiUrl(`/api/incidentreport/share/${token}`), { credentials: "include" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unable to open this shared report." }));
    throw new Error(body.error);
  }
  return response.json() as Promise<{ incident: SharedIncident; expiresAt: string }>;
}

async function fetchAccess() {
  const response = await fetch(apiUrl("/api/incidentreport/access"), { credentials: "include" });
  if (!response.ok) throw new Error("Unable to verify incident report access.");
  return response.json() as Promise<{ unlocked: boolean; hasPin: boolean }>;
}

export default function IncidentReportSharePage() {
  const { token = "" } = useParams<{ token: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const access = useQuery({ queryKey: ["/api/incidentreport/access"], queryFn: fetchAccess });
  const share = useQuery({
    queryKey: ["/api/incidentreport/share", token],
    queryFn: () => fetchShare(token),
    enabled: Boolean(access.data?.unlocked),
    retry: false,
  });
  const unlock = useMutation({
    mutationFn: () => apiRequest("POST", "/api/incidentreport/pin-login", { pin }),
    onSuccess: async () => {
      setPin("");
      await queryClient.invalidateQueries({ queryKey: ["/api/incidentreport/access"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/incidentreport/share", token] });
    },
    onError: (error: Error) => toast({ title: "Unable to open shared report", description: error.message, variant: "destructive" }),
  });

  if (access.isLoading) return <div className="min-h-screen bg-[#f3efe7] p-8 text-[#201814]">Checking incident report access...</div>;
  if (!access.data?.unlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3efe7] p-4 text-[#201814]">
        <Card className="w-full max-w-md border-[#d7c8b5] bg-[#fffaf2] shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-[#2f5f46]" />Shared Incident Report</CardTitle>
            <p className="text-sm text-[#5f5247]">Enter the established five-digit Courtyard PIN to view this internal report.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input className="border-[#cdbda8] bg-white text-center text-2xl tracking-[0.4em]" type="password" inputMode="numeric" maxLength={5} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 5))} onKeyDown={(event) => event.key === "Enter" && pin.length === 5 && unlock.mutate()} />
            <Button className="w-full bg-[#2f5f46] text-white hover:bg-[#274d39]" disabled={pin.length !== 5 || unlock.isPending} onClick={() => unlock.mutate()}>{unlock.isPending ? "Checking..." : "Open Shared Report"}</Button>
            {!access.data?.hasPin && <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">No shared Courtyard PIN is configured.</div>}
          </CardContent>
        </Card>
      </div>
    );
  }
  if (share.isLoading) return <div className="min-h-screen bg-[#f3efe7] p-8 text-[#201814]">Loading shared incident report...</div>;
  if (share.error || !share.data) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f3efe7] p-4"><Card className="max-w-lg border-[#d7c8b5] bg-[#fffaf2]"><CardContent className="p-8 text-center"><ShieldAlert className="mx-auto mb-3 h-10 w-10 text-rose-700" /><h1 className="text-xl font-semibold">Report unavailable</h1><p className="mt-2 text-sm text-[#5f5247]">{(share.error as Error)?.message}</p></CardContent></Card></div>;
  }

  const { incident } = share.data;
  const fields = [
    ["Date / time", `${incident.incidentDate} at ${incident.incidentTime}`],
    ["Location", incident.location],
    ["Category / severity", `${incident.category} / ${incident.severity}`],
    ["Reported by", `${incident.reportedByName}${incident.reportedByPosition ? `, ${incident.reportedByPosition}` : ""}`],
    ["People involved", incident.peopleInvolved],
    ["Guest room(s)", incident.guestRooms],
    ["Witnesses", incident.witnesses],
    ["Incident narrative", incident.description],
    ["Immediate actions", incident.immediateActions],
    ["Injuries / medical response", incident.injuries],
    ["Property damage", incident.propertyDamage],
    ["Vehicle details", incident.vehicleDetails],
    ["Emergency services", incident.emergencyServices],
    ["Police / case number", incident.policeReportNumber],
    ["Notifications", incident.notifications],
    ["Required follow-up", incident.followUpRequired],
    ["Manager notes", incident.managerNotes],
  ];

  return (
    <div className="min-h-screen bg-[#f3efe7] px-4 py-6 text-[#201814]">
      <main className="mx-auto max-w-5xl space-y-4">
        <Card className="border-[#d7c8b5] bg-[#fffaf2] shadow-lg">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div><div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6b3f]">Courtyard Austin Lakeline</div><CardTitle className="mt-1 text-2xl">Incident {incident.incidentNumber}</CardTitle><p className="mt-1 text-sm text-[#5f5247]">PIN-protected, read-only shared report. Link expires {new Date(share.data.expiresAt).toLocaleString()}.</p></div>
            <div className="flex gap-2"><Badge>{incident.status.replace("_", " ")}</Badge><Button asChild variant="outline"><a href={apiUrl(`/api/incidentreport/share/${token}/pdf`)}><Download className="mr-2 h-4 w-4" />PDF</a></Button></div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {fields.map(([label, value]) => <div key={label} className={`rounded border border-[#e0d3c1] bg-white p-3 ${label === "Incident narrative" || label === "Immediate actions" ? "md:col-span-2" : ""}`}><div className="text-xs font-semibold uppercase tracking-wider text-[#765f48]">{label}</div><div className="mt-1 whitespace-pre-wrap text-sm">{value || "None reported"}</div></div>)}
          </CardContent>
        </Card>
        {!!incident.evidence.length && <Card className="border-[#d7c8b5] bg-[#fffaf2]"><CardHeader><CardTitle>Evidence</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{incident.evidence.map((item, index) => <Button key={item.id} asChild variant="outline"><a href={apiUrl(`/api/incidentreport/share/${token}/evidence/${item.id}`)} target="_blank" rel="noreferrer">{item.evidenceType === "video" ? <FileVideo className="mr-2 h-4 w-4" /> : <FileImage className="mr-2 h-4 w-4" />}{item.evidenceType === "video" ? `Video${item.durationSeconds ? ` (${item.durationSeconds}s)` : ""}` : `Image ${index + 1}`}</a></Button>)}</CardContent></Card>}
      </main>
    </div>
  );
}
