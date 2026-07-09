import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Eye, FileText, Printer, Search, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SearchResult = {
  id: string;
  tailNumber: string | null;
  pilotName: string | null;
  pilotEmail: string | null;
  departure: string;
  destination: string;
  etdZulu: string | null;
  etdLocal: string | null;
  currentRsfStatus: string;
  operationalState: string;
  providerPlanId: string | null;
  lastProviderSync: string | null;
};

type OpsDetail = {
  planId: string;
  retentionNotice: string;
  status: Record<string, any>;
  summary: Record<string, any>;
  pilot: Record<string, any>;
  timeline: Array<{ timestamp: string | null; type: string; label: string; details?: Record<string, unknown> }>;
  amendmentHistory: Array<Record<string, unknown>>;
  providerCommunication: {
    messages: Array<Record<string, unknown>>;
    providerRoute: string | null;
    routeChangedByProvider: boolean;
    retrievalStatus: string | null;
    lastSyncTime: string | null;
  };
  lastKnownRsfActivity: Record<string, any>;
};

const na = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || "Not available";
};

const formatTime = (value: string | null | undefined) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(apiUrl(url), { credentials: "include" });
  if (!response.ok) throw new Error((await response.text()) || response.statusText);
  return response.json();
};

function FieldGrid({ fields }: { fields: Array<[string, unknown]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {fields.map(([label, value]) => (
        <div key={label} className="border-b border-slate-200 pb-2">
          <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
          <div className="mt-1 break-words text-sm font-medium text-slate-950">{na(value)}</div>
        </div>
      ))}
    </div>
  );
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("overdue")) return "bg-amber-100 text-amber-900";
  if (["closed", "cancelled", "canceled"].includes(normalized)) return "bg-slate-200 text-slate-900";
  if (["open", "activated", "active", "filed"].some((item) => normalized.includes(item))) return "bg-emerald-100 text-emerald-900";
  return "bg-slate-100 text-slate-800";
}

export default function FlightServiceOpsPage() {
  const { user, isLoading } = useAuth();
  const [field, setField] = useState("all");
  const [query, setQuery] = useState("");
  const [flightDate, setFlightDate] = useState("");
  const [status, setStatus] = useState("");
  const [state, setState] = useState("all");
  const [searchParams, setSearchParams] = useState("field=all&state=all");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const searchUrl = useMemo(() => `/api/admin/flight-service-ops/search?${searchParams}`, [searchParams]);
  const searchQuery = useQuery<{ results: SearchResult[]; totalReturned: number; retentionNotice: string }>({
    queryKey: [searchUrl],
    queryFn: () => fetchJson(searchUrl),
    enabled: Boolean(user?.isSuperAdmin),
  });
  const detailQuery = useQuery<OpsDetail>({
    queryKey: ["/api/admin/flight-service-ops/plans", selectedPlanId],
    queryFn: () => fetchJson(`/api/admin/flight-service-ops/plans/${encodeURIComponent(selectedPlanId || "")}`),
    enabled: Boolean(user?.isSuperAdmin && selectedPlanId),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    params.set("field", field);
    params.set("state", state);
    if (query.trim()) params.set("q", query.trim());
    if (flightDate) params.set("flightDate", flightDate);
    if (status.trim()) params.set("status", status.trim());
    setSearchParams(params.toString());
  };

  if (isLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-slate-600">Loading...</div>;
  }

  if (!user?.isSuperAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Super Admin Required</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">Flight Service operations support is restricted to RSF super admins.</CardContent>
        </Card>
      </main>
    );
  }

  const detail = detailQuery.data;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-slate-800" />
              <h1 className="text-2xl font-semibold text-slate-950">Flight Service Operations</h1>
            </div>
            <p className="mt-1 text-sm text-slate-600">Super admin SAR support and provider troubleshooting records.</p>
          </div>
          <Badge className="bg-slate-900 text-white">Audit logged</Badge>
        </div>

        <form onSubmit={onSubmit} className="mb-5 grid gap-3 rounded-md border border-slate-200 bg-white p-4 lg:grid-cols-[180px_1fr_160px_160px_160px_auto]">
          <div>
            <Label htmlFor="field">Search by</Label>
            <Select value={field} onValueChange={setField}>
              <SelectTrigger id="field"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All fields</SelectItem>
                <SelectItem value="tail">Tail number</SelectItem>
                <SelectItem value="providerPlanId">Provider plan ID</SelectItem>
                <SelectItem value="planId">RSF plan ID</SelectItem>
                <SelectItem value="pilotName">Pilot name</SelectItem>
                <SelectItem value="pilotPhone">Pilot phone</SelectItem>
                <SelectItem value="pilotEmail">Pilot email</SelectItem>
                <SelectItem value="departure">Departure</SelectItem>
                <SelectItem value="destination">Destination</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="q">Query</Label>
            <Input id="q" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="N123RS, provider ID, airport, pilot contact" />
          </div>
          <div>
            <Label htmlFor="flightDate">Flight date</Label>
            <Input id="flightDate" type="date" value={flightDate} onChange={(event) => setFlightDate(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Input id="status" value={status} onChange={(event) => setStatus(event.target.value)} placeholder="filed" />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger id="state"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any state</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="overdue-like">Overdue-like</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full gap-2"><Search className="h-4 w-4" /> Search</Button>
          </div>
        </form>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_520px]">
          <section className="rounded-md border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="font-semibold text-slate-950">Search Results</h2>
              <span className="text-sm text-slate-500">{searchQuery.data?.totalReturned ?? 0} shown</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tail</TableHead>
                  <TableHead>Pilot</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>ETD Local</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider Plan ID</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchQuery.isLoading && (
                  <TableRow><TableCell colSpan={8} className="text-slate-500">Searching...</TableCell></TableRow>
                )}
                {searchQuery.data?.results.map((result) => (
                  <TableRow key={result.id} data-state={selectedPlanId === result.id ? "selected" : undefined}>
                    <TableCell className="font-medium">{na(result.tailNumber)}</TableCell>
                    <TableCell>{na(result.pilotName)}</TableCell>
                    <TableCell>{result.departure} to {result.destination}</TableCell>
                    <TableCell>{formatTime(result.etdLocal)}</TableCell>
                    <TableCell><Badge className={statusTone(result.operationalState)}>{result.currentRsfStatus}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{na(result.providerPlanId)}</TableCell>
                    <TableCell>{formatTime(result.lastProviderSync)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedPlanId(result.id)}><Eye className="h-4 w-4" /></Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={apiUrl(`/api/admin/flight-service-ops/plans/${encodeURIComponent(result.id)}/sar-report?format=html`)} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" /></a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {searchQuery.data && searchQuery.data.results.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-slate-500">No Flight Service records found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </section>

          <aside className="space-y-4">
            {!detail && (
              <Card>
                <CardHeader><CardTitle className="text-base">Flight Detail</CardTitle></CardHeader>
                <CardContent className="text-sm text-slate-600">Select a result to reconstruct the filing history.</CardContent>
              </Card>
            )}
            {detail && (
              <>
                <section className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-slate-950">{na(detail.summary.tailNumber)} Flight Record</h2>
                      <p className="text-xs text-slate-500">{detail.planId}</p>
                    </div>
                    <Button size="sm" asChild>
                      <a href={apiUrl(`/api/admin/flight-service-ops/plans/${encodeURIComponent(detail.planId)}/sar-report?format=html`)} target="_blank" rel="noreferrer">
                        <Printer className="mr-2 h-4 w-4" /> SAR Report
                      </a>
                    </Button>
                  </div>
                  <FieldGrid fields={[
                    ["RSF status", detail.status.currentRsfStatus],
                    ["Provider status", detail.status.currentProviderStatus],
                    ["Provider plan ID", detail.status.providerPlanId],
                    ["Version stamp", detail.status.versionStamp],
                    ["Last sync", formatTime(detail.status.lastSyncTime)],
                    ["Pending review", detail.status.pendingReview ? "Yes" : "No"],
                  ]} />
                </section>

                <Tabs defaultValue="summary" className="rounded-md border border-slate-200 bg-white p-4">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="provider">Provider</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                  </TabsList>
                  <TabsContent value="summary" className="pt-4">
                    <FieldGrid fields={[
                      ["Aircraft type", detail.summary.aircraftType],
                      ["Color", detail.summary.aircraftColor],
                      ["Endurance", detail.summary.fuelEnduranceMinutes ? `${detail.summary.fuelEnduranceMinutes} min` : null],
                      ["Persons on board", detail.summary.personsOnBoard],
                      ["Wake turbulence", detail.summary.wakeTurbulence],
                      ["Equipment", detail.summary.equipment],
                      ["Surveillance", detail.summary.surveillance],
                      ["PBN", detail.summary.pbn],
                      ["Departure", detail.summary.departure],
                      ["Destination", detail.summary.destination],
                      ["Alternate", detail.summary.alternate],
                      ["Route", detail.summary.route],
                      ["Altitude", detail.summary.altitude],
                      ["Speed", detail.summary.speed],
                      ["Flight rules", detail.summary.flightRules],
                      ["Other Info", detail.summary.otherInfo],
                      ["Supplemental remarks", detail.summary.supplementalRemarks],
                      ["Pilot phone", detail.summary.pilotPhone],
                      ["Home base", detail.summary.aircraftHomeBase],
                      ["Pilot", detail.pilot.name],
                      ["Pilot email", detail.pilot.email],
                    ]} />
                  </TabsContent>
                  <TabsContent value="timeline" className="pt-4">
                    <div className="space-y-3">
                      {detail.timeline.map((event, index) => (
                        <div key={`${event.type}-${index}`} className="border-l-2 border-slate-300 pl-3">
                          <div className="text-xs text-slate-500">{formatTime(event.timestamp)}</div>
                          <div className="font-medium text-slate-950">{event.label}</div>
                          <div className="text-xs uppercase text-slate-500">{event.type}</div>
                        </div>
                      ))}
                      {detail.timeline.length === 0 && <div className="text-sm text-slate-600">Not available</div>}
                    </div>
                  </TabsContent>
                  <TabsContent value="provider" className="pt-4">
                    <FieldGrid fields={[
                      ["Provider route", detail.providerCommunication.providerRoute],
                      ["Route changed by provider", detail.providerCommunication.routeChangedByProvider ? "Yes" : "No"],
                      ["Retrieval status", detail.providerCommunication.retrievalStatus],
                      ["Last sync", formatTime(detail.providerCommunication.lastSyncTime)],
                    ]} />
                    <div className="mt-4 space-y-2">
                      {detail.providerCommunication.messages.map((message, index) => (
                        <div key={index} className="rounded-md border border-slate-200 p-3 text-sm">
                          <div className="font-medium">{na(message.action || "Provider message")}</div>
                          <div className="text-slate-600">{na(message.message || message.result)}</div>
                        </div>
                      ))}
                      {detail.providerCommunication.messages.length === 0 && <div className="text-sm text-slate-600">Not available</div>}
                    </div>
                  </TabsContent>
                  <TabsContent value="activity" className="pt-4">
                    <FieldGrid fields={[
                      ["Last login", detail.lastKnownRsfActivity.lastLogin],
                      ["Last planner update", formatTime(detail.lastKnownRsfActivity.lastPlannerUpdate)],
                      ["Last saved plan update", formatTime(detail.lastKnownRsfActivity.lastSavedPlanUpdate)],
                      ["Last weather/briefing activity", detail.lastKnownRsfActivity.lastWeatherBriefingToolActivity],
                    ]} />
                    <div className="mt-4 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{detail.retentionNotice}</span>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
