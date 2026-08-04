import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { validatePublicValidationReport, type FlightServiceValidationReportImport } from "@shared/config/flightServiceValidationReports";

type PublishedReport = { report: FlightServiceValidationReportImport; isCurrent: boolean; publishedAt: string };

function text(value: unknown) {
  if (typeof value === "string") return value;
  if (value == null) return "—";
  return JSON.stringify(value);
}

function evidenceValue(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) if (item[key] != null) return item[key];
  return null;
}

export function ValidationReportImportControl() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<any>(null);
  const [report, setReport] = useState<FlightServiceValidationReportImport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user?.isAdmin && !user?.isSuperAdmin) return null;

  async function selectFile(file?: File) {
    setError(""); setPreview(null); setReport(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json") || (file.type && file.type !== "application/json")) return setError("Select a .json report file.");
    if (file.size > 2 * 1024 * 1024) return setError("Validation report exceeds the 2 MB limit.");
    try {
      const candidate = JSON.parse(await file.text());
      const local = validatePublicValidationReport(candidate);
      if (!local.ok) return setError(local.error);
      setBusy(true);
      const response = await apiRequest("POST", "/api/admin/flight-service-validation/reports/preview", local.report);
      const data = await response.json();
      setPreview(data.preview); setReport(data.report);
    } catch (cause) { setError(cause instanceof SyntaxError ? "The selected file is not valid JSON." : cause instanceof Error ? cause.message : "Unable to validate report."); }
    finally { setBusy(false); }
  }

  async function publish(replace = false) {
    if (!report) return;
    setBusy(true); setError("");
    try {
      const response = await apiRequest("POST", "/api/admin/flight-service-validation/reports/publish", { report, replace });
      await response.json();
      setPreview(null); setReport(null); if (inputRef.current) inputRef.current.value = "";
      await queryClient.invalidateQueries({ queryKey: ["/api/public/flight-service-validation/reports"] });
    } catch (cause: any) {
      if (cause?.status === 409 && window.confirm("This report ID already exists. Replace the published report?")) return publish(true);
      setError(cause instanceof Error ? cause.message : "Unable to publish report.");
    } finally { setBusy(false); }
  }

  return <Card className="border-sky-400/30 bg-[#102033] text-[#E8EDF4]">
    <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Admin Report Import</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <input ref={inputRef} type="file" accept="application/json,.json" className="block w-full text-sm" onChange={(event) => void selectFile(event.target.files?.[0])} disabled={busy} />
      {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
      {preview ? <div className="rounded-xl border border-sky-300/20 bg-black/15 p-4">
        <h3 className="font-semibold">Preview before publishing</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries({ Title: preview.title, Environment: preview.environment, "Validation date": preview.validationDate, "Overall status": preview.overallStatus, "Validation results": preview.validationResultCount, Evidence: preview.evidenceItemCount, "Open items": preview.openItemCount }).map(([label, value]) => <div key={label}><dt className="text-[#8EA3BC]">{label}</dt><dd>{text(value)}</dd></div>)}
        </dl>
        <div className="mt-4 flex gap-3"><Button onClick={() => void publish()} disabled={busy}>Publish Report</Button><Button variant="secondary" onClick={() => { setPreview(null); setReport(null); }} disabled={busy}>Cancel</Button></div>
      </div> : null}
    </CardContent>
  </Card>;
}

export function ImportedValidationReportPage({ reportId }: { reportId?: string }) {
  const listQuery = useQuery<{ reports: Array<{ reportId: string; reportJson: FlightServiceValidationReportImport; isCurrent: boolean; publishedAt: string }> }>({ queryKey: ["/api/public/flight-service-validation/reports"], queryFn: getQueryFn({ on401: "throw" }) });
  const selected = reportId ? listQuery.data?.reports.find((item) => item.reportId === reportId) : listQuery.data?.reports.find((item) => item.isCurrent);
  if (!selected) return null;
  const report = selected.reportJson;
  const metadata = report.metadata as Record<string, unknown>;
  return <PageShell kicker={selected.isCurrent ? "Current Published Report" : "Published Validation Report"} title={report.title} description={report.subtitle} className="bg-[#090e15] text-[#E8EDF4]" contentClassName="max-w-7xl space-y-12">
    <ValidationReportImportControl />
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(metadata).map(([label, value]) => <div key={label} className="rounded-xl border border-[#5d6f85]/25 bg-[#111923] p-4"><dt className="text-xs uppercase tracking-wide text-[#8EA3BC]">{label}</dt><dd className="mt-2 font-semibold">{text(value)}</dd></div>)}</dl>
    <ReportSection title="Executive Summary"><ReportValue value={report.executiveSummary} /></ReportSection>
    <ReportSection title="Test Scenario"><ReportValue value={report.testScenario} /></ReportSection>
    <ReportSection title="Lifecycle Timeline"><div className="flex flex-wrap gap-2">{report.lifecycleTimeline.map((step, index) => <Badge key={index} variant="outline" className="border-sky-400/35 text-sky-200">{text(step)}</Badge>)}</div></ReportSection>
    <ReportSection title="Validation Results"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><tbody>{report.validationResults.map((result, index) => <tr key={index} className="border-b border-[#5d6f85]/20"><td className="py-3 font-semibold">{text(evidenceValue(result, "title", "test", "name"))}</td><td className="py-3">{text(evidenceValue(result, "result", "status", "summary"))}</td></tr>)}</tbody></table></div></ReportSection>
    <ReportSection title="Validation Evidence"><Accordion type="single" collapsible className="space-y-3">{report.evidence.map((item, index) => { const raw = evidenceValue(item, "json", "providerResponse", "log", "evidence") ?? item; const isLog = typeof raw === "string"; return <AccordionItem key={index} value={`evidence-${index}`} className="rounded-xl border border-[#5d6f85]/25 px-4"><div className="py-4"><h3 className="font-semibold">{text(evidenceValue(item, "title", "name"))}</h3><p className="mt-2 text-sm text-[#B8C7D8]">{text(evidenceValue(item, "summary", "result"))}</p><div className="mt-2 flex gap-2 text-xs text-[#9FB5C9]"><span>{text(evidenceValue(item, "evidenceType", "type"))}</span><span>{text(evidenceValue(item, "httpStatus", "status"))}</span></div></div><AccordionTrigger>{isLog ? "Expand Log Evidence" : "Expand Raw Provider Response"}</AccordionTrigger><AccordionContent><pre className="overflow-x-auto rounded-lg bg-[#090E15] p-4 text-xs text-[#AFC4DC]">{isLog ? raw : JSON.stringify(raw, null, 2)}</pre></AccordionContent></AccordionItem>; })}</Accordion></ReportSection>
    <ReportSection title="Engineering Observations"><ReportValue value={report.engineeringObservations} /></ReportSection>
    <ReportSection title="Open Items"><ReportValue value={report.openItems} /></ReportSection>
    <ReportSection title="Validation Conclusion"><ReportValue value={report.conclusion} /></ReportSection>
    <Button asChild variant="secondary"><a href={apiUrl(`/api/public/flight-service-validation/reports/${encodeURIComponent(report.reportId)}/download`)}><Download className="mr-2 h-4 w-4" />Download Sanitized JSON</a></Button>
  </PageShell>;
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="space-y-4"><h2 className="text-2xl font-bold">{title}</h2><Card className="border-[#5d6f85]/25 bg-[#111923] text-[#E8EDF4]"><CardContent className="p-6">{children}</CardContent></Card></section>; }
function ReportValue({ value }: { value: unknown }) { return Array.isArray(value) ? <div className="space-y-3">{value.map((item, index) => <p key={index} className="leading-7 text-[#BFCBDC]">{text(item)}</p>)}</div> : <p className="whitespace-pre-wrap leading-7 text-[#BFCBDC]">{text(value)}</p>; }
