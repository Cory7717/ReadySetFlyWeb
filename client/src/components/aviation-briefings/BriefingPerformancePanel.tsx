import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ExternalLink } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";

type Range = "7" | "30" | "90" | "lifetime";
type Metrics = {
  views: number;
  uniqueReaders: number;
  returningReaders: number;
  helpful: number;
  learnMore: number;
  saves: number;
  shares: number;
  toolClicks: number;
  contributorClicks: number;
  videoStarts: number;
};
type PerformanceRow = Metrics & {
  id: string;
  title: string;
  slug: string;
  category: string;
  contentType: string;
  status: string;
  engagementRate: number;
};
type PerformanceData = {
  range: Range;
  totals: Metrics;
  rows: PerformanceRow[];
};
const ranges: Array<[Range, string]> = [
  ["7", "7 days"],
  ["30", "30 days"],
  ["90", "90 days"],
  ["lifetime", "Lifetime"],
];

export function BriefingPerformancePanel() {
  const [range, setRange] = useState<Range>("30");
  const { data, isLoading, error } = useQuery<PerformanceData>({
    queryKey: ["/api/admin/aviation-briefings/performance", range],
    queryFn: async () => {
      const response = await fetch(
        apiUrl(`/api/admin/aviation-briefings/performance?range=${range}`),
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Unable to load briefing performance.");
      return response.json();
    },
  });
  const totals = data?.totals;
  const cards: Array<[string, number]> = [
    ["Article views", totals?.views || 0],
    ["Unique readers", totals?.uniqueReaders || 0],
    ["Repeat readers", totals?.returningReaders || 0],
    ["Helpful", totals?.helpful || 0],
    ["Learn more", totals?.learnMore || 0],
    ["Saves", totals?.saves || 0],
    ["Shares", totals?.shares || 0],
    ["RSF tool clicks", totals?.toolClicks || 0],
  ];
  return (
    <section className="mt-8 rounded-xl border border-[#526d94]/40 bg-[#0c1624] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center text-2xl font-bold">
            <BarChart3 className="mr-2 h-6 w-6 text-[#87b8f7]" />
            Briefing Performance
          </h2>
          <p className="mt-1 text-sm text-[#9fb0c4]">
            Private, anonymous readership and engagement signals. Nothing here
            ranks contributors publicly.
          </p>
        </div>
        <div
          className="flex flex-wrap gap-2"
          aria-label="Performance date range"
        >
          {ranges.map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={range === value ? "default" : "outline"}
              className={range === value ? "bg-[#347edc] text-white" : ""}
              onClick={() => setRange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      {error ? (
        <p className="mt-5 rounded border border-red-400/50 bg-red-950/40 p-3 text-red-100">
          Unable to load performance data.
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-[#111e30] p-4">
                <div className="text-xs text-[#9fb0c4]">{label}</div>
                <b className="mt-1 block text-2xl">
                  {isLoading ? "—" : value.toLocaleString()}
                </b>
              </div>
            ))}
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead>
                <tr className="border-b border-[#526d94]/40 text-left text-[#9fb0c4]">
                  <th className="p-2">Briefing</th>
                  <th>Views</th>
                  <th>Unique</th>
                  <th>Repeat</th>
                  <th>Helpful</th>
                  <th>Learn more</th>
                  <th>Saves</th>
                  <th>Shares</th>
                  <th>Tool clicks</th>
                  <th>Contributor</th>
                  <th>Video starts</th>
                  <th>Action rate</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows || []).map((row) => (
                  <tr key={row.id} className="border-b border-[#526d94]/25">
                    <td className="p-2">
                      <a
                        href={`/aviation-briefings/${row.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-sm items-center font-semibold text-[#8dbbfa] hover:text-white"
                      >
                        {row.title}
                        <ExternalLink className="ml-1 h-3 w-3 shrink-0" />
                      </a>
                      <div className="mt-1 text-xs text-[#8396ad]">
                        {row.category} · {row.status}
                      </div>
                    </td>
                    <td>{row.views}</td>
                    <td>{row.uniqueReaders}</td>
                    <td>{row.returningReaders}</td>
                    <td>{row.helpful}</td>
                    <td>{row.learnMore}</td>
                    <td>{row.saves}</td>
                    <td>{row.shares}</td>
                    <td>{row.toolClicks}</td>
                    <td>{row.contributorClicks}</td>
                    <td>
                      {row.contentType === "video" ? row.videoStarts : "—"}
                    </td>
                    <td>{row.engagementRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && !data?.rows.length && (
              <p className="p-5 text-[#9fb0c4]">
                No briefings are available for reporting yet.
              </p>
            )}
          </div>
          <p className="mt-3 text-xs leading-5 text-[#8396ad]">
            Repeat readers opened the same briefing more than once during the
            selected period. Action rate compares feedback, saves, shares, and
            outbound clicks with total article views.
          </p>
        </>
      )}
    </section>
  );
}
