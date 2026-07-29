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
  TrendingUp,
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
  const [view, setView] = useState("production");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detail, setDetail] = useState<Account | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [preview, setPreview] = useState<any>(null);
  const [replace, setReplace] = useState(false);
  const [reportType, setReportType] = useState(
    "marriott_mint_group_account_tracking",
  );
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
      if (!file) throw new Error("Choose a report file.");
      const f = new FormData();
      f.append("file", file);
      return json("/api/courtyard/sales-intelligence/preview", {
        method: "POST",
        body: f,
      });
    },
    onSuccess: (result) => {
      setPreview(result);
      setReportType(result.suggestedReportType);
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
      if (!file) throw new Error("Choose a report file.");
      const f = new FormData();
      f.append("file", file);
      f.append("hotelId", selectedHotel);
      f.append("reportMonth", month);
      f.append("reportYear", year);
      f.append("reportType", reportType);
      f.append("replace", String(replace));
      return json("/api/courtyard/sales-intelligence/import", {
        method: "POST",
        body: f,
      });
    },
    onSuccess: (r) => {
      toast({
        title: `${r.label} imported successfully`,
        description: `${r.accounts} accounts · ${r.roomNights.toLocaleString()} room nights · ${money.format(r.roomRevenue)}`,
      });
      setUploadOpen(false);
      setPreview(null);
      setFile(null);
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
  const accounts = useMemo(() => {
    let rows = (dashboard.data?.accounts || []) as Account[];
    if (period !== "all") {
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
                status: a.firstPeriod === h.index ? "New" : a.status,
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
  }, [dashboard.data, period, search, status]);
  const groupAccounts = accounts.filter(
    (account) => account.reportCategory === "group",
  );
  const specialAccounts = accounts.filter(
    (account) => account.reportCategory === "special",
  );
  const marketSegments = dashboard.data?.marketSegments || [];
  const visibleAccounts =
    view === "special"
      ? specialAccounts
      : view === "total"
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
  const selectedPeriodLabel =
    period === "all"
      ? "All Imported Months"
      : new Date(
          Number(period.split("-")[0]),
          Number(period.split("-")[1]) - 1,
          1,
        ).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const latestImportedLabel = dashboard.data?.periods?.[0]?.label;
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
              Review historical Marriott account production, track monthly
              trends, and identify business that may need recovery outreach.
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
              Upload MINT Report
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
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-52 bg-white">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All imported months</SelectItem>
              {dashboard.data?.periods.map((p: any) => (
                <SelectItem
                  key={`${p.year}-${p.month}`}
                  value={`${p.year}-${p.month}`}
                >
                  {p.label}
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
            {period === "all" && latestImportedLabel && (
              <div className="text-sm font-medium text-[#405f4b]">
                Latest imported month: {latestImportedLabel}
              </div>
            )}
          </CardContent>
        </Card>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ["Accounts", totals.accounts],
            ["Room Nights", Math.round(totals.roomNights).toLocaleString()],
            ["Room Revenue", money.format(totals.roomRevenue)],
            ["ADR", money2.format(totals.adr)],
            ["Average Length of Stay", totals.los.toFixed(1)],
            ["Recurring Accounts", totals.recurring],
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
            <TabsTrigger value="production">Groups</TabsTrigger>
            <TabsTrigger value="recovery">Recovery Opportunities</TabsTrigger>
            <TabsTrigger value="special">Special Corp/Govt</TabsTrigger>
            <TabsTrigger value="total">Total</TabsTrigger>
            {marketSegments.map((segment: string) => (
              <TabsTrigger key={segment} value={`segment:${segment}`}>
                {segment}
              </TabsTrigger>
            ))}
            <TabsTrigger value="crm">Sales CRM</TabsTrigger>
            <TabsTrigger value="annual">Annual Planning</TabsTrigger>
          </TabsList>
          <TabsContent value="production">
            <AccountTable
              accounts={groupAccounts}
              search={search}
              setSearch={setSearch}
              status={status}
              setStatus={setStatus}
              onDetail={setDetail}
            />
          </TabsContent>
          <TabsContent value="recovery">
            <Card className={C.shell}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#8a6b3f]" />
                  Recovery Opportunities
                </CardTitle>
                <CardDescription>
                  Accounts with no production in the last{" "}
                  {me.data.recoveryThresholdMonths} completed imported months,
                  ranked by transparent historical value and consistency.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AccountTable
                  accounts={groupAccounts
                    .filter((a) => a.status === "Potential Recovery")
                    .sort((a, b) => b.recoveryPriority - a.recoveryPriority)}
                  search={search}
                  setSearch={setSearch}
                  status="all"
                  setStatus={() => {}}
                  onDetail={setDetail}
                  recovery
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="special">
            <AccountTable
              accounts={specialAccounts}
              search={search}
              setSearch={setSearch}
              status={status}
              setStatus={setStatus}
              onDetail={setDetail}
              title="Special Corp/Govt Production"
            />
          </TabsContent>
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
          <TabsContent value="crm">
            <SalesCrm
              hotelId={selectedHotel}
              accounts={dashboard.data?.accounts || []}
            />
          </TabsContent>
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
        file={file}
        setFile={(f: File | null) => {
          setFile(f);
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
      <DetailDialog
        account={detail}
        hotelId={selectedHotel}
        onClose={() => setDetail(null)}
      />
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
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[#6e5d50]">
                <th className="p-3">Account</th>
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
  const accountOptions = useMemo(
    () =>
      Array.from(
        new Map<string, any>(
          accounts
            .filter((a: any) => ["group", "special"].includes(a.reportCategory))
            .map((a: any) => [a.key, a]),
        ).values(),
      ).sort((a: any, b: any) => a.displayName.localeCompare(b.displayName)),
    [accounts],
  );
  const [accountKey, setAccountKey] = useState("");
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
  const crm = useQuery({
    queryKey: ["sales-crm", hotelId],
    queryFn: () =>
      json(
        `/api/courtyard/sales-intelligence/crm?hotelId=${encodeURIComponent(hotelId)}`,
      ),
    enabled: !!hotelId,
  });
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["sales-crm", hotelId] });
  const createOpportunity = useMutation({
    mutationFn: () =>
      json("/api/courtyard/sales-intelligence/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId,
          normalizedAccountKey: accountKey,
          accountName: selected?.displayName,
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
      <Tabs defaultValue="queue">
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
                <AccountSelect
                  accounts={accountOptions}
                  value={accountKey}
                  onChange={setAccountKey}
                />
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
                  disabled={!accountKey || createOpportunity.isPending}
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
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Activities", m.totalActivities || 0],
            ["Calls", m.byType?.call || 0],
            ["Emails", m.byType?.email || 0],
            [
              "Meetings/Tours",
              (m.byType?.meeting || 0) + (m.byType?.site_tour || 0),
            ],
            ["Pipeline Rooms", Math.round(m.pipelineRoomNights || 0)],
            ["Pipeline Revenue", money.format(m.pipelineRevenue || 0)],
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
      const segmentAccounts = accounts.filter(
        (a: any) => a.reportCategory === `segment:${segment}`,
      );
      const history = segmentAccounts.flatMap((a: any) =>
        a.history.filter((h: any) => String(h.year) === year),
      );
      const roomNights = history.reduce(
          (s: number, h: any) => s + h.roomNights,
          0,
        ),
        roomRevenue = history.reduce(
          (s: number, h: any) => s + h.roomRevenue,
          0,
        );
      return {
        segment,
        roomNights,
        roomRevenue,
        adr: roomNights ? roomRevenue / roomNights : 0,
        months: new Set(history.map((h: any) => h.month)).size,
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
  return (
    <Dialog open={p.open} onOpenChange={p.setOpen}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload MINT Report</DialogTitle>
          <DialogDescription>
            Analytical Account Tracking exports may use .xls even when they
            contain tab-delimited text. Parsing happens securely on the server.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Production report type</Label>
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
            {p.preview && (
              <p className="mt-1 text-xs text-[#5f5247]">
                Suggested from the report's Market Segment:{" "}
                {p.preview.suggestedReportType ===
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
              onChange={(e) => p.setYear(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>File (.xls, .csv, .tsv, .txt)</Label>
            <Input
              type="file"
              accept=".xls,.csv,.tsv,.txt"
              onChange={(e) => p.setFile(e.target.files?.[0] || null)}
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
                    <th>Booking Office</th>
                    <th>Room Nights</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {p.preview.preview.map((r: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2">{r.account}</td>
                      <td>{r.bookingOffice}</td>
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
              disabled={!p.file || p.previewing}
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
    enabled: Boolean(account && hotelId),
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
        <Card className={C.shell}>
          <CardHeader>
            <CardTitle className="text-xl">Sales Contact</CardTitle>
            <CardDescription>
              Contact details and dated outreach activity are shared across this
              account's production history.
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
                  <div className="whitespace-pre-wrap text-sm">{item.note}</div>
                </div>
              ))}
              {!crm.isLoading && !crm.data?.notes?.length && (
                <p className="text-sm text-[#6e5d50]">No outreach notes yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
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
                      {x.sourceReportType ===
                      "marriott_mint_all_market_segments"
                        ? "All Market Segments"
                        : x.sourceReportType ===
                            "marriott_mint_special_corp_government"
                          ? "Special Corp/Govt"
                          : "Group Account Production"}
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
