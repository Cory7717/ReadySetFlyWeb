import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";

const TYPES = ["Groups", "Special Corp", "Government", "Corporate Accounts"];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
async function request(url: string, init?: RequestInit) {
  const response = await fetch(apiUrl(url), { credentials: "include", ...init });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || "Request failed");
  return body;
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
    mutationFn: (regenerate = false) => request("/api/courtyard/sales-intelligence/advisor/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId, lookbackMonths: Number(lookbackMonths), analysisType, businessTypes, regenerate }),
    }),
    onSuccess: (value) => {
      setAnalysis(value);
      queryClient.invalidateQueries({ queryKey: ["sales-advisor-analyses", hotelId] });
      toast({ title: value.cached ? "Saved analysis reopened" : "Sales plan generated", description: value.cached ? "No additional AI call was needed." : "The plan is ready to copy into IVY or export." });
    },
    onError: (error: Error) => toast({ title: "Sales Advisor needs attention", description: error.message, variant: "destructive" }),
  });
  const activePreview = analysis?.inputSnapshotJson || preview.data;
  const narrative = analysis?.resultJson;
  const priorities = useMemo(() => new Map((narrative?.priorities || []).map((item: any) => [item.accountKey, item])), [narrative]);
  const ivyText = useMemo(() => {
    if (!analysis) return "";
    return [
      `Sales Advisor Plan - ${new Date(analysis.createdAt).toLocaleDateString()}`,
      narrative?.executiveSummary,
      ...(narrative?.weeklyPlan || []).map((item: any) => `${item.dayOrSequence}: ${item.ivyEntry}`),
    ].filter(Boolean).join("\n\n");
  }, [analysis, narrative]);
  const toggleType = (type: string) => setBusinessTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);

  return (
    <div className="space-y-4">
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
          <Button variant="outline" className="border-[#2f5f46] bg-white text-[#173b2a]" onClick={async () => { await navigator.clipboard.writeText(ivyText); toast({ title: "IVY-ready plan copied" }); }}><Copy className="mr-2 h-4 w-4" />Copy for IVY</Button>
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
              {item?.ivyActivity && <div className="mt-2 rounded bg-[#f7f1e7] p-2 text-sm"><strong>IVY entry:</strong> {item.ivyActivity}</div>}
            </div>;
          })}
        </CardContent>
      </Card>}

      {narrative?.weeklyPlan?.length > 0 && <Card className="!border-[#cdbda8] !bg-[#fffaf2] !text-[#201814]"><CardHeader><CardTitle>This Week’s IVY Plan</CardTitle></CardHeader><CardContent className="space-y-3">{narrative.weeklyPlan.map((item: any, index: number) => <div key={index} className="rounded-md border border-[#deceba] bg-white p-3"><strong>{item.dayOrSequence}: {item.focus}</strong><p className="mt-1 text-sm text-[#5f5247]">{item.ivyEntry}</p></div>)}</CardContent></Card>}

      {!!activePreview?.limitations?.length && <Card className="border-amber-300 bg-amber-50 text-amber-950"><CardHeader><CardTitle className="text-base">Data Limitations</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-1 pl-5 text-sm">{[...activePreview.limitations, ...(narrative?.additionalLimitations || [])].map((item: string, index: number) => <li key={index}>{item}</li>)}</ul></CardContent></Card>}

      {!!recent.data?.length && <Card className="!border-[#cdbda8] !bg-[#fffaf2] !text-[#201814]"><CardHeader><CardTitle className="text-lg">Recent Plans</CardTitle><CardDescription className="!text-[#5f5247]">Reopen a saved analysis without another AI call.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{recent.data.map((item: any) => <Button key={item.id} variant="outline" className="border-[#8d765a] bg-white text-[#201814]" onClick={() => setAnalysis(item)}>{new Date(item.createdAt).toLocaleDateString()} · {item.analysisType.replace("_", " ")}</Button>)}</CardContent></Card>}
    </div>
  );
}
