import { ArrowDown, CheckCircle2, CircleDashed, Clock3, FileCheck2, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { ImportedValidationReportPage, ValidationReportImportControl } from "@/components/flight-service-validation/ImportedValidationReport";

type ValidationStatus = "Passed" | "Pending" | "Not Yet Observed";

type FlightServiceValidationReport = {
  title: string;
  subtitle: string;
  banner: { label: string; description: string };
  sections: {
    currentStatus: string;
    executiveSummary: string;
    testMatrix: string;
    lifecycleTimeline: string;
    engineeringChanges: string;
    validationMethodology: string;
    validationEvidence: string;
    openItems: string;
    futureReports: string;
  };
  overallValidation: {
    title: string;
    headline: string;
    metrics: Array<{ label: string; value: string }>;
  };
  testMatrixColumns: [string, string, string, string];
  metadata: Array<{ label: string; value: string; status?: ValidationStatus }>;
  currentStatus: Array<{ title: string; status: ValidationStatus }>;
  executiveSummary: string[];
  testMatrix: Array<{
    test: string;
    expectedResult: string;
    actualResult: string;
    status: ValidationStatus;
  }>;
  lifecycle: string[];
  verifiedFixes: string[];
  methodology: { description: string; steps: string[]; verificationLabel: string; verificationChannels: string[] };
  evidenceLabels: {
    validationSummary: string;
    purpose: string;
    result: string;
    environment: string;
    providerResponse: string;
    lifecycle: string;
    expand: string;
    rawResponse: string;
    download: string;
    comingSoon: string;
  };
  evidence: Array<{
    id: string;
    title: string;
    purpose: string;
    expectedLifecycle: string;
    result: "PASS";
    environment: string;
    httpStatus: string;
    summary: string;
    json: Record<string, unknown>;
  }>;
  openItems: Array<{ title: string; description: string; status: ValidationStatus }>;
  futureReports: Array<{ label: string; title: string; description: string; button: string }>;
  footer: { title: string; description: string; button: string };
};

export const flightServiceValidationReport = {
  title: "Ready Set Fly Flight Service Validation",
  subtitle: "Ready Set Fly ↔ Leidos Flight Service Integration Validation",
  banner: {
    label: "Engineering Validation Report",
    description:
      "This page documents the validation, testing, and operational readiness of the Ready Set Fly Flight Service integration. Sensitive operational and customer information has been intentionally omitted.",
  },
  sections: {
    currentStatus: "Current Status",
    executiveSummary: "Executive Summary",
    testMatrix: "Test Matrix",
    lifecycleTimeline: "Lifecycle Timeline",
    engineeringChanges: "Engineering Changes Verified",
    validationMethodology: "Validation Methodology",
    validationEvidence: "Validation Evidence",
    openItems: "Open Items",
    futureReports: "Future Validation Reports",
  },
  overallValidation: {
    title: "Overall Validation Status",
    headline: "118 / 118 Validation Tests Passed",
    metrics: [
      { label: "Critical Issues", value: "0" },
      { label: "Major Issues", value: "0" },
      { label: "Environment", value: "LAB / Elab2" },
      { label: "Integration Status", value: "Awaiting Final Flight Services Demonstration" },
    ],
  },
  testMatrixColumns: ["Test", "Expected Result", "Actual Result", "Status"],
  metadata: [
    { label: "Environment", value: "LAB / Elab2" },
    { label: "Report Version", value: "1.0" },
    { label: "Validation Date", value: "August 4, 2026" },
    { label: "Last Updated", value: "August 4, 2026" },
    { label: "Overall Status", value: "Validation in progress", status: "Pending" },
  ],
  currentStatus: [
    { title: "Integration Testing Complete", status: "Passed" },
    { title: "Core System Tests Passing", status: "Passed" },
    { title: "Webhook Synchronization Verified", status: "Passed" },
    { title: "Awaiting Final Flight Services Demonstration", status: "Pending" },
  ],
  executiveSummary: [
    "Ready Set Fly has completed extensive engineering validation across normal workflows, edge cases, error handling, provider synchronization, lifecycle management, webhook processing, and regression testing.",
    "The purpose of this report is to document the integration's tested behavior and current operational-readiness posture in a sanitized format suitable for external review.",
  ],
  testMatrix: [
    ["File Flight Plan", "A valid plan is accepted for filing.", "Expected filing response structure observed."],
    ["Retrieve Flight Plan", "The targeted provider record is returned.", "Targeted retrieval structure verified."],
    ["Amend Flight Plan", "A valid amendment updates the provider record.", "Amendment workflow verified."],
    ["Activate Flight Plan", "An eligible VFR plan enters the active lifecycle.", "Activation workflow verified."],
    ["Close Flight Plan", "An active plan transitions to closed.", "Closure workflow verified."],
    ["Cancel Flight Plan", "An eligible proposed plan is cancelled.", "Cancellation workflow verified."],
    ["ZZZZ Departure", "DEP/ is generated for an eligible ZZZZ departure.", "Generated DEP/ structure preserved."],
    ["ZZZZ Latitude/Longitude", "A valid coordinate is transmitted in ICAO format.", "Coordinate formatting verified."],
    ["ICAO Item 18 Validation", "Valid subfields pass and malformed content is rejected.", "Validation boundaries verified."],
    ["PBN Validation", "PBN requirements follow filed equipment capabilities.", "Required PBN behavior verified."],
    ["Blank Filing Remarks", "No RMK/ is generated when remarks are blank.", "Blank remarks omitted."],
    ["User Filing Remarks", "One normalized RMK/ is transmitted.", "Single normalized RMK/ verified."],
    ["Webhook Processing", "An authenticated event targets only the affected plan.", "Targeted processing verified."],
    ["Provider Lifecycle Updates", "Authoritative lifecycle changes are persisted.", "Lifecycle mapping verified."],
    ["Provider Acknowledgement", "Updates remain pending until user acknowledgement.", "Manual acknowledgement verified."],
    ["Refresh Provider Sync", "Manual refresh retrieves without resubmitting.", "Safe refresh workflow verified."],
    ["Version Stamp Progression", "Provider revisions advance without stale overwrite.", "Revision progression verified."],
    ["Pre-dispatch Validation Recovery", "Local validation failures remain safe to retry.", "Pre-dispatch recovery verified."],
  ].map(([test, expectedResult, actualResult]) => ({
    test,
    expectedResult,
    actualResult,
    status: "Passed" as const,
  })),
  lifecycle: ["File", "Retrieve", "Amend", "Retrieve", "Activate", "Webhook", "Retrieve", "Close", "Webhook", "Closed"],
  verifiedFixes: [
    "ICAO Item 18 validation corrected",
    "Blank Item 18 accepted",
    "Invalid Item 18 rejected before dispatch",
    "False provider-outcome-unknown classification corrected",
    "Refresh Provider Sync restored",
    "Provider acknowledgement restored",
    "Webhook-first synchronization implemented",
    "Continuous provider polling removed",
    "Internal RSF filing preview removed",
    "Blank filing remarks omitted",
    "User remarks correctly transmitted",
    "Healthy ACTIVE and PROPOSED plans no longer background synchronize",
  ],
  methodology: {
    description: "Every workflow is verified through both the Ready Set Fly user experience and direct provider retrieval, then compared with its documented expected result.",
    steps: [
      "File Flight Plan",
      "Retrieve Provider Response",
      "Validate Provider Data",
      "Verify Lifecycle",
      "Confirm Webhook Processing",
      "Compare Expected Results",
      "Record Validation",
    ],
    verificationLabel: "Each workflow is verified using both:",
    verificationChannels: ["RSF user interface", "Direct provider retrieval through Postman"],
  },
  evidenceLabels: {
    validationSummary: "Validation Summary",
    purpose: "Purpose",
    result: "Result",
    environment: "Environment",
    providerResponse: "Provider Response",
    lifecycle: "Lifecycle",
    expand: "Expand Raw Provider Response",
    rawResponse: "Sanitized Postman Response",
    download: "Download JSON",
    comingSoon: "Coming Soon",
  },
  evidence: [
    {
      id: "retrieve-filing",
      title: "Retrieve After Filing",
      purpose: "Verify successful provider filing.",
      expectedLifecycle: "PROPOSED",
      result: "PASS",
      environment: "Flight Services LAB (Elab2)",
      httpStatus: "200 OK",
      summary: "Provider accepted the filing and returned the expected proposed lifecycle state.",
      json: { returnStatus: true, operation: "retrieve", currentState: "PROPOSED", versionStamp: "sanitized" },
    },
    {
      id: "retrieve-amendment",
      title: "Retrieve After Amendment",
      purpose: "Verify amendments are accepted.",
      expectedLifecycle: "PROPOSED",
      result: "PASS",
      environment: "Flight Services LAB (Elab2)",
      httpStatus: "200 OK",
      summary: "The amended provider record retained the expected proposed lifecycle and reflected the sanitized change.",
      json: { returnStatus: true, operation: "retrieve", currentState: "PROPOSED", amendment: "sanitized", versionStamp: "sanitized" },
    },
    {
      id: "retrieve-activation",
      title: "Retrieve After Activation",
      purpose: "Verify successful activation.",
      expectedLifecycle: "ACTIVE",
      result: "PASS",
      environment: "Flight Services LAB (Elab2)",
      httpStatus: "200 OK",
      summary: "Provider retrieval confirmed that the eligible flight plan progressed to the active lifecycle.",
      json: { returnStatus: true, operation: "retrieve", currentState: "ACTIVE", versionStamp: "sanitized" },
    },
    {
      id: "retrieve-closure",
      title: "Retrieve After Closure",
      purpose: "Verify successful closure.",
      expectedLifecycle: "CLOSED",
      result: "PASS",
      environment: "Flight Services LAB (Elab2)",
      httpStatus: "200 OK",
      summary: "Provider retrieval confirmed the terminal closed lifecycle with no additional action pending.",
      json: { returnStatus: true, operation: "retrieve", currentState: "CLOSED", versionStamp: "sanitized" },
    },
    {
      id: "webhook-lifecycle",
      title: "Webhook Lifecycle Response",
      purpose: "Verify webhook-driven lifecycle synchronization.",
      expectedLifecycle: "Provider lifecycle reflected in RSF",
      result: "PASS",
      environment: "Flight Services LAB (Elab2)",
      httpStatus: "200 OK",
      summary: "Provider webhook received; lifecycle updated; notification generated.",
      json: { returnStatus: true, event: "lifecycle update", processing: "authenticated and sanitized", notification: "generated" },
    },
  ],
  openItems: [
    { title: "Beacon / Squawk Assignment", description: "Waiting for provider-generated beacon code during LAB validation.", status: "Not Yet Observed" },
    { title: "Final Flight Services Demonstration", description: "Pending coordinated demonstration with Flight Services personnel.", status: "Pending" },
    { title: "Production Authorization", description: "Pending transition from LAB validation to production approval.", status: "Pending" },
  ],
  futureReports: [
    { label: "Validation Report 1", title: "Flight Service Integration Validation v1.0", description: "Initial engineering validation covering filing, lifecycle management, webhooks, provider synchronization, and regression testing.", button: "Current Report" },
    { label: "Validation Report 2", title: "Flight Services Demonstration Validation", description: "Reserved for documenting Flight Services demonstration scenarios, reviewer feedback, and validation outcomes.", button: "Coming After Demo" },
    { label: "Validation Report 3", title: "Production Readiness Validation", description: "Reserved for documenting production environment validation, operational readiness, and final deployment verification.", button: "Future" },
  ],
  footer: {
    title: "Ready Set Fly Engineering Validation",
    description: "Sanitized public engineering report",
    button: "Return to Ready Set Fly",
  },
} satisfies FlightServiceValidationReport;

const statusStyles: Record<ValidationStatus, string> = {
  Passed: "border-emerald-400/45 bg-emerald-500/10 text-emerald-200",
  Pending: "border-amber-400/45 bg-amber-500/10 text-amber-100",
  "Not Yet Observed": "border-slate-400/40 bg-slate-500/10 text-slate-200",
};

function StatusBadge({ status }: { status: ValidationStatus }) {
  return <Badge variant="outline" className={cn("whitespace-nowrap", statusStyles[status])}>{status}</Badge>;
}

function SyntaxHighlightedJson({ value }: { value: Record<string, unknown> }) {
  const tokens = JSON.stringify(value, null, 2).split(/("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g);
  return (
    <code>
      {tokens.map((token, index) => {
        const className = /^".*"$/.test(token)
          ? (tokens[index + 1]?.trimStart().startsWith(":") ? "text-sky-300" : "text-emerald-300")
          : /^(true|false|null)$/.test(token)
            ? "text-amber-300"
            : /^-?\d/.test(token)
              ? "text-violet-300"
              : "text-[#AFC4DC]";
        return <span key={`${index}-${token}`} className={className}>{token}</span>;
      })}
    </code>
  );
}

const sectionClass = "scroll-mt-24 space-y-5";
const sectionHeadingClass = "font-display text-2xl font-bold tracking-tight text-[#F4F7FB] sm:text-3xl";

export default function FlightServiceValidationPage({ params }: { params?: { reportId?: string } }) {
  const report = flightServiceValidationReport;
  const publishedReports = useQuery<{ reports: Array<{ reportId: string; isCurrent: boolean }> }>({
    queryKey: ["/api/public/flight-service-validation/reports"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const hasImportedReport = params?.reportId
    ? publishedReports.data?.reports.some((item) => item.reportId === params.reportId)
    : publishedReports.data?.reports.some((item) => item.isCurrent);
  if (hasImportedReport) return <ImportedValidationReportPage reportId={params?.reportId} />;
  return (
    <PageShell
      kicker={report.banner.label}
      title={report.title}
      description={report.subtitle}
      className="bg-[#090e15] text-[#E8EDF4]"
      canopyClassName="border-b border-[#5d6f85]/25 bg-[radial-gradient(circle_at_top_right,rgba(43,105,178,.24),transparent_45%),linear-gradient(180deg,#101923,#0b1119)]"
      contentClassName="max-w-7xl space-y-14"
    >
      <ValidationReportImportControl />
      <aside className="rounded-2xl border border-[#4e78a8]/35 bg-[#102033]/70 p-5 shadow-[0_18px_45px_-34px_rgba(44,116,198,.9)]" aria-label="Report notice">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#87b9ff]" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-white">{report.banner.label}</h2>
            <p className="mt-1 max-w-5xl text-sm leading-6 text-[#B7C7D9]">{report.banner.description}</p>
          </div>
        </div>
      </aside>

      <Card className="overflow-hidden border-emerald-400/35 bg-[linear-gradient(135deg,rgba(12,43,38,.96),rgba(15,30,43,.98))] text-[#E8EDF4] shadow-[0_24px_65px_-42px_rgba(52,211,153,.75)]">
        <CardHeader className="border-b border-emerald-300/15">
          <CardTitle className="flex items-center gap-3 text-2xl text-white"><CheckCircle2 className="h-7 w-7 text-emerald-300" aria-hidden="true" />{report.overallValidation.title}</CardTitle>
          <div className="text-xl font-bold text-emerald-200 sm:text-2xl">{report.overallValidation.headline}</div>
        </CardHeader>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {report.overallValidation.metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-white/10 bg-black/15 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9FB5C9]">{metric.label}</div>
              <div className="mt-2 font-semibold leading-6 text-[#F4F8FC]">{metric.value}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Report metadata">
        {report.metadata.map((item) => (
          <div key={item.label} className="rounded-xl border border-[#5d6f85]/25 bg-[#111923] p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8EA3BC]">{item.label}</dt>
            <dd className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-[#F2F6FB]">
              <span>{item.value}</span>{item.status ? <StatusBadge status={item.status} /> : null}
            </dd>
          </div>
        ))}
      </dl>

      <section id="current-status" className={sectionClass} aria-labelledby="current-status-heading">
        <h2 id="current-status-heading" className={sectionHeadingClass}>{report.sections.currentStatus}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {report.currentStatus.map((item) => (
            <Card key={item.title} className="border-[#5d6f85]/25 bg-[#111923] text-[#E8EDF4]">
              <CardContent className="flex h-full flex-col justify-between gap-5 p-5">
                <div className="font-semibold leading-6 text-[#F4F7FB]">{item.title}</div>
                <StatusBadge status={item.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="executive-summary" className={sectionClass} aria-labelledby="executive-summary-heading">
        <h2 id="executive-summary-heading" className={sectionHeadingClass}>{report.sections.executiveSummary}</h2>
        <Card className="border-[#5d6f85]/25 bg-[#111923] text-[#E8EDF4]">
          <CardContent className="space-y-4 p-6 text-sm leading-7 text-[#BFCBDC] sm:text-base">
            {report.executiveSummary.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </CardContent>
        </Card>
      </section>

      <section id="test-matrix" className={sectionClass} aria-labelledby="test-matrix-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="test-matrix-heading" className={sectionHeadingClass}>{report.sections.testMatrix}</h2>
          <div className="flex flex-wrap gap-2" aria-label="Status badge legend">
            <StatusBadge status="Passed" /><StatusBadge status="Pending" /><StatusBadge status="Not Yet Observed" />
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[#5d6f85]/25 bg-[#0E151E]">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-[#172231] text-[#DCE8F7]">
              <tr>{report.testMatrixColumns.map((column) => <th key={column} className="px-4 py-3">{column}</th>)}</tr>
            </thead>
            <tbody>
              {report.testMatrix.map((row) => (
                <tr key={row.test} className="border-t border-[#5d6f85]/20 align-top">
                  <th scope="row" className="px-4 py-4 font-semibold text-[#F0F5FB]">{row.test}</th>
                  <td className="px-4 py-4 leading-6 text-[#B3C1D2]">{row.expectedResult}</td>
                  <td className="px-4 py-4 leading-6 text-[#B3C1D2]">{row.actualResult}</td>
                  <td className="px-4 py-4"><StatusBadge status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="lifecycle-timeline" className={sectionClass} aria-labelledby="lifecycle-heading">
        <h2 id="lifecycle-heading" className={sectionHeadingClass}>{report.sections.lifecycleTimeline}</h2>
        <ol className="grid gap-2 rounded-2xl border border-[#5d6f85]/25 bg-[#111923] p-5 sm:grid-cols-2 lg:grid-cols-5" aria-label="Validated Flight Service lifecycle">
          {report.lifecycle.map((step, index) => (
            <li key={`${step}-${index}`} className="flex flex-col items-center gap-2 text-center">
              <div className="w-full rounded-lg border border-[#4e78a8]/35 bg-[#13243A] px-3 py-3 font-semibold text-[#EAF3FF]">{step}</div>
              {index < report.lifecycle.length - 1 ? <ArrowDown className="h-4 w-4 text-[#79A9E5]" aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>
      </section>

      <section id="engineering-changes" className={sectionClass} aria-labelledby="engineering-changes-heading">
        <h2 id="engineering-changes-heading" className={sectionHeadingClass}>{report.sections.engineeringChanges}</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {report.verifiedFixes.map((fix) => (
            <li key={fix} className="flex gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4 text-sm text-[#DCE9E4]">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" /><span>{fix}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="validation-methodology" className={sectionClass} aria-labelledby="methodology-heading">
        <h2 id="methodology-heading" className={sectionHeadingClass}>{report.sections.validationMethodology}</h2>
        <Card className="border-[#5d6f85]/25 bg-[#111923] text-[#E8EDF4]">
          <CardContent className="space-y-6 p-6">
            <p className="max-w-5xl text-sm leading-7 text-[#BFCBDC] sm:text-base">{report.methodology.description}</p>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label={report.sections.validationMethodology}>
              {report.methodology.steps.map((step, index) => (
                <li key={step} className="flex flex-col items-center gap-2 text-center">
                  <div className="w-full rounded-lg border border-[#4e78a8]/35 bg-[#13243A] px-3 py-3 font-semibold text-[#EAF3FF]">{step}</div>
                  {index < report.methodology.steps.length - 1 ? <ArrowDown className="h-4 w-4 text-[#79A9E5]" aria-hidden="true" /> : null}
                </li>
              ))}
            </ol>
            <div className="rounded-xl border border-[#4e78a8]/25 bg-[#0C151F] p-4">
              <div className="font-semibold text-[#F0F5FB]">{report.methodology.verificationLabel}</div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {report.methodology.verificationChannels.map((channel) => <li key={channel} className="flex items-center gap-2 text-sm text-[#BFD0E2]"><CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />{channel}</li>)}
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="validation-evidence" className={sectionClass} aria-labelledby="evidence-heading">
        <h2 id="evidence-heading" className={sectionHeadingClass}>{report.sections.validationEvidence}</h2>
        <Accordion type="single" collapsible className="space-y-3">
          {report.evidence.map((item) => (
            <AccordionItem key={item.id} value={item.id} className="overflow-hidden rounded-xl border border-[#5d6f85]/25 bg-[#111923] px-5">
              <div className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-[#EEF4FB]">{item.title}</h3>
                  <Badge variant="outline" className="border-emerald-400/45 bg-emerald-500/10 text-emerald-200">{item.result}</Badge>
                </div>
                <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#87B9FF]">{report.evidenceLabels.validationSummary}</div>
                <p className="mt-2 text-sm leading-6 text-[#B8C7D8]">{item.summary}</p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div><dt className="text-xs font-semibold text-[#8EA3BC]">{report.evidenceLabels.purpose}</dt><dd className="mt-1 text-sm leading-5 text-[#E7EEF7]">{item.purpose}</dd></div>
                  <div><dt className="text-xs font-semibold text-[#8EA3BC]">{report.evidenceLabels.result}</dt><dd className="mt-1 text-sm font-semibold text-emerald-300">{item.result}</dd></div>
                  <div><dt className="text-xs font-semibold text-[#8EA3BC]">{report.evidenceLabels.environment}</dt><dd className="mt-1 text-sm text-[#E7EEF7]">{item.environment}</dd></div>
                  <div><dt className="text-xs font-semibold text-[#8EA3BC]">{report.evidenceLabels.providerResponse}</dt><dd className="mt-1 text-sm text-[#E7EEF7]">{item.httpStatus}</dd></div>
                  <div><dt className="text-xs font-semibold text-[#8EA3BC]">{report.evidenceLabels.lifecycle}</dt><dd className="mt-1 text-sm font-semibold text-[#E7EEF7]">{item.expectedLifecycle}</dd></div>
                </dl>
              </div>
              <AccordionTrigger className="border-t border-[#5d6f85]/20 py-4 text-left text-[#9CC7FF] hover:no-underline">{report.evidenceLabels.expand}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-5 pt-2">
                  <h4 className="font-semibold text-[#EAF2FC]">{report.evidenceLabels.rawResponse}</h4>
                  <pre className="overflow-x-auto rounded-lg border border-[#5d6f85]/20 bg-[#090E15] p-4 text-xs leading-6"><SyntaxHighlightedJson value={item.json} /></pre>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="secondary" disabled>{report.evidenceLabels.download}</Button>
                    <Badge variant="outline" className="border-slate-400/35 text-slate-300">{report.evidenceLabels.comingSoon}</Badge>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section id="open-items" className={sectionClass} aria-labelledby="open-items-heading">
        <h2 id="open-items-heading" className={sectionHeadingClass}>{report.sections.openItems}</h2>
        <ul className="space-y-3">
          {report.openItems.map((item) => (
            <li key={item.title} className="flex flex-col justify-between gap-3 rounded-xl border border-[#5d6f85]/25 bg-[#111923] p-4 sm:flex-row sm:items-center">
              <div className="flex gap-3 text-sm text-[#D2DDE9]">{item.status === "Pending" ? <Clock3 className="h-5 w-5 shrink-0 text-amber-300" /> : <CircleDashed className="h-5 w-5 shrink-0 text-slate-300" />}<div><div className="font-semibold text-[#EEF4FB]">{item.title}</div><div className="mt-1 leading-6 text-[#AEBCCD]">{item.description}</div></div></div>
              <StatusBadge status={item.status} />
            </li>
          ))}
        </ul>
      </section>

      <section id="future-reports" className={sectionClass} aria-labelledby="future-reports-heading">
        <h2 id="future-reports-heading" className={sectionHeadingClass}>{report.sections.futureReports}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {report.futureReports.map((item) => (
            <Card key={item.title} className="border-dashed border-[#5d6f85]/35 bg-[#111923] text-[#E8EDF4]">
              <CardHeader><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#87B9FF]"><FileCheck2 className="h-5 w-5" aria-hidden="true" />{item.label}</div><CardTitle className="text-lg">{item.title}</CardTitle></CardHeader>
              <CardContent className="flex h-full flex-col items-start justify-between gap-5 text-sm leading-6 text-[#AEBCCD]"><p>{item.description}</p><Button type="button" variant="secondary" disabled>{item.button}</Button></CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="flex flex-col items-start justify-between gap-4 border-t border-[#5d6f85]/25 pt-8 sm:flex-row sm:items-center">
        <div><div className="font-semibold text-[#F2F6FB]">{report.footer.title}</div><div className="mt-1 text-xs text-[#8FA3BA]">{report.footer.description}</div></div>
        <Button asChild className="bg-[#3378D5] text-white hover:bg-[#4389E7]"><Link href="/">{report.footer.button}</Link></Button>
      </footer>
    </PageShell>
  );
}
