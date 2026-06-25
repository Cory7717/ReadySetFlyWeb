import type { ProviderChangeSummary } from "@shared/provider-notification-format";

export function ProviderChangeSummaryView({ summary }: { summary: ProviderChangeSummary }) {
  const sections = [
    { label: "Added", values: summary.added },
    { label: "Modified", values: summary.modified },
    { label: "Removed", values: summary.removed },
    { label: "Unchanged", values: summary.unchanged },
  ].filter((section) => section.values.length > 0);

  return (
    <div className="mt-3 space-y-3">
      <div className="text-sm font-semibold">Flight Service updated your flight plan.</div>
      {sections.map((section) => (
        <div key={section.label} className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">{section.label}</div>
          <div className="space-y-1">
            {section.values.map((value) => (
              <div key={`${section.label}-${value}`} className="flex gap-2 text-sm">
                <span aria-hidden="true">✓</span>
                <span className="break-words">{value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <details className="rounded-md border border-current/20 bg-black/10 p-2 text-xs">
        <summary className="cursor-pointer font-semibold">View Technical Details</summary>
        <div className="mt-2 space-y-3">
          {summary.technicalDetails.map((detail, index) => (
            <div key={`${detail.field}-${index}`} className="space-y-1">
              <div className="font-semibold">{detail.field}</div>
              <div>
                <span className="opacity-80">Previous: </span>
                <span className="break-words">{detail.previous || "—"}</span>
              </div>
              <div>
                <span className="opacity-80">Current: </span>
                <span className="break-words">{detail.current || "—"}</span>
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
