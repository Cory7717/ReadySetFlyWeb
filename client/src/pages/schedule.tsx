import { useMemo, useState } from "react";
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
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  groupsEventsNotes?: string | null;
  notes?: string | null;
};

type ShiftAssignment = {
  id: string;
  scheduleId: string;
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
    dailyLaborHours: Record<string, number>;
    totalWeeklyLaborHours: string;
    coverage: Record<string, Record<string, number>>;
    openShiftCount: number;
    warnings: string[];
  };
  readOnly?: boolean;
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

function mondayFor(date = new Date()) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
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

function ForecastPanel({ payload, editable, onSave }: { payload: SchedulePayload; editable: boolean; onSave: (days: ForecastDay[]) => void }) {
  const [days, setDays] = useState<ForecastDay[]>(payload.days.map((date) => payload.forecast.find((day) => day.forecastDate === date) || { forecastDate: date, roomsSold: 0, occupancyPercent: 0, arrivals: 0, departures: 0, stayovers: 0 }));
  return (
    <Card className={C.shell}>
      <CardHeader>
        <CardTitle className={C.ink}>Forecast</CardTitle>
        <CardDescription className={C.muted}>Rooms, occupancy, arrivals, departures, and notes drive staffing warnings.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-[#e0d3c1] bg-[#f4eadb] p-2 text-left">Metric</th>
              {days.map((day, index) => <th key={day.forecastDate} className="border border-[#e0d3c1] bg-[#f4eadb] p-2">{DAY_LABELS[index]} {formatDate(day.forecastDate)}</th>)}
            </tr>
          </thead>
          <tbody>
            {[
              ["roomsSold", "Rooms sold"],
              ["occupancyPercent", "Occ %"],
              ["arrivals", "Arrivals"],
              ["departures", "Departures"],
              ["stayovers", "Stayovers"],
              ["notes", "Notes"],
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
        {editable && <Button className={`mt-3 ${C.green}`} onClick={() => onSave(days)}><Save className="mr-2 h-4 w-4" />Save forecast</Button>}
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

function ScheduleGrid({ payload, editable, onEdit }: { payload: SchedulePayload; editable: boolean; onEdit: (employee: ScheduleEmployee, date: string, assignment?: ShiftAssignment) => void }) {
  const assignments = useMemo(() => new Map(payload.assignments.map((assignment) => [`${assignment.employeeId}:${assignment.shiftDate}`, assignment])), [payload.assignments]);
  const shiftTypes = useMemo(() => new Map(payload.shiftTypes.map((shift) => [shift.id, shift])), [payload.shiftTypes]);
  const approvedRequests = useMemo(() => new Map((payload.approvedRequests || []).map((request) => [`${request.employeeId}:${request.requestDate}`, request])), [payload.approvedRequests]);
  return (
    <Card className={C.shell}>
      <CardHeader>
        <CardTitle className={C.ink}>Weekly schedule</CardTitle>
        <CardDescription className={C.muted}>Associates are listed on the left by department. Click any date cell to add or edit that shift.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[220px] border border-[#e0d3c1] bg-[#f4eadb] p-2 text-left">Associate</th>
                {payload.days.map((day, index) => <th key={day} className="border border-[#e0d3c1] bg-[#f4eadb] p-2">{DAY_LABELS[index]}<br />{formatDate(day)}</th>)}
                <th className="border border-[#e0d3c1] bg-[#f4eadb] p-2">Hours</th>
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
                              {approvedRequest ? "Approved request" : shiftText(assignment, shift) || (editable ? "+ Add shift" : "-")}
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
                <td className="border border-[#e0d3c1] bg-[#f4eadb] p-2 font-semibold">Daily labor hours</td>
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
                              <strong>{DAY_LABELS[index]} {formatDate(day)}:</strong> {approvedRequest ? "Approved request" : shiftText(assignment, shift) || "-"}
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

function EmployeeManager({ employees, onAdd, onUpdate }: { employees: ScheduleEmployee[]; onAdd: (employee: any) => void; onUpdate: (id: string, patch: any) => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", displayName: "", department: "Front Desk", position: "", maxWeeklyHours: "40", email: "", phone: "" });
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
          <Input className={C.field} placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <Input className={C.field} placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <Button className={C.green} onClick={() => onAdd({ ...form, maxWeeklyHours: Number(form.maxWeeklyHours || 0) })}><Plus className="mr-2 h-4 w-4" />Add employee</Button>
        </div>
        <div className="space-y-2">
          {employees.map((employee) => (
            <div key={employee.id} className={`grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_220px_120px] ${employee.active ? "border-[#e0d3c1] bg-white" : "border-slate-300 bg-slate-100"}`}>
              <div>
                <div className="font-semibold">{employee.displayName}</div>
                <div className="text-sm text-[#5f5247]">{employee.position || "No position"} {employee.maxWeeklyHours ? `- max ${employee.maxWeeklyHours} hrs` : ""}</div>
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
  const [weekStartDate, setWeekStartDate] = useState(mondayFor());
  const [selectedShift, setSelectedShift] = useState<{ employee: ScheduleEmployee; date: string; assignment?: ShiftAssignment } | null>(null);

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
                  <Badge variant="outline" className={statusBadge(payload.schedule.status)}>{payload.schedule.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Weekly hours</div><div className="text-3xl font-semibold">{payload.totals.totalWeeklyLaborHours}</div></div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Open shifts</div><div className="text-3xl font-semibold">{payload.totals.openShiftCount}</div></div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Employees</div><div className="text-3xl font-semibold">{payload.employees.filter((e) => e.active).length}</div></div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Warnings</div><div className="text-3xl font-semibold">{payload.totals.warnings.length}</div></div>
              </CardContent>
            </Card>

            {payload.totals.warnings.length > 0 && (
              <Card className={`${C.shell} border-amber-300`}>
                <CardHeader><CardTitle className={`${C.ink} flex items-center gap-2`}><AlertTriangle className="h-5 w-5 text-amber-700" />Staffing warnings</CardTitle></CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">{payload.totals.warnings.map((warning) => <div key={warning} className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">{warning}</div>)}</CardContent>
              </Card>
            )}

            <ForecastPanel payload={payload} editable={editable} onSave={(days) => saveForecast.mutate(days)} />
            <ScheduleGrid payload={payload} editable={editable} onEdit={(employee, date, assignment) => setSelectedShift({ employee, date, assignment })} />
            {user?.isAdmin && !shareToken && <EmployeeManager employees={payload.employees} onAdd={(employee) => addEmployee.mutate(employee)} onUpdate={(id, patch) => updateEmployee.mutate({ id, patch })} />}
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
    </div>
  );
}
