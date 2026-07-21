import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  History,
  Mail,
  Plane,
  Printer,
  Radio,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
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
    providerLifecycle?: string | null;
    providerFlightState?: string | null;
    lastKnownArtccState?: string | null;
    lastSyncTime: string | null;
  };
  lastKnownRsfActivity: Record<string, any>;
};

type SortKey = "tailNumber" | "pilotName" | "departure" | "destination" | "etdZulu" | "currentRsfStatus" | "operationalState" | "providerPlanId" | "lastProviderSync";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 25;
const opsFieldClassName =
  "border-slate-500 bg-slate-950 text-base text-slate-50 placeholder:text-slate-400 focus-visible:ring-blue-600 disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-400 disabled:placeholder:text-slate-500 [color-scheme:dark] [&:-webkit-autofill]:[-webkit-text-fill-color:#f8fafc] [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_#020617_inset]";
const opsSelectTriggerClassName =
  "border-slate-500 bg-slate-950 text-base text-slate-50 focus:ring-blue-600 disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-400 [color-scheme:dark]";
const opsSelectContentClassName = "border-slate-700 bg-slate-950 text-slate-50";

const na = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || "Not available";
};

const formatTime = (value: string | null | undefined, options: Intl.DateTimeFormatOptions = {}) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(apiUrl(url), { credentials: "include" });
  if (!response.ok) throw new Error((await response.text()) || response.statusText);
  return response.json();
};

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();

function statusClass(status: string) {
  const value = normalize(status);
  if (value.includes("provider error") || value.includes("rejected") || value.includes("error")) return "border-orange-300 bg-orange-100 text-orange-950";
  if (value.includes("pending") || value.includes("staged")) return "border-yellow-300 bg-yellow-100 text-yellow-950";
  if (value.includes("activated") || value === "active") return "border-emerald-300 bg-emerald-100 text-emerald-950";
  if (value.includes("closed")) return "border-green-800 bg-green-900 text-white";
  if (value.includes("cancel")) return "border-red-300 bg-red-100 text-red-950";
  if (value.includes("filed") || value.includes("open")) return "border-blue-300 bg-blue-100 text-blue-950";
  if (value.includes("expired")) return "border-slate-700 bg-slate-800 text-white";
  return "border-slate-300 bg-slate-100 text-slate-950";
}

function FieldGrid({ fields, columns = "xl:grid-cols-3" }: { fields: Array<[string, unknown]>; columns?: string }) {
  return (
    <div className={`grid gap-3 md:grid-cols-2 ${columns}`}>
      {fields.map(([label, value]) => (
        <div key={label} className="rounded-md border border-slate-200 bg-white p-3">
          <div className="text-xs font-bold uppercase text-slate-600">{label}</div>
          <div className="mt-1 min-h-6 break-words text-base font-semibold text-slate-950">{na(value)}</div>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading flight details">
      <div className="h-24 animate-pulse rounded-md bg-slate-200" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-20 animate-pulse rounded-md bg-slate-200" />
        <div className="h-20 animate-pulse rounded-md bg-slate-200" />
        <div className="h-20 animate-pulse rounded-md bg-slate-200" />
      </div>
      <div className="h-64 animate-pulse rounded-md bg-slate-200" />
    </div>
  );
}

function EmptyDetailState() {
  return (
    <section className="rounded-md border border-dashed border-slate-300 bg-white p-8">
      <div className="flex max-w-2xl gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-900">
          <Search className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-950">Search Flight Plans</h2>
          <p className="mt-2 text-base leading-7 text-slate-700">
            Select a flight to reconstruct its filing history, provider activity, notifications, amendments, audit records, and SAR-ready operational summary.
          </p>
        </div>
      </div>
    </section>
  );
}

function Timeline({ events }: { events: OpsDetail["timeline"] }) {
  if (events.length === 0) return <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-base text-slate-700">No timeline events are available.</div>;
  return (
    <ol className="space-y-0">
      {events.map((event, index) => (
        <li key={`${event.type}-${index}`} className="grid grid-cols-[32px_1fr] gap-3">
          <div className="flex flex-col items-center">
            <div className={`mt-1 h-4 w-4 rounded-full border-2 ${index === 0 ? "border-slate-500 bg-white" : "border-blue-700 bg-blue-700"}`} />
            {index < events.length - 1 && <div className="h-full min-h-10 w-px bg-slate-300" />}
          </div>
          <div className="pb-5">
            <div className="text-sm font-semibold text-slate-600">{formatTime(event.timestamp)}</div>
            <div className="mt-1 text-lg font-bold text-slate-950">{event.label}</div>
            <div className="text-sm font-medium uppercase text-slate-500">{event.type.replaceAll("_", " ")}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function DetailHeader({ detail }: { detail: OpsDetail }) {
  return (
    <section className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-950">{na(detail.summary.tailNumber)}</h2>
            <Badge className={statusClass(detail.status.currentRsfStatus)}>{na(detail.status.currentRsfStatus)}</Badge>
            {detail.status.currentProviderStatus && <Badge className={statusClass(detail.status.currentProviderStatus)}>{detail.status.currentProviderStatus}</Badge>}
          </div>
          <div className="mt-2 text-base font-medium text-slate-700">
            {na(detail.summary.departure)} to {na(detail.summary.destination)} · {na(detail.summary.flightRules)} · {formatTime(detail.summary.etdZulu)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={apiUrl(`/api/admin/flight-service-ops/plans/${encodeURIComponent(detail.planId)}/sar-report?format=html`)} target="_blank" rel="noreferrer">
              <Printer className="mr-2 h-4 w-4" /> SAR Print View
            </a>
          </Button>
          <Button size="sm" asChild>
            <a href={apiUrl(`/api/admin/flight-service-ops/plans/${encodeURIComponent(detail.planId)}/sar-report`)} target="_blank" rel="noreferrer">
              <FileText className="mr-2 h-4 w-4" /> SAR JSON
            </a>
          </Button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-slate-100 p-3">
          <div className="text-xs font-bold uppercase text-slate-600">Provider Plan ID</div>
          <div className="mt-1 break-words font-mono text-sm font-bold text-slate-950">{na(detail.status.providerPlanId)}</div>
        </div>
        <div className="rounded-md bg-slate-100 p-3">
          <div className="text-xs font-bold uppercase text-slate-600">Version Stamp</div>
          <div className="mt-1 break-words font-mono text-sm font-bold text-slate-950">{na(detail.status.versionStamp)}</div>
        </div>
        <div className="rounded-md bg-slate-100 p-3">
          <div className="text-xs font-bold uppercase text-slate-600">Route</div>
          <div className="mt-1 break-words text-sm font-bold text-slate-950">{na(detail.summary.route)}</div>
        </div>
        <div className="rounded-md bg-slate-100 p-3">
          <div className="text-xs font-bold uppercase text-slate-600">Last Provider Sync</div>
          <div className="mt-1 text-sm font-bold text-slate-950">{formatTime(detail.status.lastSyncTime)}</div>
        </div>
      </div>
    </section>
  );
}

export default function FlightServiceOpsPage() {
  const { user, isLoading } = useAuth();
  const [filters, setFilters] = useState({
    all: "",
    tail: "",
    pilotName: "",
    pilotEmail: "",
    providerPlanId: "",
    versionStamp: "",
    departure: "",
    destination: "",
    route: "",
    aircraftType: "",
    icaoIdentifier: "",
    domesticIdentifier: "",
    flightDate: "",
    dateFrom: "",
    dateTo: "",
    status: "",
    providerStatus: "",
    flightRules: "all",
    state: "all",
  });
  const [searchParams, setSearchParams] = useState("field=all&state=all&limit=100");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("lastProviderSync");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const resultsRegionRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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

  const results = searchQuery.data?.results ?? [];
  const clientFilteredResults = useMemo(() => {
    return results.filter((result) => {
      if (filters.tail && !normalize(result.tailNumber).includes(normalize(filters.tail))) return false;
      if (filters.pilotName && !normalize(result.pilotName).includes(normalize(filters.pilotName))) return false;
      if (filters.pilotEmail && !normalize(result.pilotEmail).includes(normalize(filters.pilotEmail))) return false;
      if (filters.providerPlanId && !normalize(result.providerPlanId).includes(normalize(filters.providerPlanId))) return false;
      if (filters.departure && !normalize(result.departure).includes(normalize(filters.departure))) return false;
      if (filters.destination && !normalize(result.destination).includes(normalize(filters.destination))) return false;
      if (filters.status && !normalize(result.currentRsfStatus).includes(normalize(filters.status))) return false;
      if (filters.dateFrom && result.etdZulu && result.etdZulu.slice(0, 10) < filters.dateFrom) return false;
      if (filters.dateTo && result.etdZulu && result.etdZulu.slice(0, 10) > filters.dateTo) return false;
      return true;
    });
  }, [filters, results]);

  const sortedResults = useMemo(() => {
    return [...clientFilteredResults].sort((a, b) => {
      const left = normalize(a[sortKey]);
      const right = normalize(b[sortKey]);
      const result = left.localeCompare(right);
      return sortDirection === "asc" ? result : -result;
    });
  }, [clientFilteredResults, sortDirection, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sortedResults.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const firstIndex = sortedResults.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const lastIndex = Math.min(safePage * PAGE_SIZE, sortedResults.length);
  const pagedResults = sortedResults.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedIndex = sortedResults.findIndex((result) => result.id === selectedPlanId);

  const setFilter = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  const buildBackendSearch = useCallback(() => {
    const preferred: Array<[string, string]> = [
      ["tail", filters.tail],
      ["providerPlanId", filters.providerPlanId],
      ["pilotName", filters.pilotName],
      ["pilotEmail", filters.pilotEmail],
      ["departure", filters.departure],
      ["destination", filters.destination],
      ["all", filters.all || filters.versionStamp || filters.route || filters.aircraftType || filters.icaoIdentifier || filters.domesticIdentifier || filters.providerStatus],
    ];
    const selected = preferred.find(([, value]) => value.trim());
    const params = new URLSearchParams();
    params.set("field", selected?.[0] || "all");
    params.set("state", filters.state);
    params.set("limit", "100");
    if (selected?.[1]) params.set("q", selected[1].trim());
    if (filters.flightDate) params.set("flightDate", filters.flightDate);
    if (filters.status) params.set("status", filters.status.trim());
    return params.toString();
  }, [filters]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearchParams(buildBackendSearch());
  };

  const selectResult = useCallback((planId: string) => {
    setSelectedPlanId(planId);
  }, []);

  const openReport = useCallback((planId: string | null) => {
    if (!planId) return;
    window.open(apiUrl(`/api/admin/flight-service-ops/plans/${encodeURIComponent(planId)}/sar-report?format=html`), "_blank", "noopener,noreferrer");
  }, []);

  const moveSelection = useCallback((delta: number) => {
    if (sortedResults.length === 0) return;
    const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIndex = Math.min(sortedResults.length - 1, Math.max(0, currentIndex + delta));
    const next = sortedResults[nextIndex];
    setSelectedPlanId(next.id);
    setPage(Math.floor(nextIndex / PAGE_SIZE) + 1);
  }, [selectedIndex, sortedResults]);

  const handleResultsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      openReport(selectedPlanId);
    } else if (event.key === "Escape") {
      event.preventDefault();
      searchInputRef.current?.focus();
    }
  };

  const changeSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [page, safePage]);

  if (isLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-10 text-base text-slate-700">Loading...</div>;
  }

  if (!user?.isSuperAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-950"><ShieldCheck className="h-5 w-5" /> Super Admin Required</CardTitle>
          </CardHeader>
          <CardContent className="text-base text-slate-700">Flight Service operations support is restricted to RSF super admins.</CardContent>
        </Card>
      </main>
    );
  }

  const detail = detailQuery.data;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto max-w-[1680px] px-4 py-5">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="h-6 w-6 text-blue-800" />
              <h1 className="text-3xl font-bold tracking-normal text-slate-950">Flight Service Operations Console</h1>
            </div>
            <p className="mt-1 text-base font-medium text-slate-700">Troubleshooting, provider investigation, SAR support, and audit review.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="border-slate-700 bg-slate-950 px-3 py-1 text-sm text-white">Super Admin</Badge>
            <Badge variant="outline" className="border-blue-700 bg-blue-50 px-3 py-1 text-sm font-bold text-blue-950">Access audited</Badge>
          </div>
        </header>

        <form onSubmit={onSubmit} className="sticky top-0 z-20 mb-4 rounded-md border border-slate-300 bg-white p-4 shadow-md" aria-label="Flight Service search filters">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-950">Search Filters</h2>
            <Button type="submit" className="gap-2 bg-blue-800 text-base hover:bg-blue-900"><Search className="h-4 w-4" /> Search</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="md:col-span-2">
              <Label htmlFor="all">Search all fields</Label>
              <Input ref={searchInputRef} id="all" value={filters.all} onChange={(event) => setFilter("all", event.target.value)} placeholder="Tail, provider ID, airport, pilot, status" className={opsFieldClassName} />
            </div>
            <div>
              <Label htmlFor="tail">Tail number</Label>
              <Input id="tail" value={filters.tail} onChange={(event) => setFilter("tail", event.target.value)} className={opsFieldClassName} />
            </div>
            <div>
              <Label htmlFor="providerPlanId">Provider plan ID</Label>
              <Input id="providerPlanId" value={filters.providerPlanId} onChange={(event) => setFilter("providerPlanId", event.target.value)} className={opsFieldClassName} />
            </div>
            <div>
              <Label htmlFor="pilotName">Pilot name</Label>
              <Input id="pilotName" value={filters.pilotName} onChange={(event) => setFilter("pilotName", event.target.value)} className={opsFieldClassName} />
            </div>
            <div>
              <Label htmlFor="pilotEmail">Pilot email</Label>
              <Input id="pilotEmail" value={filters.pilotEmail} onChange={(event) => setFilter("pilotEmail", event.target.value)} className={opsFieldClassName} />
            </div>
            <div>
              <Label htmlFor="departure">Departure</Label>
              <Input id="departure" value={filters.departure} onChange={(event) => setFilter("departure", event.target.value.toUpperCase())} className={opsFieldClassName} />
            </div>
            <div>
              <Label htmlFor="destination">Destination</Label>
              <Input id="destination" value={filters.destination} onChange={(event) => setFilter("destination", event.target.value.toUpperCase())} className={opsFieldClassName} />
            </div>
            <div>
              <Label htmlFor="route">Route contains</Label>
              <Input id="route" value={filters.route} onChange={(event) => setFilter("route", event.target.value.toUpperCase())} className={opsFieldClassName} />
            </div>
            <div>
              <Label htmlFor="flightDate">Flight date</Label>
              <Input id="flightDate" type="date" value={filters.flightDate} onChange={(event) => setFilter("flightDate", event.target.value)} className={opsFieldClassName} />
            </div>
            <div>
              <Label htmlFor="dateFrom">Date range start</Label>
              <Input id="dateFrom" type="date" value={filters.dateFrom} onChange={(event) => setFilter("dateFrom", event.target.value)} className={opsFieldClassName} />
            </div>
            <div>
              <Label htmlFor="dateTo">Date range end</Label>
              <Input id="dateTo" type="date" value={filters.dateTo} onChange={(event) => setFilter("dateTo", event.target.value)} className={opsFieldClassName} />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Input id="status" value={filters.status} onChange={(event) => setFilter("status", event.target.value)} placeholder="filed, closed" className={opsFieldClassName} />
            </div>
            <div>
              <Label htmlFor="providerStatus">Provider status</Label>
              <Input id="providerStatus" value={filters.providerStatus} onChange={(event) => setFilter("providerStatus", event.target.value)} className={opsFieldClassName} />
            </div>
            <div>
              <Label htmlFor="aircraftType">Aircraft type</Label>
              <Input id="aircraftType" value={filters.aircraftType} onChange={(event) => setFilter("aircraftType", event.target.value.toUpperCase())} className={opsFieldClassName} />
            </div>
            <div>
              <Label htmlFor="versionStamp">Version stamp</Label>
              <Input id="versionStamp" value={filters.versionStamp} onChange={(event) => setFilter("versionStamp", event.target.value)} className={opsFieldClassName} />
            </div>
            <div>
              <Label htmlFor="flightRules">Flight rule</Label>
              <Select value={filters.flightRules} onValueChange={(value) => setFilter("flightRules", value)}>
                <SelectTrigger id="flightRules" className={opsSelectTriggerClassName}><SelectValue /></SelectTrigger>
                <SelectContent className={opsSelectContentClassName}>
                  <SelectItem value="all">Any rule</SelectItem>
                  <SelectItem value="VFR">VFR</SelectItem>
                  <SelectItem value="IFR">IFR</SelectItem>
                  <SelectItem value="DVFR">DVFR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="state">Operational state</Label>
              <Select value={filters.state} onValueChange={(value) => setFilter("state", value)}>
                <SelectTrigger id="state" className={opsSelectTriggerClassName}><SelectValue /></SelectTrigger>
                <SelectContent className={opsSelectContentClassName}>
                  <SelectItem value="all">Any state</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="overdue-like">Overdue-like</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 text-sm font-medium text-slate-600">
            Expanded filters that are not part of the summary endpoint are applied after summaries load; complete payload reconstruction still loads only after row selection.
          </div>
        </form>

        <div className="grid gap-4 xl:grid-cols-[35fr_65fr]" onKeyDown={handleResultsKeyDown}>
          <section ref={resultsRegionRef} className="min-w-0 rounded-md border border-slate-300 bg-white shadow-sm" aria-label="Search results" tabIndex={0}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-slate-50 px-4 py-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Results</h2>
                <div className="text-sm font-semibold text-slate-600">
                  Showing {firstIndex}-{lastIndex} of {sortedResults.length} loaded
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <div className="hidden items-center gap-1 md:flex" aria-label="Page numbers">
                  {Array.from({ length: Math.min(5, pageCount) }, (_, index) => {
                    const start = Math.min(Math.max(1, safePage - 2), Math.max(1, pageCount - 4));
                    const pageNumber = start + index;
                    if (pageNumber > pageCount) return null;
                    return (
                      <Button
                        key={pageNumber}
                        type="button"
                        variant={pageNumber === safePage ? "default" : "outline"}
                        size="sm"
                        className="h-8 min-w-8 px-2"
                        onClick={() => setPage(pageNumber)}
                        aria-current={pageNumber === safePage ? "page" : undefined}
                      >
                        {pageNumber}
                      </Button>
                    );
                  })}
                </div>
                <div className="rounded-md border border-slate-300 px-3 py-1 text-sm font-bold md:hidden">Page {safePage} of {pageCount}</div>
                <Button type="button" variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="max-h-[720px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-100">
                  <TableRow>
                    {[
                      ["tailNumber", "Tail"],
                      ["pilotName", "Pilot"],
                      ["departure", "Dep"],
                      ["destination", "Dest"],
                      ["etdZulu", "ETD"],
                      ["currentRsfStatus", "Status"],
                      ["operationalState", "Provider Status"],
                      ["providerPlanId", "Provider ID"],
                      ["lastProviderSync", "Last Update"],
                    ].map(([key, label]) => (
                      <TableHead key={key} className="text-sm font-bold text-slate-800">
                        <button type="button" className="flex items-center gap-1 rounded-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-700" onClick={() => changeSort(key as SortKey)}>
                          {label}
                          {sortKey === key && (sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                        </button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchQuery.isLoading && (
                    <TableRow><TableCell colSpan={9} className="p-6 text-base font-medium text-slate-700">Searching Flight Service records...</TableCell></TableRow>
                  )}
                  {pagedResults.map((result) => {
                    const selected = selectedPlanId === result.id;
                    return (
                      <TableRow
                        key={result.id}
                        tabIndex={0}
                        aria-selected={selected}
                        className={`cursor-pointer outline-none focus:ring-2 focus:ring-blue-700 ${selected ? "border-l-4 border-l-blue-800 bg-blue-50 hover:bg-blue-50" : "hover:bg-slate-50"}`}
                        onClick={() => selectResult(result.id)}
                        onDoubleClick={() => openReport(result.id)}
                      >
                        <TableCell className="text-base font-bold text-slate-950">{na(result.tailNumber)}</TableCell>
                        <TableCell className="text-base font-semibold text-slate-900">{na(result.pilotName)}</TableCell>
                        <TableCell className="font-mono text-sm font-bold text-slate-900">{result.departure}</TableCell>
                        <TableCell className="font-mono text-sm font-bold text-slate-900">{result.destination}</TableCell>
                        <TableCell className="text-sm font-semibold text-slate-900">{formatTime(result.etdZulu)}</TableCell>
                        <TableCell><Badge className={statusClass(result.currentRsfStatus)}>{result.currentRsfStatus}</Badge></TableCell>
                        <TableCell><Badge className={statusClass(result.operationalState)}>{result.operationalState}</Badge></TableCell>
                        <TableCell className="max-w-[160px] truncate font-mono text-xs font-bold text-slate-900">{na(result.providerPlanId)}</TableCell>
                        <TableCell className="text-sm font-semibold text-slate-900">{formatTime(result.lastProviderSync)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {searchQuery.data && sortedResults.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="p-6 text-base font-medium text-slate-700">No Flight Service records found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="border-t border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">
              Keyboard: Up/Down selects results, Enter opens printable SAR report, double click opens the report.
            </div>
          </section>

          <section className="min-w-0 space-y-4" aria-label="Selected flight operational report">
            {detailQuery.isLoading && <LoadingSkeleton />}
            {!detailQuery.isLoading && !detail && <EmptyDetailState />}
            {!detailQuery.isLoading && detail && (
              <>
                <DetailHeader detail={detail} />
                <Tabs defaultValue="overview" className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
                  <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-slate-100 p-1 md:grid-cols-6">
                    <TabsTrigger value="overview" className="text-base font-bold"><Plane className="mr-2 h-4 w-4" /> Overview</TabsTrigger>
                    <TabsTrigger value="timeline" className="text-base font-bold"><History className="mr-2 h-4 w-4" /> Timeline</TabsTrigger>
                    <TabsTrigger value="provider" className="text-base font-bold"><Mail className="mr-2 h-4 w-4" /> Provider</TabsTrigger>
                    <TabsTrigger value="amendments" className="text-base font-bold"><Clock className="mr-2 h-4 w-4" /> Amendments</TabsTrigger>
                    <TabsTrigger value="audit" className="text-base font-bold"><ShieldCheck className="mr-2 h-4 w-4" /> Audit</TabsTrigger>
                    <TabsTrigger value="sar" className="text-base font-bold"><AlertTriangle className="mr-2 h-4 w-4" /> SAR</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="pt-4">
                    <div className="space-y-4">
                      <FieldGrid fields={[
                        ["Tail number", detail.summary.tailNumber],
                        ["Pilot", detail.pilot.name],
                        ["Provider status", detail.status.currentProviderStatus],
                        ["Departure", detail.summary.departure],
                        ["Destination", detail.summary.destination],
                        ["Route", detail.summary.route],
                        ["Filed time", formatTime(detail.timeline.find((event) => event.type === "filed" || normalize(event.label).includes("file"))?.timestamp)],
                        ["ETD", formatTime(detail.summary.etdZulu)],
                        ["ETE", detail.summary.etaZulu ? `${formatTime(detail.summary.etdZulu)} to ${formatTime(detail.summary.etaZulu)}` : null],
                        ["Altitude", detail.summary.altitude],
                        ["Aircraft type", detail.summary.aircraftType],
                        ["Provider plan ID", detail.status.providerPlanId],
                        ["Version stamp", detail.status.versionStamp],
                        ["Flight rules", detail.summary.flightRules],
                        ["Other Info", detail.summary.otherInfo],
                      ]} />
                      <FieldGrid columns="xl:grid-cols-2" fields={[
                        ["Pilot information", `${na(detail.pilot.name)} · ${na(detail.pilot.email)} · ${na(detail.pilot.phone)}`],
                        ["Aircraft information", `${na(detail.summary.aircraftType)} · ${na(detail.summary.aircraftColor)} · home base ${na(detail.summary.aircraftHomeBase)}`],
                        ["Route", `${na(detail.summary.departure)} to ${na(detail.summary.destination)} via ${na(detail.summary.route)} alternate ${na(detail.summary.alternate)}`],
                        ["Timing", `ETD ${formatTime(detail.summary.etdZulu)} · ETA ${formatTime(detail.summary.etaZulu)}`],
                        ["Provider information", `Provider ID ${na(detail.status.providerPlanId)} · version ${na(detail.status.versionStamp)}`],
                        ["Administrative notes", detail.retentionNotice],
                      ]} />
                    </div>
                  </TabsContent>

                  <TabsContent value="timeline" className="pt-4">
                    <Timeline events={detail.timeline} />
                  </TabsContent>

                  <TabsContent value="provider" className="pt-4">
                    <div className="space-y-4">
                      <FieldGrid fields={[
                        ["Provider route", detail.providerCommunication.providerRoute],
                        ["Route changed by provider", detail.providerCommunication.routeChangedByProvider ? "Yes" : "No"],
                        ["Provider lifecycle", detail.providerCommunication.providerLifecycle],
                        ["Provider flight state", detail.providerCommunication.providerFlightState || "Not returned"],
                        ["Last known ARTCC state", detail.providerCommunication.lastKnownArtccState || "Not returned"],
                        ["Provider retrieval", detail.providerCommunication.retrievalStatus],
                        ["Last provider update", formatTime(detail.providerCommunication.lastSyncTime)],
                      ]} />
                      <div className="space-y-3">
                        {detail.providerCommunication.messages.map((message, index) => (
                          <details key={index} className="rounded-md border border-slate-300 bg-slate-50 p-4">
                            <summary className="cursor-pointer text-base font-bold text-slate-950">
                              {na(message.action || "Provider message")} · {na(message.result || message.code)}
                            </summary>
                            <div className="mt-3 grid gap-2 text-base text-slate-800 md:grid-cols-2">
                              <div><span className="font-bold">Timestamp:</span> {formatTime(String(message.timestamp || ""))}</div>
                              <div><span className="font-bold">Provider ID:</span> {na(message.providerPlanId)}</div>
                              <div><span className="font-bold">Version:</span> {na(message.versionStamp)}</div>
                              <div><span className="font-bold">Direction:</span> Inbound / provider response</div>
                              <div className="md:col-span-2"><span className="font-bold">Decoded summary:</span> {na(message.message || message.result)}</div>
                            </div>
                          </details>
                        ))}
                        {detail.providerCommunication.messages.length === 0 && <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-base text-slate-700">No provider messages retained for this plan.</div>}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="amendments" className="pt-4">
                    <div className="space-y-3">
                      {detail.amendmentHistory.map((entry, index) => (
                        <details key={index} className="rounded-md border border-slate-300 bg-white p-4" open={index === detail.amendmentHistory.length - 1}>
                          <summary className="cursor-pointer text-base font-bold text-slate-950">
                            {na(entry.action).toUpperCase()} · {formatTime(String(entry.stagedAt || entry.timestamp || ""))}
                          </summary>
                          <FieldGrid columns="xl:grid-cols-2" fields={[
                            ["Action", entry.action],
                            ["Provider Plan ID", entry.providerPlanId],
                            ["Version Stamp", entry.versionStamp],
                            ["Live provider call", entry.live === false ? "No" : "Yes"],
                            ["Message", entry.message],
                            ["Changed fields", entry.changedFields ? JSON.stringify(entry.changedFields) : "Not available"],
                          ]} />
                        </details>
                      ))}
                      {detail.amendmentHistory.length === 0 && <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-base text-slate-700">No amendment or provider action history retained for this plan.</div>}
                    </div>
                  </TabsContent>

                  <TabsContent value="audit" className="pt-4">
                    <div className="space-y-4">
                      <FieldGrid fields={[
                        ["Admin access", "Searches, views, and SAR report opens are logged server-side"],
                        ["Last login", detail.lastKnownRsfActivity.lastLogin],
                        ["Last planner update", formatTime(detail.lastKnownRsfActivity.lastPlannerUpdate)],
                        ["Last saved plan update", formatTime(detail.lastKnownRsfActivity.lastSavedPlanUpdate)],
                        ["Last weather/briefing/tool activity", detail.lastKnownRsfActivity.lastWeatherBriefingToolActivity],
                        ["Notification acknowledgements", detail.status.pendingReview ? "Provider review pending" : "Not available"],
                      ]} />
                      <details className="rounded-md border border-slate-300 bg-slate-50 p-4">
                        <summary className="cursor-pointer text-base font-bold text-slate-950">Operational retention and audit notes</summary>
                        <p className="mt-3 text-base leading-7 text-slate-700">{detail.retentionNotice}</p>
                      </details>
                    </div>
                  </TabsContent>

                  <TabsContent value="sar" className="pt-4">
                    <div className="mb-4 flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950">
                      <div className="flex gap-3">
                        <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
                        <div>
                          <div className="text-lg font-bold">SAR Support Summary</div>
                          <div className="text-base">Generated from RSF records. Verify against Leidos/provider records before relying on this report.</div>
                        </div>
                      </div>
                      <Button variant="outline" asChild>
                        <a href={apiUrl(`/api/admin/flight-service-ops/plans/${encodeURIComponent(detail.planId)}/sar-report?format=html`)} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" /> Printable
                        </a>
                      </Button>
                    </div>
                    <FieldGrid fields={[
                      ["Pilot contact", `${na(detail.pilot.name)} · ${na(detail.pilot.phone)} · ${na(detail.pilot.email)}`],
                      ["Emergency contact", detail.pilot.secondaryEmergencyContact],
                      ["Aircraft", `${na(detail.summary.tailNumber)} · ${na(detail.summary.aircraftType)}`],
                      ["Color", detail.summary.aircraftColor],
                      ["Home airport", detail.summary.aircraftHomeBase],
                      ["Filed route", detail.summary.route],
                      ["Alternate", detail.summary.alternate],
                      ["Fuel endurance", detail.summary.fuelEnduranceMinutes ? `${detail.summary.fuelEnduranceMinutes} minutes` : null],
                      ["Souls on board", detail.summary.personsOnBoard],
                      ["Survival equipment", "Not available"],
                      ["Remarks", detail.summary.supplementalRemarks],
                      ["Provider ID", detail.status.providerPlanId],
                      ["Version stamp", detail.status.versionStamp],
                      ["Last provider update", formatTime(detail.status.lastSyncTime)],
                    ]} />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
