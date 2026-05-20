import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  Lock,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const C = {
  page: "bg-[#f5efe7] text-[#201814]",
  shell: "!border-[#ddccb5] !bg-[#fffaf2] !bg-none !text-[#201814] shadow-[0_18px_45px_rgba(74,54,34,0.10)]",
  panel: "border-[#e1d1bb] !bg-[#fbf6ee] !bg-none text-[#201814]",
  ink: "!text-[#201814]",
  muted: "!text-[#5f5247]",
  green: "!bg-[#2f5f46] !bg-none !text-white hover:!bg-[#274d39]",
  accent: "!bg-[#b98435] !bg-none !text-white hover:!bg-[#9f6f2b]",
  field: "!border-[#cdbda8] !bg-white !text-[#201814] placeholder:!text-[#76695d]",
  outline: "!border-[#cdbda8] !bg-white !bg-none !text-[#201814] hover:!bg-[#f8efe2]",
  darkButton: "!border-[#111827] !bg-[#1f2937] !bg-none !text-white hover:!bg-[#111827]",
};

const DEPARTMENTS = ["Managers", "Front Desk", "Bistro", "Maintenance", "Housekeeping"];
const DAY_LABELS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_LABELS_ES = ["Sab", "Dom", "Lun", "Mar", "Mie", "Jue", "Vie"];

const ES: Record<string, string> = {
  "Courtyard Schedule Builder": "Constructor de Horarios Courtyard",
  "Generate AI schedule": "Generar horario con IA",
  "Weekly hours": "Horas semanales",
  "Open shifts": "Turnos abiertos",
  Employees: "Empleados",
  Warnings: "Alertas",
  "Labor targets": "Metas de labor",
  "Forecast rooms": "Cuartos pronosticados",
  "HK room credits": "Creditos de cuartos HK",
  "Target HK hours": "Horas meta HK",
  Forecast: "Pronostico",
  "Rooms sold": "Cuartos vendidos",
  "Occ %": "Ocupacion %",
  Arrivals: "Llegadas",
  Departures: "Salidas",
  Stayovers: "Quedan",
  Notes: "Notas",
  "Save forecast": "Guardar pronostico",
  "Import OTB CSV": "Importar CSV OTB",
  "Upload actualized CSV": "Subir CSV actualizado",
  "Weekly schedule": "Horario semanal",
  Associate: "Empleado",
  Hours: "Horas",
  "Approved request": "Solicitud aprobada",
  "Add shift": "Agregar turno",
  "Daily labor hours": "Horas de labor diarias",
  "Bistro labor": "Labor Bistro",
};

type ScheduleUser = {
  id: string;
  email: string;
  employeeDisplayName: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

type ScheduleRequest = {
  id: string;
  requesterUserId: string;
  department?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  requestDate: string;
  requestType: string;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
  status: string;
  createdAt?: string | null;
  conflictCount?: number;
  requester?: ScheduleUser;
};

type ScheduleEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  department: string;
  position?: string | null;
  defaultShiftType?: string | null;
  maxWeeklyHours?: string | null;
  hourlyRate?: string | null;
  phone?: string | null;
  email?: string | null;
  active: boolean;
  notes?: string | null;
};

type ShiftType = {
  id: string;
  label: string;
  startTime?: string | null;
  endTime?: string | null;
  unpaidBreakMinutes: number;
  color: string;
  textColor: string;
  departmentHint?: string | null;
  isOvernight: boolean;
  active: boolean;
  sortOrder: number;
};

type WeeklySchedule = {
  id: string;
  propertyName: string;
  weekStartDate: string;
  weekEndDate: string;
  status: "draft" | "published" | "archived";
  publishedAt?: string | null;
};

type ForecastDay = {
  id?: string;
  forecastDate: string;
  roomsSold: number;
  occupancyPercent: string | number;
  arrivals: number;
  departures: number;
  stayovers: number;
  otbRoomsSold?: number | null;
  otbOccupancyPercent?: string | number | null;
  otbArrivals?: number | null;
  otbDepartures?: number | null;
  actualRoomsSold?: number | null;
  actualOccupancyPercent?: string | number | null;
  actualArrivals?: number | null;
  actualDepartures?: number | null;
  popupGroupRooms?: number | null;
  popupGroupNotes?: string | null;
  groupsEventsNotes?: string | null;
  notes?: string | null;
};

type ShiftAssignment = {
  id?: string;
  scheduleId?: string;
  employeeId?: string | null;
  shiftDate: string;
  shiftTypeId?: string | null;
  customStartTime?: string | null;
  customEndTime?: string | null;
  unpaidBreakMinutes?: number | null;
  roleNote?: string | null;
  managerNote?: string | null;
  isOpenShift: boolean;
};

type SchedulePayload = {
  schedule: WeeklySchedule;
  days: string[];
  departments: string[];
  employees: ScheduleEmployee[];
  shiftTypes: ShiftType[];
  forecast: ForecastDay[];
  assignments: ShiftAssignment[];
  approvedRequests?: ScheduleRequest[];
  totals: {
    employeeWeeklyHours: Record<string, number>;
    departmentDailyHours: Record<string, Record<string, number>>;
    departmentWeeklyHours: Record<string, number>;
    departmentWeeklyLaborDollars?: Record<string, number>;
    dailyLaborHours: Record<string, number>;
    dailyLaborDollars?: Record<string, number>;
    totalWeeklyLaborHours: string;
    totalWeeklyLaborDollars?: string;
    coverage: Record<string, Record<string, number>>;
    openShiftCount: number;
    warnings: string[];
    laborMetrics?: LaborMetrics;
    bistroLabor?: {
      weeklyOccupancyPercent: number;
      occupiedRooms: number;
      scheduledHours: number;
      targetMinHours: number;
      targetMaxHours: number;
      model: string;
      status: string;
    };
  };
  readOnly?: boolean;
};

type LaborMetrics = {
  targets: { hpor: number; hkMporMin: number; hkMporMax: number };
  daily: Record<string, {
    roomsSold: number;
    laborHours: number;
    laborDollars: number;
    hpor: number;
    housekeepingHours: number;
    roomCredits: number;
    hkMpor: number;
    targetHousekeepingHoursMin: number;
    targetHousekeepingHoursMax: number;
    pickupRooms?: number | null;
    popupGroupRooms?: number;
    serviceStayovers?: number;
    dndRooms?: number;
    standardHousekeepingMinutes?: number;
  }>;
  weekly: {
    roomsSold: number;
    laborHours: number;
    laborDollars: number;
    roomRevenue: number;
    actualRoomRevenue: number;
    hpor: number;
    housekeepingHours: number;
    roomCredits: number;
    hkMpor: number;
    targetHousekeepingHoursMin: number;
    targetHousekeepingHoursMax: number;
  };
};

type AiScheduleDraft = {
  assignments: ShiftAssignment[];
  warnings: string[];
  laborMetrics?: LaborMetrics;
  ai: {
    aiAvailable: boolean;
    summary: string;
    recommendations: string[];
    risks: string[];
  };
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(apiUrl(url), { credentials: "include" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function localDateKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function saturdayFor(date = new Date()) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay();
  next.setDate(next.getDate() - day - (day === 6 ? 0 : 1));
  return localDateKey(next);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatWeek(start: string, end: string) {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function shiftText(assignment: ShiftAssignment | undefined, shiftType: ShiftType | undefined) {
  if (!assignment || !shiftType) return "";
  const start = assignment.customStartTime || shiftType.startTime;
  const end = assignment.customEndTime || shiftType.endTime;
  const base = start && end ? `${start.slice(0, 5)}-${end.slice(0, 5)}` : shiftType.label;
  return [base, assignment.roleNote].filter(Boolean).join(" ");
}

function normalizeDepartment(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("leadership") || normalized.includes("mod") || normalized.includes("manager")) return "Managers";
  if (normalized.includes("front") || normalized.includes("audit")) return "Front Desk";
  if (normalized.includes("bistro") || normalized.includes("breakfast")) return "Bistro";
  if (normalized.includes("engineer") || normalized.includes("maintenance")) return "Maintenance";
  if (normalized.includes("house") || normalized.includes("laundry")) return "Housekeeping";
  return DEPARTMENTS.includes(String(value || "")) ? String(value) : "Front Desk";
}

function statusBadge(status: string) {
  if (status === "published") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "archived") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-amber-300 bg-amber-50 text-amber-900";
}

function metricTone(value: number, target: number, higherIsBad = true) {
  const isBad = higherIsBad ? value > target : value < target;
  return isBad ? "text-red-700" : "text-emerald-800";
}

function ScheduleAuthGate({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ firstName: "", lastName: "", employeeDisplayName: "", email: "", password: "" });
  const login = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", mode === "login" ? "/api/tips/auth/login" : "/api/tips/auth/register", mode === "login" ? { email: form.email, password: form.password } : form);
      return response.json();
    },
    onSuccess: onDone,
    onError: (error: Error) => toast({ title: mode === "login" ? "Unable to sign in" : "Unable to create login", description: error.message, variant: "destructive" }),
  });
  return (
    <div className={`min-h-screen px-4 py-8 ${C.page}`}>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center">
        <Card className={C.shell}>
          <CardHeader>
            <CardTitle className={C.ink}>Courtyard Schedule</CardTitle>
            <CardDescription className={C.muted}>{mode === "login" ? "Use your Courtyard account to view schedules and submit requests." : "Create your Courtyard login to view published schedules and submit requests."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mode === "register" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>First name</Label><Input className={C.field} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></div>
                <div><Label>Last name</Label><Input className={C.field} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Display name</Label><Input className={C.field} value={form.employeeDisplayName} onChange={(event) => setForm({ ...form, employeeDisplayName: event.target.value })} placeholder="Optional" /></div>
              </div>
            )}
            <div><Label>Email</Label><Input className={C.field} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
            <div><Label>Password</Label><Input className={C.field} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></div>
            <Button className={`w-full ${C.green}`} disabled={login.isPending} onClick={() => login.mutate()}>{login.isPending ? "Working..." : mode === "login" ? "Sign in" : "Create login"}</Button>
            <Button variant="outline" className={`w-full ${C.outline}`} onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Create your login" : "Back to sign in"}</Button>
            <Button asChild variant="ghost" className="w-full text-[#2f5f46]"><a href="/tips">Need to set or change your password?</a></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ForecastPanel({
  payload,
  editable,
  onSave,
  onImport,
  onActualizedImport,
  onPopupGroupSave,
  importing,
  actualizing,
  spanish,
}: {
  payload: SchedulePayload;
  editable: boolean;
  onSave: (days: ForecastDay[]) => void;
  onImport: (file: File) => void;
  onActualizedImport: (file: File) => void;
  onPopupGroupSave: (body: { forecastDate: string; popupGroupRooms: number; popupGroupNotes: string }) => void;
  importing: boolean;
  actualizing: boolean;
  spanish: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const actualizedInputRef = useRef<HTMLInputElement | null>(null);
  const t = (value: string) => spanish ? ES[value] || value : value;
  const [days, setDays] = useState<ForecastDay[]>(payload.days.map((date) => payload.forecast.find((day) => day.forecastDate === date) || { forecastDate: date, roomsSold: 0, occupancyPercent: 0, arrivals: 0, departures: 0, stayovers: 0 }));
  const [groupForm, setGroupForm] = useState({ forecastDate: payload.days[0] || "", popupGroupRooms: "0", popupGroupNotes: "" });
  useEffect(() => {
    setDays(payload.days.map((date) => payload.forecast.find((day) => day.forecastDate === date) || { forecastDate: date, roomsSold: 0, occupancyPercent: 0, arrivals: 0, departures: 0, stayovers: 0 }));
  }, [payload.schedule.id, payload.forecast, payload.days]);
  return (
    <Card className={C.shell}>
      <CardHeader>
        <CardTitle className={C.ink}>{t("Forecast")}</CardTitle>
        <CardDescription className={C.muted}>Rooms, occupancy, arrivals, departures, and notes drive staffing warnings.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-[#e0d3c1] bg-[#f4eadb] p-2 text-left">Metric</th>
              {days.map((day, index) => <th key={day.forecastDate} className="border border-[#e0d3c1] bg-[#f4eadb] p-2">{(spanish ? DAY_LABELS_ES : DAY_LABELS)[index]} {formatDate(day.forecastDate)}</th>)}
            </tr>
          </thead>
          <tbody>
            {[
              ["roomsSold", t("Rooms sold")],
              ["occupancyPercent", "Occ %"],
              ["arrivals", t("Arrivals")],
              ["departures", t("Departures")],
              ["stayovers", "Stayovers"],
              ["dndRooms", "DND rooms"],
              ["roomRevenue", "Room rev"],
              ["popupGroupRooms", "Pop-up rooms"],
              ["notes", t("Notes")],
            ].map(([key, label]) => (
              <tr key={key}>
                <td className="border border-[#e0d3c1] p-2 font-medium">{label}</td>
                {days.map((day, index) => (
                  <td key={day.forecastDate} className="border border-[#e0d3c1] p-1">
                    <Input
                      className={C.field}
                      disabled={!editable}
                      value={(day as any)[key] || ""}
                      type={key === "notes" ? "text" : "number"}
                      onChange={(event) => setDays((current) => current.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {editable && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className={C.green} onClick={() => onSave(days)}><Save className="mr-2 h-4 w-4" />{t("Save forecast")}</Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
                event.target.value = "";
              }}
            />
            <Button variant="outline" className={C.outline} disabled={importing} onClick={() => fileInputRef.current?.click()}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {importing ? "Importing..." : t("Import OTB CSV")}
            </Button>
            <input
              ref={actualizedInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onActualizedImport(file);
                event.target.value = "";
              }}
            />
            <Button variant="outline" className={C.outline} disabled={actualizing} onClick={() => actualizedInputRef.current?.click()}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {actualizing ? "Uploading..." : t("Upload actualized CSV")}
            </Button>
          </div>
        )}
        {editable && (
          <div className="mt-4 rounded-xl border border-[#e0d3c1] bg-white p-3">
            <div className="mb-2 font-semibold">DOS pop-up group adjustment</div>
            <div className="grid gap-2 md:grid-cols-[160px_140px_1fr_auto]">
              <Select value={groupForm.forecastDate} onValueChange={(forecastDate) => setGroupForm({ ...groupForm, forecastDate })}>
                <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                <SelectContent>{payload.days.map((day, index) => <SelectItem key={day} value={day}>{(spanish ? DAY_LABELS_ES : DAY_LABELS)[index]} {formatDate(day)}</SelectItem>)}</SelectContent>
              </Select>
              <Input className={C.field} type="number" value={groupForm.popupGroupRooms} onChange={(event) => setGroupForm({ ...groupForm, popupGroupRooms: event.target.value })} placeholder="Rooms" />
              <Input className={C.field} value={groupForm.popupGroupNotes} onChange={(event) => setGroupForm({ ...groupForm, popupGroupNotes: event.target.value })} placeholder="Group / demand generator notes" />
              <Button className={C.green} onClick={() => onPopupGroupSave({ forecastDate: groupForm.forecastDate, popupGroupRooms: Number(groupForm.popupGroupRooms || 0), popupGroupNotes: groupForm.popupGroupNotes })}>Save group</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ShiftEditDialog({
  open,
  onOpenChange,
  payload,
  employee,
  date,
  assignment,
  onSave,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: SchedulePayload;
  employee: ScheduleEmployee | null;
  date: string;
  assignment?: ShiftAssignment;
  onSave: (body: any) => void;
  onClear: () => void;
}) {
  const [form, setForm] = useState({
    shiftTypeId: assignment?.shiftTypeId || "",
    customStartTime: assignment?.customStartTime?.slice(0, 5) || "",
    customEndTime: assignment?.customEndTime?.slice(0, 5) || "",
    unpaidBreakMinutes: assignment?.unpaidBreakMinutes?.toString() || "",
    roleNote: assignment?.roleNote || "",
    managerNote: assignment?.managerNote || "",
    isOpenShift: assignment?.isOpenShift || false,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-[#fffaf2] text-[#201814]">
        <DialogHeader>
          <DialogTitle>{employee ? employee.displayName : "Open shift"} - {formatDate(date)}</DialogTitle>
          <DialogDescription className={C.muted}>Shift color is applied automatically from the selected shift type.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Shift type</Label>
            <Select value={form.shiftTypeId || "none"} onValueChange={(shiftTypeId) => setForm({ ...form, shiftTypeId: shiftTypeId === "none" ? "" : shiftTypeId })}>
              <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Clear / no shift</SelectItem>
                {payload.shiftTypes.filter((shift) => shift.active).map((shift) => <SelectItem key={shift.id} value={shift.id}>{shift.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Start</Label><Input className={C.field} type="time" value={form.customStartTime} onChange={(event) => setForm({ ...form, customStartTime: event.target.value })} /></div>
            <div><Label>End</Label><Input className={C.field} type="time" value={form.customEndTime} onChange={(event) => setForm({ ...form, customEndTime: event.target.value })} /></div>
            <div><Label>Break min</Label><Input className={C.field} type="number" value={form.unpaidBreakMinutes} onChange={(event) => setForm({ ...form, unpaidBreakMinutes: event.target.value })} /></div>
          </div>
          <div><Label>Role / station note</Label><Input className={C.field} value={form.roleNote} onChange={(event) => setForm({ ...form, roleNote: event.target.value })} placeholder="Breakfast, MOD, desk, etc." /></div>
          <div><Label>Manager note</Label><Textarea className={C.field} value={form.managerNote} onChange={(event) => setForm({ ...form, managerNote: event.target.value })} rows={2} /></div>
          <div className="flex gap-2">
            <Button className={C.green} onClick={() => onSave({ employeeId: employee?.id || null, shiftDate: date, ...form, unpaidBreakMinutes: form.unpaidBreakMinutes === "" ? null : Number(form.unpaidBreakMinutes) })}>Save shift</Button>
            <Button variant="outline" className={C.outline} onClick={onClear}>Clear</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleGrid({ payload, editable, onEdit, spanish }: { payload: SchedulePayload; editable: boolean; spanish: boolean; onEdit: (employee: ScheduleEmployee, date: string, assignment?: ShiftAssignment) => void }) {
  const assignments = useMemo(() => new Map(payload.assignments.map((assignment) => [`${assignment.employeeId}:${assignment.shiftDate}`, assignment])), [payload.assignments]);
  const shiftTypes = useMemo(() => new Map(payload.shiftTypes.map((shift) => [shift.id, shift])), [payload.shiftTypes]);
  const approvedRequests = useMemo(() => new Map((payload.approvedRequests || []).map((request) => [`${request.employeeId}:${request.requestDate}`, request])), [payload.approvedRequests]);
  const t = (value: string) => spanish ? ES[value] || value : value;
  const labels = spanish ? DAY_LABELS_ES : DAY_LABELS;
  return (
    <Card className={C.shell}>
      <CardHeader>
        <CardTitle className={C.ink}>{t("Weekly schedule")}</CardTitle>
        <CardDescription className={C.muted}>Associates are listed on the left by department. Click any date cell to add or edit that shift.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[220px] border border-[#e0d3c1] bg-[#f4eadb] p-2 text-left">{t("Associate")}</th>
                {payload.days.map((day, index) => <th key={day} className="border border-[#e0d3c1] bg-[#f4eadb] p-2">{labels[index]}<br />{formatDate(day)}</th>)}
                <th className="border border-[#e0d3c1] bg-[#f4eadb] p-2">{t("Hours")}</th>
              </tr>
            </thead>
            <tbody>
              {payload.departments.map((department) => {
                const employees = payload.employees.filter((employee) => normalizeDepartment(employee.department) === department && employee.active);
                if (!employees.length) return null;
                return [
                  <tr key={`${department}-header`}><td colSpan={9} className="border border-[#e0d3c1] bg-[#2a211c] p-2 font-semibold text-white">{department} - {payload.totals.departmentWeeklyHours[department] || 0} hrs</td></tr>,
                  ...employees.map((employee) => (
                    <tr key={employee.id}>
                      <td className="sticky left-0 z-10 border border-[#e0d3c1] bg-white p-2 font-medium">{employee.displayName}<div className="text-xs text-[#5f5247]">{employee.position || ""}</div></td>
                      {payload.days.map((day) => {
                        const assignment = assignments.get(`${employee.id}:${day}`);
                        const approvedRequest = approvedRequests.get(`${employee.id}:${day}`);
                        const shift = assignment ? shiftTypes.get(assignment.shiftTypeId || "") : undefined;
                        return (
                          <td key={day} className="border border-[#e0d3c1] p-1 align-top">
                            <button
                              type="button"
                              disabled={!editable || Boolean(approvedRequest)}
                              className="min-h-12 w-full rounded-md border border-[#e0d3c1] p-2 text-left text-xs disabled:cursor-default"
                              style={{ background: approvedRequest ? "#e5e7eb" : shift?.color || "#ffffff", color: approvedRequest ? "#374151" : shift?.textColor || "#201814" }}
                              onClick={() => onEdit(employee, day, assignment)}
                            >
                              {approvedRequest ? t("Approved request") : shiftText(assignment, shift) || (editable ? `+ ${t("Add shift")}` : "-")}
                            </button>
                          </td>
                        );
                      })}
                      <td className="border border-[#e0d3c1] p-2 text-center font-semibold">{payload.totals.employeeWeeklyHours[employee.id] || 0}</td>
                    </tr>
                  )),
                ];
              })}
              <tr>
                <td className="border border-[#e0d3c1] bg-[#f4eadb] p-2 font-semibold">{t("Daily labor hours")}</td>
                {payload.days.map((day) => <td key={day} className="border border-[#e0d3c1] bg-[#f4eadb] p-2 text-center font-semibold">{payload.totals.dailyLaborHours[day] || 0}</td>)}
                <td className="border border-[#e0d3c1] bg-[#f4eadb] p-2 text-center font-semibold">{payload.totals.totalWeeklyLaborHours}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="space-y-4 lg:hidden">
          {payload.departments.map((department) => {
            const employees = payload.employees.filter((employee) => normalizeDepartment(employee.department) === department && employee.active);
            if (!employees.length) return null;
            return (
              <div key={department}>
                <h3 className="mb-2 font-semibold">{department}</h3>
                <div className="space-y-3">
                  {employees.map((employee) => (
                    <div key={employee.id} className="rounded-xl border border-[#e0d3c1] bg-white p-3">
                      <div className="mb-2 flex justify-between"><div className="font-semibold">{employee.displayName}</div><Badge variant="outline">{payload.totals.employeeWeeklyHours[employee.id] || 0} hrs</Badge></div>
                      <div className="grid gap-2">
                        {payload.days.map((day, index) => {
                          const assignment = assignments.get(`${employee.id}:${day}`);
                          const approvedRequest = approvedRequests.get(`${employee.id}:${day}`);
                          const shift = assignment ? shiftTypes.get(assignment.shiftTypeId || "") : undefined;
                          return (
                            <button key={day} disabled={!editable || Boolean(approvedRequest)} className="rounded-md border border-[#e0d3c1] p-2 text-left text-sm disabled:cursor-default" style={{ background: approvedRequest ? "#e5e7eb" : shift?.color || "#fff", color: approvedRequest ? "#374151" : shift?.textColor || "#201814" }} onClick={() => onEdit(employee, day, assignment)}>
                              <strong>{labels[index]} {formatDate(day)}:</strong> {approvedRequest ? t("Approved request") : shiftText(assignment, shift) || "-"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeeManager({ employees, canViewRates, onAdd, onUpdate, onPayrollImport, importingPayroll }: { employees: ScheduleEmployee[]; canViewRates: boolean; onAdd: (employee: any) => void; onUpdate: (id: string, patch: any) => void; onPayrollImport: (file: File) => void; importingPayroll: boolean }) {
  const payrollInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", displayName: "", department: "Front Desk", position: "", maxWeeklyHours: "40", hourlyRate: "", email: "", phone: "" });
  return (
    <Card className={C.shell}>
      <CardHeader>
        <CardTitle className={C.ink}>Employees</CardTitle>
        <CardDescription className={C.muted}>Add associates to the far-left schedule column and assign their department row group.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input className={C.field} placeholder="First name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
          <Input className={C.field} placeholder="Last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
          <Input className={C.field} placeholder="Display name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
          <Select value={form.department} onValueChange={(department) => setForm({ ...form, department })}>
            <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
            <SelectContent>{DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}</SelectContent>
          </Select>
          <Input className={C.field} placeholder="Position" value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} />
          <Input className={C.field} placeholder="Max weekly hours" type="number" value={form.maxWeeklyHours} onChange={(event) => setForm({ ...form, maxWeeklyHours: event.target.value })} />
          {canViewRates && <Input className={C.field} placeholder="Hourly rate" type="number" value={form.hourlyRate} onChange={(event) => setForm({ ...form, hourlyRate: event.target.value })} />}
          <Input className={C.field} placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <Input className={C.field} placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <Button className={C.green} onClick={() => onAdd({ ...form, maxWeeklyHours: Number(form.maxWeeklyHours || 0), hourlyRate: form.hourlyRate === "" ? null : Number(form.hourlyRate) })}><Plus className="mr-2 h-4 w-4" />Add employee</Button>
          {canViewRates && (
            <>
              <input
                ref={payrollInputRef}
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onPayrollImport(file);
                  event.target.value = "";
                }}
              />
              <Button variant="outline" className={C.outline} disabled={importingPayroll} onClick={() => payrollInputRef.current?.click()}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {importingPayroll ? "Importing payroll..." : "Import payroll rates"}
              </Button>
            </>
          )}
        </div>
        <div className="space-y-2">
          {employees.map((employee) => (
            <div key={employee.id} className={`grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_220px_120px] ${employee.active ? "border-[#e0d3c1] bg-white" : "border-slate-300 bg-slate-100"}`}>
              <div>
                <div className="font-semibold">{employee.displayName}</div>
                <div className="text-sm text-[#5f5247]">{employee.position || "No position"} {employee.maxWeeklyHours ? `- max ${employee.maxWeeklyHours} hrs` : ""} {canViewRates && employee.hourlyRate ? `- $${employee.hourlyRate}/hr` : ""}</div>
              </div>
              <Select value={normalizeDepartment(employee.department)} onValueChange={(department) => onUpdate(employee.id, { department })}>
                <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" className={C.outline} onClick={() => onUpdate(employee.id, { active: !employee.active })}>{employee.active ? "Deactivate" : "Activate"}</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleRequestsPanel({ requests, isAdmin, onSubmit, onStatus }: { requests: ScheduleRequest[]; isAdmin: boolean; onSubmit: (request: any) => void; onStatus: (request: ScheduleRequest, status: string) => void }) {
  const [form, setForm] = useState({ requestDate: "", requestType: "time_off", startTime: "", endTime: "", notes: "" });
  const submit = () => {
    onSubmit({ ...form, startTime: form.startTime || null, endTime: form.endTime || null });
    setForm({ requestDate: "", requestType: "time_off", startTime: "", endTime: "", notes: "" });
  };
  return (
    <Card className={`${C.shell} print:hidden`}>
      <CardHeader>
        <CardTitle className={C.ink}>Schedule requests</CardTitle>
        <CardDescription className={C.muted}>Requests must be submitted at least 14 days before the requested date.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[160px_180px_120px_120px_1fr_auto]">
          <div><Label>Date</Label><Input className={C.field} type="date" value={form.requestDate} onChange={(event) => setForm({ ...form, requestDate: event.target.value })} /></div>
          <div>
            <Label>Type</Label>
            <Select value={form.requestType} onValueChange={(requestType) => setForm({ ...form, requestType })}>
              <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="time_off">Time off</SelectItem>
                <SelectItem value="preferred_shift">Preferred shift</SelectItem>
                <SelectItem value="availability">Availability</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Start</Label><Input className={C.field} type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></div>
          <div><Label>End</Label><Input className={C.field} type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></div>
          <div><Label>Notes</Label><Input className={C.field} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Request details" /></div>
          <div className="flex items-end"><Button className={C.green} disabled={!form.requestDate || !form.notes.trim()} onClick={submit}>Submit</Button></div>
        </div>
        <div className="space-y-2">
          {requests.map((request) => (
            <div key={request.id} className="flex flex-col gap-2 rounded-lg border border-[#e0d3c1] bg-white p-3 text-sm md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold">{isAdmin ? `${request.requester?.employeeDisplayName || "Associate"} - ` : ""}{formatDate(request.requestDate)} - {request.requestType.replace("_", " ")}</div>
                <div className="text-[#5f5247]">{isAdmin && request.department ? `${request.department} - ` : ""}{[request.startTime?.slice(0, 5), request.endTime?.slice(0, 5)].filter(Boolean).join(" - ")} {request.notes}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isAdmin && request.status === "submitted" && Number(request.conflictCount || 0) > 0 && (
                  <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-900">
                    {request.conflictCount} already approved
                  </Badge>
                )}
                <Badge variant="outline" className={request.status === "approved" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : request.status === "denied" ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"}>{request.status}</Badge>
                {isAdmin && request.status === "submitted" && (
                  <>
                    <Button size="sm" variant="outline" className={C.outline} onClick={() => onStatus(request, "approved")}>Approve</Button>
                    <Button size="sm" variant="outline" className={C.outline} onClick={() => onStatus(request, "denied")}>Deny</Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {requests.length === 0 && <div className="text-sm text-[#5f5247]">No schedule requests yet.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const shareToken = params.get("share");
  const [selectedWeekId, setSelectedWeekId] = useState<string>("");
  const [weekStartDate, setWeekStartDate] = useState(saturdayFor());
  const [selectedShift, setSelectedShift] = useState<{ employee: ScheduleEmployee; date: string; assignment?: ShiftAssignment } | null>(null);
  const [aiDraft, setAiDraft] = useState<AiScheduleDraft | null>(null);
  const [spanish, setSpanish] = useState(false);

  const auth = useQuery<{ user: ScheduleUser | null }>({ queryKey: ["/api/schedule/auth/me"], queryFn: () => fetchJson("/api/schedule/auth/me"), enabled: !shareToken });
  const weeks = useQuery<{ weeks: WeeklySchedule[] }>({ queryKey: ["/api/schedule/weeks"], queryFn: () => fetchJson("/api/schedule/weeks"), enabled: !!auth.data?.user && !shareToken });
  const requests = useQuery<{ requests: ScheduleRequest[] }>({ queryKey: ["/api/schedule/requests"], queryFn: () => fetchJson("/api/schedule/requests"), enabled: !!auth.data?.user && !shareToken });
  const share = useQuery<SchedulePayload>({ queryKey: ["/api/schedule/share", shareToken], queryFn: () => fetchJson(`/api/schedule/share/${shareToken}`), enabled: !!shareToken });
  const weekId = selectedWeekId || weeks.data?.weeks?.[0]?.id || "";
  const detail = useQuery<SchedulePayload>({ queryKey: ["/api/schedule/weeks", weekId], queryFn: () => fetchJson(`/api/schedule/weeks/${weekId}`), enabled: !!weekId && !shareToken });
  const payload = shareToken ? share.data : detail.data;
  const user = auth.data?.user;
  const editable = Boolean(user?.isAdmin && payload?.schedule.status === "draft" && !shareToken);

  const createWeek = useMutation({
    mutationFn: async (mode: "blank" | "copyPrevious") => {
      const response = await apiRequest("POST", "/api/schedule/weeks", { weekStartDate, propertyName: "Courtyard Austin Lakeline", mode });
      return response.json();
    },
    onSuccess: (data: SchedulePayload) => {
      setSelectedWeekId(data.schedule.id);
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks"] });
    },
    onError: (error: Error) => toast({ title: "Unable to create week", description: error.message, variant: "destructive" }),
  });
  const addEmployee = useMutation({
    mutationFn: (employee: any) => apiRequest("POST", "/api/schedule/employees", employee),
    onSuccess: () => {
      toast({ title: "Employee added" });
      if (weekId) queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "Employee add failed", description: error.message, variant: "destructive" }),
  });
  const updateEmployee = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => apiRequest("PATCH", `/api/schedule/employees/${id}`, patch),
    onSuccess: () => {
      toast({ title: "Employee updated" });
      if (weekId) queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "Employee update failed", description: error.message, variant: "destructive" }),
  });
  const saveForecast = useMutation({
    mutationFn: (days: ForecastDay[]) => apiRequest("PUT", `/api/schedule/weeks/${payload?.schedule.id}/forecast`, { days }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] }),
  });
  const importForecast = useMutation({
    mutationFn: async (file: File) => {
      if (!payload?.schedule.id) throw new Error("Select a schedule before importing forecast data.");
      const formData = new FormData();
      formData.append("forecastReport", file);
      const response = await fetch(apiUrl(`/api/schedule/weeks/${payload.schedule.id}/forecast/import`), {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Forecast imported", description: "On-the-books data was parsed and adjusted for pickup." });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "Forecast import failed", description: error.message, variant: "destructive" }),
  });
  const importActualized = useMutation({
    mutationFn: async (file: File) => {
      if (!payload?.schedule.id) throw new Error("Select a schedule before uploading actualized data.");
      const formData = new FormData();
      formData.append("actualizedReport", file);
      const response = await fetch(apiUrl(`/api/schedule/weeks/${payload.schedule.id}/forecast/actualized`), {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Actualized stats uploaded", description: "Pickup can now be compared against the original OTB import." });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "Actualized upload failed", description: error.message, variant: "destructive" }),
  });
  const savePopupGroup = useMutation({
    mutationFn: (body: { forecastDate: string; popupGroupRooms: number; popupGroupNotes: string }) => apiRequest("PATCH", `/api/schedule/weeks/${payload?.schedule.id}/forecast/groups`, body),
    onSuccess: () => {
      toast({ title: "Pop-up group saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "Group save failed", description: error.message, variant: "destructive" }),
  });
  const importPayrollRates = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("payrollRegister", file);
      const response = await fetch(apiUrl("/api/schedule/employees/payroll-import"), {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (data: { matched: any[]; unmatched: any[] }) => {
      toast({ title: "Payroll rates imported", description: `${data.matched.length} matched, ${data.unmatched.length} unmatched.` });
      if (weekId) queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "Payroll import failed", description: error.message, variant: "destructive" }),
  });
  const generateAiSchedule = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/schedule/weeks/${payload?.schedule.id}/ai/generate`, {});
      return response.json() as Promise<AiScheduleDraft>;
    },
    onSuccess: (data) => {
      setAiDraft(data);
      toast({ title: "AI draft generated", description: `${data.assignments.length} proposed shifts are ready to review.` });
    },
    onError: (error: Error) => toast({ title: "AI draft failed", description: error.message, variant: "destructive" }),
  });
  const applyAiSchedule = useMutation({
    mutationFn: async () => {
      if (!aiDraft) throw new Error("Generate an AI draft first.");
      const response = await apiRequest("POST", `/api/schedule/weeks/${payload?.schedule.id}/ai/apply`, { assignments: aiDraft.assignments });
      return response.json();
    },
    onSuccess: () => {
      setAiDraft(null);
      toast({ title: "AI draft applied", description: "Review the schedule before publishing." });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "AI apply failed", description: error.message, variant: "destructive" }),
  });
  const saveShift = useMutation({
    mutationFn: (body: any) => apiRequest("PUT", `/api/schedule/weeks/${payload?.schedule.id}/shifts`, body),
    onSuccess: () => {
      setSelectedShift(null);
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "Shift save failed", description: error.message, variant: "destructive" }),
  });
  const action = useMutation({
    mutationFn: async ({ name, body }: { name: "publish" | "reopen" | "archive"; body?: any }) => {
      const response = await apiRequest("POST", `/api/schedule/weeks/${payload?.schedule.id}/${name}`, body || {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
  });
  const shareLink = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/schedule/weeks/${payload?.schedule.id}/share-link`, {});
      return response.json();
    },
    onSuccess: async (data) => {
      await navigator.clipboard?.writeText(data.url);
      toast({ title: "Share link copied", description: data.url });
    },
    onError: (error: Error) => toast({ title: "Share failed", description: error.message, variant: "destructive" }),
  });
  const submitRequest = useMutation({
    mutationFn: async (request: any) => {
      const response = await apiRequest("POST", "/api/schedule/requests", request);
      return response.json();
    },
    onSuccess: (data: { emailSent?: boolean }) => {
      toast({
        title: "Schedule request submitted",
        description: data.emailSent ? "Your department manager was notified." : "Your request was saved. Manager email could not be sent automatically.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/requests"] });
    },
    onError: (error: Error) => toast({ title: "Request not submitted", description: error.message, variant: "destructive" }),
  });
  const updateRequestStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PATCH", `/api/schedule/requests/${id}/status`, { status }),
    onSuccess: () => {
      toast({ title: "Request updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/requests"] });
    },
    onError: (error: Error) => toast({ title: "Request update failed", description: error.message, variant: "destructive" }),
  });

  if (!shareToken && auth.isLoading) return <div className={`min-h-screen p-8 ${C.page}`}>Loading Schedule...</div>;
  if (!shareToken && !auth.data?.user) return <ScheduleAuthGate onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/schedule/auth/me"] })} />;

  return (
    <div className={`min-h-screen ${C.page}`}>
      <header className="border-b border-[#deceba] bg-[#fffaf2]/95 px-4 py-4 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Lakeline</div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Courtyard Schedule Builder</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className={C.outline} onClick={() => setSpanish((value) => !value)}>
              {spanish ? "English" : "Español"}
            </Button>
            {!shareToken && user?.isAdmin && <Input className={`${C.field} w-[160px]`} type="date" value={weekStartDate} onChange={(event) => setWeekStartDate(event.target.value)} />}
            {!shareToken && user?.isAdmin && <Button className={C.green} onClick={() => createWeek.mutate("blank")}><CalendarDays className="mr-2 h-4 w-4" />Blank week</Button>}
            {!shareToken && user?.isAdmin && <Button variant="outline" className={C.outline} onClick={() => createWeek.mutate("copyPrevious")}><Copy className="mr-2 h-4 w-4" />Copy previous</Button>}
            <Button variant="outline" className={C.outline} onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {!shareToken && (
          <Card className={`${C.shell} print:hidden`}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Label>Week</Label>
                <Select value={weekId || "none"} onValueChange={setSelectedWeekId}>
                  <SelectTrigger className={`${C.field} w-[240px]`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select schedule</SelectItem>
                    {(weeks.data?.weeks || []).map((week) => <SelectItem key={week.id} value={week.id}>{formatWeek(week.weekStartDate, week.weekEndDate)} - {week.status}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {payload && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={statusBadge(payload.schedule.status)}>{payload.schedule.status}</Badge>
                  {payload.schedule.status === "draft" && user?.isAdmin && <Button className={C.green} onClick={() => action.mutate({ name: "publish" })}><CheckCircle2 className="mr-2 h-4 w-4" />Publish</Button>}
                  {payload.schedule.status === "published" && user?.isAdmin && <Button variant="outline" className={C.outline} onClick={() => action.mutate({ name: "reopen", body: { reason: "Manager edit" } })}><RefreshCw className="mr-2 h-4 w-4" />Reopen</Button>}
                  {user?.isAdmin && <Button variant="outline" className={C.outline} onClick={() => action.mutate({ name: "archive" })}><Archive className="mr-2 h-4 w-4" />Archive</Button>}
                  {payload.schedule.status === "published" && user?.isAdmin && <Button variant="outline" className={C.outline} onClick={() => shareLink.mutate()}><Share2 className="mr-2 h-4 w-4" />Copy share link</Button>}
                  <Button asChild variant="outline" className={C.outline}><a href={apiUrl(`/api/schedule/weeks/${payload.schedule.id}/pdf`)}><Download className="mr-2 h-4 w-4" />PDF</a></Button>
                  <Button asChild variant="outline" className={C.outline}><a href={apiUrl(`/api/schedule/weeks/${payload.schedule.id}/excel`)}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</a></Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!shareToken && user && (
          <ScheduleRequestsPanel
            requests={requests.data?.requests || []}
            isAdmin={Boolean(user.isAdmin)}
            onSubmit={(request) => submitRequest.mutate(request)}
            onStatus={(request, status) => {
              if (
                status === "approved" &&
                Number(request.conflictCount || 0) > 0 &&
                !window.confirm(`${request.conflictCount} associate(s) in ${request.department || "this department"} are already approved off on ${formatDate(request.requestDate)}. Approve this additional request?`)
              ) {
                return;
              }
              updateRequestStatus.mutate({ id: request.id, status });
            }}
          />
        )}

        {!payload ? (
          <Card className={C.shell}><CardContent className="p-6">{shareToken ? "Loading shared schedule..." : "Create or select a week to begin."}</CardContent></Card>
        ) : (
          <>
            <Card className={C.shell}>
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className={C.ink}>{payload.schedule.propertyName}</CardTitle>
                    <CardDescription className={C.muted}>{formatWeek(payload.schedule.weekStartDate, payload.schedule.weekEndDate)}</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {editable && (
                      <Button className={C.accent} disabled={generateAiSchedule.isPending} onClick={() => generateAiSchedule.mutate()}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        {generateAiSchedule.isPending ? "Generating..." : (spanish ? ES["Generate AI schedule"] : "Generate AI schedule")}
                      </Button>
                    )}
                    <Badge variant="outline" className={statusBadge(payload.schedule.status)}>{payload.schedule.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">{spanish ? ES["Weekly hours"] : "Weekly hours"}</div><div className="text-3xl font-semibold">{payload.totals.totalWeeklyLaborHours}</div></div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Labor $</div><div className="text-3xl font-semibold">${payload.totals.totalWeeklyLaborDollars || "0.00"}</div></div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                  <div className="text-sm text-[#5f5247]">HPOR target {payload.totals.laborMetrics?.targets.hpor ?? 1.3}</div>
                  <div className={`text-3xl font-semibold ${metricTone(payload.totals.laborMetrics?.weekly.hpor || 0, payload.totals.laborMetrics?.targets.hpor || 1.3)}`}>{payload.totals.laborMetrics?.weekly.hpor ?? "0.00"}</div>
                </div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                  <div className="text-sm text-[#5f5247]">HK MPOR target {payload.totals.laborMetrics?.targets.hkMporMin ?? 25}-{payload.totals.laborMetrics?.targets.hkMporMax ?? 30}</div>
                  <div className={`text-3xl font-semibold ${metricTone(payload.totals.laborMetrics?.weekly.hkMpor || 0, payload.totals.laborMetrics?.targets.hkMporMax || 30)}`}>{payload.totals.laborMetrics?.weekly.hkMpor ?? "0.0"}</div>
                </div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">{spanish ? ES["Open shifts"] : "Open shifts"}</div><div className="text-3xl font-semibold">{payload.totals.openShiftCount}</div></div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">{spanish ? ES.Employees : "Employees"}</div><div className="text-3xl font-semibold">{payload.employees.filter((e) => e.active).length}</div></div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">{spanish ? ES.Warnings : "Warnings"}</div><div className="text-3xl font-semibold">{payload.totals.warnings.length}</div></div>
              </CardContent>
            </Card>

            {payload.totals.laborMetrics && (
              <Card className={C.shell}>
                <CardHeader>
                  <CardTitle className={C.ink}>Labor targets</CardTitle>
                  <CardDescription className={C.muted}>HPOR is total labor hours per occupied room. HK MPOR is room-attendant minutes per weighted room credit.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">Forecast rooms</div>
                    <div className="text-2xl font-semibold">{payload.totals.laborMetrics.weekly.roomsSold}</div>
                  </div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">HK room credits</div>
                    <div className="text-2xl font-semibold">{payload.totals.laborMetrics.weekly.roomCredits}</div>
                  </div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">Target HK hours</div>
                    <div className="text-2xl font-semibold">{payload.totals.laborMetrics.weekly.targetHousekeepingHoursMin}-{payload.totals.laborMetrics.weekly.targetHousekeepingHoursMax}</div>
                  </div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">Room revenue</div>
                    <div className="text-2xl font-semibold">${payload.totals.laborMetrics.weekly.roomRevenue || 0}</div>
                  </div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">Actual pickup</div>
                    <div className="text-2xl font-semibold">
                      {payload.forecast.some((day) => day.actualRoomsSold != null && day.otbRoomsSold != null)
                        ? payload.forecast.reduce((sum, day) => sum + (Number(day.actualRoomsSold ?? day.otbRoomsSold ?? 0) - Number(day.otbRoomsSold ?? 0)), 0)
                        : "-"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {payload.totals.bistroLabor && (
              <Card className={C.shell}>
                <CardHeader>
                  <CardTitle className={C.ink}>{spanish ? ES["Bistro labor"] : "Bistro labor"}</CardTitle>
                  <CardDescription className={C.muted}>Sliding scale from the Bistro labor guide based on weekly occupancy.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Weekly Occ</div><div className="text-2xl font-semibold">{payload.totals.bistroLabor.weeklyOccupancyPercent}%</div></div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Model</div><div className="text-xl font-semibold">{payload.totals.bistroLabor.model}</div></div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Target hours</div><div className="text-2xl font-semibold">{payload.totals.bistroLabor.targetMinHours}-{payload.totals.bistroLabor.targetMaxHours}</div></div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Scheduled</div><div className="text-2xl font-semibold">{payload.totals.bistroLabor.scheduledHours}</div></div>
                </CardContent>
              </Card>
            )}

            {payload.totals.warnings.length > 0 && (
              <Card className={`${C.shell} border-amber-300`}>
                <CardHeader><CardTitle className={`${C.ink} flex items-center gap-2`}><AlertTriangle className="h-5 w-5 text-amber-700" />Staffing warnings</CardTitle></CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">{payload.totals.warnings.map((warning) => <div key={warning} className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">{warning}</div>)}</CardContent>
              </Card>
            )}

            <ForecastPanel
              payload={payload}
              editable={editable}
              onSave={(days) => saveForecast.mutate(days)}
              onImport={(file) => importForecast.mutate(file)}
              onActualizedImport={(file) => importActualized.mutate(file)}
              onPopupGroupSave={(body) => savePopupGroup.mutate(body)}
              importing={importForecast.isPending}
              actualizing={importActualized.isPending}
              spanish={spanish}
            />
            <ScheduleGrid payload={payload} editable={editable} spanish={spanish} onEdit={(employee, date, assignment) => setSelectedShift({ employee, date, assignment })} />
            {user?.isAdmin && !shareToken && (
              <EmployeeManager
                employees={payload.employees}
                canViewRates={Boolean(user?.isSuperAdmin)}
                onAdd={(employee) => addEmployee.mutate(employee)}
                onUpdate={(id, patch) => updateEmployee.mutate({ id, patch })}
                onPayrollImport={(file) => importPayrollRates.mutate(file)}
                importingPayroll={importPayrollRates.isPending}
              />
            )}
            {!editable && !shareToken && payload.schedule.status === "published" && <div className="flex items-center gap-2 text-sm text-[#5f5247]"><Lock className="h-4 w-4" />Published schedules are read-only until reopened.</div>}
          </>
        )}
      </main>
      {payload && selectedShift && (
        <ShiftEditDialog
          open={!!selectedShift}
          onOpenChange={(open) => !open && setSelectedShift(null)}
          payload={payload}
          employee={selectedShift.employee}
          date={selectedShift.date}
          assignment={selectedShift.assignment}
          onSave={(body) => saveShift.mutate(body)}
          onClear={() => saveShift.mutate({ employeeId: selectedShift.employee.id, shiftDate: selectedShift.date, clear: true })}
        />
      )}
      <Dialog open={!!aiDraft} onOpenChange={(open) => !open && setAiDraft(null)}>
        <DialogContent className="max-w-3xl bg-[#fffaf2] text-[#201814]">
          <DialogHeader>
            <DialogTitle>AI schedule draft</DialogTitle>
            <DialogDescription className={C.muted}>
              Review the draft before applying. Applying updates matching associate/date cells but does not publish the schedule.
            </DialogDescription>
          </DialogHeader>
          {aiDraft && (
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                <div className="text-sm font-semibold">{aiDraft.ai.aiAvailable ? "OpenAI review" : "Rules-based draft"}</div>
                <p className="mt-1 text-sm text-[#5f5247]">{aiDraft.ai.summary}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Proposed shifts</div><div className="text-2xl font-semibold">{aiDraft.assignments.length}</div></div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Current HPOR</div><div className="text-2xl font-semibold">{aiDraft.laborMetrics?.weekly.hpor ?? "-"}</div></div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Current HK MPOR</div><div className="text-2xl font-semibold">{aiDraft.laborMetrics?.weekly.hkMpor ?? "-"}</div></div>
              </div>
              {aiDraft.ai.recommendations.length > 0 && (
                <div>
                  <h3 className="font-semibold">Recommendations</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#5f5247]">
                    {aiDraft.ai.recommendations.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                </div>
              )}
              {(aiDraft.ai.risks.length > 0 || aiDraft.warnings.length > 0) && (
                <div>
                  <h3 className="font-semibold">Warnings</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#5f5247]">
                    {[...aiDraft.ai.risks, ...aiDraft.warnings].filter(Boolean).slice(0, 12).map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" className={C.outline} onClick={() => setAiDraft(null)}>Keep manual schedule</Button>
                <Button className={C.green} disabled={applyAiSchedule.isPending} onClick={() => applyAiSchedule.mutate()}>
                  {applyAiSchedule.isPending ? "Applying..." : "Apply AI draft"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
