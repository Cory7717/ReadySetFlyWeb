import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Calendar,
  Download,
  ChevronDown,
  Eye,
  FileClock,
  Search,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";

const C = {
  page: "!bg-[#f7f1e7] !text-[#201814]",
  shell: "!border-[#cdbda8] !bg-[#fffaf2] !bg-none !text-[#201814] shadow-sm",
  green: "!bg-[#2f5f46] !bg-none !text-white hover:!bg-[#274f3b]",
  outline:
    "!border-[#8d765a] !bg-white !bg-none !text-[#201814] hover:!bg-[#f4eadb]",
  muted: "!text-[#5f5247]",
};
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const money2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});
async function json(url: string, init?: RequestInit) {
  const r = await fetch(apiUrl(url), { credentials: "include", ...init });
  const body = r.status === 204 ? null : await r.json();
  if (!r.ok)
    throw Object.assign(new Error(body?.error || "Request failed"), {
      code: body?.code,
    });
  return body;
}
type Account = any;
export default function CourtyardSalesIntelligence() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [hotelId, setHotelId] = useState("");
  const [period, setPeriod] = useState("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState("total");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detail, setDetail] = useState<Account | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [preview, setPreview] = useState<any>(null);
  const [replace, setReplace] = useState(false);
  const [reportType, setReportType] = useState(
    "marriott_mint_group_account_tracking",
  );
  useEffect(() => {
    const stayTypes = [
      "stay_revenue_by_market_segment_with_groups",
      "stay_group_summary",
      "stay_reservations_company_names",
    ];
    if (Number(year) >= 2026 && !stayTypes.includes(reportType))
      setReportType("stay_revenue_by_market_segment_with_groups");
    if (Number(year) < 2026 && stayTypes.includes(reportType))
      setReportType("marriott_mint_group_account_tracking");
  }, [year, reportType]);
  const me = useQuery({
    queryKey: ["/api/courtyard/sales-intelligence/me"],
    queryFn: () => json("/api/courtyard/sales-intelligence/me"),
  });
  const selectedHotel = hotelId || me.data?.hotels?.[0]?.id || "";
  const dashboard = useQuery({
    queryKey: ["/api/courtyard/sales-intelligence/dashboard", selectedHotel],
    queryFn: () =>
      json(
        `/api/courtyard/sales-intelligence/dashboard?hotelId=${encodeURIComponent(selectedHotel)}`,
      ),
    enabled: !!selectedHotel,
  });
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!files.length) throw new Error("Choose one or more report files.");
      const reports = await Promise.all(
        files.map((file) => {
          const f = new FormData();
          f.append("file", file);
          f.append("reportYear", year);
          f.append("reportMonth", month);
          f.append("reportType", reportType);
          return json("/api/courtyard/sales-intelligence/preview", {
            method: "POST",
            body: f,
          }).then((result) => ({ ...result, filename: file.name }));
        }),
      );
      return {
        reports,
        detectedDelimiter: "auto",
        rowsFound: reports.reduce((sum, r) => sum + r.rowsFound, 0),
        acceptedRows: reports.reduce((sum, r) => sum + r.acceptedRows, 0),
        rejectedRows: reports.reduce((sum, r) => sum + r.rejectedRows, 0),
        duplicateRows: reports.reduce((sum, r) => sum + r.duplicateRows, 0),
        warnings: reports.flatMap((r) => r.warnings || []),
        preview: reports.flatMap((r) =>
          r.preview.map((row: any) => ({ ...row, filename: r.filename })),
        ),
      };
    },
    onSuccess: (result) => {
      setPreview(result);
    },
    onError: (e: Error) =>
      toast({
        title: "Could not read report",
        description: e.message,
        variant: "destructive",
      }),
  });
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!files.length) throw new Error("Choose one or more report files.");
      if (files.length > 1) {
        const form = new FormData();
        files.forEach((file) => form.append("files", file));
        form.append("hotelId", selectedHotel);
        form.append("reportMonth", month);
        form.append("reportYear", year);
        form.append("replace", String(replace));
        return json("/api/courtyard/sales-intelligence/imports", {
          method: "POST",
          body: form,
        });
      }
      const results = [];
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const f = new FormData();
        f.append("file", file);
        f.append("hotelId", selectedHotel);
        f.append("reportMonth", month);
        f.append("reportYear", year);
        f.append(
          "reportType",
          preview?.reports?.[index]?.suggestedReportType || reportType,
        );
        f.append("replace", String(replace));
        results.push(
          await json("/api/courtyard/sales-intelligence/import", {
            method: "POST",
            body: f,
          }),
        );
      }
      return {
        label: `${results.length} report${results.length === 1 ? "" : "s"}`,
        accounts: results.reduce((sum, r) => sum + r.accounts, 0),
        roomNights: results.reduce((sum, r) => sum + r.roomNights, 0),
        roomRevenue: results.reduce((sum, r) => sum + r.roomRevenue, 0),
      };
    },
    onSuccess: (r) => {
      toast({
        title: `${r.label} imported successfully`,
        description: r.reports
          ? `${r.reports.length} report sources imported together. Hotel totals remain sourced only from Hotel Production.`
          : `${r.accounts} accounts · ${r.roomNights.toLocaleString()} room nights · ${money.format(r.roomRevenue)}`,
      });
      setUploadOpen(false);
      setPreview(null);
      setFiles([]);
      setReplace(false);
      setPeriod(`${year}-${Number(month)}`);
      qc.invalidateQueries({
        queryKey: ["/api/courtyard/sales-intelligence/dashboard"],
      });
    },
    onError: (e: any) => {
      if (e.code === "duplicate_month") setReplace(true);
      toast({
        title: "Import needs attention",
        description: e.message,
        variant: "destructive",
      });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      json(`/api/courtyard/sales-intelligence/imports/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["/api/courtyard/sales-intelligence/dashboard"],
      }),
    onError: (e: Error) =>
      toast({
        title: "Could not delete import",
        description: e.message,
        variant: "destructive",
      }),
  });
  const importedYears = useMemo(
    () =>
      Array.from(
        new Set<number>(
          (dashboard.data?.periods || []).map((item: any) => item.year),
        ),
      ).sort((a, b) => b - a),
    [dashboard.data?.periods],
  );
  const latestImportedYear = importedYears[0];
  const activeYear =
    period === "all"
      ? latestImportedYear
      : period.startsWith("year:")
        ? Number(period.slice(5))
        : Number(period.split("-")[0]);
  const activePeriodValue =
    period === "all" || period.startsWith("year:")
      ? "total"
      : period.split("-")[1];
  const importedMonthsForYear = (dashboard.data?.periods || []).filter(
    (item: any) => item.year === activeYear,
  );
  const accounts = useMemo(() => {
    let rows = (dashboard.data?.accounts || []) as Account[];
    if (period === "all" || period.startsWith("year:")) {
      const selectedYear =
        period === "all" ? latestImportedYear : Number(period.slice(5));
      rows = rows
        .map((account) => {
          const history = account.history.filter(
            (item: any) => item.year === selectedYear,
          );
          if (!history.length) return null;
          const roomNights = history.reduce(
            (sum: number, item: any) => sum + item.roomNights,
            0,
          );
          const roomRevenue = history.reduce(
            (sum: number, item: any) => sum + item.roomRevenue,
            0,
          );
          const losNumerator = history.reduce(
            (sum: number, item: any) => sum + item.averageLos * item.roomNights,
            0,
          );
          return {
            ...account,
            roomNights,
            roomRevenue,
            adr: roomNights ? roomRevenue / roomNights : 0,
            averageLos: roomNights ? losNumerator / roomNights : 0,
          };
        })
        .filter(Boolean);
    } else {
      const [y, m] = period.split("-").map(Number);
      rows = rows
        .map((a) => {
          const h = a.history.find((x: any) => x.year === y && x.month === m);
          return h
            ? {
                ...a,
                roomNights: h.roomNights,
                roomRevenue: h.roomRevenue,
                adr: h.adr,
                averageLos: h.averageLos,
                status:
                  !String(a.key).startsWith("stay-segment:") &&
                  !String(a.key).startsWith("stay-company:") &&
                  a.firstPeriod === h.index
                    ? "New"
                    : a.status,
              }
            : null;
        })
        .filter(Boolean);
    }
    const q = search.trim().toLowerCase();
    if (q)
      rows = rows.filter((a) =>
        [
          a.displayName,
          a.highestLevelAccountId,
          a.accountId,
          a.marketSegment,
          a.rateProgram,
          ...a.bookingOffices,
        ].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(q),
        ),
      );
    if (status !== "all") rows = rows.filter((a) => a.status === status);
    return rows.sort((a, b) => b.roomRevenue - a.roomRevenue);
  }, [dashboard.data, latestImportedYear, period, search, status]);
  const groupAccounts = accounts.filter(
    (account) => account.reportCategory === "group",
  );
  const marketSegments = dashboard.data?.marketSegments || [];
  const visibleAccounts =
    view === "total"
      ? accounts.filter((account) => account.reportCategory === "total")
      : view.startsWith("segment:")
        ? accounts.filter((account) => account.reportCategory === view)
        : groupAccounts;
  const totals = useMemo(() => {
    const roomNights = visibleAccounts.reduce((s, a) => s + a.roomNights, 0),
      roomRevenue = visibleAccounts.reduce((s, a) => s + a.roomRevenue, 0);
    return {
      accounts: visibleAccounts.length,
      recurring: visibleAccounts.filter((account) => account.recurring).length,
      roomNights,
      roomRevenue,
      adr: roomNights ? roomRevenue / roomNights : 0,
      los: roomNights
        ? visibleAccounts.reduce((s, a) => s + a.averageLos * a.roomNights, 0) /
          roomNights
        : 0,
    };
  }, [visibleAccounts]);
  const entityLabel =
    view === "total"
      ? "Segments"
      : view === "segment:Group"
        ? "Groups"
        : ["segment:Special Corp", "segment:Government"].includes(view)
          ? "Prospects"
          : view.startsWith("segment:")
            ? "Segments"
            : "Accounts";
  const selectedPeriodLabel =
    period === "all"
      ? `Calendar Year ${latestImportedYear || ""}`
      : period.startsWith("year:")
        ? `Calendar Year ${period.slice(5)}`
        : new Date(
            Number(period.split("-")[0]),
            Number(period.split("-")[1]) - 1,
            1,
          ).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const latestImportedLabel = dashboard.data?.periods?.[0]?.label;
  const selectedDataHealth = (dashboard.data?.dataHealth || []).find(
    (item: any) =>
      item.year === activeYear &&
      (activePeriodValue === "total" ||
        item.month === Number(activePeriodValue)),
  );
  if (me.isLoading)
    return (
      <div className={`min-h-screen p-8 ${C.page}`}>
        Loading Sales Intelligence…
      </div>
    );
  if (me.error)
    return (
      <div className={`min-h-screen p-8 ${C.page}`}>
        <Card className={C.shell}>
          <CardHeader>
            <CardTitle>Sales Intelligence</CardTitle>
            <CardDescription>{(me.error as Error).message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className={C.green}>
              <Link href="/courtyard">Go to Courtyard portal</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  return (
    <div className={`min-h-screen ${C.page}`}>
      <header className="border-b border-[#deceba] bg-[#fffaf2]/95 px-4 py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[.24em] text-[#8a6b3f]">
              Courtyard Austin Lakeline
            </div>
            <h1 className="text-3xl font-semibold">Sales Intelligence</h1>
            <p className={C.muted}>
              Review hotel production, compare market segments, analyze group
              history, identify prospects, and manage ongoing sales efforts.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className={C.outline}>
              <Link href="/courtyard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Portal
              </Link>
            </Button>
            <Button
              variant="outline"
              className={C.outline}
              onClick={() => setHistoryOpen(true)}
            >
              <FileClock className="mr-2 h-4 w-4" />
              Import History
            </Button>
            <Button className={C.green} onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Sales Reports
            </Button>
          </div>
        </div>
      </header>
      <main className="sales-intelligence-content mx-auto max-w-7xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap gap-3">
          <Select value={selectedHotel} onValueChange={setHotelId}>
            <SelectTrigger className="w-72 bg-white">
              <Building2 className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {me.data.hotels.map((h: any) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={activeYear ? String(activeYear) : undefined}
            onValueChange={(value) => setPeriod(`year:${value}`)}
          >
            <SelectTrigger className="w-32 bg-white">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {importedYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={activePeriodValue}
            onValueChange={(value) =>
              setPeriod(
                value === "total"
                  ? `year:${activeYear}`
                  : `${activeYear}-${value}`,
              )
            }
          >
            <SelectTrigger className="w-48 bg-white">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total">Total Year</SelectItem>
              {importedMonthsForYear.map((item: any) => (
                <SelectItem key={item.month} value={String(item.month)}>
                  {new Date(item.year, item.month - 1, 1).toLocaleDateString(
                    "en-US",
                    { month: "long" },
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={view.startsWith("segment:") ? view : "all-segments"}
            onValueChange={(value) =>
              setView(value === "all-segments" ? "total" : value)
            }
          >
            <SelectTrigger className="w-56 bg-white">
              <SelectValue placeholder="Filter market segment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-segments">All Market Segments</SelectItem>
              {marketSegments.map((segment: string) => (
                <SelectItem key={segment} value={`segment:${segment}`}>
                  {segment}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Card className="!border-[#2f5f46] !bg-[#e7f0e9] !bg-none !text-[#173b2a]">
          <CardContent className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#52705e]">
                Reporting Period
              </div>
              <div className="text-2xl font-semibold">
                {selectedPeriodLabel}
              </div>
            </div>
            {(period === "all" || period.startsWith("year:")) &&
              latestImportedLabel && (
                <div className="text-sm font-medium text-[#405f4b]">
                  Calendar-year totals from imported monthly reports
                </div>
              )}
          </CardContent>
        </Card>
        {selectedDataHealth && (
          <Card className={C.shell}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">Monthly Data Health</CardTitle>
                  <CardDescription>
                    {activePeriodValue === "total"
                      ? "Latest imported month: "
                      : ""}
                    {selectedDataHealth.label}
                  </CardDescription>
                </div>
                <Badge
                  className={
                    selectedDataHealth.status === "Complete"
                      ? "!bg-[#2f5f46] !text-white"
                      : "!bg-amber-100 !text-amber-900"
                  }
                >
                  {selectedDataHealth.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-3">
              {selectedDataHealth.sources.map((source: any) => (
                <div
                  key={source.sourceReportType}
                  className="rounded-md border border-[#deceba] bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#6e5d50]">
                        {source.system} · {source.purpose}
                      </div>
                      <div className="font-medium">{source.label}</div>
                    </div>
                    <Badge variant={source.imported ? "outline" : "secondary"}>
                      {source.imported ? "Imported" : "Missing"}
                    </Badge>
                  </div>
                  {source.imported &&
                    source.sourceReportType !==
                      "stay_reservations_company_names" && (
                      <div className="mt-2 text-sm text-[#5f5247]">
                        {Math.round(source.roomNights).toLocaleString()} rooms ·{" "}
                        {money.format(source.roomRevenue)}
                      </div>
                    )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            [activeYear >= 2026 ? entityLabel : "Accounts", totals.accounts],
            ["Room Nights", Math.round(totals.roomNights).toLocaleString()],
            ["Room Revenue", money.format(totals.roomRevenue)],
            ["ADR", money2.format(totals.adr)],
            ["Average Length of Stay", totals.los.toFixed(1)],
            [
              activeYear >= 2026
                ? `Recurring ${entityLabel}`
                : "Recurring Accounts",
              totals.recurring,
            ],
          ].map(([k, v]) => (
            <Card className={C.shell} key={k}>
              <CardContent className="p-4">
                <div className={`text-sm ${C.muted}`}>{k}</div>
                <div className="mt-1 text-2xl font-semibold">{v}</div>
              </CardContent>
            </Card>
          ))}
        </section>
        <Tabs value={view} onValueChange={setView}>
          <TabsList className="h-auto flex-wrap justify-start bg-[#eadfce]">
            <TabsTrigger value="total">Total</TabsTrigger>
            {marketSegments.map((segment: string) => (
              <TabsTrigger key={segment} value={`segment:${segment}`}>
                {segment}
              </TabsTrigger>
            ))}
            <TabsTrigger value="annual">Annual Planning</TabsTrigger>
          </TabsList>
          <TabsContent value="total">
            <AccountTable
              accounts={visibleAccounts}
              search={search}
              setSearch={setSearch}
              status={status}
              setStatus={setStatus}
              onDetail={setDetail}
              title="Total Market Production"
            />
          </TabsContent>
          {marketSegments.map((segment: string) => (
            <TabsContent key={segment} value={`segment:${segment}`}>
              <AccountTable
                accounts={visibleAccounts}
                search={search}
                setSearch={setSearch}
                status={status}
                setStatus={setStatus}
                onDetail={setDetail}
                title={`${segment} Production`}
              />
            </TabsContent>
          ))}
          <TabsContent value="annual">
            <AnnualPlanning
              accounts={dashboard.data?.accounts || []}
              marketSegments={marketSegments}
            />
          </TabsContent>
        </Tabs>
      </main>
      <UploadDialog
        open={uploadOpen}
        setOpen={setUploadOpen}
        files={files}
        setFiles={(selected: File[]) => {
          setFiles(selected);
          setPreview(null);
          setReplace(false);
        }}
        month={month}
        setMonth={setMonth}
        year={year}
        setYear={setYear}
        preview={preview}
        previewing={previewMutation.isPending}
        importing={importMutation.isPending}
        onPreview={() => previewMutation.mutate()}
        onImport={() => importMutation.mutate()}
        replace={replace}
        reportType={reportType}
        setReportType={setReportType}
      />
      <PlanningDetailDialog account={detail} onClose={() => setDetail(null)} />
      <HistoryDialog
        open={historyOpen}
        setOpen={setHistoryOpen}
        imports={dashboard.data?.imports || []}
        isAdmin={me.data.user.isAdmin}
        onDelete={(id: string) => {
          if (
            confirm(
              "Delete this import and all of its production rows? This cannot be undone.",
            )
          )
            remove.mutate(id);
        }}
      />
    </div>
  );
}

function AccountTable({
  accounts,
  search,
  setSearch,
  status,
  setStatus,
  onDetail,
  recovery = false,
  title = "Account Production",
}: any) {
  return (
    <Card
      className={recovery ? "border-0 bg-transparent shadow-none" : C.shell}
    >
      {!recovery && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            Source rows are aggregated to stable account identities. Default
            sort is room revenue.
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className={recovery ? "p-0" : ""}>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="bg-white pl-9"
              placeholder="Search accounts, IDs, booking office…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {!recovery && (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-48 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Potential Recovery">
                  Potential Recovery
                </SelectItem>
                <SelectItem value="Insufficient Data">
                  Insufficient Data
                </SelectItem>
                <SelectItem value="Identified Prospect">
                  Identified Prospect
                </SelectItem>
                <SelectItem value="Growing">Growing</SelectItem>
                <SelectItem value="Stable">Stable</SelectItem>
                <SelectItem value="Declining">Declining</SelectItem>
                <SelectItem value="Insufficient History">
                  Insufficient History
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[#6e5d50]">
                <th className="p-3">Account / Segment</th>
                <th className="p-3 text-right">Room Nights</th>
                <th className="p-3 text-right">Room Revenue</th>
                <th className="p-3 text-right">ADR</th>
                <th className="p-3 text-right">Avg LOS</th>
                <th className="p-3">Last Production</th>
                <th className="p-3">
                  {recovery ? "Recovery Priority" : "Status"}
                </th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a: any) => (
                <tr
                  key={a.key}
                  className="border-b border-[#eadfce] hover:bg-[#f7f0e5]"
                >
                  <td className="p-3">
                    <button
                      className="font-medium text-[#214f3a] underline-offset-4 hover:underline"
                      onClick={() => onDetail(a)}
                    >
                      {a.displayName}
                    </button>
                    <div className="text-xs text-[#7b6a5d]">
                      {a.highestLevelAccountId &&
                        `UAID ${a.highestLevelAccountId} · `}
                      {a.marketSegment || a.rateProgram || "Account production"}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    {Math.round(a.roomNights).toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-medium">
                    {money.format(a.roomRevenue)}
                  </td>
                  <td className="p-3 text-right">{money2.format(a.adr)}</td>
                  <td className="p-3 text-right">{a.averageLos.toFixed(1)}</td>
                  <td className="p-3">{a.history.at(-1)?.label}</td>
                  <td className="p-3">
                    {recovery ? (
                      <div>
                        <div className="font-semibold">
                          {a.recoveryPriority}
                        </div>
                        <div className="text-xs text-[#7b6a5d]">
                          {a.history.length} months · {a.monthsSinceLast} since
                          last
                        </div>
                      </div>
                    ) : (
                      <Badge
                        variant={
                          a.status === "Potential Recovery"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {a.status}
                      </Badge>
                    )}
                    {a.recurring && !recovery && (
                      <Badge className="ml-2 !bg-[#dcecdf] !text-[#214f3a]">
                        Recurring
                      </Badge>
                    )}
                  </td>
                  <td className="p-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDetail(a)}
                    >
                      <Eye className="mr-1 h-4 w-4" />
                      History
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!accounts.length && (
            <div className="py-12 text-center text-[#6e5d50]">
              No accounts match the selected period and filters.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const STAGES = [
  ["prospect", "Prospect"],
  ["contact_attempted", "Contact Attempted"],
  ["connected", "Connected"],
  ["qualified", "Qualified"],
  ["proposal_sent", "Proposal Sent"],
  ["tentative", "Tentative"],
  ["definite", "Definite / Won"],
  ["lost", "Lost"],
  ["nurture", "Nurture"],
];
const ACTIVITY_TYPES = [
  ["call", "Phone Call"],
  ["email", "Email"],
  ["meeting", "Meeting"],
  ["site_tour", "Site Tour"],
  ["proposal", "Proposal"],
  ["follow_up", "Follow-Up"],
  ["note", "Note"],
];
function mondayValue() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SalesCrm({ hotelId, accounts }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const crm = useQuery({
    queryKey: ["sales-crm", hotelId],
    queryFn: () =>
      json(
        `/api/courtyard/sales-intelligence/crm?hotelId=${encodeURIComponent(hotelId)}`,
      ),
    enabled: !!hotelId,
  });
  const accountOptions = useMemo(() => {
    const options = new Map<string, any>(
      accounts
        .filter(
          (a: any) =>
            (["group", "special", "corporate"].includes(a.reportCategory) ||
              String(a.key).startsWith("stay-company:")) &&
            !String(a.key).startsWith("stay-segment:"),
        )
        .map((a: any) => [a.key, a]),
    );
    for (const opportunity of crm.data?.opportunities || []) {
      if (!options.has(opportunity.normalizedAccountKey)) {
        options.set(opportunity.normalizedAccountKey, {
          key: opportunity.normalizedAccountKey,
          displayName: opportunity.accountName,
          marketSegment: opportunity.marketSegment,
          manual: true,
        });
      }
    }
    return Array.from(options.values()).sort((a: any, b: any) =>
      a.displayName.localeCompare(b.displayName),
    );
  }, [accounts, crm.data?.opportunities]);
  const [accountKey, setAccountKey] = useState("");
  const [crmTab, setCrmTab] = useState("queue");
  const [addingAccount, setAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const selected = accountOptions.find((a: any) => a.key === accountKey);
  const [stage, setStage] = useState("prospect"),
    [nights, setNights] = useState(""),
    [revenue, setRevenue] = useState(""),
    [nextAction, setNextAction] = useState(""),
    [nextActionAt, setNextActionAt] = useState("");
  const [activityAccount, setActivityAccount] = useState(""),
    [activityType, setActivityType] = useState("call"),
    [outcome, setOutcome] = useState(""),
    [details, setDetails] = useState(""),
    [followUp, setFollowUp] = useState("");
  const manualAccountKey = `manual:${newAccountName.trim().toLowerCase().replace(/\s+/g, " ")}`;
  const salesFocus = useMemo(() => {
    const opportunities = crm.data?.opportunities || [];
    const activities = crm.data?.activities || [];
    const contacted = new Set(
      activities.map((activity: any) => activity.normalizedAccountKey),
    );
    const activeOpportunityKeys = new Set(
      opportunities
        .filter(
          (opportunity: any) =>
            !["definite", "lost"].includes(opportunity.stage),
        )
        .map((opportunity: any) => opportunity.normalizedAccountKey),
    );
    const today = new Date();
    const todayKey = today.toLocaleDateString("en-CA");
    return {
      overdue: (crm.data?.queue || []).filter((item: any) => item.overdue),
      dueToday: (crm.data?.queue || []).filter(
        (item: any) =>
          item.nextActionAt &&
          new Date(item.nextActionAt).toLocaleDateString("en-CA") === todayKey,
      ),
      neverContacted: accountOptions
        .filter((account: any) => !contacted.has(account.key))
        .slice(0, 8),
      recurringWithoutOpportunity: accountOptions
        .filter(
          (account: any) =>
            account.recurring &&
            !String(account.key).startsWith("stay-segment:") &&
            !activeOpportunityKeys.has(account.key),
        )
        .slice(0, 8),
      recovery: accountOptions
        .filter((account: any) => account.status === "Potential Recovery")
        .slice(0, 8),
    };
  }, [accountOptions, accounts, crm.data]);
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["sales-crm", hotelId] });
  const createOpportunity = useMutation({
    mutationFn: () =>
      json("/api/courtyard/sales-intelligence/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId,
          normalizedAccountKey: addingAccount ? manualAccountKey : accountKey,
          accountName: addingAccount
            ? newAccountName.trim()
            : selected?.displayName,
          marketSegment: selected?.marketSegment,
          stage,
          estimatedRoomNights: nights,
          estimatedRevenue: revenue,
          nextAction,
          nextActionAt,
        }),
      }),
    onSuccess: () => {
      refresh();
      setAccountKey("");
      setAddingAccount(false);
      setNewAccountName("");
      setNights("");
      setRevenue("");
      setNextAction("");
      setNextActionAt("");
      toast({ title: "Opportunity added to pipeline" });
    },
    onError: (e: Error) =>
      toast({
        title: "Could not add opportunity",
        description: e.message,
        variant: "destructive",
      }),
  });
  const updateOpportunity = useMutation({
    mutationFn: ({ id, stage }: any) =>
      json(`/api/courtyard/sales-intelligence/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      }),
    onSuccess: refresh,
  });
  const logActivity = useMutation({
    mutationFn: () => {
      const account = accountOptions.find(
        (a: any) => a.key === activityAccount,
      );
      return json("/api/courtyard/sales-intelligence/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId,
          normalizedAccountKey: activityAccount,
          accountName: account?.displayName,
          activityType,
          outcome,
          details,
          nextFollowUpAt: followUp,
        }),
      });
    },
    onSuccess: () => {
      refresh();
      setOutcome("");
      setDetails("");
      setFollowUp("");
      toast({ title: "Sales activity logged" });
    },
    onError: (e: Error) =>
      toast({
        title: "Could not log activity",
        description: e.message,
        variant: "destructive",
      }),
  });
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            "Open Opportunities",
            (crm.data?.opportunities || []).filter(
              (x: any) => !["definite", "lost"].includes(x.stage),
            ).length,
          ],
          [
            "Overdue Follow-Ups",
            (crm.data?.queue || []).filter((x: any) => x.overdue).length,
          ],
          [
            "Pipeline Room Nights",
            Math.round(
              (crm.data?.opportunities || [])
                .filter((x: any) => !["lost"].includes(x.stage))
                .reduce(
                  (s: number, x: any) => s + Number(x.estimatedRoomNights || 0),
                  0,
                ),
            ).toLocaleString(),
          ],
          [
            "Pipeline Revenue",
            money.format(
              (crm.data?.opportunities || [])
                .filter((x: any) => !["lost"].includes(x.stage))
                .reduce(
                  (s: number, x: any) => s + Number(x.estimatedRevenue || 0),
                  0,
                ),
            ),
          ],
        ].map(([k, v]) => (
          <Card className={C.shell} key={k}>
            <CardContent className="p-4">
              <div className={C.muted}>{k}</div>
              <div className="text-2xl font-semibold">{v}</div>
            </CardContent>
          </Card>
        ))}
      </section>
      <Card className={C.shell}>
        <CardHeader>
          <CardTitle>Today’s Sales Focus</CardTitle>
          <CardDescription>
            A prioritized working list assembled from production history, CRM
            activity, and scheduled follow-ups.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["Overdue", salesFocus.overdue, "accountName"],
            ["Due Today", salesFocus.dueToday, "accountName"],
            ["Never Contacted", salesFocus.neverContacted, "displayName"],
            [
              "Recurring / No Opportunity",
              salesFocus.recurringWithoutOpportunity,
              "displayName",
            ],
            ["Recovery Candidates", salesFocus.recovery, "displayName"],
          ].map(([label, items, nameField]: any) => (
            <div
              key={label}
              className="rounded-md border border-[#deceba] bg-white p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-semibold">{label}</div>
                <Badge variant="outline">{items.length}</Badge>
              </div>
              <div className="space-y-1 text-sm">
                {items.slice(0, 5).map((item: any) => (
                  <button
                    type="button"
                    key={item.id || item.key}
                    className="block w-full truncate text-left text-[#405f4b] underline-offset-2 hover:underline"
                    onClick={() => {
                      setActivityAccount(item.normalizedAccountKey || item.key);
                      setCrmTab("activity");
                    }}
                  >
                    {item[nameField]}
                  </button>
                ))}
                {!items.length && <div className="text-[#6e5d50]">None</div>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Tabs value={crmTab} onValueChange={setCrmTab}>
        <TabsList>
          <TabsTrigger value="queue">Follow-Up Queue</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="activity">Log Activity</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Report</TabsTrigger>
        </TabsList>
        <TabsContent value="queue">
          <Card className={C.shell}>
            <CardHeader>
              <CardTitle>Follow-Up Queue</CardTitle>
              <CardDescription>
                Overdue items appear first. Every active opportunity should have
                a clear next action.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(crm.data?.queue || []).map((x: any) => (
                  <div
                    key={x.id}
                    className={`grid gap-2 rounded border p-3 sm:grid-cols-[1fr_180px_180px] ${x.overdue ? "border-red-400 bg-red-50" : "border-[#deceba] bg-white"}`}
                  >
                    <div>
                      <div className="font-semibold">{x.accountName}</div>
                      <div className="text-sm text-[#5f5247]">
                        {x.nextAction || "Next action not scheduled"}
                      </div>
                    </div>
                    <div className="text-sm">
                      <div className="text-[#5f5247]">Due</div>
                      {x.nextActionAt
                        ? new Date(x.nextActionAt).toLocaleString()
                        : "Not scheduled"}
                    </div>
                    <Badge className="h-fit w-fit !bg-[#e7f0e9] !text-[#214f3a]">
                      {STAGES.find(([key]) => key === x.stage)?.[1]}
                    </Badge>
                  </div>
                ))}
                {!crm.data?.queue?.length && (
                  <p className={C.muted}>
                    No follow-ups are currently scheduled.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pipeline">
          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <Card className={C.shell}>
              <CardHeader>
                <CardTitle>New Opportunity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {addingAccount ? (
                  <div className="rounded-md border border-[#cdbda8] bg-[#f7f1e7] p-3">
                    <Label>New account name</Label>
                    <Input
                      autoFocus
                      value={newAccountName}
                      onChange={(event) =>
                        setNewAccountName(event.target.value)
                      }
                      placeholder="Company or organization name"
                    />
                    <Button
                      className="mt-2"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAddingAccount(false);
                        setNewAccountName("");
                      }}
                    >
                      Choose Existing Account
                    </Button>
                  </div>
                ) : (
                  <>
                    <AccountSelect
                      accounts={accountOptions}
                      value={accountKey}
                      onChange={setAccountKey}
                    />
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => {
                        setAccountKey("");
                        setAddingAccount(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add New Account
                    </Button>
                  </>
                )}
                <FieldSelect
                  label="Stage"
                  value={stage}
                  onChange={setStage}
                  options={STAGES}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Est. room nights</Label>
                    <Input
                      type="number"
                      value={nights}
                      onChange={(e) => setNights(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Est. revenue</Label>
                    <Input
                      type="number"
                      value={revenue}
                      onChange={(e) => setRevenue(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Next action</Label>
                  <Input
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    placeholder="Call decision maker"
                  />
                </div>
                <div>
                  <Label>Next action date</Label>
                  <Input
                    type="datetime-local"
                    value={nextActionAt}
                    onChange={(e) => setNextActionAt(e.target.value)}
                  />
                </div>
                <Button
                  className={C.green}
                  disabled={
                    (addingAccount ? !newAccountName.trim() : !accountKey) ||
                    createOpportunity.isPending
                  }
                  onClick={() => createOpportunity.mutate()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Opportunity
                </Button>
              </CardContent>
            </Card>
            <Card className={C.shell}>
              <CardHeader>
                <CardTitle>Sales Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="p-2 text-left">Account</th>
                        <th>Stage</th>
                        <th className="text-right">Rooms</th>
                        <th className="text-right">Revenue</th>
                        <th className="p-2 text-left">Next Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(crm.data?.opportunities || []).map((x: any) => (
                        <tr className="border-t" key={x.id}>
                          <td className="p-2 font-medium">{x.accountName}</td>
                          <td>
                            <Select
                              value={x.stage}
                              onValueChange={(value) =>
                                updateOpportunity.mutate({
                                  id: x.id,
                                  stage: value,
                                })
                              }
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STAGES.map(([k, v]) => (
                                  <SelectItem key={k} value={k}>
                                    {v}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="text-right">
                            {Number(x.estimatedRoomNights).toLocaleString()}
                          </td>
                          <td className="text-right">
                            {money.format(Number(x.estimatedRevenue))}
                          </td>
                          <td className="p-2">{x.nextAction || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="activity">
          <Card className={C.shell}>
            <CardHeader>
              <CardTitle>Log Sales Activity</CardTitle>
              <CardDescription>
                Record the effort once; it will feed the account history and
                weekly sales report.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <AccountSelect
                accounts={accountOptions}
                value={activityAccount}
                onChange={setActivityAccount}
              />
              <FieldSelect
                label="Activity type"
                value={activityType}
                onChange={setActivityType}
                options={ACTIVITY_TYPES}
              />
              <div>
                <Label>Outcome</Label>
                <Input
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="Connected, voicemail, proposal requested…"
                />
              </div>
              <div>
                <Label>Next follow-up</Label>
                <Input
                  type="datetime-local"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Details</Label>
                <Textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                />
              </div>
              <div>
                <Button
                  className={C.green}
                  disabled={!activityAccount || logActivity.isPending}
                  onClick={() => logActivity.mutate()}
                >
                  Log Activity
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="weekly">
          <WeeklySalesReport hotelId={hotelId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
function AccountSelect({ accounts, value, onChange }: any) {
  return (
    <div>
      <Label>Account</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Choose an account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((a: any) => (
            <SelectItem key={a.key} value={a.key}>
              {a.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function FieldSelect({ label, value, onChange, options }: any) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([k, v]: string[]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function WeeklySalesReport({ hotelId }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(mondayValue());
  const blank: any = {
    accomplishments: "",
    wins: "",
    challenges: "",
    competitorInfo: "",
    networking: "",
    nextWeekPriorities: "",
    supportNeeded: "",
  };
  const [narrative, setNarrative] = useState(blank);
  const report = useQuery({
    queryKey: ["weekly-sales-report", hotelId, weekStart],
    queryFn: () =>
      json(
        `/api/courtyard/sales-intelligence/weekly-report?hotelId=${encodeURIComponent(hotelId)}&weekStart=${weekStart}`,
      ),
    enabled: !!hotelId && !!weekStart,
  });
  useEffect(
    () =>
      setNarrative({ ...blank, ...(report.data?.report?.narrativeJson || {}) }),
    [report.data],
  );
  const save = useMutation({
    mutationFn: (status: string) =>
      json("/api/courtyard/sales-intelligence/weekly-report", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId, weekStart, narrative, status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["weekly-sales-report", hotelId, weekStart],
      });
      toast({ title: "Weekly sales report saved" });
    },
    onError: (e: Error) =>
      toast({
        title: "Could not save report",
        description: e.message,
        variant: "destructive",
      }),
  });
  const m = report.data?.metrics || { byType: {} };
  const fields = [
    ["Weekly Accomplishments", "accomplishments"],
    ["Major Wins", "wins"],
    ["Challenges / Lost Business", "challenges"],
    ["Competitor Information", "competitorInfo"],
    ["Community / Networking", "networking"],
    ["Priorities for Next Week", "nextWeekPriorities"],
    ["Support Needed from GM", "supportNeeded"],
  ];
  return (
    <Card className={C.shell}>
      <CardHeader>
        <CardTitle>Weekly Sales Report</CardTitle>
        <CardDescription>
          Activity totals are assembled automatically. Add context, save, and
          export the PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>Week starting</Label>
            <Input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </div>
          <Badge variant="outline">
            {report.data?.report?.status || "New Draft"}
          </Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-8">
          {[
            ["Activities", m.totalActivities || 0],
            ["Calls", m.byType?.call || 0],
            ["Emails", m.byType?.email || 0],
            ["Proposals", m.byType?.proposal || 0],
            [
              "Meetings/Tours",
              (m.byType?.meeting || 0) + (m.byType?.site_tour || 0),
            ],
            ["Pipeline Rooms", Math.round(m.pipelineRoomNights || 0)],
            ["Pipeline Revenue", money.format(m.pipelineRevenue || 0)],
            ["Definite / Won", m.won || 0],
          ].map(([k, v]) => (
            <div className="rounded border bg-white p-3" key={k}>
              <div className="text-xs text-[#5f5247]">{k}</div>
              <div className="font-semibold">{v}</div>
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {fields.map(([label, key]) => (
            <div key={key}>
              <Label>{label}</Label>
              <Textarea
                rows={4}
                value={narrative[key] || ""}
                onChange={(e) =>
                  setNarrative((old: any) => ({
                    ...old,
                    [key]: e.target.value,
                  }))
                }
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => save.mutate("draft")}>
            Save Draft
          </Button>
          <Button className={C.green} onClick={() => save.mutate("submitted")}>
            Submit Report
          </Button>
          <Button asChild variant="outline">
            <a
              href={apiUrl(
                `/api/courtyard/sales-intelligence/weekly-report.pdf?hotelId=${encodeURIComponent(hotelId)}&weekStart=${weekStart}`,
              )}
            >
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AnnualPlanning({ accounts, marketSegments }: any) {
  const totalAccounts = accounts.filter(
    (a: any) => a.reportCategory === "total",
  );
  const years = Array.from(
    new Set<number>(
      totalAccounts.flatMap((a: any) => a.history.map((h: any) => h.year)),
    ),
  ).sort((a: any, b: any) => b - a);
  const [year, setYear] = useState(
    String(years[0] || new Date().getFullYear()),
  );
  const segmentRows = marketSegments
    .map((segment: string) => {
      const segmentAccounts = totalAccounts.filter(
        (account: any) => account.marketSegment === segment,
      );
      const history = segmentAccounts.flatMap((a: any) =>
        a.history.filter((h: any) => String(h.year) === year),
      );
      const priorHistory = segmentAccounts.flatMap((a: any) =>
        a.history.filter((h: any) => h.year === Number(year) - 1),
      );
      const roomNights = history.reduce(
          (s: number, h: any) => s + h.roomNights,
          0,
        ),
        roomRevenue = history.reduce(
          (s: number, h: any) => s + h.roomRevenue,
          0,
        ),
        priorRoomRevenue = priorHistory.reduce(
          (s: number, h: any) => s + h.roomRevenue,
          0,
        );
      return {
        segment,
        roomNights,
        roomRevenue,
        adr: roomNights ? roomRevenue / roomNights : 0,
        months: new Set(history.map((h: any) => h.month)).size,
        priorRoomRevenue,
        revenueChange:
          priorRoomRevenue > 0
            ? (roomRevenue - priorRoomRevenue) / priorRoomRevenue
            : null,
      };
    })
    .sort((a: any, b: any) => b.roomRevenue - a.roomRevenue);
  const totals = segmentRows.reduce(
    (o: any, row: any) => ({
      roomNights: o.roomNights + row.roomNights,
      roomRevenue: o.roomRevenue + row.roomRevenue,
    }),
    { roomNights: 0, roomRevenue: 0 },
  );
  return (
    <Card className={C.shell}>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Annual Market Segment Production</CardTitle>
            <CardDescription>
              Budget-planning reference sourced only from comprehensive All
              Market Segments uploads.
            </CardDescription>
          </div>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y: any) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded border bg-[#e7f0e9] p-4">
            <div className={C.muted}>Yearly Room Nights</div>
            <div className="text-2xl font-semibold">
              {Math.round(totals.roomNights).toLocaleString()}
            </div>
          </div>
          <div className="rounded border bg-[#e7f0e9] p-4">
            <div className={C.muted}>Yearly Room Revenue</div>
            <div className="text-2xl font-semibold">
              {money.format(totals.roomRevenue)}
            </div>
          </div>
          <div className="rounded border bg-[#e7f0e9] p-4">
            <div className={C.muted}>Yearly ADR</div>
            <div className="text-2xl font-semibold">
              {money2.format(
                totals.roomNights ? totals.roomRevenue / totals.roomNights : 0,
              )}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-3 text-left">Market Segment</th>
                <th className="text-right">Months Loaded</th>
                <th className="text-right">Room Nights</th>
                <th className="text-right">Room Revenue</th>
                <th className="text-right">Prior Year Revenue</th>
                <th className="text-right">YoY Change</th>
                <th className="p-3 text-right">ADR</th>
              </tr>
            </thead>
            <tbody>
              {segmentRows.map((row: any) => (
                <tr className="border-t" key={row.segment}>
                  <td className="p-3 font-medium">{row.segment}</td>
                  <td className="text-right">{row.months}</td>
                  <td className="text-right">
                    {Math.round(row.roomNights).toLocaleString()}
                  </td>
                  <td className="text-right">
                    {money.format(row.roomRevenue)}
                  </td>
                  <td className="text-right">
                    {money.format(row.priorRoomRevenue)}
                  </td>
                  <td className="text-right">
                    {row.revenueChange == null
                      ? "—"
                      : `${row.revenueChange >= 0 ? "+" : ""}${(row.revenueChange * 100).toFixed(1)}%`}
                  </td>
                  <td className="p-3 text-right">{money2.format(row.adr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function UploadDialog(p: any) {
  const usesStayFormat = Number(p.year) >= 2026;
  return (
    <Dialog open={p.open} onOpenChange={p.setOpen}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Sales Reports</DialogTitle>
          <DialogDescription>
            {usesStayFormat
              ? "Upload the selected monthly STAY report. Hotel Production controls totals; Named Groups builds the prospecting history."
              : "Analytical Account Tracking exports may use .xls even when they contain tab-delimited text. Parsing happens securely on the server."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Production report type</Label>
            {usesStayFormat ? (
              <div className="space-y-2">
                <Select
                  value={p.reportType}
                  onValueChange={(value) => {
                    p.setReportType(value);
                    p.setFiles([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stay_revenue_by_market_segment_with_groups">
                      Hotel Production — Market Segments
                    </SelectItem>
                    <SelectItem value="stay_reservations_company_names">
                      Company Names — Reservations Report
                    </SelectItem>
                    <SelectItem value="stay_group_summary">
                      Named Groups — Group Summary
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="rounded-md border border-[#2f5f46] bg-[#e7f0e9] p-3 text-sm text-[#173b2a]">
                  {p.reportType === "stay_group_summary"
                    ? "Imports group names, booking codes, stay dates, picked-up rooms, revenue, ADR, cutoff dates, and block performance. It does not affect hotel totals."
                    : "Authoritative source for Total, Special Corp/Govt rollups, and every market-segment tab."}
                </div>
              </div>
            ) : (
              <Select value={p.reportType} onValueChange={p.setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="marriott_mint_group_account_tracking">
                    Group Account Production
                  </SelectItem>
                  <SelectItem value="marriott_mint_special_corp_government">
                    Special Corp/Govt Production
                  </SelectItem>
                  <SelectItem value="marriott_mint_all_market_segments">
                    All Market Segments
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            {p.preview && !usesStayFormat && (
              <p className="mt-1 text-xs text-[#5f5247]">
                Suggested from the report's Market Segment:{" "}
                {p.preview.suggestedReportType === "stay_group_summary"
                  ? "STAY Named Groups — Group Summary"
                  : p.preview.suggestedReportType ===
                      "stay_revenue_by_market_segment_with_groups"
                    ? "STAY Revenue by Market Segment with Groups"
                    : p.preview.suggestedReportType ===
                        "marriott_mint_all_market_segments"
                      ? "All Market Segments"
                      : p.preview.suggestedReportType ===
                          "marriott_mint_special_corp_government"
                        ? "Special Corp/Govt"
                        : "Group Account Production"}
                .
              </p>
            )}
          </div>
          <div>
            <Label>Report month</Label>
            <Select value={p.month} onValueChange={p.setMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {new Date(2020, i, 1).toLocaleDateString("en-US", {
                      month: "long",
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Report year</Label>
            <Input
              type="number"
              min="2000"
              max="2100"
              value={p.year}
              onChange={(e) => {
                p.setYear(e.target.value);
                p.setFiles([]);
              }}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>
              {usesStayFormat
                ? "STAY report files (select one or more)"
                : "File (.xls, .xlsx, .csv, .tsv, .txt)"}
            </Label>
            <Input
              key={`${usesStayFormat ? "stay" : "mint"}-${p.reportType}`}
              type="file"
              accept=".xls,.xlsx,.csv,.tsv,.txt"
              multiple={usesStayFormat}
              onChange={(e) => p.setFiles(Array.from(e.target.files || []))}
            />
          </div>
        </div>
        {p.preview && (
          <div className="space-y-3 rounded-lg border bg-[#f7f1e7] p-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{p.preview.detectedDelimiter}-delimited</Badge>
              <Badge variant="outline">{p.preview.rowsFound} rows found</Badge>
              <Badge variant="outline">{p.preview.acceptedRows} accepted</Badge>
              {p.preview.rejectedRows > 0 && (
                <Badge variant="destructive">
                  {p.preview.rejectedRows} rejected
                </Badge>
              )}
              {p.preview.duplicateRows > 0 && (
                <Badge variant="secondary">
                  {p.preview.duplicateRows} duplicate rows skipped
                </Badge>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left">Account</th>
                    <th>
                      {p.preview.reports
                        ? "Source"
                        : p.preview.isGroupSummary
                          ? "Booking Code"
                          : p.preview.isStayFormat
                            ? "Guest Type"
                            : "Booking Office"}
                    </th>
                    <th>Room Nights</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {p.preview.preview.map((r: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2">{r.account}</td>
                      <td>{r.sourceDetail || r.bookingOffice || "—"}</td>
                      <td className="text-right">{r.roomNights}</td>
                      <td className="text-right">
                        {money.format(r.roomRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {p.preview.warnings.length > 0 && (
              <div className="text-xs text-[#6e5d50]">
                Optional columns not present:{" "}
                {p.preview.warnings.slice(0, 6).join(", ")}
                {p.preview.warnings.length > 6 ? "…" : ""}
              </div>
            )}
          </div>
        )}
        {p.replace && (
          <div className="rounded border border-amber-400 bg-amber-50 p-3 text-sm">
            <strong>Replace Month confirmation:</strong> Existing production for
            this month will be marked as replaced and excluded from reports.
            Select Import again to confirm.
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => p.setOpen(false)}>
            Cancel
          </Button>
          {!p.preview ? (
            <Button
              className={C.green}
              disabled={!p.files?.length || p.previewing}
              onClick={p.onPreview}
            >
              {p.previewing ? "Reading report…" : "Validate & Preview"}
            </Button>
          ) : (
            <Button
              className={C.green}
              disabled={p.importing}
              onClick={p.onImport}
            >
              {p.importing
                ? "Importing…"
                : p.replace
                  ? "Confirm Replace Month"
                  : "Import Report"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function PlanningDetailDialog({ account, onClose }: any) {
  if (!account) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account.displayName}</DialogTitle>
          <DialogDescription>
            Read-only production history for planning and prospect research.
            Sales activity remains in IVY.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ["Room Nights", Math.round(account.roomNights).toLocaleString()],
            ["Room Revenue", money.format(account.roomRevenue)],
            ["ADR", money2.format(account.adr)],
            ["Average LOS", account.averageLos.toFixed(1)],
            ["First Production", account.history[0]?.label || "—"],
            ["Most Recent", account.history.at(-1)?.label || "—"],
            ["Market Segment", account.marketSegment || "—"],
            ["Planning Status", account.status || "—"],
          ].map(([label, value]) => (
            <div className="rounded border bg-[#f7f1e7] p-3" key={label}>
              <div className="text-xs text-[#6e5d50]">{label}</div>
              <div className="font-semibold">{value}</div>
            </div>
          ))}
        </div>
        {account.bookings?.length > 0 && (
          <div>
            <h3 className="mb-2 font-semibold">STAY Group Bookings</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2">Stay Dates</th>
                    <th>Booking Code</th>
                    <th className="text-right">Contracted</th>
                    <th className="text-right">Blocked</th>
                    <th className="text-right">Picked Up</th>
                    <th className="p-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {account.bookings.map((booking: any, index: number) => (
                    <tr
                      className="border-b"
                      key={`${booking.bookingCode}-${index}`}
                    >
                      <td className="p-2">
                        {booking.arrivalDate} – {booking.departureDate}
                      </td>
                      <td>{booking.bookingCode || "—"}</td>
                      <td className="text-right">
                        {booking.contractedRoomNights}
                      </td>
                      <td className="text-right">
                        {booking.blockedRoomNights}
                      </td>
                      <td className="text-right font-medium">
                        {booking.pickedUpRoomNights}
                      </td>
                      <td className="p-2 text-right">
                        {money.format(booking.roomRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div>
          <h3 className="mb-2 font-semibold">Monthly Production History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Month</th>
                  <th className="text-right">Room Nights</th>
                  <th className="text-right">Revenue</th>
                  <th className="p-2 text-right">ADR</th>
                </tr>
              </thead>
              <tbody>
                {account.history.map((history: any) => (
                  <tr className="border-b" key={history.index}>
                    <td className="p-2">{history.label}</td>
                    <td className="text-right">
                      {Math.round(history.roomNights)}
                    </td>
                    <td className="text-right">
                      {money.format(history.roomRevenue)}
                    </td>
                    <td className="p-2 text-right">
                      {money2.format(history.adr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({ account, hotelId, onClose }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const accountUrl = account
    ? `/api/courtyard/sales-intelligence/accounts/${encodeURIComponent(account.key)}`
    : "";
  const crm = useQuery({
    queryKey: ["sales-account-crm", hotelId, account?.key],
    queryFn: () => json(`${accountUrl}?hotelId=${encodeURIComponent(hotelId)}`),
    enabled: Boolean(
      account && hotelId && !String(account.key).startsWith("stay-segment:"),
    ),
  });
  useEffect(() => {
    if (!crm.data?.profile) return;
    setContactName(crm.data.profile.contactName || "");
    setPhone(crm.data.profile.phone || "");
    setEmail(crm.data.profile.email || "");
  }, [crm.data]);
  const refreshCrm = () =>
    qc.invalidateQueries({
      queryKey: ["sales-account-crm", hotelId, account?.key],
    });
  const saveContact = useMutation({
    mutationFn: () =>
      json(accountUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId, contactName, phone, email }),
      }),
    onSuccess: () => {
      refreshCrm();
      toast({ title: "Contact information saved" });
    },
    onError: (error: Error) =>
      toast({
        title: "Could not save contact",
        description: error.message,
        variant: "destructive",
      }),
  });
  const addNote = useMutation({
    mutationFn: () =>
      json(`${accountUrl}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId, note }),
      }),
    onSuccess: () => {
      setNote("");
      refreshCrm();
      toast({ title: "Contact note added" });
    },
    onError: (error: Error) =>
      toast({
        title: "Could not add note",
        description: error.message,
        variant: "destructive",
      }),
  });
  if (!account) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account.displayName}</DialogTitle>
          <DialogDescription>
            {account.highestLevelAccountId
              ? `Highest-level UAID ${account.highestLevelAccountId}`
              : "Matched using normalized account name"}
          </DialogDescription>
        </DialogHeader>
        {String(account.key).startsWith("stay-segment:") ? (
          <div className="rounded-md border border-[#b98435] bg-[#fff4dc] p-4 text-sm text-[#4d3514]">
            <div className="font-semibold">STAY segment-level production</div>
            <div>
              This report does not contain individual company or group names.
              Use the historical MINT accounts or add a manual CRM prospect for
              contact tracking.
            </div>
          </div>
        ) : (
          <Card className={C.shell}>
            <CardHeader>
              <CardTitle className="text-xl">Sales Contact</CardTitle>
              <CardDescription>
                Contact details and dated outreach activity are shared across
                this account's production history.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Contact name</Label>
                  <Input
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    placeholder="Name"
                  />
                </div>
                <div>
                  <Label>Phone number</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="(512) 555-0123"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="contact@company.com"
                  />
                </div>
              </div>
              <Button
                className={C.green}
                disabled={saveContact.isPending}
                onClick={() => saveContact.mutate()}
              >
                {saveContact.isPending ? "Saving…" : "Save Contact"}
              </Button>
              <div className="border-t border-[#deceba] pt-4">
                <Label>New contact note</Label>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Called and left a voicemail regarding fall group dates…"
                  rows={3}
                />
                <Button
                  className={`mt-2 ${C.green}`}
                  disabled={!note.trim() || addNote.isPending}
                  onClick={() => addNote.mutate()}
                >
                  {addNote.isPending ? "Adding…" : "Add Dated Note"}
                </Button>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Contact History</h3>
                {crm.data?.notes?.map((item: any) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-[#deceba] bg-white p-3"
                  >
                    <div className="mb-1 text-xs font-medium text-[#6e5d50]">
                      {new Date(item.createdAt).toLocaleString()}
                    </div>
                    <div className="whitespace-pre-wrap text-sm">
                      {item.note}
                    </div>
                  </div>
                ))}
                {!crm.isLoading && !crm.data?.notes?.length && (
                  <p className="text-sm text-[#6e5d50]">
                    No outreach notes yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            [
              "Lifetime Room Nights",
              Math.round(account.roomNights).toLocaleString(),
            ],
            ["Lifetime Revenue", money.format(account.roomRevenue)],
            ["Weighted ADR", money2.format(account.adr)],
            ["Average LOS", account.averageLos.toFixed(1)],
            ["First Production", account.history[0]?.label],
            ["Most Recent", account.history.at(-1)?.label],
            ["Market Segment", account.marketSegment || "—"],
            ["Rate Program", account.rateProgram || "—"],
          ].map(([k, v]) => (
            <div className="rounded border bg-[#f7f1e7] p-3" key={k}>
              <div className="text-xs text-[#6e5d50]">{k}</div>
              <div className="font-semibold">{v}</div>
            </div>
          ))}
        </div>
        <div>
          {account.bookings?.length > 0 && (
            <div className="mb-5">
              <h3 className="mb-2 font-semibold">STAY Group Bookings</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">Stay Dates</th>
                      <th>Booking Code</th>
                      <th>Profile</th>
                      <th className="text-right">Contracted</th>
                      <th className="text-right">Blocked</th>
                      <th className="text-right">Picked Up</th>
                      <th className="text-right">Revenue</th>
                      <th className="p-2">Released</th>
                    </tr>
                  </thead>
                  <tbody>
                    {account.bookings.map((booking: any, index: number) => (
                      <tr
                        className="border-b"
                        key={`${booking.bookingCode}-${booking.arrivalDate}-${index}`}
                      >
                        <td className="p-2">
                          {booking.arrivalDate} – {booking.departureDate}
                        </td>
                        <td>{booking.bookingCode || "—"}</td>
                        <td>{booking.profile || "—"}</td>
                        <td className="text-right">
                          {booking.contractedRoomNights}
                        </td>
                        <td className="text-right">
                          {booking.blockedRoomNights}
                        </td>
                        <td className="text-right font-medium">
                          {booking.pickedUpRoomNights}
                        </td>
                        <td className="text-right">
                          {money.format(booking.roomRevenue)}
                        </td>
                        <td className="p-2">
                          {booking.released ? "Yes" : "No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <h3 className="mb-2 font-semibold">Monthly Room Revenue</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={account.history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: any) => money.format(v)} />
                <Bar
                  dataKey="roomRevenue"
                  fill="#2f5f46"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Month</th>
              <th className="text-right">Room Nights</th>
              <th className="text-right">Revenue</th>
              <th className="text-right">ADR</th>
              <th className="p-2">Booking Offices</th>
            </tr>
          </thead>
          <tbody>
            {account.history.map((h: any) => (
              <tr className="border-b" key={h.index}>
                <td className="p-2">{h.label}</td>
                <td className="text-right">{Math.round(h.roomNights)}</td>
                <td className="text-right">{money.format(h.roomRevenue)}</td>
                <td className="text-right">{money2.format(h.adr)}</td>
                <td className="p-2 text-xs">
                  {h.bookingOffices.join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}
function HistoryDialog({ open, setOpen, imports, isAdmin, onDelete }: any) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import History</DialogTitle>
          <DialogDescription>
            Every upload retains its filename, validation summary, checksum, and
            raw source rows.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Period / File</th>
                <th>Rows</th>
                <th>Accounts</th>
                <th>Room Nights</th>
                <th>Revenue</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {imports.map((x: any) => (
                <tr className="border-b" key={x.id}>
                  <td className="p-2">
                    <div>
                      {new Date(
                        x.reportYear,
                        x.reportMonth - 1,
                      ).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                    <div className="max-w-64 truncate text-xs text-[#6e5d50]">
                      {x.originalFilename}
                    </div>
                    <div className="text-xs font-medium text-[#2f5f46]">
                      {x.system ? `${x.system} · ` : ""}
                      {x.label || x.sourceReportType}
                    </div>
                    <div className="text-xs text-[#6e5d50]">
                      {x.purpose || "Historical Sales Intelligence"}
                    </div>
                  </td>
                  <td>
                    {x.acceptedRowCount}
                    {x.rejectedRowCount
                      ? ` (${x.rejectedRowCount} rejected)`
                      : ""}
                  </td>
                  <td>{x.accounts}</td>
                  <td>{Math.round(x.roomNights).toLocaleString()}</td>
                  <td>{money.format(x.roomRevenue)}</td>
                  <td>
                    <Badge
                      variant={
                        x.status === "completed" ? "outline" : "secondary"
                      }
                    >
                      {x.status}
                    </Badge>
                  </td>
                  <td>
                    {isAdmin && x.status === "completed" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Delete import"
                        onClick={() => onDelete(x.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!imports.length && (
            <div className="py-10 text-center text-[#6e5d50]">
              No reports have been imported yet.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
