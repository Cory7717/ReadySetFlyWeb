import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, KeyRound, Plus, Printer, Save, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const C = {
  page: "min-h-screen bg-[#f3efe7] text-[#201814]",
  shell: "!border-[#d7c8b5] !bg-[#fffaf2] !bg-none !text-[#201814] shadow-[0_18px_45px_rgba(72,52,31,0.10)]",
  card: "!border-[#d7c8b5] !bg-white !bg-none !text-[#201814]",
  panel: "rounded-xl border border-[#e0d3c1] bg-[#fbf6ee] p-4",
  field: "!border-[#cdbda8] !bg-white !text-[#201814] placeholder:!text-[#76695d]",
  green: "!bg-[#2f5f46] !bg-none !text-white hover:!bg-[#274d39]",
  dark: "!border-[#1f2937] !bg-[#1f2937] !bg-none !text-white hover:!bg-[#111827]",
  outline: "!border-[#cdbda8] !bg-white !bg-none !text-[#201814] hover:!bg-[#f8efe2]",
  muted: "!text-[#5f5247]",
  menu: "!border-[#cdbda8] !bg-white !text-[#201814]",
};

type Stage = "Inquiry" | "Prospect" | "Proposal" | "Definite" | "Turned Down";
type Potential = "High" | "Medium" | "Low";

type ActivityRow = {
  id: string;
  name: string;
  inquiryDate: string;
  meetingRoom: "Yes" | "No";
  rooms: string;
  arrival: string;
  departure: string;
  stage: Stage;
  dueDate: string;
  remarks: string;
  revenueImpact: string;
};

type WeeklyItem = {
  id: string;
  company: string;
  result: string;
  potential: Potential;
};

type BusinessRow = {
  id: string;
  company: string;
  status: string;
  arrival: string;
  departure: string;
  roomNights: string;
  roomRevenue: string;
  otherRevenue: string;
  salesPerson: string;
  comments: string;
};

type AccountRow = {
  id: string;
  name: string;
  segment: string;
  monthRn: string;
  monthRevenue: string;
  ytdRn: string;
  ytdRevenue: string;
  salesPerson: string;
  comments: string;
};

type ContractRow = {
  id: string;
  company: string;
  segment: string;
  channel: string;
  begins: string;
  ends: string;
  targetRn: string;
  targetRevenue: string;
  rate: string;
  salesPerson: string;
  comments: string;
};

type InitiativeRow = {
  id: string;
  activity: string;
  segment: string;
  cost: string;
  expectedRevenue: string;
  date: string;
};

type DosReport = {
  meta: {
    hotelCode: string;
    hotelName: string;
    reportMonth: string;
    preparedBy: string;
    issuedDate: string;
  };
  weekly: Array<{ calls: WeeklyItem[]; activities: WeeklyItem[] }>;
  monthlyActivities: ActivityRow[];
  topAccounts: {
    corporate: AccountSummaryRow[];
    agencies: AccountSummaryRow[];
    otas: AccountSummaryRow[];
  };
  materialized: BusinessRow[];
  lost: BusinessRow[];
  corporateAccounts: AccountRow[];
  leisureAccounts: AccountRow[];
  contracts: ContractRow[];
  pipeline: BusinessRow[];
  initiatives: InitiativeRow[];
  executiveSummary: string;
};

type AccountSummaryRow = {
  id: string;
  name: string;
  roomNights: string;
  adr: string;
  revenue: string;
};

function id() {
  return Math.random().toString(36).slice(2, 10);
}

const stages: Stage[] = ["Inquiry", "Prospect", "Proposal", "Definite", "Turned Down"];
const potentials: Potential[] = ["High", "Medium", "Low"];

const emptyWeeklyItem = (): WeeklyItem => ({ id: id(), company: "", result: "", potential: "Medium" });
const emptyActivity = (): ActivityRow => ({
  id: id(),
  name: "",
  inquiryDate: "",
  meetingRoom: "No",
  rooms: "",
  arrival: "",
  departure: "",
  stage: "Inquiry",
  dueDate: "",
  remarks: "",
  revenueImpact: "",
});
const emptyBusiness = (): BusinessRow => ({ id: id(), company: "", status: "", arrival: "", departure: "", roomNights: "", roomRevenue: "", otherRevenue: "", salesPerson: "", comments: "" });
const emptyAccount = (): AccountRow => ({ id: id(), name: "", segment: "", monthRn: "", monthRevenue: "", ytdRn: "", ytdRevenue: "", salesPerson: "", comments: "" });
const emptySummaryAccount = (): AccountSummaryRow => ({ id: id(), name: "", roomNights: "", adr: "", revenue: "" });
const emptyContract = (): ContractRow => ({ id: id(), company: "", segment: "", channel: "", begins: "", ends: "", targetRn: "", targetRevenue: "", rate: "", salesPerson: "", comments: "" });
const emptyInitiative = (): InitiativeRow => ({ id: id(), activity: "", segment: "", cost: "", expectedRevenue: "", date: "" });

function seedRows<T>(factory: () => T, count: number) {
  return Array.from({ length: count }, factory);
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function defaultReport(): DosReport {
  return {
    meta: {
      hotelCode: "AUSNL",
      hotelName: "Courtyard Austin Lakeline",
      reportMonth: currentMonth(),
      preparedBy: "",
      issuedDate: new Date().toISOString().slice(0, 10),
    },
    weekly: Array.from({ length: 4 }, () => ({ calls: seedRows(emptyWeeklyItem, 5), activities: seedRows(emptyWeeklyItem, 5) })),
    monthlyActivities: seedRows(emptyActivity, 8),
    topAccounts: {
      corporate: seedRows(emptySummaryAccount, 10),
      agencies: seedRows(emptySummaryAccount, 10),
      otas: seedRows(emptySummaryAccount, 5),
    },
    materialized: seedRows(emptyBusiness, 5),
    lost: seedRows(emptyBusiness, 5),
    corporateAccounts: seedRows(emptyAccount, 5),
    leisureAccounts: seedRows(emptyAccount, 5),
    contracts: seedRows(emptyContract, 5),
    pipeline: seedRows(emptyBusiness, 5),
    initiatives: seedRows(emptyInitiative, 5),
    executiveSummary: "",
  };
}

function money(value: string | number) {
  const n = Number(String(value || "").replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(value: string | number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(money(value));
}

function fmtNumber(value: string | number) {
  const n = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function totalBusiness(rows: BusinessRow[], key: "roomNights" | "roomRevenue" | "otherRevenue") {
  return rows.reduce((sum, row) => sum + (key === "roomNights" ? fmtNumber(row[key]) : money(row[key])), 0);
}

function stageCounts(rows: ActivityRow[]) {
  return stages.reduce<Record<Stage, number>>((acc, stage) => {
    acc[stage] = rows.filter((row) => row.name.trim() && row.stage === stage).length;
    return acc;
  }, {} as Record<Stage, number>);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(apiUrl(url), { credentials: "include" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function useSavedReport() {
  const [report, setReport] = useState<DosReport>(() => {
    try {
      const saved = window.localStorage.getItem("courtyard-dos-report-v1");
      return saved ? { ...defaultReport(), ...JSON.parse(saved) } : defaultReport();
    } catch {
      return defaultReport();
    }
  });

  useEffect(() => {
    window.localStorage.setItem("courtyard-dos-report-v1", JSON.stringify(report));
  }, [report]);

  return [report, setReport] as const;
}

function PinGate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const login = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tips/shared-pin/login", { pin }),
    onSuccess: () => {
      toast({ title: "DOS reporting unlocked" });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/shared-pin/status"] });
    },
    onError: (error: Error) => toast({ title: "Unable to unlock", description: error.message, variant: "destructive" }),
  });

  return (
    <div className={C.page}>
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-8">
        <Card className={`w-full ${C.shell}`}>
          <CardHeader>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Sales Reporting</div>
            <CardTitle className="text-3xl">Enter team PIN</CardTitle>
            <CardDescription className={C.muted}>
              Use the same 5 digit shared Courtyard PIN used for protected team tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              className={`${C.field} h-14 text-center text-2xl tracking-[0.35em]`}
              inputMode="numeric"
              maxLength={5}
              placeholder="00000"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 5))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && pin.length === 5) login.mutate();
              }}
            />
            <Button className={`w-full ${C.green}`} disabled={pin.length !== 5 || login.isPending} onClick={() => login.mutate()}>
              <KeyRound className="mr-2 h-4 w-4" />
              {login.isPending ? "Checking PIN..." : "Open DOS reporting"}
            </Button>
            <Button asChild variant="ghost" className="w-full text-[#5f5247]">
              <a href="/courtyard">Back to Courtyard portal</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function LoginRequired() {
  return (
    <div className={C.page}>
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-8">
        <Card className={`w-full ${C.shell}`}>
          <CardHeader>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Sales Reporting</div>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription className={C.muted}>Use the Courtyard Associate Portal first, then return here to enter the shared PIN.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className={`w-full ${C.green}`}>
              <a href="/courtyard">Go to Courtyard portal</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function TextCell({ value, onChange, placeholder, textarea = false }: { value: string; onChange: (value: string) => void; placeholder?: string; textarea?: boolean }) {
  if (textarea) {
    return <Textarea className={`min-h-[72px] ${C.field}`} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
  }
  return <Input className={C.field} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

function CompactSelect<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (value: T) => void }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
      <SelectContent className={C.menu}>
        {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function SectionHeader({ title, description, right }: { title: string; description?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {description && <p className={`mt-1 text-sm ${C.muted}`}>{description}</p>}
      </div>
      {right}
    </div>
  );
}

function AddButton({ onClick, label = "Add row" }: { onClick: () => void; label?: string }) {
  return (
    <Button type="button" size="sm" variant="outline" className={C.outline} onClick={onClick}>
      <Plus className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}

function RowDelete({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" size="icon" variant="ghost" className="text-[#8a4a36] hover:bg-[#f8e5dd]" onClick={onClick} aria-label="Remove row">
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

export default function DosReportingPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [report, setReport] = useSavedReport();
  const access = useQuery<{ unlocked: boolean; hasPin: boolean; requiresLogin?: boolean }>({
    queryKey: ["/api/tips/shared-pin/status"],
    queryFn: () => fetchJson("/api/tips/shared-pin/status"),
  });
  const counts = useMemo(() => stageCounts(report.monthlyActivities), [report.monthlyActivities]);
  const activeActivities = report.monthlyActivities.filter((row) => row.name.trim()).length;
  const definiteRooms = report.monthlyActivities.filter((row) => row.stage === "Definite").reduce((sum, row) => sum + fmtNumber(row.rooms), 0);
  const pipelineRevenue = report.pipeline.reduce((sum, row) => sum + money(row.roomRevenue) + money(row.otherRevenue), 0);

  const update = (patch: Partial<DosReport>) => setReport({ ...report, ...patch });
  const updateMeta = (key: keyof DosReport["meta"], value: string) => update({ meta: { ...report.meta, [key]: value } });

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dos-report-${report.meta.reportMonth || "draft"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const logout = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tips/kiosk/logout"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tips/shared-pin/status"] }),
  });

  if (access.isLoading) return <div className={`${C.page} p-8`}>Loading DOS reporting...</div>;
  if (access.data?.requiresLogin) return <LoginRequired />;
  if (!access.data?.unlocked) return <PinGate />;

  return (
    <div className={C.page}>
      <header className="border-b border-[#deceba] bg-[#fffaf2]/95 px-4 py-4 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Lakeline</div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">DOS Sales Activities Report</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className={C.outline} onClick={() => toast({ title: "Draft saved", description: "This browser has the latest report draft." })}>
              <Save className="mr-2 h-4 w-4" />
              Save draft
            </Button>
            <Button variant="outline" className={C.outline} onClick={downloadJson}>
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
            <Button variant="outline" className={C.outline} onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print / PDF
            </Button>
            <Button variant="outline" className={C.outline} onClick={() => logout.mutate()}>Lock</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 print:max-w-none">
        <Card className={C.shell}>
          <CardHeader>
            <CardTitle>Report Header</CardTitle>
            <CardDescription className={C.muted}>Matches the hotel, month, and accountability information from the workbook cover/monthly tabs.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-5">
            <div><Label>Hotel code</Label><Input className={C.field} value={report.meta.hotelCode} onChange={(event) => updateMeta("hotelCode", event.target.value)} /></div>
            <div className="md:col-span-2"><Label>Hotel name</Label><Input className={C.field} value={report.meta.hotelName} onChange={(event) => updateMeta("hotelName", event.target.value)} /></div>
            <div><Label>Report month</Label><Input className={C.field} type="month" value={report.meta.reportMonth} onChange={(event) => updateMeta("reportMonth", event.target.value)} /></div>
            <div><Label>Issued date</Label><Input className={C.field} type="date" value={report.meta.issuedDate} onChange={(event) => updateMeta("issuedDate", event.target.value)} /></div>
            <div className="md:col-span-2"><Label>Prepared by</Label><Input className={C.field} value={report.meta.preparedBy} onChange={(event) => updateMeta("preparedBy", event.target.value)} /></div>
            <div className="md:col-span-3"><Label>Executive summary / corporate callout</Label><Textarea className={`min-h-[80px] ${C.field}`} value={report.executiveSummary} onChange={(event) => update({ executiveSummary: event.target.value })} /></div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-5">
          {stages.map((stage) => (
            <Card key={stage} className={C.card}>
              <CardContent className="p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b5f54]">{stage}</div>
                <div className="mt-2 text-3xl font-bold">{counts[stage] || 0}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className={C.card}><CardContent className="p-4"><div className={C.muted}>Active monthly activities</div><div className="text-2xl font-bold">{activeActivities}</div></CardContent></Card>
          <Card className={C.card}><CardContent className="p-4"><div className={C.muted}>Definite room nights</div><div className="text-2xl font-bold">{definiteRooms}</div></CardContent></Card>
          <Card className={C.card}><CardContent className="p-4"><div className={C.muted}>Future pipeline revenue</div><div className="text-2xl font-bold">{fmtMoney(pipelineRevenue)}</div></CardContent></Card>
        </div>

        <Tabs defaultValue="weekly" className="space-y-6">
          <TabsList className="grid h-auto grid-cols-2 bg-[#e8dccb] p-1 md:grid-cols-5 print:hidden">
            <TabsTrigger value="weekly">Weekly Logs</TabsTrigger>
            <TabsTrigger value="monthly">Monthly Pipeline</TabsTrigger>
            <TabsTrigger value="accounts">Top Accounts</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="future">Future Business</TabsTrigger>
          </TabsList>

          <TabsContent value="weekly" className="space-y-6">
            {report.weekly.map((week, weekIndex) => (
              <Card className={C.shell} key={weekIndex}>
                <CardHeader>
                  <CardTitle>Week {weekIndex + 1}</CardTitle>
                  <CardDescription className={C.muted}>Workbook sections: Weekly Sales Call and Sales Activities.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 lg:grid-cols-2">
                  <WeeklyTable
                    title="Weekly Sales Call"
                    rows={week.calls}
                    onChange={(rows) => {
                      const weekly = report.weekly.map((item, index) => index === weekIndex ? { ...item, calls: rows } : item);
                      update({ weekly });
                    }}
                  />
                  <WeeklyTable
                    title="Sales Activities"
                    rows={week.activities}
                    onChange={(rows) => {
                      const weekly = report.weekly.map((item, index) => index === weekIndex ? { ...item, activities: rows } : item);
                      update({ weekly });
                    }}
                  />
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="monthly">
            <Card className={C.shell}>
              <CardHeader>
                <CardTitle>Monthly Sales Activities Report</CardTitle>
                <CardDescription className={C.muted}>Tracks inquiry through turned-down status, due dates, remarks, meeting room use, rooms, and revenue impact.</CardDescription>
              </CardHeader>
              <CardContent>
                <MonthlyActivities rows={report.monthlyActivities} onChange={(monthlyActivities) => update({ monthlyActivities })} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts" className="space-y-6">
            <Card className={C.shell}>
              <CardHeader>
                <CardTitle>Monthly Top Accounts</CardTitle>
                <CardDescription className={C.muted}>Mirrors the Top 10 Corporate Accounts, Agencies, and OTA sections.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 xl:grid-cols-2">
                <SummaryAccountTable title="Top 10 Corporate Accounts" rows={report.topAccounts.corporate} onChange={(corporate) => update({ topAccounts: { ...report.topAccounts, corporate } })} />
                <SummaryAccountTable title="Top 10 Agencies" rows={report.topAccounts.agencies} onChange={(agencies) => update({ topAccounts: { ...report.topAccounts, agencies } })} />
                <SummaryAccountTable title="Top 5 OTAs" rows={report.topAccounts.otas} onChange={(otas) => update({ topAccounts: { ...report.topAccounts, otas } })} />
              </CardContent>
            </Card>
            <Card className={C.shell}>
              <CardHeader>
                <CardTitle>Top Accounts - Month / YTD</CardTitle>
                <CardDescription className={C.muted}>Preserves the corporate and leisure month-vs-YTD account reporting from the month-end tab.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 xl:grid-cols-2">
                <AccountTable title="Corporate Accounts" rows={report.corporateAccounts} onChange={(corporateAccounts) => update({ corporateAccounts })} />
                <AccountTable title="Leisure / Agency Accounts" rows={report.leisureAccounts} onChange={(leisureAccounts) => update({ leisureAccounts })} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="production" className="space-y-6">
            <BusinessTable
              title="Top 10 - Major Business Materialized in the Month"
              description="Business that actually converted and produced revenue during the month."
              rows={report.materialized}
              statusLabel="Booking status"
              commentsLabel="Comments about the business / future potential"
              onChange={(materialized) => update({ materialized })}
            />
            <BusinessTable
              title="Top 10 - Denied / Lost Business"
              description="Business denied or lost, including reason, room nights, revenue, and sales comments."
              rows={report.lost}
              statusLabel="Denied or lost reason"
              commentsLabel="Comments about why it was denied or lost"
              onChange={(lost) => update({ lost })}
            />
          </TabsContent>

          <TabsContent value="future" className="space-y-6">
            <Card className={C.shell}>
              <CardHeader>
                <CardTitle>RFP and Contracts Signed in the Month</CardTitle>
                <CardDescription className={C.muted}>Tracks signed agreements, target room nights, target revenue, rate indication, and sales ownership.</CardDescription>
              </CardHeader>
              <CardContent>
                <ContractTable rows={report.contracts} onChange={(contracts) => update({ contracts })} />
              </CardContent>
            </Card>
            <BusinessTable
              title="Major Business in the Pipeline for Coming Months"
              description="Use for future opportunities over 50 room nights or strategic corporate visibility."
              rows={report.pipeline}
              statusLabel="Booking status"
              commentsLabel="Comments on status and potential"
              onChange={(pipeline) => update({ pipeline })}
            />
            <Card className={C.shell}>
              <CardHeader>
                <CardTitle>Sales, Marketing, Meetings & Events Initiatives</CardTitle>
                <CardDescription className={C.muted}>Captures initiatives, segment, cost, expected revenue, and timing.</CardDescription>
              </CardHeader>
              <CardContent>
                <InitiativesTable rows={report.initiatives} onChange={(initiatives) => update({ initiatives })} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function WeeklyTable({ title, rows, onChange }: { title: string; rows: WeeklyItem[]; onChange: (rows: WeeklyItem[]) => void }) {
  return (
    <div>
      <SectionHeader title={title} right={<AddButton onClick={() => onChange([...rows, emptyWeeklyItem()])} />} />
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.id} className={C.panel}>
            <div className="grid gap-3 md:grid-cols-[44px_1fr_1.6fr_150px_40px] md:items-start">
              <div className="pt-2 text-sm font-bold text-[#6b5f54]">{index + 1}</div>
              <TextCell value={row.company} placeholder="Company / event" onChange={(company) => onChange(rows.map((item) => item.id === row.id ? { ...item, company } : item))} />
              <TextCell textarea value={row.result} placeholder="Result / follow-up / outcome" onChange={(result) => onChange(rows.map((item) => item.id === row.id ? { ...item, result } : item))} />
              <CompactSelect value={row.potential} options={potentials} onChange={(potential) => onChange(rows.map((item) => item.id === row.id ? { ...item, potential } : item))} />
              <RowDelete onClick={() => onChange(rows.filter((item) => item.id !== row.id))} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyActivities({ rows, onChange }: { rows: ActivityRow[]; onChange: (rows: ActivityRow[]) => void }) {
  const updateRow = (idValue: string, patch: Partial<ActivityRow>) => onChange(rows.map((row) => row.id === idValue ? { ...row, ...patch } : row));
  return (
    <div>
      <SectionHeader title="Activity log" right={<AddButton onClick={() => onChange([...rows, emptyActivity()])} />} />
      <div className="space-y-4">
        {rows.map((row, index) => (
          <div key={row.id} className={C.panel}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <Badge variant="outline" className="border-[#cdbda8] bg-white text-[#201814]">Activity {index + 1}</Badge>
              <RowDelete onClick={() => onChange(rows.filter((item) => item.id !== row.id))} />
            </div>
            <div className="grid gap-3 md:grid-cols-6">
              <div className="md:col-span-2"><Label>Activity Type & Name</Label><TextCell value={row.name} onChange={(name) => updateRow(row.id, { name })} /></div>
              <div><Label>Inquiry date</Label><Input className={C.field} type="date" value={row.inquiryDate} onChange={(event) => updateRow(row.id, { inquiryDate: event.target.value })} /></div>
              <div><Label>Meeting room</Label><CompactSelect value={row.meetingRoom} options={["Yes", "No"]} onChange={(meetingRoom) => updateRow(row.id, { meetingRoom })} /></div>
              <div><Label>No. rooms</Label><Input className={C.field} value={row.rooms} onChange={(event) => updateRow(row.id, { rooms: event.target.value })} /></div>
              <div><Label>Stage</Label><CompactSelect value={row.stage} options={stages} onChange={(stage) => updateRow(row.id, { stage })} /></div>
              <div><Label>Arrival</Label><Input className={C.field} type="date" value={row.arrival} onChange={(event) => updateRow(row.id, { arrival: event.target.value })} /></div>
              <div><Label>Departure</Label><Input className={C.field} type="date" value={row.departure} onChange={(event) => updateRow(row.id, { departure: event.target.value })} /></div>
              <div><Label>Due date</Label><Input className={C.field} type="date" value={row.dueDate} onChange={(event) => updateRow(row.id, { dueDate: event.target.value })} /></div>
              <div><Label>Revenue impact</Label><Input className={C.field} value={row.revenueImpact} placeholder="High / Medium / Low / $" onChange={(event) => updateRow(row.id, { revenueImpact: event.target.value })} /></div>
              <div className="md:col-span-2"><Label>Remarks</Label><TextCell value={row.remarks} onChange={(remarks) => updateRow(row.id, { remarks })} /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryAccountTable({ title, rows, onChange }: { title: string; rows: AccountSummaryRow[]; onChange: (rows: AccountSummaryRow[]) => void }) {
  const updateRow = (rowId: string, patch: Partial<AccountSummaryRow>) => onChange(rows.map((row) => row.id === rowId ? { ...row, ...patch } : row));
  return (
    <div>
      <SectionHeader title={title} right={<AddButton onClick={() => onChange([...rows, emptySummaryAccount()])} />} />
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={row.id} className="grid gap-2 rounded-lg border border-[#e0d3c1] bg-[#fbf6ee] p-2 sm:grid-cols-[32px_1fr_90px_90px_110px_36px]">
            <div className="pt-2 text-sm font-bold">{index + 1}</div>
            <Input className={C.field} value={row.name} placeholder="Name" onChange={(event) => updateRow(row.id, { name: event.target.value })} />
            <Input className={C.field} value={row.roomNights} placeholder="RN" onChange={(event) => updateRow(row.id, { roomNights: event.target.value })} />
            <Input className={C.field} value={row.adr} placeholder="ADR" onChange={(event) => updateRow(row.id, { adr: event.target.value })} />
            <Input className={C.field} value={row.revenue} placeholder="Revenue" onChange={(event) => updateRow(row.id, { revenue: event.target.value })} />
            <RowDelete onClick={() => onChange(rows.filter((item) => item.id !== row.id))} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BusinessTable({ title, description, rows, statusLabel, commentsLabel, onChange }: { title: string; description: string; rows: BusinessRow[]; statusLabel: string; commentsLabel: string; onChange: (rows: BusinessRow[]) => void }) {
  const updateRow = (rowId: string, patch: Partial<BusinessRow>) => onChange(rows.map((row) => row.id === rowId ? { ...row, ...patch } : row));
  return (
    <Card className={C.shell}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className={C.muted}>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <SectionHeader
          title="Entries"
          right={<AddButton onClick={() => onChange([...rows, emptyBusiness()])} />}
        />
        <div className="space-y-4">
          {rows.map((row, index) => (
            <div key={row.id} className={C.panel}>
              <div className="mb-3 flex items-center justify-between"><Badge variant="outline" className="border-[#cdbda8] bg-white text-[#201814]">#{index + 1}</Badge><RowDelete onClick={() => onChange(rows.filter((item) => item.id !== row.id))} /></div>
              <div className="grid gap-3 md:grid-cols-6">
                <div className="md:col-span-2"><Label>Company & Event Name</Label><Input className={C.field} value={row.company} onChange={(event) => updateRow(row.id, { company: event.target.value })} /></div>
                <div className="md:col-span-2"><Label>{statusLabel}</Label><Input className={C.field} value={row.status} onChange={(event) => updateRow(row.id, { status: event.target.value })} /></div>
                <div><Label>Arrival</Label><Input className={C.field} type="date" value={row.arrival} onChange={(event) => updateRow(row.id, { arrival: event.target.value })} /></div>
                <div><Label>Departure</Label><Input className={C.field} type="date" value={row.departure} onChange={(event) => updateRow(row.id, { departure: event.target.value })} /></div>
                <div><Label>Total RN&apos;s</Label><Input className={C.field} value={row.roomNights} onChange={(event) => updateRow(row.id, { roomNights: event.target.value })} /></div>
                <div><Label>Room revenue</Label><Input className={C.field} value={row.roomRevenue} onChange={(event) => updateRow(row.id, { roomRevenue: event.target.value })} /></div>
                <div><Label>Other revenue</Label><Input className={C.field} value={row.otherRevenue} onChange={(event) => updateRow(row.id, { otherRevenue: event.target.value })} /></div>
                <div><Label>Total revenue</Label><Input className={C.field} disabled value={fmtMoney(money(row.roomRevenue) + money(row.otherRevenue))} /></div>
                <div><Label>Sales person</Label><Input className={C.field} value={row.salesPerson} onChange={(event) => updateRow(row.id, { salesPerson: event.target.value })} /></div>
                <div className="md:col-span-3"><Label>{commentsLabel}</Label><Textarea className={C.field} value={row.comments} onChange={(event) => updateRow(row.id, { comments: event.target.value })} /></div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 rounded-xl border border-[#d7c8b5] bg-white p-4 text-sm sm:grid-cols-4">
          <div><span className={C.muted}>Total RN&apos;s</span><div className="text-xl font-bold">{totalBusiness(rows, "roomNights")}</div></div>
          <div><span className={C.muted}>Room revenue</span><div className="text-xl font-bold">{fmtMoney(totalBusiness(rows, "roomRevenue"))}</div></div>
          <div><span className={C.muted}>Other revenue</span><div className="text-xl font-bold">{fmtMoney(totalBusiness(rows, "otherRevenue"))}</div></div>
          <div><span className={C.muted}>Total revenue</span><div className="text-xl font-bold">{fmtMoney(totalBusiness(rows, "roomRevenue") + totalBusiness(rows, "otherRevenue"))}</div></div>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountTable({ title, rows, onChange }: { title: string; rows: AccountRow[]; onChange: (rows: AccountRow[]) => void }) {
  const updateRow = (rowId: string, patch: Partial<AccountRow>) => onChange(rows.map((row) => row.id === rowId ? { ...row, ...patch } : row));
  return (
    <div>
      <SectionHeader title={title} right={<AddButton onClick={() => onChange([...rows, emptyAccount()])} />} />
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.id} className={C.panel}>
            <div className="mb-3 flex items-center justify-between"><Badge variant="outline" className="border-[#cdbda8] bg-white text-[#201814]">#{index + 1}</Badge><RowDelete onClick={() => onChange(rows.filter((item) => item.id !== row.id))} /></div>
            <div className="grid gap-3 md:grid-cols-6">
              <div className="md:col-span-2"><Label>Name</Label><Input className={C.field} value={row.name} onChange={(event) => updateRow(row.id, { name: event.target.value })} /></div>
              <div><Label>Segment</Label><Input className={C.field} value={row.segment} onChange={(event) => updateRow(row.id, { segment: event.target.value })} /></div>
              <div><Label>Month RN&apos;s</Label><Input className={C.field} value={row.monthRn} onChange={(event) => updateRow(row.id, { monthRn: event.target.value })} /></div>
              <div><Label>Month revenue</Label><Input className={C.field} value={row.monthRevenue} onChange={(event) => updateRow(row.id, { monthRevenue: event.target.value })} /></div>
              <div><Label>Month ARR</Label><Input className={C.field} disabled value={fmtNumber(row.monthRn) ? fmtMoney(money(row.monthRevenue) / fmtNumber(row.monthRn)) : "$0"} /></div>
              <div><Label>YTD RN&apos;s</Label><Input className={C.field} value={row.ytdRn} onChange={(event) => updateRow(row.id, { ytdRn: event.target.value })} /></div>
              <div><Label>YTD revenue</Label><Input className={C.field} value={row.ytdRevenue} onChange={(event) => updateRow(row.id, { ytdRevenue: event.target.value })} /></div>
              <div><Label>YTD ARR</Label><Input className={C.field} disabled value={fmtNumber(row.ytdRn) ? fmtMoney(money(row.ytdRevenue) / fmtNumber(row.ytdRn)) : "$0"} /></div>
              <div><Label>Sales person</Label><Input className={C.field} value={row.salesPerson} onChange={(event) => updateRow(row.id, { salesPerson: event.target.value })} /></div>
              <div className="md:col-span-2"><Label>Comments</Label><Input className={C.field} value={row.comments} onChange={(event) => updateRow(row.id, { comments: event.target.value })} /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContractTable({ rows, onChange }: { rows: ContractRow[]; onChange: (rows: ContractRow[]) => void }) {
  const updateRow = (rowId: string, patch: Partial<ContractRow>) => onChange(rows.map((row) => row.id === rowId ? { ...row, ...patch } : row));
  return (
    <div>
      <SectionHeader title="Signed contracts" right={<AddButton onClick={() => onChange([...rows, emptyContract()])} />} />
      <div className="space-y-4">
        {rows.map((row, index) => (
          <div key={row.id} className={C.panel}>
            <div className="mb-3 flex items-center justify-between"><Badge variant="outline" className="border-[#cdbda8] bg-white text-[#201814]">#{index + 1}</Badge><RowDelete onClick={() => onChange(rows.filter((item) => item.id !== row.id))} /></div>
            <div className="grid gap-3 md:grid-cols-6">
              <div className="md:col-span-2"><Label>Company / Agency Name</Label><Input className={C.field} value={row.company} onChange={(event) => updateRow(row.id, { company: event.target.value })} /></div>
              <div><Label>Segment</Label><Input className={C.field} value={row.segment} onChange={(event) => updateRow(row.id, { segment: event.target.value })} /></div>
              <div><Label>Booking channel</Label><Input className={C.field} value={row.channel} onChange={(event) => updateRow(row.id, { channel: event.target.value })} /></div>
              <div><Label>Begins</Label><Input className={C.field} type="date" value={row.begins} onChange={(event) => updateRow(row.id, { begins: event.target.value })} /></div>
              <div><Label>Ends</Label><Input className={C.field} type="date" value={row.ends} onChange={(event) => updateRow(row.id, { ends: event.target.value })} /></div>
              <div><Label>RN target</Label><Input className={C.field} value={row.targetRn} onChange={(event) => updateRow(row.id, { targetRn: event.target.value })} /></div>
              <div><Label>Revenue target</Label><Input className={C.field} value={row.targetRevenue} onChange={(event) => updateRow(row.id, { targetRevenue: event.target.value })} /></div>
              <div><Label>Rate indication</Label><Input className={C.field} value={row.rate} onChange={(event) => updateRow(row.id, { rate: event.target.value })} /></div>
              <div><Label>Sales person</Label><Input className={C.field} value={row.salesPerson} onChange={(event) => updateRow(row.id, { salesPerson: event.target.value })} /></div>
              <div className="md:col-span-2"><Label>Comments</Label><Input className={C.field} value={row.comments} onChange={(event) => updateRow(row.id, { comments: event.target.value })} /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InitiativesTable({ rows, onChange }: { rows: InitiativeRow[]; onChange: (rows: InitiativeRow[]) => void }) {
  const updateRow = (rowId: string, patch: Partial<InitiativeRow>) => onChange(rows.map((row) => row.id === rowId ? { ...row, ...patch } : row));
  return (
    <div>
      <SectionHeader title="Initiatives" right={<AddButton onClick={() => onChange([...rows, emptyInitiative()])} />} />
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.id} className="grid gap-3 rounded-xl border border-[#e0d3c1] bg-[#fbf6ee] p-4 md:grid-cols-[36px_1.5fr_1fr_110px_130px_130px_40px]">
            <div className="pt-2 font-bold">{index + 1}</div>
            <Input className={C.field} value={row.activity} placeholder="Sales & marketing activity" onChange={(event) => updateRow(row.id, { activity: event.target.value })} />
            <Input className={C.field} value={row.segment} placeholder="Segment" onChange={(event) => updateRow(row.id, { segment: event.target.value })} />
            <Input className={C.field} value={row.cost} placeholder="Cost" onChange={(event) => updateRow(row.id, { cost: event.target.value })} />
            <Input className={C.field} value={row.expectedRevenue} placeholder="Expected revenue" onChange={(event) => updateRow(row.id, { expectedRevenue: event.target.value })} />
            <Input className={C.field} type="date" value={row.date} onChange={(event) => updateRow(row.id, { date: event.target.value })} />
            <RowDelete onClick={() => onChange(rows.filter((item) => item.id !== row.id))} />
          </div>
        ))}
      </div>
    </div>
  );
}
