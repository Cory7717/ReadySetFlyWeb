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
import { removeRestrictedProviderBranding, validatePublicValidationReport, type FlightServiceValidationReportImport } from "@shared/config/flightServiceValidationReports";

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

function label(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function isRedacted(value: unknown) {
  return typeof value === "string" && /^(?:\[REDACTED\]|\[REMOVED\]|PII restricted)$/i.test(value.trim());
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
  const report = removeRestrictedProviderBranding(selected.reportJson);
  const metadata = report.metadata as Record<string, unknown>;
  return <PageShell kicker={selected.isCurrent ? "Current Published Report" : "Published Validation Report"} title={report.title} description={report.subtitle} className="bg-[#090e15] text-[#E8EDF4]" contentClassName="max-w-7xl space-y-12">
    <ValidationReportImportControl />
    <Card className="border-emerald-400/30 bg-[linear-gradient(135deg,rgba(12,43,38,.96),rgba(15,30,43,.98))] text-[#E8EDF4]"><CardContent className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center"><div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Validation Outcome</div><div className="mt-2 text-3xl font-bold text-white">{text(metadata.overallStatus)}</div><div className="mt-2 text-sm text-[#B8C7D8]">{text(metadata.environment)} · {text(metadata.validationDate)} · Report {text(metadata.reportVersion)}</div></div><Badge variant="outline" className="border-emerald-400/45 bg-emerald-500/10 px-4 py-2 text-emerald-200">Sanitized Public Evidence</Badge></CardContent></Card>
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(metadata).filter(([key]) => !["overallStatus", "environment", "validationDate", "reportVersion"].includes(key)).map(([key, value]) => <div key={key} className="rounded-xl border border-[#5d6f85]/25 bg-[#111923] p-4"><dt className="text-xs uppercase tracking-wide text-[#8EA3BC]">{label(key)}</dt><dd className="mt-2 font-semibold">{text(value)}</dd></div>)}</dl>
    <ReportSection title="Executive Summary"><ReportValue value={report.executiveSummary} /></ReportSection>
    <ReportSection title="Test Scenario"><ScenarioGrid value={report.testScenario} /></ReportSection>
    <ReportSection title="Lifecycle Timeline"><LifecycleTimeline value={report.lifecycleTimeline} /></ReportSection>
    <ReportSection title="Test Cases"><TestCaseWorkspace testCases={report.testCases ?? []} results={report.validationResults ?? []} evidence={report.evidence ?? []} /></ReportSection>
    <ReportSection title="Engineering Observations"><ObservationList value={report.engineeringObservations} /></ReportSection>
    <ReportSection title="Open Items"><OpenItemCards value={report.openItems} /></ReportSection>
    <ReportSection title="Validation Conclusion"><Conclusion value={report.conclusion} /></ReportSection>
    <Button asChild variant="secondary"><a href={apiUrl(`/api/public/flight-service-validation/reports/${encodeURIComponent(report.reportId)}/download`)}><Download className="mr-2 h-4 w-4" />Download Sanitized JSON</a></Button>
  </PageShell>;
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="space-y-4"><h2 className="text-2xl font-bold">{title}</h2><Card className="border-[#5d6f85]/25 bg-[#111923] text-[#E8EDF4]"><CardContent className="p-6">{children}</CardContent></Card></section>; }
function ReportValue({ value }: { value: unknown }) { return Array.isArray(value) ? <div className="space-y-3">{value.map((item, index) => <p key={index} className="leading-7 text-[#BFCBDC]">{text(item)}</p>)}</div> : <p className="whitespace-pre-wrap leading-7 text-[#BFCBDC]">{text(value)}</p>; }

function ScenarioGrid({ value }: { value: unknown }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return <ReportValue value={value} />;
  return <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(value as Record<string, unknown>).map(([key, item]) => <div key={key} className="rounded-lg border border-[#5d6f85]/20 bg-[#0C151F] p-3"><dt className="text-xs font-semibold text-[#8EA3BC]">{label(key)}</dt><dd className={isRedacted(item) ? "mt-1 text-sm italic text-[#91A2B5]" : "mt-1 text-sm font-semibold text-[#EEF4FB]"}>{isRedacted(item) ? "Redacted" : text(item)}</dd></div>)}</dl>;
}

function LifecycleTimeline({ value }: { value: Array<string | Record<string, unknown>> }) {
  return <ol className="grid gap-3 md:grid-cols-5">{value.map((item, index) => { const step = typeof item === "string" ? { stage: item } : item; return <li key={index} className="relative rounded-xl border border-sky-400/25 bg-[#102033] p-4"><div className="text-xs text-[#87B9FF]">STEP {text(step.sequence ?? index + 1)}</div><div className="mt-2 font-bold">{text(step.stage)}</div><div className="mt-3 text-sm text-[#B8C7D8]">Provider state: <strong className="text-white">{text(step.providerState)}</strong></div><Badge variant="outline" className="mt-3 border-emerald-400/40 text-emerald-200">{text(step.status ?? "PASS")}</Badge></li>; })}</ol>;
}

function TestCaseWorkspace({ testCases, results, evidence }: { testCases: Array<Record<string, unknown>>; results: Array<Record<string, unknown>>; evidence: Array<Record<string, unknown>> }) {
  const cases: Array<Record<string, unknown>> = testCases.length > 0 ? testCases : results.map((result): Record<string, unknown> => ({
    ...result,
    testCaseId: result.testCaseId ?? result.id,
    title: result.title ?? result.name ?? result.test,
    purpose: result.purpose ?? result.objective,
    evidenceRefs: result.evidenceRefs ?? (result.evidenceRef ? [result.evidenceRef] : []),
  }));
  const [selectedId, setSelectedId] = useState(() => text(evidenceValue(cases[0] ?? {}, "testCaseId", "id")));
  const selected = cases.find((item) => text(evidenceValue(item, "testCaseId", "id")) === selectedId) ?? cases[0];
  if (!selected) return <p className="text-sm text-[#B8C7D8]">No test cases have been published in this report.</p>;
  const refs = Array.isArray(selected.evidenceRefs) ? selected.evidenceRefs.map(String) : selected.evidenceRef ? [String(selected.evidenceRef)] : [];
  const linkedEvidence = evidence.filter((item) => refs.includes(String(item.id)));
  const caseTimeline = Array.isArray(selected.lifecycleTimeline) ? selected.lifecycleTimeline as Array<string | Record<string, unknown>> : [];
  const category = evidenceValue(selected, "category", "testCategory");
  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#5d6f85]/25 bg-[#0C151F] p-4 md:flex-row md:items-end">
      <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#87B9FF]">Test Case Workspace</div><p className="mt-2 text-sm text-[#AEBCCD]">Select one case to review its expected results, actual results, lifecycle, and linked evidence.</p></div>
      <label className="block min-w-0 md:w-[360px]"><span className="mb-2 block text-xs font-semibold text-[#B8C7D8]">Selected test case</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="h-11 w-full rounded-md border border-[#5d6f85]/45 bg-[#111923] px-3 text-sm text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/25">{cases.map((item, index) => { const id = text(evidenceValue(item, "testCaseId", "id") ?? index); return <option key={id} value={id}>{text(evidenceValue(item, "title", "name", "test"))}</option>; })}</select></label>
    </div>
    <article className="rounded-xl border border-[#5d6f85]/25 bg-[#0C151F] p-5">
      <div className="flex flex-wrap justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2">{category ? <Badge variant="outline" className="border-sky-400/35 text-sky-200">{text(category)}</Badge> : null}<span className="text-xs text-[#8EA3BC]">Case {cases.findIndex((item) => item === selected) + 1} of {cases.length}</span></div><h3 className="mt-3 text-xl font-semibold text-white">{text(evidenceValue(selected, "title", "name", "test"))}</h3><p className="mt-2 max-w-4xl text-sm leading-6 text-[#B8C7D8]">{text(evidenceValue(selected, "purpose", "objective", "summary"))}</p></div><Badge variant="outline" className="h-fit border-emerald-400/40 text-emerald-200">{text(evidenceValue(selected, "status", "result"))}</Badge></div>
      {selected.scenario != null ? <div className="mt-5"><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8EA3BC]">Scenario</div><ScenarioGrid value={selected.scenario} /></div> : null}
      <div className="mt-5 grid gap-3 md:grid-cols-2"><Comparison title="Expected" value={selected.expected} /><Comparison title="Actual" value={selected.actual} /></div>
      {caseTimeline.length > 0 ? <div className="mt-5"><div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8EA3BC]">Case Lifecycle</div><LifecycleTimeline value={caseTimeline} /></div> : null}
      <div className="mt-5"><div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8EA3BC]">Linked Evidence</div>{linkedEvidence.length > 0 ? <EvidencePanels evidence={linkedEvidence} results={[selected]} /> : <p className="rounded-lg border border-dashed border-[#5d6f85]/30 p-4 text-sm text-[#8FA3BA]">No evidence is linked to this test case.</p>}</div>
    </article>
  </div>;
}

function Comparison({ title, value }: { title: string; value: unknown }) { return <div className="rounded-lg border border-[#5d6f85]/20 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-[#8EA3BC]">{title}</div>{value && typeof value === "object" && !Array.isArray(value) ? <dl className="mt-3 space-y-2">{Object.entries(value as Record<string, unknown>).map(([key, item]) => <div key={key} className="flex justify-between gap-3 text-sm"><dt className="text-[#AEBCCD]">{label(key)}</dt><dd className="text-right font-semibold text-[#EAF2FC]">{text(item)}</dd></div>)}</dl> : <div className="mt-2 text-sm">{text(value)}</div>}</div>; }

function EvidencePanels({ evidence, results }: { evidence: Array<Record<string, unknown>>; results: Array<Record<string, unknown>> }) {
  return <Accordion type="single" collapsible className="space-y-3">{evidence.map((item, index) => { const raw = evidenceValue(item, "response", "events", "json", "providerResponse", "log", "evidence") ?? item; const events = Array.isArray(item.events) ? item.events as Array<Record<string, unknown>> : null; const related = results.find((result) => result.evidenceRef === item.id); return <AccordionItem key={index} value={`evidence-${index}`} className="rounded-xl border border-[#5d6f85]/25 px-4"><div className="py-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{text(evidenceValue(item, "title", "name"))}</h3><Badge variant="outline" className="border-emerald-400/35 text-emerald-200">PASS</Badge></div><p className="mt-2 text-sm leading-6 text-[#B8C7D8]">{text(related?.objective ?? evidenceValue(item, "summary", "result"))}</p><div className="mt-3 flex flex-wrap gap-3 text-xs text-[#9FB5C9]"><span>{label(text(evidenceValue(item, "evidenceType", "type")))}</span>{item.httpStatus != null ? <span>HTTP {text(item.httpStatus)} OK</span> : null}</div></div><AccordionTrigger>{events ? "Expand Log Evidence" : "Expand Raw Provider Response"}</AccordionTrigger><AccordionContent>{events ? <ol className="space-y-3 rounded-lg bg-[#090E15] p-4">{events.map((event, eventIndex) => <li key={eventIndex} className="border-l-2 border-sky-400/40 pl-4"><div className="font-mono text-xs text-sky-300">{label(text(event.event))}</div><pre className="mt-2 overflow-x-auto text-xs leading-6 text-[#AFC4DC]">{JSON.stringify(event, null, 2)}</pre></li>)}</ol> : <pre className="overflow-x-auto rounded-lg bg-[#090E15] p-4 text-xs leading-6 text-[#AFC4DC]">{JSON.stringify(raw, null, 2)}</pre>}</AccordionContent></AccordionItem>; })}</Accordion>;
}

function ObservationList({ value }: { value: unknown }) { const values = Array.isArray(value) ? value : [value]; return <ul className="grid gap-3 md:grid-cols-2">{values.map((item, index) => <li key={index} className="flex gap-3 rounded-lg border border-emerald-400/15 bg-emerald-500/[0.04] p-4 text-sm leading-6 text-[#DCE9E4]"><span className="font-bold text-emerald-300">✓</span>{text(item)}</li>)}</ul>; }
function OpenItemCards({ value }: { value: Array<string | Record<string, unknown>> }) { return <div className="grid gap-3 md:grid-cols-3">{value.map((item, index) => { const row = typeof item === "string" ? { name: item } : item; return <div key={index} className="rounded-xl border border-amber-400/20 bg-amber-500/[0.04] p-4"><div className="font-semibold">{text(row.name ?? row.title)}</div><Badge variant="outline" className="mt-3 border-amber-400/35 text-amber-200">{text(row.status)}</Badge><p className="mt-3 text-sm leading-6 text-[#B8C7D8]">{text(row.detail ?? row.description)}</p></div>; })}</div>; }
function Conclusion({ value }: { value: Record<string, unknown> }) { return <div className="flex flex-col gap-4 sm:flex-row sm:items-start"><Badge variant="outline" className="border-emerald-400/40 text-emerald-200">{text(value.status)}</Badge><p className="text-lg leading-8 text-[#D8E3EE]">{text(value.statement ?? value.summary)}</p></div>; }
