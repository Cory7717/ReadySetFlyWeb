import { ArrowDown, CheckCircle2, CircleDashed, Clock3, FileCheck2, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

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
    regressionFixes: string;
    validationEvidence: string;
    openItems: string;
    futureReports: string;
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
  evidence: Array<{ id: string; title: string; payload: Record<string, unknown> }>;
  openItems: Array<{ item: string; status: ValidationStatus }>;
  futureReports: Array<{ title: string; description: string }>;
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
    regressionFixes: "Regression Fixes Verified",
    validationEvidence: "Validation Evidence",
    openItems: "Open Items",
    futureReports: "Future Validation Reports",
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
  evidence: [
    { id: "retrieve-filing", title: "Retrieve after Filing", payload: { operation: "retrieve", lifecycle: "PROPOSED", result: "sanitized example" } },
    { id: "retrieve-amendment", title: "Retrieve after Amendment", payload: { operation: "retrieve", lifecycle: "PROPOSED", change: "sanitized amendment example" } },
    { id: "retrieve-activation", title: "Retrieve after Activation", payload: { operation: "retrieve", lifecycle: "ACTIVE", result: "sanitized example" } },
    { id: "retrieve-closure", title: "Retrieve after Closure", payload: { operation: "retrieve", lifecycle: "CLOSED", result: "sanitized example" } },
    { id: "webhook-lifecycle", title: "Webhook Lifecycle Example", payload: { event: "lifecycle update", lifecycle: "ACTIVE", processing: "authenticated and sanitized" } },
  ],
  openItems: [
    { item: "Squawk / Beacon Code update not yet observed during current LAB testing", status: "Not Yet Observed" },
    { item: "Final Flight Services demonstration pending", status: "Pending" },
    { item: "Production authorization pending", status: "Pending" },
  ],
  futureReports: [
    { title: "Validation Report 1", description: "Reserved for the next documented validation cycle." },
    { title: "Validation Report 2", description: "Reserved for expanded operational evidence." },
    { title: "Validation Report 3", description: "Reserved for future production-readiness reporting." },
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

const sectionClass = "scroll-mt-24 space-y-5";
const sectionHeadingClass = "font-display text-2xl font-bold tracking-tight text-[#F4F7FB] sm:text-3xl";

export default function FlightServiceValidationPage() {
  const report = flightServiceValidationReport;
  return (
    <PageShell
      kicker={report.banner.label}
      title={report.title}
      description={report.subtitle}
      className="bg-[#090e15] text-[#E8EDF4]"
      canopyClassName="border-b border-[#5d6f85]/25 bg-[radial-gradient(circle_at_top_right,rgba(43,105,178,.24),transparent_45%),linear-gradient(180deg,#101923,#0b1119)]"
      contentClassName="max-w-7xl space-y-14"
    >
      <aside className="rounded-2xl border border-[#4e78a8]/35 bg-[#102033]/70 p-5 shadow-[0_18px_45px_-34px_rgba(44,116,198,.9)]" aria-label="Report notice">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#87b9ff]" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-white">{report.banner.label}</h2>
            <p className="mt-1 max-w-5xl text-sm leading-6 text-[#B7C7D9]">{report.banner.description}</p>
          </div>
        </div>
      </aside>

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

      <section id="regression-fixes" className={sectionClass} aria-labelledby="regression-heading">
        <h2 id="regression-heading" className={sectionHeadingClass}>{report.sections.regressionFixes}</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {report.verifiedFixes.map((fix) => (
            <li key={fix} className="flex gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4 text-sm text-[#DCE9E4]">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" /><span>{fix}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="validation-evidence" className={sectionClass} aria-labelledby="evidence-heading">
        <h2 id="evidence-heading" className={sectionHeadingClass}>{report.sections.validationEvidence}</h2>
        <Accordion type="single" collapsible className="space-y-3">
          {report.evidence.map((item) => (
            <AccordionItem key={item.id} value={item.id} className="rounded-xl border border-[#5d6f85]/25 bg-[#111923] px-4">
              <AccordionTrigger className="text-left text-[#EEF4FB]">{item.title}</AccordionTrigger>
              <AccordionContent>
                <pre className="overflow-x-auto rounded-lg border border-[#5d6f85]/20 bg-[#090E15] p-4 text-xs leading-6 text-[#AFC4DC]">{JSON.stringify(item.payload, null, 2)}</pre>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section id="open-items" className={sectionClass} aria-labelledby="open-items-heading">
        <h2 id="open-items-heading" className={sectionHeadingClass}>{report.sections.openItems}</h2>
        <ul className="space-y-3">
          {report.openItems.map((item) => (
            <li key={item.item} className="flex flex-col justify-between gap-3 rounded-xl border border-[#5d6f85]/25 bg-[#111923] p-4 sm:flex-row sm:items-center">
              <div className="flex gap-3 text-sm text-[#D2DDE9]">{item.status === "Pending" ? <Clock3 className="h-5 w-5 shrink-0 text-amber-300" /> : <CircleDashed className="h-5 w-5 shrink-0 text-slate-300" />}<span>{item.item}</span></div>
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
              <CardHeader><FileCheck2 className="h-5 w-5 text-[#87B9FF]" aria-hidden="true" /><CardTitle className="text-lg">{item.title}</CardTitle></CardHeader>
              <CardContent className="text-sm leading-6 text-[#AEBCCD]">{item.description}</CardContent>
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
