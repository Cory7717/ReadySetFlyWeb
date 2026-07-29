import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Copy, Download, ExternalLink, Lock, MapPin, Plus, RefreshCw, Save, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";

const TYPES = ["Groups", "Special Corp", "Government", "Corporate Accounts"];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
async function request(url: string, init?: RequestInit) {
  const response = await fetch(apiUrl(url), { credentials: "include", ...init });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || "Request failed");
  return body;
}

function MonthlySalesTargets({ hotelId }: { hotelId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const nextMonth = useMemo(() => {
    const value = new Date();
    value.setMonth(value.getMonth() + 1);
    return { year: value.getFullYear(), month: value.getMonth() + 1 };
  }, []);
  const [targetYear, setTargetYear] = useState(String(nextMonth.year));
  const [targetMonth, setTargetMonth] = useState(String(nextMonth.month));
  const [drafts, setDrafts] = useState<any[]>([]);
  const targets = useQuery({
    queryKey: ["sales-monthly-targets", hotelId, targetYear, targetMonth],
    queryFn: () => request(`/api/courtyard/sales-intelligence/advisor/monthly-targets?hotelId=${encodeURIComponent(hotelId)}&targetYear=${targetYear}&targetMonth=${targetMonth}`),
    enabled: !!hotelId,
  });
  useEffect(() => {
    if (!targets.data) return;
    setDrafts(targets.data.segments.map((item: any) => ({
      segment: item.segment,
      targetRoomNights: Number(item.saved?.targetRoomNights ?? item.recommended.roomNights),
      targetRevenue: Number(item.saved?.targetRevenue ?? item.recommended.revenue),
      stretchRoomNights: Number(item.saved?.stretchRoomNights ?? item.stretch.roomNights),
      stretchRevenue: Number(item.saved?.stretchRevenue ?? item.stretch.revenue),
      rationale: item.saved?.rationale || item.rationale,
    })));
  }, [targets.data]);
  const locked = !!targets.data?.segments?.length && targets.data.segments.every((item: any) => item.saved?.status === "locked");
  const update = (segment: string, field: string, value: string) => setDrafts((current) => current.map((item) => item.segment === segment ? { ...item, [field]: field === "rationale" ? value : Number(value) } : item));
  const save = useMutation({
    mutationFn: (status: "draft" | "locked") => request("/api/courtyard/sales-intelligence/advisor/monthly-targets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId, targetYear: Number(targetYear), targetMonth: Number(targetMonth), status, segments: drafts }),
    }),
    onSuccess: (value) => {
      queryClient.invalidateQueries({ queryKey: ["sales-monthly-targets", hotelId, targetYear, targetMonth] });
      toast({ title: value.status === "locked" ? "Monthly sales plan locked" : "Monthly sales targets saved", description: value.status === "locked" ? "The approved targets are now fixed for this reporting month." : "The plan remains editable until it is locked." });
    },
    onError: (error: Error) => toast({ title: "Could not save monthly targets", description: error.message, variant: "destructive" }),
  });
  const years = [nextMonth.year - 1, nextMonth.year, nextMonth.year + 1, nextMonth.year + 2];
  return <Card className="!border-[#2f5f46] !bg-[#fffaf2] !text-[#201814]">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#2f5f46]" />Monthly Group & Special Corp Targets</CardTitle><CardDescription className="mt-1 !text-[#5f5247]">Set the onsite sales goal before the month begins, then track official segment production as reports arrive.</CardDescription></div>
        {locked && <Badge className="!bg-[#2f5f46] !text-white"><Lock className="mr-1 h-3 w-3" />Locked Plan</Badge>}
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={targetYear} onValueChange={setTargetYear}><SelectTrigger className="w-32 bg-white"><SelectValue /></SelectTrigger><SelectContent>{years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select>
        <Select value={targetMonth} onValueChange={setTargetMonth}><SelectTrigger className="w-48 bg-white"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <SelectItem key={month} value={String(month)}>{new Date(2020, month - 1, 1).toLocaleDateString("en-US", { month: "long" })}</SelectItem>)}</SelectContent></Select>
      </div>
      {targets.isLoading && <div className="rounded-md border border-[#deceba] bg-white p-5 text-[#5f5247]">Building historical target baseline…</div>}
      {targets.error && <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900">{(targets.error as Error).message}</div>}
      {targets.data && <>
        <div className="rounded-md border border-[#b7ccb9] bg-[#e7f0e9] p-3 text-sm text-[#294d38]">{targets.data.methodology}</div>
        <div className="grid gap-4 xl:grid-cols-2">
          {targets.data.segments.map((item: any) => {
            const draft = drafts.find((value) => value.segment === item.segment) || {};
            const targetAdr = Number(draft.targetRoomNights) > 0 ? Number(draft.targetRevenue) / Number(draft.targetRoomNights) : 0;
            return <div key={item.segment} className="rounded-lg border border-[#cdbda8] bg-white p-4">
              <div className="flex items-start justify-between gap-2"><div><h3 className="text-lg font-semibold">{item.segment}</h3><p className="text-xs text-[#6e5d50]">{item.baseline.source} · {item.confidence} confidence</p></div><Badge variant="outline" className="border-[#8d765a] text-[#3f3329]">Recommended +{item.growth.roomNightsPercent}% rooms</Badge></div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded bg-[#f7f1e7] p-2"><div className="text-xs text-[#6e5d50]">Historical Base</div><strong>{Math.round(item.baseline.roomNights)} rooms</strong><div>{money.format(item.baseline.revenue)}</div></div>
                <div className="rounded bg-[#e7f0e9] p-2"><div className="text-xs text-[#52705e]">System Recommendation</div><strong>{item.recommended.roomNights} rooms</strong><div>{money.format(item.recommended.revenue)}</div></div>
                <div className="rounded bg-[#f2e5cf] p-2"><div className="text-xs text-[#7a5d35]">Stretch</div><strong>{item.stretch.roomNights} rooms</strong><div>{money.format(item.stretch.revenue)}</div></div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div><Label>Target room nights</Label><Input type="number" min="0" disabled={locked} value={draft.targetRoomNights ?? ""} onChange={(event) => update(item.segment, "targetRoomNights", event.target.value)} /></div>
                <div><Label>Target revenue</Label><Input type="number" min="0" disabled={locked} value={draft.targetRevenue ?? ""} onChange={(event) => update(item.segment, "targetRevenue", event.target.value)} /></div>
                <div><Label>Stretch room nights</Label><Input type="number" min="0" disabled={locked} value={draft.stretchRoomNights ?? ""} onChange={(event) => update(item.segment, "stretchRoomNights", event.target.value)} /></div>
                <div><Label>Stretch revenue</Label><Input type="number" min="0" disabled={locked} value={draft.stretchRevenue ?? ""} onChange={(event) => update(item.segment, "stretchRevenue", event.target.value)} /></div>
              </div>
              <div className="mt-2 text-sm text-[#5f5247]">Target ADR: <strong>{money.format(targetAdr)}</strong> · Recent room trend: <strong>{item.baseline.recentTrendPercent >= 0 ? "+" : ""}{item.baseline.recentTrendPercent}%</strong></div>
              <div className="mt-3"><Label>Planning rationale</Label><Textarea rows={3} disabled={locked} value={draft.rationale || ""} onChange={(event) => update(item.segment, "rationale", event.target.value)} /></div>
              {item.actual && <div className="mt-3 rounded-md border border-[#b7ccb9] bg-[#e7f0e9] p-3 text-sm"><strong>Actual production loaded:</strong> {Math.round(item.actual.roomNights)} rooms ({item.actual.roomNightsAttainmentPercent}% of target) · {money.format(item.actual.revenue)} ({item.actual.revenueAttainmentPercent}% of target)</div>}
              <div className="mt-3"><div className="text-sm font-semibold">Likely historical contributors</div><div className="mt-1 flex flex-wrap gap-1">{item.namedProspects.map((prospect: any) => <Badge key={prospect.key} variant="outline" className="border-[#cdbda8] text-[#3f3329]">{prospect.name}</Badge>)}{!item.namedProspects.length && <span className="text-sm text-[#6e5d50]">No same-month named account history is currently available.</span>}</div></div>
            </div>;
          })}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" className="border-[#8d765a] bg-white text-[#201814]" disabled={locked || save.isPending || drafts.length !== 2} onClick={() => save.mutate("draft")}><Save className="mr-2 h-4 w-4" />Save Draft</Button>
          <Button className="!bg-[#2f5f46] !text-white" disabled={locked || save.isPending || drafts.length !== 2} onClick={() => { if (confirm(`Lock the ${targets.data.periodLabel} Group and Special Corp sales targets?`)) save.mutate("locked"); }}><Lock className="mr-2 h-4 w-4" />Approve & Lock Plan</Button>
        </div>
      </>}
    </CardContent>
  </Card>;
}

function FutureDemandPipeline({ hotelId }: { hotelId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const initial = useMemo(() => { const date = new Date(); date.setMonth(date.getMonth() + 1); return { year: date.getFullYear(), month: date.getMonth() + 1 }; }, []);
  const [year, setYear] = useState(String(initial.year));
  const [month, setMonth] = useState(String(initial.month));
  const [showAdd, setShowAdd] = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [city, setCity] = useState("");
  const [industry, setIndustry] = useState("");
  const [distance, setDistance] = useState("");
  const [signals, setSignals] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventVenue, setEventVenue] = useState("");
  const [eventAction, setEventAction] = useState("");
  const demand = useQuery({
    queryKey: ["sales-demand", hotelId, year, month],
    queryFn: () => request(`/api/courtyard/sales-intelligence/advisor/demand?hotelId=${encodeURIComponent(hotelId)}&targetYear=${year}&targetMonth=${month}`),
    enabled: !!hotelId,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["sales-demand", hotelId, year, month] });
  const research = useMutation({
    mutationFn: () => request("/api/courtyard/sales-intelligence/advisor/demand/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hotelId, targetYear: Number(year), targetMonth: Number(month) }) }),
    onSuccess: (result) => { refresh(); toast({ title: "Demand research complete", description: `${result.added} newly verified events added.` }); },
    onError: (error: Error) => toast({ title: "Demand research needs attention", description: error.message, variant: "destructive" }),
  });
  const discover = useMutation({
    mutationFn: () => request("/api/courtyard/sales-intelligence/advisor/demand/discover-businesses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hotelId }) }),
    onSuccess: (result) => {
      refresh();
      const returned = Number(result?.diagnostics?.placesReturned || 0);
      const saved = Number(result?.saved || 0);
      toast(saved > 0
        ? { title: "Regional discovery complete", description: `${saved} businesses scored and saved from ${returned} Google Places results.` }
        : { title: "No regional businesses found", description: `Google returned ${returned} place records, but none qualified within the 75-mile program.`, variant: "destructive" });
    },
    onError: (error: Error) => toast({ title: "Business discovery needs attention", description: error.message, variant: "destructive" }),
  });
  const addProspect = useMutation({
    mutationFn: () => request("/api/courtyard/sales-intelligence/advisor/demand/prospects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hotelId, companyName, city, industry, distanceMiles: Number(distance), opportunitySignals: signals.split("\n").map((item) => item.trim()).filter(Boolean) }) }),
    onSuccess: () => { refresh(); setShowAdd(false); setCompanyName(""); setCity(""); setIndustry(""); setDistance(""); setSignals(""); toast({ title: "Known prospect added" }); },
    onError: (error: Error) => toast({ title: "Could not add prospect", description: error.message, variant: "destructive" }),
  });
  const addEvent = useMutation({
    mutationFn: () => request("/api/courtyard/sales-intelligence/advisor/demand/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hotelId, eventName, startDate: eventDate, venue: eventVenue, category: "Other", demandLevel: "medium", recommendedAction: eventAction, targetRoles: ["Event or Program Coordinator", "Group Housing Coordinator"], opportunityTypes: ["Group", "Special Corp"], bookingWindowDays: 90 }) }),
    onSuccess: () => { refresh(); setShowEvent(false); setEventName(""); setEventDate(""); setEventVenue(""); setEventAction(""); toast({ title: "Known demand event added" }); },
    onError: (error: Error) => toast({ title: "Could not add event", description: error.message, variant: "destructive" }),
  });
  const addCrm = useMutation({
    mutationFn: (prospect: any) => request("/api/courtyard/sales-intelligence/opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hotelId, normalizedAccountKey: prospect.historicalAccountKey || `regional:${prospect.id}`, accountName: prospect.companyName, marketSegment: prospect.industry, stage: "prospect", estimatedRoomNights: 0, estimatedRevenue: 0, nextAction: "Qualify travel, training, meeting, or project lodging need", notes: `${prospect.rationale || "Added from regional prospecting pipeline"} Evidence: ${String(prospect.evidenceClass).replace(/_/g, " ")}.` }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-crm", hotelId] }); toast({ title: "Lead added to Backup CRM" }); },
    onError: (error: Error) => toast({ title: "Could not add lead", description: error.message, variant: "destructive" }),
  });
  const years = [initial.year, initial.year + 1, initial.year + 2];
  return <Card className="!border-[#cdbda8] !bg-[#fffaf2] !text-[#201814]">
    <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-[#2f5f46]" />Future Demand & Regional Lead Pipeline</CardTitle><CardDescription className="!text-[#5f5247]">Connect upcoming demand generators with proven hotel accounts and qualified business prospects within 75 miles. Construction crew leads are limited to 15 miles; traveling youth sports receive a dedicated tournament search.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Select value={year} onValueChange={setYear}><SelectTrigger className="w-28 bg-white"><SelectValue /></SelectTrigger><SelectContent>{years.map((item) => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}</SelectContent></Select>
        <Select value={month} onValueChange={setMonth}><SelectTrigger className="w-44 bg-white"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((item) => <SelectItem key={item} value={String(item)}>{new Date(2020, item - 1, 1).toLocaleDateString("en-US", { month: "long" })}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" className="border-[#8d765a] bg-white text-[#201814]" disabled={research.isPending || !demand.data?.configuration?.webResearch} onClick={() => research.mutate()}><Search className="mr-2 h-4 w-4" />{research.isPending ? "Researching…" : "Research Official Events"}</Button>
        <Button variant="outline" className="border-[#8d765a] bg-white text-[#201814]" disabled={discover.isPending || !demand.data?.configuration?.places} onClick={() => discover.mutate()}><MapPin className="mr-2 h-4 w-4" />{discover.isPending ? "Discovering…" : "Discover Regional Businesses"}</Button>
        <Button className="!bg-[#2f5f46] !text-white" onClick={() => setShowAdd(!showAdd)}><Plus className="mr-2 h-4 w-4" />Add Known Prospect</Button>
        <Button variant="outline" className="border-[#8d765a] bg-white text-[#201814]" onClick={() => setShowEvent(!showEvent)}><Plus className="mr-2 h-4 w-4" />Add Known Event</Button>
      </div>
      {demand.data && (!demand.data.configuration.webResearch || !demand.data.configuration.places) && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Core planning and hotel-history leads are active. {!demand.data.configuration.webResearch ? "OpenAI is required for official event research. " : ""}{!demand.data.configuration.places ? "GOOGLE_PLACES_API_KEY is required for regional business discovery." : ""}</div>}
      {showAdd && <div className="grid gap-3 rounded-md border border-[#cdbda8] bg-white p-4 sm:grid-cols-2"><div><Label>Company</Label><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="McCoy’s Building Supply" /></div><div><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="San Marcos" /></div><div><Label>Industry</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Building supply / training" /></div><div><Label>Approx. miles from hotel</Label><Input type="number" min="0" max="75" value={distance} onChange={(e) => setDistance(e.target.value)} /></div><div className="sm:col-span-2"><Label>Known opportunity signals</Label><Textarea rows={3} value={signals} onChange={(e) => setSignals(e.target.value)} placeholder={"Regional training program\nRecurring multi-night classes\nOperations based in Central Texas"} /></div><div><Button className="!bg-[#2f5f46] !text-white" disabled={!companyName.trim() || addProspect.isPending} onClick={() => addProspect.mutate()}>Save Prospect</Button></div></div>}
      {showEvent && <div className="grid gap-3 rounded-md border border-[#cdbda8] bg-white p-4 sm:grid-cols-2"><div><Label>Event or demand generator</Label><Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Regional training week" /></div><div><Label>Start date</Label><Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></div><div><Label>Venue</Label><Input value={eventVenue} onChange={(e) => setEventVenue(e.target.value)} placeholder="H-E-B Center" /></div><div><Label>Recommended sales action</Label><Input value={eventAction} onChange={(e) => setEventAction(e.target.value)} placeholder="Contact organizer and participating teams" /></div><div><Button className="!bg-[#2f5f46] !text-white" disabled={!eventName.trim() || !eventDate || addEvent.isPending} onClick={() => addEvent.mutate()}>Save Event</Button></div></div>}
      <div><div className="mb-2 flex items-center justify-between"><h3 className="text-lg font-semibold">Upcoming Demand Generators</h3><Badge variant="outline">{demand.data?.events?.length || 0} verified/manual</Badge></div>
        <div className="grid gap-3 lg:grid-cols-2">{(demand.data?.events || []).map((event: any) => <div key={event.id} className="rounded-md border border-[#deceba] bg-white p-4"><div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{event.eventName}</div><div className="text-sm text-[#5f5247]">{new Date(`${event.startDate}T12:00:00`).toLocaleDateString()} · {event.venue || event.city || "Venue pending"}</div></div><Badge className={event.demandLevel === "high" ? "!bg-[#2f5f46] !text-white" : "!bg-[#eadfce] !text-[#4f4339]"}>{event.demandLevel} demand</Badge></div><p className="mt-2 text-sm">{event.recommendedAction}</p><div className="mt-2 text-xs text-[#6e5d50]">Target: {(event.targetRolesJson || []).join(" · ")}</div>{event.sourceUrl && <a className="mt-2 inline-flex items-center text-sm text-[#2f5f46] underline" href={event.sourceUrl} target="_blank" rel="noreferrer">{event.sourceName || "Official source"}<ExternalLink className="ml-1 h-3 w-3" /></a>}</div>)}{!demand.isLoading && !demand.data?.events?.length && <div className="rounded-md border border-dashed border-[#cdbda8] bg-white p-5 text-sm text-[#5f5247] lg:col-span-2">No demand events are stored for this month yet. Run official event research or add a known event above.</div>}</div>
      </div>
      <div><div className="mb-2 flex items-center justify-between"><h3 className="text-lg font-semibold">Prioritized Outreach Pipeline</h3><Badge variant="outline">{demand.data?.prospects?.length || 0} leads</Badge></div><div className="overflow-x-auto rounded-md border border-[#deceba] bg-white"><table className="w-full min-w-[900px] text-sm"><thead className="bg-[#f7f1e7]"><tr><th className="p-3 text-left">Priority / Company</th><th className="text-left">Evidence</th><th className="text-left">Distance</th><th className="text-left">Why pursue</th><th className="text-left">Target roles</th><th className="p-3"></th></tr></thead><tbody>{(demand.data?.prospects || []).slice(0, 50).map((prospect: any) => <tr key={prospect.id} className="border-t border-[#deceba]"><td className="p-3"><div className="font-semibold">{prospect.opportunityScore} · {prospect.companyName}</div><div className="text-xs text-[#6e5d50]">{prospect.industry || "Business"}{prospect.historicalRevenue ? ` · ${money.format(Number(prospect.historicalRevenue))} history` : ""}</div></td><td><Badge variant="outline" className="capitalize">{String(prospect.evidenceClass).replace(/_/g, " ")}</Badge></td><td>{prospect.distanceMiles == null ? prospect.distanceBand : `${Number(prospect.distanceMiles).toFixed(1)} mi · ${prospect.distanceBand}`}</td><td className="max-w-xs p-2 text-[#5f5247]">{prospect.rationale}</td><td className="max-w-xs p-2 text-xs">{(prospect.targetRolesJson || []).slice(0, 3).join(" · ")}</td><td className="p-3"><Button size="sm" variant="outline" disabled={addCrm.isPending} onClick={() => addCrm.mutate(prospect)}>Add to CRM</Button></td></tr>)}</tbody></table></div></div>
    </CardContent>
  </Card>;
}

export function CourtyardSalesAdvisor({ hotelId }: { hotelId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lookbackMonths, setLookbackMonths] = useState("24");
  const [analysisType, setAnalysisType] = useState("full_plan");
  const [businessTypes, setBusinessTypes] = useState(TYPES);
  const [analysis, setAnalysis] = useState<any>(null);
  const query = new URLSearchParams({
    hotelId,
    lookbackMonths,
    analysisType,
    businessTypes: businessTypes.join(","),
  });
  const preview = useQuery({
    queryKey: ["sales-advisor-preview", hotelId, lookbackMonths, analysisType, businessTypes.join("|")],
    queryFn: () => request(`/api/courtyard/sales-intelligence/advisor/preview?${query}`),
    enabled: !!hotelId && businessTypes.length > 0,
  });
  const recent = useQuery({
    queryKey: ["sales-advisor-analyses", hotelId],
    queryFn: () => request(`/api/courtyard/sales-intelligence/advisor/analyses?hotelId=${encodeURIComponent(hotelId)}`),
    enabled: !!hotelId,
  });
  const generate = useMutation({
    mutationFn: (regenerate: boolean) => request("/api/courtyard/sales-intelligence/advisor/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId, lookbackMonths: Number(lookbackMonths), analysisType, businessTypes, regenerate }),
    }),
    onSuccess: (value) => {
      setAnalysis(value);
      queryClient.invalidateQueries({ queryKey: ["sales-advisor-analyses", hotelId] });
      toast({ title: value.cached ? "Saved analysis reopened" : "Sales plan generated", description: value.cached ? "No additional AI call was needed." : "The onsite plan is ready to review or export." });
    },
    onError: (error: Error) => toast({ title: "Sales Advisor needs attention", description: error.message, variant: "destructive" }),
  });
  const activePreview = analysis?.inputSnapshotJson || preview.data;
  const narrative = analysis?.resultJson;
  const priorities = useMemo(() => new Map((narrative?.priorities || []).map((item: any) => [item.accountKey, item])), [narrative]);
  const planText = useMemo(() => {
    if (!analysis) return "";
    return [
      `Sales Advisor Plan - ${new Date(analysis.createdAt).toLocaleDateString()}`,
      narrative?.executiveSummary,
      ...(narrative?.weeklyPlan || []).map((item: any) => `${item.dayOrSequence}: ${item.actionPlanEntry || "Complete the planned outreach and record the outcome onsite."}`),
    ].filter(Boolean).join("\n\n");
  }, [analysis, narrative]);
  const addToCrm = useMutation({
    mutationFn: (candidate: any) => request("/api/courtyard/sales-intelligence/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotelId,
        normalizedAccountKey: candidate.key,
        accountName: candidate.name,
        marketSegment: candidate.businessType,
        stage: "prospect",
        estimatedRoomNights: candidate.totalRoomNights,
        estimatedRevenue: candidate.estimatedRecoveryRevenue,
        nextAction: "Review Sales Advisor history and identify the best contact",
        notes: `Added from Sales Advisor. ${candidate.status}; ${candidate.confidence} confidence; ${candidate.productionBasis} production basis.`,
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-crm", hotelId] });
      toast({ title: "Prospect added to Backup CRM" });
    },
    onError: (error: Error) => toast({ title: "Could not add prospect", description: error.message, variant: "destructive" }),
  });
  const toggleType = (type: string) => setBusinessTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);

  return (
    <div className="space-y-4">
      <MonthlySalesTargets hotelId={hotelId} />
      <FutureDemandPipeline hotelId={hotelId} />
      <Card className="!border-[#cdbda8] !bg-[#fffaf2] !text-[#201814]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[#2f5f46]" />Sales Advisor</CardTitle>
          <CardDescription className="!text-[#5f5247]">Prioritize named past business and build a practical weekly prospecting plan. Production figures come from imported reports; AI only interprets the evidence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Select value={lookbackMonths} onValueChange={setLookbackMonths}>
              <SelectTrigger className="bg-white text-[#201814]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="12">Last 12 months</SelectItem><SelectItem value="24">Last 24 months</SelectItem><SelectItem value="36">Last 36 months</SelectItem></SelectContent>
            </Select>
            <Select value={analysisType} onValueChange={setAnalysisType}>
              <SelectTrigger className="bg-white text-[#201814]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="full_plan">Full Sales Plan</SelectItem><SelectItem value="recovery">Recovery Opportunities</SelectItem><SelectItem value="declining">Declining Accounts</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-4 rounded-md border border-[#deceba] bg-white p-3">
            {TYPES.map((type) => <Label key={type} className="flex items-center gap-2 text-sm text-[#201814]"><Checkbox checked={businessTypes.includes(type)} onCheckedChange={() => toggleType(type)} />{type}</Label>)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[#5f5247]">{preview.isLoading ? "Reviewing imported history…" : `${activePreview?.summary?.prospectsReviewed || 0} named prospects matched · ${money.format(activePreview?.summary?.estimatedRecoveryRevenue || 0)} estimated recovery potential`}</div>
            <Button className="!bg-[#2f5f46] !text-white hover:!bg-[#274f3b]" disabled={generate.isPending || !businessTypes.length || !activePreview?.candidates?.length} onClick={() => generate.mutate(false)}>
              {generate.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{generate.isPending ? "Building plan…" : "Generate Sales Plan"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview.error && <Card className="border-red-300 bg-red-50"><CardContent className="p-4 text-red-900">{(preview.error as Error).message}</CardContent></Card>}
      {!preview.isLoading && !activePreview?.candidates?.length && <Card className="!border-[#cdbda8] !bg-[#fffaf2]"><CardContent className="p-6 text-[#5f5247]">No named prospects match this view. Broaden the filters or import the relevant Group Summary, Reservations by Company, or historical MINT account report.</CardContent></Card>}

      {narrative && <Card className="!border-[#2f5f46] !bg-[#e7f0e9] !text-[#173b2a]">
        <CardHeader><CardTitle>Executive Summary</CardTitle><CardDescription className="!text-[#405f4b]">{narrative.executiveSummary}</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" className="border-[#2f5f46] bg-white text-[#173b2a]" onClick={async () => { await navigator.clipboard.writeText(planText); toast({ title: "Onsite action plan copied" }); }}><Copy className="mr-2 h-4 w-4" />Copy Action Plan</Button>
          <Button asChild variant="outline" className="border-[#2f5f46] bg-white text-[#173b2a]"><a href={apiUrl(`/api/courtyard/sales-intelligence/advisor/analyses/${analysis.id}.pdf?hotelId=${encodeURIComponent(hotelId)}`)}><Download className="mr-2 h-4 w-4" />Download PDF</a></Button>
        </CardContent>
      </Card>}

      {!!activePreview?.candidates?.length && <Card className="!border-[#cdbda8] !bg-[#fffaf2] !text-[#201814]">
        <CardHeader><CardTitle>Priority Prospects</CardTitle><CardDescription className="!text-[#5f5247]">Scores combine historical value, recoverability, timing, and current status. Missing months do not count as zero.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {activePreview.candidates.slice(0, 12).map((candidate: any, index: number) => {
            const item: any = priorities.get(candidate.key);
            return <div key={`${candidate.businessType}:${candidate.key}`} className="rounded-md border border-[#deceba] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-semibold">{index + 1}. {candidate.name}</div><div className="text-sm text-[#5f5247]">{candidate.businessType} · {candidate.status}</div></div><div className="flex gap-2"><Badge className="!bg-[#2f5f46] !text-white">Score {candidate.scores.overall}</Badge><Badge variant="outline" className="border-[#8d765a] text-[#3f3329]">{candidate.confidence} confidence</Badge></div></div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4"><span><strong>{candidate.totalRoomNights}</strong> room nights</span><span><strong>{money.format(candidate.totalRevenue)}</strong> revenue</span><span><strong>{money.format(candidate.estimatedRecoveryRevenue)}</strong> potential</span><span><strong className="capitalize">{candidate.productionBasis}</strong> basis</span></div>
              <p className="mt-3 text-sm text-[#4f4339]">{item?.rationale || `${candidate.possibleDemandDriver}. Generate the plan for a tailored outreach recommendation.`}</p>
              {item?.planningNote && <div className="mt-2 rounded bg-[#f7f1e7] p-2 text-sm"><strong>Planning note:</strong> {item.planningNote}</div>}
              <Button size="sm" variant="outline" className="mt-3 border-[#8d765a] bg-white text-[#201814]" disabled={addToCrm.isPending} onClick={() => addToCrm.mutate(candidate)}>Add to Backup CRM</Button>
            </div>;
          })}
        </CardContent>
      </Card>}

      {narrative?.weeklyPlan?.length > 0 && <Card className="!border-[#cdbda8] !bg-[#fffaf2] !text-[#201814]"><CardHeader><CardTitle>This Week’s Onsite Action Plan</CardTitle></CardHeader><CardContent className="space-y-3">{narrative.weeklyPlan.map((item: any, index: number) => <div key={index} className="rounded-md border border-[#deceba] bg-white p-3"><strong>{item.dayOrSequence}: {item.focus}</strong><p className="mt-1 text-sm text-[#5f5247]">{item.actionPlanEntry || "Complete the planned outreach and record the outcome onsite."}</p></div>)}</CardContent></Card>}

      {!!activePreview?.limitations?.length && <Card className="border-amber-300 bg-amber-50 text-amber-950"><CardHeader><CardTitle className="text-base">Data Limitations</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-1 pl-5 text-sm">{[...activePreview.limitations, ...(narrative?.additionalLimitations || [])].map((item: string, index: number) => <li key={index}>{item}</li>)}</ul></CardContent></Card>}

      {!!recent.data?.length && <Card className="!border-[#cdbda8] !bg-[#fffaf2] !text-[#201814]"><CardHeader><CardTitle className="text-lg">Recent Plans</CardTitle><CardDescription className="!text-[#5f5247]">Reopen a saved analysis without another AI call.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{recent.data.map((item: any) => <Button key={item.id} variant="outline" className="border-[#8d765a] bg-white text-[#201814]" onClick={() => setAnalysis(item)}>{new Date(item.createdAt).toLocaleDateString()} · {item.analysisType.replace("_", " ")}</Button>)}</CardContent></Card>}
    </div>
  );
}
