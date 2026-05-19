import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, LockKeyhole, LogOut, Save, Upload } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const C = {
  page: "min-h-screen bg-[#f3efe7] text-[#201814]",
  shell: "border-[#d7c8b5] bg-[#fffaf2] shadow-[0_18px_45px_rgba(72,52,31,0.10)]",
  section: "border-[#d7c8b5] bg-white",
  header: "bg-[#23313d] text-white",
  subheader: "bg-[#d9e6d7] text-[#173c25]",
  field: "border-[#cdbda8] bg-white text-[#201814] placeholder:text-[#7c6e61]",
  outline: "border-[#cdbda8] bg-white text-[#201814] hover:bg-[#f8efe2]",
  green: "bg-[#2f5f46] text-white hover:bg-[#274d39]",
};

type OpsAccess = { unlocked: boolean; user: { employeeDisplayName: string; email: string; isAdmin: boolean } | null; passwordChangeRequired?: boolean };
type Row = Record<string, string>;

const emptyRows = (count: number, keys: string[]) =>
  Array.from({ length: count }, (_, index) => keys.reduce<Row>((row, key) => ({ ...row, [key]: key === "no" ? String(index + 1) : "" }), {}));

function money(value: string | number) {
  const n = Number(value || 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
}

function pct(value: string | number) {
  const n = Number(value || 0);
  return `${((Number.isFinite(n) ? n : 0) * 100).toFixed(1)}%`;
}

function num(value: string | number) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function LabeledInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b5f54]">{label}</Label>
      <Input className={`mt-1 ${C.field}`} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <Card className={C.section}>
      <CardHeader className="border-b border-[#d7c8b5] py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {right}
        </div>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

function EditableTable({ columns, rows, onChange }: { columns: Array<{ key: string; label: string; wide?: boolean }>; rows: Row[]; onChange: (rows: Row[]) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className={C.header}>
            {columns.map((column) => (
              <th key={column.key} className={`border border-[#c9d2d8] px-2 py-2 text-left ${column.wide ? "min-w-[260px]" : "min-w-[110px]"}`}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="odd:bg-white even:bg-[#fbf6ee]">
              {columns.map((column) => (
                <td key={column.key} className="border border-[#e0d3c1] p-1 align-top">
                  <Input
                    className="h-8 border-transparent bg-transparent px-2 text-sm focus:border-[#b98435] focus:bg-white"
                    value={row[column.key] || ""}
                    onChange={(event) => {
                      const next = rows.map((item, index) => index === rowIndex ? { ...item, [column.key]: event.target.value } : item);
                      onChange(next);
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OpsReportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [week, setWeek] = useState("Week 1");
  const [setup, setSetup] = useState({ propertyName: "Please enter Hotel name", generalManager: "Please enter General Manager name", totalRooms: "50", monthlyRoomNights: "1550" });
  const [topMetrics, setTopMetrics] = useState({ weekStart: "2026-01-03", roomsSold: "200", roomRevenue: "20000", mtdThisYear: "80000", mtdLastYear: "100000", ytdThisYear: "150000", ytdLastYear: "200000" });
  const [monthRows, setMonthRows] = useState<Row[]>([
    { label: "MONTH TO DATE", occupancy: "0.60", rooms: "400", adr: "169", revenue: "80000", comments: "" },
    { label: "FUTURE BOOKED", occupancy: "0.05", rooms: "100", adr: "15", revenue: "12000", comments: "" },
    { label: "MONTHLY TOTAL", occupancy: "0.32", rooms: "500", adr: "184", revenue: "92000", comments: "" },
    { label: "CURRENT MONTH BUDGET", occupancy: "0.45", rooms: "700", adr: "200", revenue: "120000", comments: "" },
    { label: "VARIANCE", occupancy: "-0.13", rooms: "-200", adr: "-16", revenue: "-28000", comments: "" },
    { label: "LY SAME MONTH", occupancy: "0.50", rooms: "750", adr: "220", revenue: "135000", comments: "" },
  ]);
  const [nextMonthRows, setNextMonthRows] = useState<Row[]>([
    { label: "FUTURE BOOKED FOR NEXT MONTH", occupancy: "0.30", rooms: "500", adr: "150", revenue: "75000", comments: "" },
    { label: "NEXT MONTH BUDGET", occupancy: "0.20", rooms: "400", adr: "125", revenue: "50000", comments: "" },
    { label: "VARIANCE", occupancy: "0.10", rooms: "100", adr: "25", revenue: "25000", comments: "" },
  ]);
  const [chargebacks, setChargebacks] = useState<Row[]>(emptyRows(5, ["no", "reason", "respondDate", "amount", "comment"]));
  const [maintenance, setMaintenance] = useState<Row[]>(emptyRows(5, ["no", "rooms", "area", "hours", "comment"]));
  const [oooRooms, setOooRooms] = useState<Row[]>(emptyRows(5, ["no", "room", "startDate", "returnDate", "comment"]));
  const [adjustments, setAdjustments] = useState<Row[]>(emptyRows(5, ["no", "room", "guest", "amount", "comment"]));
  const [ar, setAr] = useState({ current: "90", d30: "150", d60: "220", d90: "1240", comments: "" });
  const [ledger, setLedger] = useState({ balance: "", over1000: "", comment: "" });
  const [labor, setLabor] = useState<Row[]>([
    { department: "FRONT DESK HOURS", hours: "168", budget: "160", comments: "" },
    { department: "HOUSEKEEPING HOURS", hours: "140", budget: "45", comments: "" },
    { department: "BREAKFAST", hours: "42", budget: "41", comments: "" },
    { department: "MAINTENANCE", hours: "60", budget: "56", comments: "" },
    { department: "OTHER", hours: "10", budget: "5", comments: "" },
  ]);
  const [staffing, setStaffing] = useState({ openPositions: "", status: "", overtimeLastWeek: "", overtimeExpected: "", comment: "" });
  const [cases, setCases] = useState<Row[]>(emptyRows(5, ["no", "guest", "incidentType", "resolution", "comment"]));
  const [gmOverview, setGmOverview] = useState("");
  const [gssRows, setGssRows] = useState<Row[]>(["ITR", "Elite Appreciation", "Cleanliness", "Staff Service", "Maintenance", "Food & Beverage", "Internet"].map((label) => ({ label, hotel: "", brand: "", variance: "", sply: "", comments: "" })));
  const [reputationRows, setReputationRows] = useState<Row[]>(["GOOGLE", "BOOKING.COM", "EXPEDIA", "TRIPADVISOR", "YELP"].map((label) => ({ label, reviews: "", score: "", outOf: "", goal: "", variance: "", strategy: "" })));
  const [positiveReviews, setPositiveReviews] = useState<Row[]>(emptyRows(5, ["source", "score", "comment"]));
  const [negativeReviews, setNegativeReviews] = useState<Row[]>(emptyRows(5, ["source", "score", "comment"]));
  const [followUp, setFollowUp] = useState<Row[]>(emptyRows(5, ["point", "direction", "owner", "dueDate", "status", "notes"]));
  const [priorities, setPriorities] = useState<Row[]>([
    { priority: "High", action: "", owner: "", dueDate: "", status: "Not Started", support: "" },
    { priority: "Medium", action: "", owner: "", dueDate: "", status: "Not Started", support: "" },
    { priority: "Low", action: "", owner: "", dueDate: "", status: "Not Started", support: "" },
  ]);

  const access = useQuery<OpsAccess>({
    queryKey: ["/api/opsreport/access"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/opsreport/access"), { credentials: "include" });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });
  const unlock = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tips/auth/login", loginForm),
    onSuccess: () => {
      setLoginForm({ email: "", password: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/opsreport/access"] });
    },
    onError: (error: Error) => toast({ title: "Unable to sign in", description: error.message, variant: "destructive" }),
  });
  const lock = useMutation({
    mutationFn: () => apiRequest("POST", "/api/opsreport/logout"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/opsreport/access"] }),
  });

  const adr = useMemo(() => num(topMetrics.roomsSold) ? num(topMetrics.roomRevenue) / num(topMetrics.roomsSold) : 0, [topMetrics]);
  const laborTotal = useMemo(() => labor.reduce((sum, row) => sum + num(row.hours), 0), [labor]);
  const laborBudget = useMemo(() => labor.reduce((sum, row) => sum + num(row.budget), 0), [labor]);
  const laborVariance = laborTotal - laborBudget;
  const adjustmentTotal = useMemo(() => adjustments.reduce((sum, row) => sum + num(row.amount), 0), [adjustments]);
  const arTotal = num(ar.current) + num(ar.d30) + num(ar.d60) + num(ar.d90);
  const weekEnd = useMemo(() => {
    const start = new Date(`${topMetrics.weekStart}T00:00:00`);
    if (Number.isNaN(start.getTime())) return "";
    start.setDate(start.getDate() + 6);
    return start.toISOString().slice(0, 10);
  }, [topMetrics.weekStart]);

  if (access.isLoading) return <div className={`${C.page} p-8`}>Loading operations report...</div>;
  if (!access.data?.unlocked) {
    return (
      <div className={`${C.page} flex items-center justify-center p-4`}>
        <Card className={`w-full max-w-md ${C.shell}`}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-[#2f5f46]" />
              <CardTitle>Courtyard Login Required</CardTitle>
            </div>
            <CardDescription>Use the same Courtyard account used for Tips and Schedule. Manager access is required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input className={C.field} type="email" value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                className={C.field}
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                onKeyDown={(event) => event.key === "Enter" && unlock.mutate()}
              />
            </div>
            <Button className={`w-full ${C.green}`} onClick={() => unlock.mutate()} disabled={unlock.isPending || !loginForm.email.trim() || !loginForm.password}>
              {unlock.isPending ? "Signing in..." : "Sign in"}
            </Button>
            {access.data?.passwordChangeRequired && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Password change is required before opening Ops Report. Use /tips to complete the password change.</div>}
            {access.data?.user && !access.data.user.isAdmin && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">This account is signed in but does not have manager access for Ops Report.</div>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={C.page}>
      <header className="border-b border-[#d7c8b5] bg-[#fffaf2] px-4 py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Globiwest Weekly Operations</div>
            <h1 className="text-3xl font-semibold tracking-tight">Operations Report</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={week} onValueChange={setWeek}>
              <SelectTrigger className={`w-32 ${C.field}`}><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 52 }, (_, index) => <SelectItem key={index + 1} value={`Week ${index + 1}`}>Week {index + 1}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" className={C.outline} onClick={() => window.print()}><Download className="mr-2 h-4 w-4" />Print</Button>
            <Button variant="outline" className={C.outline} onClick={() => toast({ title: "Saved locally", description: "Database persistence can be added after import mapping is finalized." })}><Save className="mr-2 h-4 w-4" />Save draft</Button>
            <Button variant="ghost" className="text-[#5f5247]" onClick={() => lock.mutate()}><LogOut className="mr-2 h-4 w-4" />Lock</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <Card className={C.shell}>
          <CardContent className="grid gap-4 p-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              <LabeledInput label="Property name" value={setup.propertyName} onChange={(propertyName) => setSetup({ ...setup, propertyName })} />
              <LabeledInput label="General manager" value={setup.generalManager} onChange={(generalManager) => setSetup({ ...setup, generalManager })} />
              <LabeledInput label="Total rooms" value={setup.totalRooms} onChange={(totalRooms) => setSetup({ ...setup, totalRooms })} type="number" />
              <LabeledInput label="Monthly room nights" value={setup.monthlyRoomNights} onChange={(monthlyRoomNights) => setSetup({ ...setup, monthlyRoomNights })} type="number" />
            </div>
            <div className="rounded-xl border border-dashed border-[#cdbda8] bg-white p-4">
              <div className="flex items-center gap-2 font-semibold"><Upload className="h-4 w-4" /> Future parser staging</div>
              <p className="mt-2 text-sm text-[#5f5247]">Upload mapping will be connected next. This page is structured to receive source reports and populate the matching fields.</p>
              <Input className={`mt-3 ${C.field}`} type="file" accept=".xlsx,.xls,.csv,.pdf" disabled />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="weekly" className="space-y-5">
          <TabsList className="bg-[#fffaf2]">
            <TabsTrigger value="weekly">Weekly worksheet</TabsTrigger>
            <TabsTrigger value="summary">Summary dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-5">
            <Section title="Weekly Performance Dashboard" right={<Badge className="bg-[#23313d]">{week}</Badge>}>
              <EditableTable
                columns={[
                  { key: "week", label: "Week" }, { key: "rooms", label: "Rooms Sold" }, { key: "revenue", label: "Room Revenue" }, { key: "adr", label: "ADR" }, { key: "occupancy", label: "Occupancy %" }, { key: "labor", label: "Labor Hours" }, { key: "variance", label: "Labor Variance" },
                ]}
                rows={Array.from({ length: 10 }, (_, index) => ({ week: `Week ${index + 1}`, rooms: index === 0 ? topMetrics.roomsSold : "", revenue: index === 0 ? topMetrics.roomRevenue : "", adr: index === 0 ? adr.toFixed(0) : "", occupancy: index === 0 ? monthRows[0].occupancy : "", labor: index === 0 ? String(laborTotal) : "", variance: index === 0 ? String(laborVariance) : "" }))}
                onChange={() => undefined}
              />
            </Section>
            <Section title="Key Performance Indicators YTD">
              <EditableTable
                columns={[{ key: "kpi", label: "KPI", wide: true }, { key: "current", label: "Current" }, { key: "target", label: "Target" }, { key: "variance", label: "Variance" }]}
                rows={[
                  { kpi: "Avg Weekly Revenue", current: topMetrics.roomRevenue, target: "25000", variance: String(num(topMetrics.roomRevenue) - 25000) },
                  { kpi: "Avg Occupancy %", current: monthRows[0].occupancy, target: "0.65", variance: String(num(monthRows[0].occupancy) - 0.65) },
                  { kpi: "Avg ADR", current: adr.toFixed(0), target: "120", variance: String(Math.round(adr - 120)) },
                  { kpi: "Labor Efficiency (Hrs/Room)", current: num(topMetrics.roomsSold) ? (laborTotal / num(topMetrics.roomsSold)).toFixed(2) : "0", target: "1.50", variance: num(topMetrics.roomsSold) ? ((laborTotal / num(topMetrics.roomsSold)) - 1.5).toFixed(2) : "0" },
                ]}
                onChange={() => undefined}
              />
            </Section>
          </TabsContent>

          <TabsContent value="weekly" className="space-y-5">
            <Card className={C.shell}>
              <CardHeader>
                <div className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-[#2f5f46]" /><CardTitle>{week} Report</CardTitle></div>
                <CardDescription>{setup.propertyName} | {topMetrics.weekStart} to {weekEnd || "week end date"}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <LabeledInput label="Week start date" value={topMetrics.weekStart} onChange={(weekStart) => setTopMetrics({ ...topMetrics, weekStart })} type="date" />
                <LabeledInput label="Rooms sold" value={topMetrics.roomsSold} onChange={(roomsSold) => setTopMetrics({ ...topMetrics, roomsSold })} type="number" />
                <LabeledInput label="Room revenue" value={topMetrics.roomRevenue} onChange={(roomRevenue) => setTopMetrics({ ...topMetrics, roomRevenue })} type="number" />
                <div className="rounded-lg border border-[#d7c8b5] bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b5f54]">Weekly ADR</div>
                  <div className="mt-2 text-2xl font-semibold">{money(adr)}</div>
                </div>
                <LabeledInput label="MTD this year" value={topMetrics.mtdThisYear} onChange={(mtdThisYear) => setTopMetrics({ ...topMetrics, mtdThisYear })} type="number" />
                <LabeledInput label="MTD last year" value={topMetrics.mtdLastYear} onChange={(mtdLastYear) => setTopMetrics({ ...topMetrics, mtdLastYear })} type="number" />
                <LabeledInput label="YTD this year" value={topMetrics.ytdThisYear} onChange={(ytdThisYear) => setTopMetrics({ ...topMetrics, ytdThisYear })} type="number" />
                <LabeledInput label="YTD last year" value={topMetrics.ytdLastYear} onChange={(ytdLastYear) => setTopMetrics({ ...topMetrics, ytdLastYear })} type="number" />
              </CardContent>
            </Card>

            <Section title="Current Month">
              <EditableTable columns={[{ key: "label", label: "Current Month", wide: true }, { key: "occupancy", label: "Occupancy" }, { key: "rooms", label: "Rooms" }, { key: "adr", label: "ADR" }, { key: "revenue", label: "Room Revenue" }, { key: "comments", label: "Comments", wide: true }]} rows={monthRows} onChange={setMonthRows} />
            </Section>
            <Section title="Next Month Data">
              <EditableTable columns={[{ key: "label", label: "Next Month", wide: true }, { key: "occupancy", label: "Occupancy" }, { key: "rooms", label: "Rooms" }, { key: "adr", label: "ADR" }, { key: "revenue", label: "Room Revenue" }, { key: "comments", label: "Comments", wide: true }]} rows={nextMonthRows} onChange={setNextMonthRows} />
            </Section>
            <Section title="Weekly Chargebacks">
              <EditableTable columns={[{ key: "no", label: "S No" }, { key: "reason", label: "Reason", wide: true }, { key: "respondDate", label: "Respond Date" }, { key: "amount", label: "Total Amount" }, { key: "comment", label: "Comment", wide: true }]} rows={chargebacks} onChange={setChargebacks} />
            </Section>
            <Section title="Major Weekly Maintenance Tasks">
              <EditableTable columns={[{ key: "no", label: "S No" }, { key: "rooms", label: "P.M. Rooms" }, { key: "area", label: "Area" }, { key: "hours", label: "Time Consumed Hrs" }, { key: "comment", label: "Comment", wide: true }]} rows={maintenance} onChange={setMaintenance} />
            </Section>
            <Section title="Weekly Out of Order Rooms">
              <EditableTable columns={[{ key: "no", label: "S No" }, { key: "room", label: "Room No" }, { key: "startDate", label: "OOO Start Date" }, { key: "returnDate", label: "Expected Return" }, { key: "comment", label: "Comment", wide: true }]} rows={oooRooms} onChange={setOooRooms} />
            </Section>
            <Section title="Week's Total Revenue Adjustments" right={<Badge variant="outline">{money(adjustmentTotal)}</Badge>}>
              <EditableTable columns={[{ key: "no", label: "S No" }, { key: "room", label: "Room No" }, { key: "guest", label: "Guest Name" }, { key: "amount", label: "Adjustment Amount" }, { key: "comment", label: "Reason/Comment", wide: true }]} rows={adjustments} onChange={setAdjustments} />
            </Section>
            <Section title="Accounts Receivable / Aging" right={<Badge variant="outline">Total {money(arTotal)}</Badge>}>
              <div className="grid gap-3 p-4 sm:grid-cols-5">
                <LabeledInput label="Current" value={ar.current} onChange={(current) => setAr({ ...ar, current })} />
                <LabeledInput label="30" value={ar.d30} onChange={(d30) => setAr({ ...ar, d30 })} />
                <LabeledInput label="60" value={ar.d60} onChange={(d60) => setAr({ ...ar, d60 })} />
                <LabeledInput label="90+" value={ar.d90} onChange={(d90) => setAr({ ...ar, d90 })} />
                <LabeledInput label="Comments" value={ar.comments} onChange={(comments) => setAr({ ...ar, comments })} />
              </div>
            </Section>
            <Section title="Guest Ledger Balance">
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                <LabeledInput label="Total balance" value={ledger.balance} onChange={(balance) => setLedger({ ...ledger, balance })} />
                <LabeledInput label="Any guest over $1000" value={ledger.over1000} onChange={(over1000) => setLedger({ ...ledger, over1000 })} />
                <LabeledInput label="Comment" value={ledger.comment} onChange={(comment) => setLedger({ ...ledger, comment })} />
              </div>
            </Section>
            <Section title="Department Labor Review (Controllable)" right={<Badge variant="outline">Variance {laborVariance}</Badge>}>
              <EditableTable columns={[{ key: "department", label: "Department", wide: true }, { key: "hours", label: "Hours" }, { key: "budget", label: "Budgeted MPOR/Hours" }, { key: "comments", label: "Comments", wide: true }]} rows={labor} onChange={setLabor} />
            </Section>
            <Section title="Staffing">
              <div className="grid gap-3 p-4 md:grid-cols-5">
                <LabeledInput label="Any open positions" value={staffing.openPositions} onChange={(openPositions) => setStaffing({ ...staffing, openPositions })} />
                <LabeledInput label="Status" value={staffing.status} onChange={(status) => setStaffing({ ...staffing, status })} />
                <LabeledInput label="Overtime last week" value={staffing.overtimeLastWeek} onChange={(overtimeLastWeek) => setStaffing({ ...staffing, overtimeLastWeek })} />
                <LabeledInput label="Overtime expected" value={staffing.overtimeExpected} onChange={(overtimeExpected) => setStaffing({ ...staffing, overtimeExpected })} />
                <LabeledInput label="Comment" value={staffing.comment} onChange={(comment) => setStaffing({ ...staffing, comment })} />
              </div>
            </Section>
            <Section title="Brand / Guest Relation Cases">
              <EditableTable columns={[{ key: "no", label: "S No" }, { key: "guest", label: "Guest Name" }, { key: "incidentType", label: "Incident Type" }, { key: "resolution", label: "Resolution / Compensation" }, { key: "comment", label: "Incident / Comment", wide: true }]} rows={cases} onChange={setCases} />
            </Section>
            <Section title="GM Weekly Overview">
              <div className="p-4"><Textarea className={`${C.field} min-h-40`} value={gmOverview} onChange={(event) => setGmOverview(event.target.value)} placeholder="Please provide detailed summary of your week" /></div>
            </Section>
            <Section title="Guest Satisfaction Scores">
              <EditableTable columns={[{ key: "label", label: "GSS MTD", wide: true }, { key: "hotel", label: "Hotel" }, { key: "brand", label: "Brand / Continent" }, { key: "variance", label: "Variance" }, { key: "sply", label: "SPLY Variance" }, { key: "comments", label: "Comments", wide: true }]} rows={gssRows} onChange={setGssRows} />
            </Section>
            <Section title="Online Reputation">
              <EditableTable columns={[{ key: "label", label: "Name", wide: true }, { key: "reviews", label: "Total Reviews" }, { key: "score", label: "Rank / Score" }, { key: "outOf", label: "Out Of" }, { key: "goal", label: "Goal Rank" }, { key: "variance", label: "Variance" }, { key: "strategy", label: "Strategy / Action Plan", wide: true }]} rows={reputationRows} onChange={setReputationRows} />
            </Section>
            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Weekly Reviews: Positive">
                <EditableTable columns={[{ key: "source", label: "Source" }, { key: "score", label: "Overall Score" }, { key: "comment", label: "Guest Comments", wide: true }]} rows={positiveReviews} onChange={setPositiveReviews} />
              </Section>
              <Section title="Weekly Reviews: Negative">
                <EditableTable columns={[{ key: "source", label: "Source" }, { key: "score", label: "Overall Score" }, { key: "comment", label: "Guest Comments", wide: true }]} rows={negativeReviews} onChange={setNegativeReviews} />
              </Section>
            </div>
            <Section title="Corporate Director Review & Weekly Follow-Up">
              <EditableTable columns={[{ key: "point", label: "Discussion Point", wide: true }, { key: "direction", label: "Direction Given", wide: true }, { key: "owner", label: "Owner" }, { key: "dueDate", label: "Due Date" }, { key: "status", label: "Status" }, { key: "notes", label: "Notes", wide: true }]} rows={followUp} onChange={setFollowUp} />
            </Section>
            <Section title="Top 3 Priorities For Next Week">
              <EditableTable columns={[{ key: "priority", label: "Priority" }, { key: "action", label: "Action / Result", wide: true }, { key: "owner", label: "Owner" }, { key: "dueDate", label: "Due Date" }, { key: "status", label: "Status" }, { key: "support", label: "Support Needed", wide: true }]} rows={priorities} onChange={setPriorities} />
            </Section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
