import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  GripVertical,
  Lock,
  Mail,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Share2,
  Sparkles,
  Users,
  X,
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

const DEPARTMENTS = ["Managers", "Front Desk", "Night Audit", "Bistro", "Maintenance", "Housekeeping"];
const SCHEDULE_ROLES = ["GM", "DOS", "DOS / Sales", "Sales", "MOD", "Executive Housekeeper", "Exec HK", "FD AM", "FD PM", "Night Audit", "Bistro AM", "Bistro PM", "Breakfast", "Maintenance", "Room Attendant", "Laundry", "Room Inspector", "Houseperson"];
const DAY_LABELS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_LABELS_ES = ["Sab", "Dom", "Lun", "Mar", "Mie", "Jue", "Vie"];

const ES: Record<string, string> = {
  "Courtyard Schedule Builder": "Constructor de Horarios Courtyard",
  "Courtyard Austin Lakeline": "Courtyard Austin Lakeline",
  English: "Ingles",
  "Blank week": "Semana en blanco",
  "Copy previous": "Copiar anterior",
  Print: "Imprimir",
  Week: "Semana",
  "Select schedule": "Seleccionar horario",
  Publish: "Publicar",
  Reopen: "Reabrir",
  Archive: "Archivar",
  "Copy share link": "Copiar enlace",
  "Generate AI schedule": "Generar horario con IA",
  "Weekly hours": "Horas semanales",
  "Labor $": "Labor $",
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
  "DOS pop-up group adjustment": "Ajuste de grupo nuevo del DOS",
  "Group rooms": "Cuartos de grupo",
  "Group notes": "Notas del grupo",
  "Save group": "Guardar grupo",
  "Weekly schedule": "Horario semanal",
  "Associates are listed on the left by department. Click any date cell to add or edit that shift.": "Los empleados estan a la izquierda por departamento. Haga clic en cualquier celda para agregar o editar un turno.",
  Associate: "Empleado",
  Hours: "Horas",
  "Approved request": "Solicitud aprobada",
  "Add shift": "Agregar turno",
  "Daily labor hours": "Horas de labor diarias",
  "Bistro labor": "Labor Bistro",
  "Add employee": "Agregar empleado",
  "Add employees to the far-left schedule column and assign their department row group.": "Agregue empleados a la columna izquierda del horario y asigne su departamento.",
  "First name": "Nombre",
  "Last name": "Apellido",
  "Display name": "Nombre visible",
  Department: "Departamento",
  Position: "Puesto",
  "Max weekly hours": "Horas maximas semanales",
  "Hourly rate": "Tarifa por hora",
  Email: "Correo",
  Phone: "Telefono",
  "Import payroll rates": "Importar tarifas de nomina",
  "Importing payroll...": "Importando nomina...",
  Deactivate: "Desactivar",
  Activate: "Activar",
  "No position": "Sin puesto",
  "Schedule requests": "Solicitudes de horario",
  "Requests must be submitted at least 14 days before the requested date.": "Las solicitudes deben enviarse al menos 14 dias antes de la fecha solicitada.",
  Date: "Fecha",
  Type: "Tipo",
  Start: "Inicio",
  End: "Fin",
  "Request details": "Detalles de la solicitud",
  Submit: "Enviar",
  "Time off": "Tiempo libre",
  "Preferred shift": "Turno preferido",
  Availability: "Disponibilidad",
  Other: "Otro",
  Approve: "Aprobar",
  Deny: "Negar",
  "No schedule requests yet.": "Todavia no hay solicitudes de horario.",
  "Published schedules are read-only until reopened.": "Los horarios publicados son de solo lectura hasta que se reabran.",
  "Schedule tutorial": "Tutorial del horario",
  "Create or select a week": "Crear o seleccionar una semana",
  "Choose the Saturday start date, create a blank week, or copy the previous schedule.": "Elija la fecha de inicio del sabado, cree una semana en blanco o copie el horario anterior.",
  "Review, approve, or deny department requests before building the week.": "Revise, apruebe o niegue solicitudes del departamento antes de crear la semana.",
  "Submit time-off or availability requests here. Requests inside the two-week window may be rejected.": "Envie solicitudes de tiempo libre o disponibilidad aqui. Las solicitudes dentro de dos semanas pueden ser rechazadas.",
  "Import OTB reports, upload actualized stats, and adjust rooms. Forecast changes drive staffing warnings and labor targets.": "Importe reportes OTB, suba estadisticas actualizadas y ajuste cuartos. El pronostico controla alertas de personal y metas de labor.",
  "Weekly grid": "Tabla semanal",
  "Click an associate/day cell to add or edit a shift. Housekeeping cells include a board button for MPOR.": "Haga clic en empleado/dia para agregar o editar un turno. Las celdas de Housekeeping incluyen boton de tablero para MPOR.",
  "View your published schedule by department and day.": "Vea su horario publicado por departamento y dia.",
  Associates: "Empleados",
  "Managers add associates, assign departments, and activate or deactivate employees. Only super admin can see pay rates.": "Los managers agregan empleados, asignan departamentos y activan o desactivan empleados. Solo super admin puede ver tarifas.",
  Next: "Siguiente",
  Back: "Atras",
  Done: "Listo",
  "Skip tutorial": "Omitir tutorial",
};

type ScheduleUser = {
  id: string;
  email: string;
  employeeDisplayName: string;
  firstName?: string;
  lastName?: string;
  role?: string;
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
  rolesJson?: string[] | null;
  isSalaried?: boolean;
  isDepartmentManager?: boolean;
  sortOrder?: number;
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
  dndRooms?: number | null;
  roomRevenue?: string | number | null;
  otbRoomsSold?: number | null;
  otbOccupancyPercent?: string | number | null;
  otbArrivals?: number | null;
  otbDepartures?: number | null;
  actualRoomsSold?: number | null;
  actualOccupancyPercent?: string | number | null;
  actualArrivals?: number | null;
  actualDepartures?: number | null;
  actualRoomRevenue?: string | number | null;
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
  roleWorked?: string | null;
  isOpenShift: boolean;
};

type HousekeepingBoard = {
  id?: string;
  scheduleId?: string;
  employeeId: string;
  boardDate: string;
  actualHours: number | string;
  checkoutRooms: number;
  stayoverRooms: number;
  dndRooms: number;
  oooRooms: number;
  deepCleanRooms: number;
  notes?: string | null;
  roomCredits?: number;
  standardMinutes?: number;
  mpor?: number;
};

type SchedulePayload = {
  schedule: WeeklySchedule;
  days: string[];
  departments: string[];
  requiredDepartments?: string[];
  employees: ScheduleEmployee[];
  shiftTypes: ShiftType[];
  forecast: ForecastDay[];
  assignments: ShiftAssignment[];
  housekeepingBoards?: HousekeepingBoard[];
  approvedRequests?: ScheduleRequest[];
  totals: {
    employeeWeeklyHours: Record<string, number>;
    departmentDailyHours: Record<string, Record<string, number>>;
    departmentWeeklyHours: Record<string, number>;
    departmentWeeklyLaborDollars?: Record<string, number>;
    departmentWeeklyLaborDollarsIncludingSalary?: Record<string, number>;
    dailyLaborHours: Record<string, number>;
    dailyLaborHoursIncludingSalary?: Record<string, number>;
    dailySalariedLaborHours?: Record<string, number>;
    dailyLaborDollars?: Record<string, number>;
    dailyLaborDollarsIncludingSalary?: Record<string, number>;
    dailySalariedLaborDollars?: Record<string, number>;
    totalWeeklyLaborHours: string;
    totalWeeklyLaborHoursIncludingSalary?: string;
    totalWeeklySalariedLaborHours?: string;
    totalWeeklyLaborDollars?: string;
    totalWeeklyLaborDollarsIncludingSalary?: string;
    totalWeeklySalariedLaborDollars?: string;
    totalWeeklyLaborPercentOfRoomRevenue?: string;
    totalWeeklyLaborPercentOfRoomRevenueIncludingSalary?: string;
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
  departmentStatus?: Record<string, { completedAt?: string; completedBy?: string }>;
  currentUserPermissions?: { editableDepartments: string[]; canPublishFinal: boolean };
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
  const base = start && end ? `${formatTimeCompact(start)} - ${formatTimeCompact(end)}` : shiftType.label;
  return [base, usefulShiftNote(assignment.roleNote, assignment.roleWorked, shiftType)].filter(Boolean).join("\n");
}

function usefulShiftNote(note: string | null | undefined, roleWorked: string | null | undefined, shiftType: ShiftType | undefined) {
  const value = String(note || "").trim();
  if (!value) return "";
  const normalized = value.toLowerCase();
  const role = String(roleWorked || "").trim().toLowerCase();
  const shiftLabel = String(shiftType?.label || "").trim().toLowerCase();
  const department = String(shiftType?.departmentHint || "").trim().toLowerCase();
  if (normalized === role || normalized === shiftLabel || normalized === department) return "";
  if (/^(gm|dos|dos \/ sales|sales|mod|manager|managers|front desk|fd am|fd pm|night audit|bistro|bistro am|bistro pm|breakfast|maintenance|housekeeping|room attendant|laundry|room inspector|houseperson)$/i.test(value)) return "";
  return value;
}

function formatTime12(value?: string | null) {
  if (!value) return "";
  const [hh, mm] = value.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return value || "";
  const period = hh >= 12 ? "PM" : "AM";
  const hour = hh % 12 || 12;
  return `${hour}:${String(mm).padStart(2, "0")} ${period}`;
}

function formatTimeCompact(value?: string | null) {
  if (!value) return "";
  const [hh, mm] = value.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return value || "";
  const period = hh >= 12 ? "PM" : "AM";
  const hour = hh % 12 || 12;
  return mm === 0 ? `${hour} ${period}` : `${hour}:${String(mm).padStart(2, "0")} ${period}`;
}

function normalizeDepartment(value?: string | null) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();
  if (DEPARTMENTS.includes(raw)) return raw;
  if (normalized.includes("audit") || normalized.includes("night")) return "Night Audit";
  if (normalized.includes("front") || normalized.includes("fd ") || normalized === "fd am" || normalized === "fd pm" || normalized.includes("desk")) return "Front Desk";
  if (normalized.includes("bistro") || normalized.includes("breakfast")) return "Bistro";
  if (normalized.includes("engineer") || normalized.includes("maintenance")) return "Maintenance";
  if (normalized.includes("house") || normalized.includes("hk") || normalized.includes("laundry") || normalized.includes("room attendant") || normalized.includes("inspector")) return "Housekeeping";
  if (normalized.includes("leadership") || normalized.includes("mod") || normalized.includes("general manager") || normalized === "gm" || normalized.includes("director of sales") || normalized === "dos" || normalized.includes("sales") || normalized.includes("manager")) return "Managers";
  return "Front Desk";
}

function roleDepartment(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("fd ") || normalized === "front desk" || normalized.includes("desk")) return "Front Desk";
  if (normalized.includes("audit") || normalized.includes("night")) return "Night Audit";
  if (normalized.includes("bistro") || normalized.includes("breakfast")) return "Bistro";
  if (normalized.includes("maintenance") || normalized.includes("engineer")) return "Maintenance";
  if (normalized.includes("room attendant") || normalized.includes("laundry") || normalized.includes("inspector") || normalized.includes("houseperson") || normalized.includes("housekeeping") || normalized.includes("hk")) return "Housekeeping";
  if (normalized.includes("director of sales") || normalized === "sales" || normalized.includes("gm") || normalized.includes("dos") || normalized.includes("mod") || normalized.includes("manager")) return "Managers";
  return "";
}

function employeeDepartments(employee: ScheduleEmployee) {
  return Array.from(new Set([
    normalizeDepartment(employee.department),
    ...rolesArray(employee.rolesJson).map(roleDepartment).filter(Boolean),
  ]));
}

function findEmployeeForUser(payload: SchedulePayload, user?: ScheduleUser | null) {
  if (!user) return null;
  const email = String(user.email || "").trim().toLowerCase();
  if (email) {
    const byEmail = payload.employees.find((employee) => String(employee.email || "").trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  const first = String(user.firstName || "").trim().toLowerCase();
  const last = String(user.lastName || "").trim().toLowerCase();
  const display = String(user.employeeDisplayName || [user.firstName, user.lastName].filter(Boolean).join(" ")).trim().toLowerCase();
  const matches = payload.employees.filter((employee) => {
    const employeeFirst = String(employee.firstName || "").trim().toLowerCase();
    const employeeLast = String(employee.lastName || "").trim().toLowerCase();
    const employeeDisplay = String(employee.displayName || "").trim().toLowerCase();
    return Boolean((first && last && employeeFirst === first && employeeLast === last) || (display && employeeDisplay === display));
  });
  return matches.length === 1 ? matches[0] : null;
}

function assignmentDepartment(assignment: ShiftAssignment | undefined, employee: ScheduleEmployee, shiftType?: ShiftType) {
  return roleDepartment(assignment?.roleWorked || shiftType?.departmentHint || employee.department);
}

function scheduleEmployeeSort(a: ScheduleEmployee, b: ScheduleEmployee) {
  const managerRank = Number(Boolean(b.isDepartmentManager)) - Number(Boolean(a.isDepartmentManager));
  return managerRank || Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.displayName.localeCompare(b.displayName);
}

function employeeScheduleSubtitle(employee: ScheduleEmployee) {
  return String(employee.position || normalizeDepartment(employee.department) || "").trim();
}

function cleanTime(value?: string | null) {
  return value ? value.slice(0, 5) : null;
}

function shiftTone(assignment: ShiftAssignment | undefined, shiftType: ShiftType | undefined, shiftTypes: Map<string, ShiftType>) {
  const roleShift = assignment?.roleWorked
    ? Array.from(shiftTypes.values()).find((shift) => shift.label.toLowerCase() === String(assignment.roleWorked).toLowerCase())
    : undefined;
  return roleShift || shiftType;
}

function tr(spanish: boolean, value: string) {
  return spanish ? ES[value] || value : value;
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

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rolesArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function inferRoomCapacity(day: ForecastDay) {
  const otbRooms = numberValue(day.otbRoomsSold);
  const otbOcc = numberValue(day.otbOccupancyPercent);
  if (otbRooms > 0 && otbOcc > 0) return Math.max(1, Math.round(otbRooms / (otbOcc / 100)));
  const rooms = numberValue(day.roomsSold);
  const occ = numberValue(day.occupancyPercent);
  if (rooms > 0 && occ > 0) return Math.max(1, Math.round(rooms / (occ / 100)));
  return 118;
}

function housekeepingBoardTone(board?: HousekeepingBoard) {
  if (!board || !Number(board.actualHours)) return "border-slate-300 bg-slate-50 text-slate-700";
  const mpor = Number(board.mpor || 0);
  if (mpor >= 25 && mpor <= 30) return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (mpor >= 20 && mpor <= 34) return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-red-300 bg-red-50 text-red-800";
}

function ScheduleAuthGate({ onDone }: { onDone: () => void }) {
  return (
    <div className={`min-h-screen px-4 py-8 ${C.page}`}>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center">
        <Card className={C.shell}>
          <CardHeader>
            <CardTitle className={C.ink}>Courtyard Schedule</CardTitle>
            <CardDescription className={C.muted}>Schedule access now starts from the Courtyard Associate Portal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[#5f5247]">Sign in or create your account on the portal, then open Schedule from there.</p>
            <Button asChild className={`w-full ${C.green}`}><a href="/courtyard">Go to Courtyard portal</a></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ScheduleTutorial({ spanish, isAdmin, userId }: { spanish: boolean; isAdmin: boolean; userId?: string }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const steps = useMemo(() => [
    ...(isAdmin ? [{ selector: "[data-tour='week-controls']", title: "Create or select a week", body: "Choose the Saturday start date, create a blank week, or copy the previous schedule." }] : []),
    { selector: "[data-tour='requests']", title: "Schedule requests", body: isAdmin ? "Review, approve, or deny department requests before building the week." : "Submit time-off or availability requests here. Requests inside the two-week window may be rejected." },
    ...(isAdmin ? [{ selector: "[data-tour='forecast']", title: "Forecast", body: "Import OTB reports, upload actualized stats, and adjust rooms. Forecast changes drive staffing warnings and labor targets." }] : []),
    { selector: "[data-tour='schedule-grid']", title: "Weekly grid", body: isAdmin ? "Click an associate/day cell to add or edit a shift. Housekeeping cells include a board button for MPOR." : "View your published schedule by department and day." },
    ...(isAdmin ? [{ selector: "[data-tour='employees']", title: "Associates", body: "Managers add associates, assign departments, and activate or deactivate employees. Only super admin can see pay rates." }] : []),
  ], [isAdmin]);
  const t = (value: string) => tr(spanish, value);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    const key = `schedule_tutorial_views_${userId}`;
    const count = Number(window.localStorage.getItem(key) || "0");
    if (count < 3) {
      window.localStorage.setItem(key, String(count + 1));
      setActive(true);
    }
  }, [userId]);

  useEffect(() => {
    if (!active) return;
    const updateRect = () => {
      const selector = steps[stepIndex]?.selector;
      const element = selector ? document.querySelector(selector) : null;
      if (!element) return setRect(null);
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      window.setTimeout(() => setRect(element.getBoundingClientRect()), 180);
    };
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [active, stepIndex, steps]);

  if (!active || !steps.length) return null;
  const step = steps[stepIndex];
  const close = () => setActive(false);
  return (
    <div className="fixed inset-0 z-50 print:hidden">
      <div className="absolute inset-0 bg-black/55" />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-xl border-2 border-[#f5c66b] shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
          style={{ left: Math.max(8, rect.left - 8), top: Math.max(8, rect.top - 8), width: rect.width + 16, height: rect.height + 16 }}
        />
      )}
      <div className="absolute left-4 right-4 top-6 mx-auto max-w-md rounded-xl border border-[#e0d3c1] bg-[#fffaf2] p-4 text-[#201814] shadow-2xl sm:left-auto sm:right-8">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6b3f]">{t("Schedule tutorial")}</div>
            <h2 className="text-xl font-semibold">{t(step.title)}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={close} aria-label={t("Skip tutorial")}><X className="h-4 w-4" /></Button>
        </div>
        <p className="text-sm text-[#5f5247]">{t(step.body)}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="text-xs text-[#6d5d50]">{stepIndex + 1} / {steps.length}</div>
          <div className="flex gap-2">
            <Button variant="outline" className={C.outline} disabled={stepIndex === 0} onClick={() => setStepIndex((index) => Math.max(0, index - 1))}>{t("Back")}</Button>
            <Button className={C.green} onClick={() => stepIndex === steps.length - 1 ? close() : setStepIndex((index) => index + 1)}>{stepIndex === steps.length - 1 ? t("Done") : t("Next")}</Button>
          </div>
        </div>
        <Button variant="ghost" className="mt-2 w-full text-[#5f5247]" onClick={close}>{t("Skip tutorial")}</Button>
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
  const hasOriginalUpload = days.some((day) =>
    day.otbRoomsSold != null ||
    day.otbOccupancyPercent != null ||
    day.otbArrivals != null ||
    day.otbDepartures != null
  );
  const updateDayField = (index: number, key: string, value: string) => {
    setDays((current) => current.map((item, i) => {
      if (i !== index) return item;
      if (key !== "roomsSold") return { ...item, [key]: value };

      const nextRoomsSold = Math.max(0, Math.round(numberValue(value)));
      const previousRoomsSold = numberValue(item.roomsSold);
      const roomDelta = nextRoomsSold - previousRoomsSold;
      const capacity = inferRoomCapacity(item);
      const occupancyPercent = Number(((nextRoomsSold / capacity) * 100).toFixed(2));
      const previousArrivals = numberValue(item.arrivals);
      const arrivals = Math.max(0, Math.round(previousArrivals + roomDelta));
      const stayovers = Math.max(0, nextRoomsSold - arrivals);
      const currentAdr = previousRoomsSold > 0 ? numberValue(item.roomRevenue) / previousRoomsSold : 0;
      const nextAdr = currentAdr > 0 ? currentAdr + 2 : 0;
      const roomRevenue = nextAdr > 0 ? Number((nextRoomsSold * nextAdr).toFixed(2)) : numberValue(item.roomRevenue);

      return {
        ...item,
        roomsSold: nextRoomsSold,
        occupancyPercent,
        arrivals,
        stayovers,
        roomRevenue,
      };
    }));
  };
  return (
    <Card className={C.shell} data-tour="forecast">
      <CardHeader>
        <CardTitle className={C.ink}>{t("Forecast")}</CardTitle>
        <CardDescription className={C.muted}>{spanish ? "Cuartos, ocupacion, llegadas, salidas y notas controlan alertas de personal." : "Rooms, occupancy, arrivals, departures, and notes drive staffing warnings."}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {hasOriginalUpload && (
          <div className="mb-5 rounded-xl border border-[#d9c9b4] bg-[#fbf6ee] p-3">
            <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-semibold text-[#201814]">{spanish ? "Carga original" : "Original Upload"}</h3>
                <p className="text-sm text-[#5f5247]">
                  {spanish
                    ? "Referencia bloqueada del reporte OTB inicial. No controla los calculos actuales."
                    : "Locked reference from the initial OTB report. Current forecast calculations use the editable table below."}
                </p>
              </div>
              {days.some((day) => day.actualRoomsSold != null && day.otbRoomsSold != null) && (
                <Badge variant="outline" className="w-fit border-[#bdd5c3] bg-[#e8f1ea] text-[#173c25]">
                  {spanish ? "Pickup vs original" : "Pickup vs original"}: {days.reduce((sum, day) => sum + (Number(day.actualRoomsSold ?? day.otbRoomsSold ?? 0) - Number(day.otbRoomsSold ?? 0)), 0)} rooms
                </Badge>
              )}
            </div>
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-[#e0d3c1] bg-[#efe3d1] p-2 text-left">{spanish ? "Metrica" : "Metric"}</th>
                  {days.map((day, index) => <th key={day.forecastDate} className="border border-[#e0d3c1] bg-[#efe3d1] p-2">{(spanish ? DAY_LABELS_ES : DAY_LABELS)[index]} {formatDate(day.forecastDate)}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  ["otbRoomsSold", t("Rooms sold")],
                  ["otbOccupancyPercent", "Occ %"],
                  ["otbArrivals", t("Arrivals")],
                  ["otbDepartures", t("Departures")],
                ].map(([key, label]) => (
                  <tr key={key}>
                    <td className="border border-[#e0d3c1] bg-white p-2 font-medium">{label}</td>
                    {days.map((day) => (
                      <td key={day.forecastDate} className="border border-[#e0d3c1] bg-white p-2 text-center font-semibold text-[#5f5247]">
                        {(day as any)[key] ?? "-"}
                      </td>
                    ))}
                  </tr>
                ))}
                {days.some((day) => day.actualRoomsSold != null) && (
                  <tr>
                    <td className="border border-[#e0d3c1] bg-[#f4eadb] p-2 font-medium">{spanish ? "Pickup actual" : "Actual pickup"}</td>
                    {days.map((day) => {
                      const pickup = day.actualRoomsSold != null && day.otbRoomsSold != null ? Number(day.actualRoomsSold || 0) - Number(day.otbRoomsSold || 0) : null;
                      return (
                        <td key={day.forecastDate} className="border border-[#e0d3c1] bg-[#f4eadb] p-2 text-center font-semibold">
                          {pickup == null ? "-" : pickup > 0 ? `+${pickup}` : pickup}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-[#e0d3c1] bg-[#f4eadb] p-2 text-left">{spanish ? "Metrica" : "Metric"}</th>
              {days.map((day, index) => <th key={day.forecastDate} className="border border-[#e0d3c1] bg-[#f4eadb] p-2">{(spanish ? DAY_LABELS_ES : DAY_LABELS)[index]} {formatDate(day.forecastDate)}</th>)}
            </tr>
          </thead>
          <tbody>
            {[
              ["roomsSold", t("Rooms sold")],
              ["occupancyPercent", "Occ %"],
              ["arrivals", t("Arrivals")],
              ["departures", t("Departures")],
              ["stayovers", t("Stayovers")],
              ["dndRooms", spanish ? "Cuartos DND" : "DND rooms"],
              ["roomRevenue", spanish ? "Ingresos cuartos" : "Room rev"],
              ["popupGroupRooms", spanish ? "Cuartos grupo" : "Pop-up rooms"],
              ["notes", t("Notes")],
            ].map(([key, label]) => (
              <tr key={key}>
                <td className="border border-[#e0d3c1] p-2 font-medium">{label}</td>
                {days.map((day, index) => (
                  <td key={day.forecastDate} className="border border-[#e0d3c1] p-1">
                    <Input
                      className={C.field}
                      disabled={!editable}
                      value={(day as any)[key] ?? ""}
                      type={key === "notes" ? "text" : "number"}
                      onChange={(event) => updateDayField(index, key, event.target.value)}
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
              {importing ? (spanish ? "Importando..." : "Importing...") : t("Import OTB CSV")}
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
              {actualizing ? (spanish ? "Subiendo..." : "Uploading...") : t("Upload actualized CSV")}
            </Button>
          </div>
        )}
        {editable && (
          <div className="mt-4 rounded-xl border border-[#e0d3c1] bg-white p-3">
            <div className="mb-2 font-semibold">{t("DOS pop-up group adjustment")}</div>
            <div className="grid gap-2 md:grid-cols-[160px_140px_1fr_auto]">
              <Select value={groupForm.forecastDate} onValueChange={(forecastDate) => setGroupForm({ ...groupForm, forecastDate })}>
                <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                <SelectContent>{payload.days.map((day, index) => <SelectItem key={day} value={day}>{(spanish ? DAY_LABELS_ES : DAY_LABELS)[index]} {formatDate(day)}</SelectItem>)}</SelectContent>
              </Select>
              <Input className={C.field} type="number" value={groupForm.popupGroupRooms} onChange={(event) => setGroupForm({ ...groupForm, popupGroupRooms: event.target.value })} placeholder={t("Group rooms")} />
              <Input className={C.field} value={groupForm.popupGroupNotes} onChange={(event) => setGroupForm({ ...groupForm, popupGroupNotes: event.target.value })} placeholder={t("Group notes")} />
              <Button className={C.green} onClick={() => onPopupGroupSave({ forecastDate: groupForm.forecastDate, popupGroupRooms: Number(groupForm.popupGroupRooms || 0), popupGroupNotes: groupForm.popupGroupNotes })}>{t("Save group")}</Button>
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
  rowDepartment,
  assignment,
  onSave,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: SchedulePayload;
  employee: ScheduleEmployee | null;
  date: string;
  rowDepartment?: string;
  assignment?: ShiftAssignment;
  onSave: (body: any) => void;
  onClear: () => void;
}) {
  const defaultRole = employee
    ? rolesArray(employee.rolesJson).find((role) => roleDepartment(role) === rowDepartment) || rowDepartment || employee.rolesJson?.[0] || ""
    : rowDepartment || "";
  const [form, setForm] = useState({
    shiftTypeId: assignment?.shiftTypeId || "",
    customStartTime: assignment?.customStartTime?.slice(0, 5) || "",
    customEndTime: assignment?.customEndTime?.slice(0, 5) || "",
    unpaidBreakMinutes: assignment?.unpaidBreakMinutes?.toString() || "",
    roleWorked: assignment?.roleWorked || defaultRole,
    roleNote: assignment?.roleNote || "",
    managerNote: assignment?.managerNote || "",
    isOpenShift: assignment?.isOpenShift || false,
  });
  const selectShiftType = (shiftTypeId: string) => {
    const shift = payload.shiftTypes.find((item) => item.id === shiftTypeId);
    setForm({
      ...form,
      shiftTypeId: shiftTypeId === "none" ? "" : shiftTypeId,
      customStartTime: shift?.startTime?.slice(0, 5) || "",
      customEndTime: shift?.endTime?.slice(0, 5) || "",
      roleWorked: form.roleWorked || shift?.label || "",
    });
  };
  const selectRoleWorked = (roleWorked: string) => {
    const nextRole = roleWorked === "none" ? "" : roleWorked;
    const matchingShift = payload.shiftTypes.find((shift) => shift.label.toLowerCase() === nextRole.toLowerCase())
      || (nextRole.toLowerCase().includes("audit") ? payload.shiftTypes.find((shift) => shift.label.toLowerCase() === "night audit" || shift.label.toLowerCase() === "audit") : undefined)
      || (nextRole.toLowerCase().includes("dos") || nextRole.toLowerCase().includes("sales") ? payload.shiftTypes.find((shift) => shift.label.toLowerCase() === "dos / sales") : undefined)
      || (nextRole.toLowerCase() === "gm" ? payload.shiftTypes.find((shift) => shift.label.toLowerCase() === "gm") : undefined);
    setForm({
      ...form,
      roleWorked: nextRole,
      shiftTypeId: form.shiftTypeId || matchingShift?.id || "",
      customStartTime: form.customStartTime || matchingShift?.startTime?.slice(0, 5) || "",
      customEndTime: form.customEndTime || matchingShift?.endTime?.slice(0, 5) || "",
    });
  };
  const roleOptions = employee
    ? Array.from(new Set([...(employee.rolesJson || []), rowDepartment || ""].filter(Boolean)))
    : Array.from(new Set([rowDepartment || "", ...SCHEDULE_ROLES].filter(Boolean)));
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
            <Select value={form.shiftTypeId || "none"} onValueChange={selectShiftType}>
              <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Clear / no shift</SelectItem>
                {payload.shiftTypes.filter((shift) => shift.active).map((shift) => <SelectItem key={shift.id} value={shift.id}>{shift.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Role worked</Label>
            <Select value={form.roleWorked || "none"} onValueChange={selectRoleWorked}>
              <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No role label</SelectItem>
                {roleOptions.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
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
            <Button className={C.green} onClick={() => onSave({ employeeId: employee?.id || null, shiftDate: date, ...form, roleWorked: form.roleWorked || null, unpaidBreakMinutes: form.unpaidBreakMinutes === "" ? null : Number(form.unpaidBreakMinutes) })}>Save shift</Button>
            <Button variant="outline" className={C.outline} onClick={onClear}>Clear</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HousekeepingBoardDialog({
  open,
  onOpenChange,
  employee,
  date,
  board,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: ScheduleEmployee;
  date: string;
  board?: HousekeepingBoard;
  onSave: (board: any) => void;
}) {
  const [form, setForm] = useState({
    actualHours: "",
    checkoutRooms: "",
    stayoverRooms: "",
    dndRooms: "",
    oooRooms: "",
    deepCleanRooms: "",
    notes: "",
  });
  useEffect(() => {
    setForm({
      actualHours: board?.actualHours?.toString() || "",
      checkoutRooms: board?.checkoutRooms?.toString() || "",
      stayoverRooms: board?.stayoverRooms?.toString() || "",
      dndRooms: board?.dndRooms?.toString() || "",
      oooRooms: board?.oooRooms?.toString() || "",
      deepCleanRooms: board?.deepCleanRooms?.toString() || "",
      notes: board?.notes || "",
    });
  }, [board, employee?.id, date, open]);
  const checkoutRooms = Number(form.checkoutRooms || 0);
  const stayoverRooms = Number(form.stayoverRooms || 0);
  const dndRooms = Number(form.dndRooms || 0);
  const deepCleanRooms = Number(form.deepCleanRooms || 0);
  const actualHours = Number(form.actualHours || 0);
  const serviceStayovers = Math.max(0, stayoverRooms - dndRooms);
  const roomCredits = Math.max(0, checkoutRooms + serviceStayovers * 0.5 + deepCleanRooms);
  const standardMinutes = Math.max(0, checkoutRooms * 30 + serviceStayovers * 15 + deepCleanRooms * 30);
  const mpor = roomCredits > 0 ? (actualHours * 60) / roomCredits : 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-[#fffaf2] text-[#201814]">
        <DialogHeader>
          <DialogTitle>Room attendant board - {employee?.displayName || "Associate"}</DialogTitle>
          <DialogDescription className={C.muted}>{formatDate(date)}. DND rooms are deducted from stayover service count.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Actual hours worked</Label><Input className={C.field} type="number" step="0.25" value={form.actualHours} onChange={(event) => setForm({ ...form, actualHours: event.target.value })} /></div>
          <div><Label>Checkout rooms</Label><Input className={C.field} type="number" value={form.checkoutRooms} onChange={(event) => setForm({ ...form, checkoutRooms: event.target.value })} /></div>
          <div><Label>Stayover rooms</Label><Input className={C.field} type="number" value={form.stayoverRooms} onChange={(event) => setForm({ ...form, stayoverRooms: event.target.value })} /></div>
          <div><Label>DND / refused service</Label><Input className={C.field} type="number" value={form.dndRooms} onChange={(event) => setForm({ ...form, dndRooms: event.target.value })} /></div>
          <div><Label>Out of order rooms</Label><Input className={C.field} type="number" value={form.oooRooms} onChange={(event) => setForm({ ...form, oooRooms: event.target.value })} /></div>
          <div><Label>Deep cleans</Label><Input className={C.field} type="number" value={form.deepCleanRooms} onChange={(event) => setForm({ ...form, deepCleanRooms: event.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Notes</Label><Textarea className={C.field} rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
        </div>
        <div className="grid gap-3 rounded-xl border border-[#e0d3c1] bg-white p-3 sm:grid-cols-3">
          <div><div className="text-xs uppercase text-[#6d5d50]">Room credits</div><div className="text-xl font-semibold">{roomCredits.toFixed(1)}</div></div>
          <div><div className="text-xs uppercase text-[#6d5d50]">Standard minutes</div><div className="text-xl font-semibold">{standardMinutes}</div></div>
          <div><div className="text-xs uppercase text-[#6d5d50]">MPOR</div><div className={`text-xl font-semibold ${mpor >= 25 && mpor <= 30 ? "text-emerald-800" : "text-amber-800"}`}>{mpor.toFixed(1)}</div></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" className={C.outline} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className={C.green} disabled={!employee} onClick={() => onSave({
            employeeId: employee?.id,
            boardDate: date,
            actualHours,
            checkoutRooms,
            stayoverRooms,
            dndRooms,
            oooRooms: Number(form.oooRooms || 0),
            deepCleanRooms,
            notes: form.notes || null,
          })}>Save board</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PersonalScheduleCard({ payload, user, spanish }: { payload: SchedulePayload; user?: ScheduleUser | null; spanish: boolean }) {
  const employee = findEmployeeForUser(payload, user);
  const shiftTypes = useMemo(() => new Map(payload.shiftTypes.map((shift) => [shift.id, shift])), [payload.shiftTypes]);
  const approvedRequests = useMemo(() => new Map((payload.approvedRequests || []).map((request) => [`${request.employeeId}:${request.requestDate}`, request])), [payload.approvedRequests]);
  const labels = spanish ? DAY_LABELS_ES : DAY_LABELS;
  if (!employee) return null;
  const rows = payload.days.map((day, index) => {
    const assignment = payload.assignments.find((item) => item.employeeId === employee.id && item.shiftDate === day);
    const shiftType = assignment ? shiftTypes.get(assignment.shiftTypeId || "") : undefined;
    const approvedRequest = approvedRequests.get(`${employee.id}:${day}`);
    const department = assignment ? assignmentDepartment(assignment, employee, shiftType) : "";
    return { day, index, assignment, shiftType, approvedRequest, department };
  });
  const hasCrossDepartment = rows.some((row) => row.department && row.department !== normalizeDepartment(employee.department));
  return (
    <Card className={`${C.shell} border-[#2f5f46]`}>
      <CardHeader>
        <CardTitle className={C.ink}>{spanish ? "Mi horario" : "My Schedule"}</CardTitle>
        <CardDescription className={C.muted}>
          {spanish ? "Resumen personal para evitar confusiones entre departamentos." : "Your personal schedule across all departments for this week."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasCrossDepartment && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
            {spanish ? "Tiene turnos en mas de un departamento esta semana." : "You have shifts in more than one department this week. Review each day carefully."}
          </div>
        )}
        <div className="grid gap-2 md:grid-cols-7">
          {rows.map((row) => {
            const text = row.approvedRequest ? (spanish ? "Solicitud aprobada" : "Approved request") : shiftText(row.assignment, row.shiftType);
            const tone = row.assignment ? shiftTone(row.assignment, row.shiftType, shiftTypes) : undefined;
            return (
              <div key={row.day} className="rounded-xl border border-[#e0d3c1] bg-white p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#5f5247]">{labels[row.index]}</div>
                <div className="font-semibold">{formatDate(row.day)}</div>
                {text ? (
                  <div className="mt-2 rounded-lg border border-[#e0d3c1] p-2 text-sm whitespace-pre-line" style={{ background: row.approvedRequest ? "#e5e7eb" : tone?.color || "#ffffff", color: row.approvedRequest ? "#374151" : tone?.textColor || "#201814" }}>
                    {text}
                    {row.department && <div className="mt-1 text-xs font-semibold opacity-80">{row.department}</div>}
                  </div>
                ) : (
                  <div className="mt-2 rounded-lg border border-dashed border-[#d6c8b5] p-2 text-sm text-[#5f5247]">{spanish ? "Sin turno" : "No shift"}</div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function HousekeepingForecastMini({ payload, labels }: { payload: SchedulePayload; labels: string[] }) {
  const forecastByDay = new Map(payload.forecast.map((day) => [day.forecastDate, day]));
  const recommendationForDay = (index: number) => {
    const workloadDay = payload.days[index - 1] || payload.days[index];
    const workloadForecast = forecastByDay.get(workloadDay);
    const roomsToClean = Number(workloadForecast?.roomsSold || 0);
    const roomAttendants = Math.ceil(roomsToClean / 16);
    return {
      workloadDay,
      roomsToClean,
      roomAttendants,
      housekeepingHours: roomAttendants * 8 + 7 + 7,
    };
  };
  const metrics = [
    { key: "roomsSold", label: "Rooms" },
    { key: "occupancyPercent", label: "Occ %" },
    { key: "arrivals", label: "Arr" },
    { key: "departures", label: "Dep" },
    { key: "stayovers", label: "Stay" },
    { key: "dndRooms", label: "DND" },
  ] as const;
  return (
    <tr>
      <td colSpan={9} className="border border-[#e0d3c1] bg-[#fbf6ee] p-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#5f5247]">Housekeeping working forecast</div>
        <div className="text-[11px] text-[#5f5247]">Uses the saved manager forecast, not the original upload baseline.</div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {payload.days.map((day, index) => {
            const forecast = forecastByDay.get(day);
            const recommendation = recommendationForDay(index);
            return (
              <div key={day} className="rounded-lg border border-[#d6c8b5] bg-white p-2 text-xs">
                <div className="font-semibold text-[#201814]">{labels[index]} {formatDate(day)}</div>
                <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[#5f5247]">
                  {metrics.map((metric) => (
                    <div key={metric.key} className="flex justify-between gap-2">
                      <span>{metric.label}</span>
                      <strong className="text-[#201814]">{Number(forecast?.[metric.key] || 0)}</strong>
                    </div>
                  ))}
                </div>
                <div className="mt-2 border-t border-[#eadfce] pt-1 text-[#5f5247]">
                  <div className="flex justify-between gap-2"><span>RA needed</span><strong className="text-[#201814]">{recommendation.roomAttendants}</strong></div>
                  <div className="flex justify-between gap-2"><span>HK hrs</span><strong className="text-[#201814]">{recommendation.housekeepingHours}</strong></div>
                  <div className="text-[10px]">Workload: {recommendation.roomsToClean} rooms from {formatDate(recommendation.workloadDay)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

function HousekeepingForecastMiniCards({ payload, labels }: { payload: SchedulePayload; labels: string[] }) {
  const forecastByDay = new Map(payload.forecast.map((day) => [day.forecastDate, day]));
  const recommendationForDay = (index: number) => {
    const workloadDay = payload.days[index - 1] || payload.days[index];
    const workloadForecast = forecastByDay.get(workloadDay);
    const roomsToClean = Number(workloadForecast?.roomsSold || 0);
    const roomAttendants = Math.ceil(roomsToClean / 16);
    return {
      workloadDay,
      roomsToClean,
      roomAttendants,
      housekeepingHours: roomAttendants * 8 + 7 + 7,
    };
  };
  return (
    <div className="mb-3 rounded-xl border border-[#e0d3c1] bg-[#fbf6ee] p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-[#5f5247]">Housekeeping working forecast</div>
      <div className="text-[11px] text-[#5f5247]">Uses the saved manager forecast, not the original upload baseline.</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {payload.days.map((day, index) => {
          const forecast = forecastByDay.get(day);
          const recommendation = recommendationForDay(index);
          return (
            <div key={day} className="rounded-lg border border-[#d6c8b5] bg-white p-2 text-sm">
              <div className="font-semibold">{labels[index]} {formatDate(day)}</div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-[#5f5247]">
                <div>Rooms <strong className="text-[#201814]">{Number(forecast?.roomsSold || 0)}</strong></div>
                <div>Occ <strong className="text-[#201814]">{Number(forecast?.occupancyPercent || 0)}%</strong></div>
                <div>Arr <strong className="text-[#201814]">{Number(forecast?.arrivals || 0)}</strong></div>
                <div>Dep <strong className="text-[#201814]">{Number(forecast?.departures || 0)}</strong></div>
                <div>Stay <strong className="text-[#201814]">{Number(forecast?.stayovers || 0)}</strong></div>
                <div>DND <strong className="text-[#201814]">{Number(forecast?.dndRooms || 0)}</strong></div>
              </div>
              <div className="mt-2 rounded-md bg-[#f4eadb] p-2 text-xs text-[#5f5247]">
                <div><strong className="text-[#201814]">{recommendation.roomAttendants}</strong> room attendants recommended</div>
                <div><strong className="text-[#201814]">{recommendation.housekeepingHours}</strong> estimated HK hours incl. 7 HP + 7 laundry</div>
                <div>Workload: {recommendation.roomsToClean} rooms from {formatDate(recommendation.workloadDay)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleGrid({ payload, editable, currentUser, onEdit, onCopyShift, onHousekeepingBoard, spanish }: { payload: SchedulePayload; editable: boolean; currentUser?: ScheduleUser | null; spanish: boolean; onEdit: (employee: ScheduleEmployee, date: string, department: string, assignment?: ShiftAssignment) => void; onCopyShift: (assignment: ShiftAssignment, employee: ScheduleEmployee, date: string, department: string) => void; onHousekeepingBoard: (employee: ScheduleEmployee, date: string, board?: HousekeepingBoard) => void }) {
  const assignments = useMemo(() => new Map(payload.assignments.map((assignment) => [`${assignment.employeeId}:${assignment.shiftDate}`, assignment])), [payload.assignments]);
  const housekeepingBoards = useMemo(() => new Map((payload.housekeepingBoards || []).map((board) => [`${board.employeeId}:${board.boardDate}`, board])), [payload.housekeepingBoards]);
  const shiftTypes = useMemo(() => new Map(payload.shiftTypes.map((shift) => [shift.id, shift])), [payload.shiftTypes]);
  const approvedRequests = useMemo(() => new Map((payload.approvedRequests || []).map((request) => [`${request.employeeId}:${request.requestDate}`, request])), [payload.approvedRequests]);
  const t = (value: string) => spanish ? ES[value] || value : value;
  const labels = spanish ? DAY_LABELS_ES : DAY_LABELS;
  const editableDepartments = payload.currentUserPermissions?.editableDepartments || [];
  const currentEmployee = findEmployeeForUser(payload, currentUser);
  return (
    <Card className={C.shell} data-tour="schedule-grid">
      <CardHeader>
        <CardTitle className={C.ink}>{t("Weekly schedule")}</CardTitle>
        <CardDescription className={C.muted}>{t("Associates are listed on the left by department. Click any date cell to add or edit that shift.")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1160px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[220px]" />
              {payload.days.map((day) => <col key={day} className="w-[128px]" />)}
              <col className="w-[60px]" />
            </colgroup>
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border border-[#e0d3c1] bg-[#f4eadb] p-2 text-left">{t("Associate")}</th>
                {payload.days.map((day, index) => <th key={day} className="border border-[#e0d3c1] bg-[#f4eadb] p-2 text-center">{labels[index]}<br />{formatDate(day)}</th>)}
                <th className="border border-[#e0d3c1] bg-[#f4eadb] p-2 text-center">{t("Hours")}</th>
              </tr>
            </thead>
            <tbody>
              {payload.departments.map((department) => {
                const employees = payload.employees.filter((employee) => employee.active && employeeDepartments(employee).includes(department)).sort(scheduleEmployeeSort);
                if (!employees.length) return null;
                const showHousekeepingReference = department === "Housekeeping" && editable && editableDepartments.includes("Housekeeping");
                return [
                  <tr key={`${department}-header`}><td colSpan={9} className="border border-[#e0d3c1] bg-[#2a211c] p-2 font-semibold text-white">{department} - {payload.totals.departmentWeeklyHours[department] || 0} hrs</td></tr>,
                  showHousekeepingReference ? <HousekeepingForecastMini key={`${department}-forecast`} payload={payload} labels={labels} /> : null,
                  <tr key={`${department}-days`}>
                    <td className="sticky left-0 z-10 border border-[#e0d3c1] bg-[#f4eadb] p-2 text-left text-xs font-semibold uppercase tracking-wide text-[#5f5247]">{t("Associate")}</td>
                    {payload.days.map((day, index) => <td key={day} className="border border-[#e0d3c1] bg-[#f4eadb] p-2 text-center text-xs font-semibold uppercase tracking-wide text-[#5f5247]">{labels[index]}<br />{formatDate(day)}</td>)}
                    <td className="border border-[#e0d3c1] bg-[#f4eadb] p-2 text-center text-xs font-semibold uppercase tracking-wide text-[#5f5247]">{t("Hours")}</td>
                  </tr>,
                  ...employees.map((employee) => (
                    <tr key={employee.id}>
                      <td className="sticky left-0 z-10 border border-[#e0d3c1] bg-white p-2 align-middle font-medium">{employee.displayName}<div className="text-xs text-[#5f5247]">{employeeScheduleSubtitle(employee)}</div></td>
                      {payload.days.map((day) => {
                        const rawAssignment = assignments.get(`${employee.id}:${day}`);
                        const hkBoard = housekeepingBoards.get(`${employee.id}:${day}`);
                        const rawShift = rawAssignment ? shiftTypes.get(rawAssignment.shiftTypeId || "") : undefined;
                        const assignment = rawAssignment;
                        const isHousekeeping = department === "Housekeeping";
                        const canEditCell = editable && (editableDepartments.includes(department) || currentEmployee?.id === employee.id);
                        const approvedRequest = approvedRequests.get(`${employee.id}:${day}`);
                        const shift = assignment ? shiftTone(assignment, rawShift, shiftTypes) : undefined;
                        const handleShiftDragStart = (event: DragEvent) => {
                          if (!assignment || !canEditCell) return;
                          const payload = JSON.stringify(assignment);
                          event.dataTransfer.effectAllowed = "copy";
                          event.dataTransfer.setData("application/json", payload);
                          event.dataTransfer.setData("text/plain", payload);
                        };
                        const handleShiftDrop = (event: DragEvent) => {
                          event.preventDefault();
                          const raw = event.dataTransfer.getData("application/json") || event.dataTransfer.getData("text/plain");
                          if (!raw || !canEditCell) return;
                          onCopyShift(JSON.parse(raw), employee, day, department);
                        };
                        return (
                          <td key={day} className="h-[92px] border border-[#e0d3c1] p-1 align-middle" onDragOver={(event) => canEditCell && event.preventDefault()} onDrop={handleShiftDrop}>
                            <div className="space-y-1">
                              <button
                                type="button"
                                draggable={canEditCell && Boolean(assignment)}
                                disabled={!canEditCell || Boolean(approvedRequest)}
                                className={`flex h-[76px] w-full flex-col justify-center overflow-hidden rounded-md border border-[#e0d3c1] p-2 text-left text-xs leading-snug disabled:cursor-default ${assignment ? "cursor-copy" : ""}`}
                                style={{ background: approvedRequest ? "#e5e7eb" : shift?.color || "#ffffff", color: approvedRequest ? "#374151" : shift?.textColor || "#201814" }}
                                onDragStart={handleShiftDragStart}
                                onDragOver={(event) => canEditCell && event.preventDefault()}
                                onDrop={handleShiftDrop}
                                onClick={() => onEdit(employee, day, department, assignment)}
                              >
                                <span className="whitespace-pre-line leading-snug">{approvedRequest ? t("Approved request") : shiftText(assignment, shift) || (editable ? `+ ${t("Add shift")}` : "-")}</span>
                                {assignment && <span className="mt-1 block text-[10px] opacity-75">Drag to copy</span>}
                              </button>
                              {isHousekeeping && (
                                <button
                                  type="button"
                                  disabled={!canEditCell}
                                  className={`w-full rounded-md border px-2 py-1 text-center text-[11px] font-semibold disabled:cursor-default ${housekeepingBoardTone(hkBoard)}`}
                                  onClick={() => onHousekeepingBoard(employee, day, hkBoard)}
                                >
                                  {hkBoard ? `${Number(hkBoard.mpor || 0).toFixed(1)} MPOR` : "Board"}
                                </button>
                              )}
                            </div>
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
            const employees = payload.employees.filter((employee) => employee.active && employeeDepartments(employee).includes(department)).sort(scheduleEmployeeSort);
            if (!employees.length) return null;
            const showHousekeepingReference = department === "Housekeeping" && editable && editableDepartments.includes("Housekeeping");
            return (
              <div key={department}>
                <h3 className="mb-2 font-semibold">{department}</h3>
                {showHousekeepingReference && <HousekeepingForecastMiniCards payload={payload} labels={labels} />}
                <div className="space-y-3">
                  {employees.map((employee) => (
                    <div key={employee.id} className="rounded-xl border border-[#e0d3c1] bg-white p-3">
                      <div className="mb-2 flex justify-between"><div className="font-semibold">{employee.displayName}</div><Badge variant="outline">{payload.totals.employeeWeeklyHours[employee.id] || 0} hrs</Badge></div>
                      <div className="grid gap-2">
                        {payload.days.map((day, index) => {
                          const rawAssignment = assignments.get(`${employee.id}:${day}`);
                          const hkBoard = housekeepingBoards.get(`${employee.id}:${day}`);
                          const rawShift = rawAssignment ? shiftTypes.get(rawAssignment.shiftTypeId || "") : undefined;
                          const assignment = rawAssignment;
                          const isHousekeeping = department === "Housekeeping";
                          const approvedRequest = approvedRequests.get(`${employee.id}:${day}`);
                          const shift = assignment ? shiftTone(assignment, rawShift, shiftTypes) : undefined;
                          const canEditCell = editable && (editableDepartments.includes(department) || currentEmployee?.id === employee.id);
                          return (
                            <div key={day} className="rounded-md border border-[#e0d3c1] bg-white p-2">
                              <button disabled={!canEditCell || Boolean(approvedRequest)} className="w-full text-left text-sm disabled:cursor-default" style={{ color: approvedRequest ? "#374151" : shift?.textColor || "#201814" }} onClick={() => onEdit(employee, day, department, assignment)}>
                                <strong>{labels[index]} {formatDate(day)}:</strong> {approvedRequest ? t("Approved request") : shiftText(assignment, shift) || "-"}
                              </button>
                              {isHousekeeping && (
                                <button
                                  type="button"
                                  disabled={!canEditCell}
                                  className={`mt-2 w-full rounded-md border px-2 py-1 text-xs font-semibold disabled:cursor-default ${housekeepingBoardTone(hkBoard)}`}
                                  onClick={() => onHousekeepingBoard(employee, day, hkBoard)}
                                >
                                  {hkBoard ? `${Number(hkBoard.mpor || 0).toFixed(1)} MPOR` : "Enter board"}
                                </button>
                              )}
                            </div>
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

function EmployeeManager({ employees, canViewRates, onAdd, onUpdate, onPayrollImport, importingPayroll, spanish }: { employees: ScheduleEmployee[]; canViewRates: boolean; spanish: boolean; onAdd: (employee: any) => void; onUpdate: (id: string, patch: any) => void; onPayrollImport: (file: File) => void; importingPayroll: boolean }) {
  const payrollInputRef = useRef<HTMLInputElement | null>(null);
  const emptyForm = { firstName: "", lastName: "", displayName: "", department: "Front Desk", position: "", rolesJson: [] as string[], hourlyRate: "", email: "", phone: "", isSalaried: false, isDepartmentManager: false };
  const [form, setForm] = useState(emptyForm);
  const [expanded, setExpanded] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [editing, setEditing] = useState<Record<string, any>>({});
  const t = (value: string) => tr(spanish, value);
  const toggleRole = (role: string) => setForm((current) => ({ ...current, rolesJson: current.rolesJson.includes(role) ? current.rolesJson.filter((item) => item !== role) : [...current.rolesJson, role] }));
  const employeePatch = (employee: ScheduleEmployee) => editing[employee.id] || employee;
  const saveEmployee = (employee: ScheduleEmployee) => onUpdate(employee.id, employeePatch(employee));
  const toggleEmployeeRole = (employee: ScheduleEmployee, role: string) => {
    const draft = employeePatch(employee);
    const roles = rolesArray(draft.rolesJson);
    const nextRoles = roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role];
    setEditing({ ...editing, [employee.id]: { ...draft, rolesJson: nextRoles } });
  };
  const reorderEmployee = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const ordered = [...employees].sort((a, b) => normalizeDepartment(a.department).localeCompare(normalizeDepartment(b.department)) || Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.displayName.localeCompare(b.displayName));
    const dragged = ordered.find((employee) => employee.id === draggedId);
    const target = ordered.find((employee) => employee.id === targetId);
    if (!dragged || !target || normalizeDepartment(dragged.department) !== normalizeDepartment(target.department)) return;
    const sameDepartment = ordered.filter((employee) => normalizeDepartment(employee.department) === normalizeDepartment(target.department));
    const from = sameDepartment.findIndex((employee) => employee.id === draggedId);
    const to = sameDepartment.findIndex((employee) => employee.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = sameDepartment.splice(from, 1);
    sameDepartment.splice(to, 0, moved);
    sameDepartment.forEach((employee, index) => {
      if (Number(employee.sortOrder || 0) !== index + 1) onUpdate(employee.id, { sortOrder: index + 1 });
    });
  };
  const sortedEmployees = [...employees].sort((a, b) => normalizeDepartment(a.department).localeCompare(normalizeDepartment(b.department)) || Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.displayName.localeCompare(b.displayName));
  const query = employeeSearch.trim().toLowerCase();
  const filteredEmployees = sortedEmployees.filter((employee) => {
    const draft = employeePatch(employee);
    const department = normalizeDepartment(draft.department);
    if (departmentFilter !== "All" && department !== departmentFilter) return false;
    if (!query) return true;
    const searchable = [
      draft.displayName,
      draft.firstName,
      draft.lastName,
      draft.position,
      draft.email,
      draft.phone,
      department,
      rolesArray(draft.rolesJson).join(" "),
    ].join(" ").toLowerCase();
    return searchable.includes(query);
  });
  const groupedDepartments = (departmentFilter === "All" ? DEPARTMENTS : [departmentFilter]).map((department) => ({
    department,
    employees: filteredEmployees.filter((employee) => normalizeDepartment(employeePatch(employee).department) === department),
  })).filter((group) => group.employees.length > 0);
  return (
    <Card className={C.shell} data-tour="employees">
      <CardHeader>
        <CardTitle className={C.ink}>{t("Employees")}</CardTitle>
        <CardDescription className={C.muted}>{t("Add employees to the far-left schedule column and assign their department row group.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input className={C.field} placeholder={t("First name")} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
          <Input className={C.field} placeholder={t("Last name")} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
          <Input className={C.field} placeholder={t("Display name")} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
          <Select value={form.department} onValueChange={(department) => setForm({ ...form, department })}>
            <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
            <SelectContent>{DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}</SelectContent>
          </Select>
          <Input className={C.field} placeholder={t("Position")} value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} />
          <div className="sm:col-span-2">
            <Label>{t("Approved roles / cross-department access")}</Label>
            <p className="mb-2 text-xs text-[#5f5247]">Select every role this associate is approved to work. Extra department roles make them available in those schedule sections.</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {SCHEDULE_ROLES.map((role) => <Button key={role} type="button" size="sm" variant="outline" className={form.rolesJson.includes(role) ? C.green : C.outline} onClick={() => toggleRole(role)}>{role}</Button>)}
            </div>
          </div>
          {canViewRates && <Input className={C.field} placeholder={t("Hourly rate")} type="number" value={form.hourlyRate} onChange={(event) => setForm({ ...form, hourlyRate: event.target.value })} />}
          <Input className={C.field} placeholder={t("Email")} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <Input className={C.field} placeholder={t("Phone")} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isSalaried} onChange={(event) => setForm({ ...form, isSalaried: event.target.checked })} /> Salaried</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isDepartmentManager} onChange={(event) => setForm({ ...form, isDepartmentManager: event.target.checked })} /> Department manager</label>
          <Button className={C.green} onClick={() => { onAdd({ ...form, hourlyRate: form.hourlyRate === "" ? null : Number(form.hourlyRate) }); setForm(emptyForm); }}><Plus className="mr-2 h-4 w-4" />{t("Add employee")}</Button>
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
                {importingPayroll ? t("Importing payroll...") : t("Import payroll rates")}
              </Button>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" className={C.outline} onClick={() => setExpanded((value) => !value)}>{expanded ? "Hide employee list" : "Show employee list"}</Button>
          {expanded && <Badge variant="outline" className="border-[#d6c8b5] bg-white text-[#5f5247]">{filteredEmployees.length} of {employees.length} associates</Badge>}
        </div>
        {expanded && <div className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-[#e0d3c1] bg-[#fbf6ee] p-3 md:grid-cols-[1fr_240px]">
            <div>
              <Label>{t("Search employees")}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#76695d]" />
                <Input
                  className={`${C.field} pl-9`}
                  placeholder={t("Search by name, role, email, phone...")}
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>{t("Department")}</Label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{t("All departments")}</SelectItem>
                  {DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {groupedDepartments.length === 0 && (
            <div className="rounded-lg border border-[#e0d3c1] bg-white p-4 text-sm text-[#5f5247]">
              {t("No employees match that search or department filter.")}
            </div>
          )}
          {groupedDepartments.map((group) => (
            <div key={group.department} className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-[#d6c8b5] bg-[#2a211c] px-3 py-2 text-white">
                <div className="font-semibold">{group.department}</div>
                <Badge variant="outline" className="border-white/30 bg-white/10 text-white">{group.employees.length}</Badge>
              </div>
              {group.employees.map((employee) => {
            const draft = employeePatch(employee);
            const roles = rolesArray(draft.rolesJson);
            return (
            <div key={employee.id} className={`grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_220px_120px] ${employee.active ? "border-[#e0d3c1] bg-white" : "border-slate-300 bg-slate-100"}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const draggedId = event.dataTransfer.getData("text/plain");
                reorderEmployee(draggedId, employee.id);
              }}>
              <div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    draggable
                    className="mt-1 flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-md border border-[#d6c8b5] bg-[#fffaf2] text-[#5f5247] active:cursor-grabbing"
                    title="Drag to reorder this associate"
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", employee.id);
                    }}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <Input className={C.field} value={draft.displayName || ""} onChange={(event) => setEditing({ ...editing, [employee.id]: { ...draft, displayName: event.target.value } })} />
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Input className={C.field} placeholder="Phone" value={draft.phone || ""} onChange={(event) => setEditing({ ...editing, [employee.id]: { ...draft, phone: event.target.value } })} />
                  <Input className={C.field} placeholder="Email" value={draft.email || ""} onChange={(event) => setEditing({ ...editing, [employee.id]: { ...draft, email: event.target.value } })} />
                </div>
                {(!draft.phone || !draft.email) && <Badge variant="outline" className="mt-2 border-amber-300 bg-amber-50 text-amber-900">Missing phone/email</Badge>}
                <div className="mt-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#5f5247]">Approved roles / cross-department access</div>
                  <div className="flex flex-wrap gap-1">
                  {SCHEDULE_ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${roles.includes(role) ? "border-[#2f5f46] bg-[#e8f3ec] text-[#244c37]" : "border-[#d6c8b5] bg-white text-[#5f5247]"}`}
                      onClick={() => toggleEmployeeRole(employee, role)}
                    >
                      {role}
                    </button>
                  ))}
                  </div>
                </div>
                <div className="text-sm text-[#5f5247]">{draft.position || t("No position")} {draft.maxWeeklyHours ? `- max ${draft.maxWeeklyHours} hrs` : ""} {draft.isSalaried ? "- salaried" : ""} {canViewRates && draft.hourlyRate ? `- $${draft.hourlyRate}/hr` : ""}</div>
              </div>
              <Select value={normalizeDepartment(draft.department)} onValueChange={(department) => setEditing({ ...editing, [employee.id]: { ...draft, department } })}>
                <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex flex-col gap-2">
                <Button className={C.green} onClick={() => saveEmployee(employee)}>Save</Button>
                <Button variant="outline" className={C.outline} onClick={() => onUpdate(employee.id, { active: !employee.active })}>{employee.active ? t("Deactivate") : t("Activate")}</Button>
              </div>
            </div>
          );})}
            </div>
          ))}
        </div>}
      </CardContent>
    </Card>
  );
}

function ScheduleRequestsPanel({ requests, isAdmin, spanish, onSubmit, onStatus }: { requests: ScheduleRequest[]; isAdmin: boolean; spanish: boolean; onSubmit: (request: any) => void; onStatus: (request: ScheduleRequest, status: string) => void }) {
  const [form, setForm] = useState({ requestDate: "", requestType: "time_off", startTime: "", endTime: "", notes: "" });
  const t = (value: string) => tr(spanish, value);
  const submit = () => {
    onSubmit({ ...form, startTime: form.startTime || null, endTime: form.endTime || null });
    setForm({ requestDate: "", requestType: "time_off", startTime: "", endTime: "", notes: "" });
  };
  return (
    <Card className={`${C.shell} print:hidden`} data-tour="requests">
      <CardHeader>
        <CardTitle className={C.ink}>{t("Schedule requests")}</CardTitle>
        <CardDescription className={C.muted}>{t("Requests must be submitted at least 14 days before the requested date.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[160px_180px_120px_120px_1fr_auto]">
          <div><Label>{t("Date")}</Label><Input className={C.field} type="date" value={form.requestDate} onChange={(event) => setForm({ ...form, requestDate: event.target.value })} /></div>
          <div>
            <Label>{t("Type")}</Label>
            <Select value={form.requestType} onValueChange={(requestType) => setForm({ ...form, requestType })}>
              <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="time_off">{t("Time off")}</SelectItem>
                <SelectItem value="preferred_shift">{t("Preferred shift")}</SelectItem>
                <SelectItem value="availability">{t("Availability")}</SelectItem>
                <SelectItem value="other">{t("Other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t("Start")}</Label><Input className={C.field} type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></div>
          <div><Label>{t("End")}</Label><Input className={C.field} type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></div>
          <div><Label>{t("Notes")}</Label><Input className={C.field} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder={t("Request details")} /></div>
          <div className="flex items-end"><Button className={C.green} disabled={!form.requestDate || !form.notes.trim()} onClick={submit}>{t("Submit")}</Button></div>
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
                    {request.conflictCount} {spanish ? "ya aprobado(s)" : "already approved"}
                  </Badge>
                )}
                <Badge variant="outline" className={request.status === "approved" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : request.status === "denied" ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"}>{request.status}</Badge>
                {isAdmin && request.status === "submitted" && (
                  <>
                    <Button size="sm" variant="outline" className={C.outline} onClick={() => onStatus(request, "approved")}>{t("Approve")}</Button>
                    <Button size="sm" variant="outline" className={C.outline} onClick={() => onStatus(request, "denied")}>{t("Deny")}</Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {requests.length === 0 && <div className="text-sm text-[#5f5247]">{t("No schedule requests yet.")}</div>}
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
  const [selectedShift, setSelectedShift] = useState<{ employee: ScheduleEmployee; date: string; department: string; assignment?: ShiftAssignment } | null>(null);
  const [selectedHousekeepingBoard, setSelectedHousekeepingBoard] = useState<{ employee: ScheduleEmployee; date: string; board?: HousekeepingBoard } | null>(null);
  const [aiDraft, setAiDraft] = useState<AiScheduleDraft | null>(null);
  const [spanish, setSpanish] = useState(false);
  const dailyHporToastKey = useRef("");

  const auth = useQuery<{ user: ScheduleUser | null }>({ queryKey: ["/api/schedule/auth/me"], queryFn: () => fetchJson("/api/schedule/auth/me"), enabled: !shareToken });
  const weeks = useQuery<{ weeks: WeeklySchedule[] }>({ queryKey: ["/api/schedule/weeks"], queryFn: () => fetchJson("/api/schedule/weeks"), enabled: !!auth.data?.user && !shareToken });
  const requests = useQuery<{ requests: ScheduleRequest[] }>({ queryKey: ["/api/schedule/requests"], queryFn: () => fetchJson("/api/schedule/requests"), enabled: !!auth.data?.user && !shareToken });
  const share = useQuery<SchedulePayload>({ queryKey: ["/api/schedule/share", shareToken], queryFn: () => fetchJson(`/api/schedule/share/${shareToken}`), enabled: !!shareToken });
  const weekId = selectedWeekId || weeks.data?.weeks?.[0]?.id || "";
  const detail = useQuery<SchedulePayload>({ queryKey: ["/api/schedule/weeks", weekId], queryFn: () => fetchJson(`/api/schedule/weeks/${weekId}`), enabled: !!weekId && !shareToken });
  const payload = shareToken ? share.data : detail.data;
  const user = auth.data?.user;
  const editable = Boolean(user?.isAdmin && payload?.schedule.status === "draft" && !shareToken);
  const t = (value: string) => tr(spanish, value);
  const hasHousekeepingBoardData = Boolean(payload?.housekeepingBoards?.some((board) => Number(board.actualHours || 0) > 0));

  useEffect(() => {
    if (!payload || !user?.isAdmin || shareToken) return;
    const daily = payload.totals.laborMetrics?.daily || {};
    const overTarget = payload.days
      .map((day) => ({ day, hpor: Number(daily[day]?.hpor || 0) }))
      .filter((item) => item.hpor > 1.25);
    if (!overTarget.length) return;
    const key = `${payload.schedule.id}:${overTarget.map((item) => `${item.day}:${item.hpor.toFixed(2)}`).join("|")}`;
    if (dailyHporToastKey.current === key) return;
    dailyHporToastKey.current = key;
    toast({
      title: "Daily labor HPOR alert",
      description: overTarget.map((item) => `${formatDate(item.day)} ${item.hpor.toFixed(2)} HPOR`).join(", "),
      variant: "destructive",
    });
  }, [payload, shareToken, toast, user?.isAdmin]);

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
      const department = payload?.currentUserPermissions?.editableDepartments?.find((item) => item !== "Managers") || payload?.currentUserPermissions?.editableDepartments?.[0] || "Front Desk";
      const response = await apiRequest("POST", `/api/schedule/weeks/${payload?.schedule.id}/ai/generate`, { department });
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
  const saveHousekeepingBoard = useMutation({
    mutationFn: (body: any) => apiRequest("PUT", `/api/schedule/weeks/${payload?.schedule.id}/housekeeping-board`, body),
    onSuccess: () => {
      setSelectedHousekeepingBoard(null);
      toast({ title: "Housekeeping board saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "Board save failed", description: error.message, variant: "destructive" }),
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
  const completeDepartment = useMutation({
    mutationFn: (department: string) => apiRequest("POST", `/api/schedule/weeks/${payload?.schedule.id}/departments/${encodeURIComponent(department)}/complete`, {}),
    onSuccess: () => {
      toast({ title: "Department completed" });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "Department save failed", description: error.message, variant: "destructive" }),
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
  const emailSchedule = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/schedule/weeks/${payload?.schedule.id}/email`, {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Schedule emailed",
        description: `${data.sentCount || 0} of ${data.recipientCount || 0} employee email(s) sent.`,
      });
    },
    onError: (error: Error) => toast({ title: "Email failed", description: error.message, variant: "destructive" }),
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
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">{t("Courtyard Austin Lakeline")}</div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("Courtyard Schedule Builder")}</h1>
          </div>
          <div className="flex flex-wrap gap-2" data-tour="week-controls">
            <Button variant="outline" className={C.outline} onClick={() => setSpanish((value) => !value)}>
              {spanish ? "English" : "Espanol"}
            </Button>
            {!shareToken && user?.isAdmin && <Input className={`${C.field} w-[160px]`} type="date" value={weekStartDate} onChange={(event) => setWeekStartDate(event.target.value)} />}
            {!shareToken && user?.isAdmin && <Button className={C.green} onClick={() => createWeek.mutate("blank")}><CalendarDays className="mr-2 h-4 w-4" />{t("Blank week")}</Button>}
            {!shareToken && user?.isAdmin && <Button variant="outline" className={C.outline} onClick={() => createWeek.mutate("copyPrevious")}><Copy className="mr-2 h-4 w-4" />{t("Copy previous")}</Button>}
            <Button variant="outline" className={C.outline} onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />{t("Print")}</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {!shareToken && (
          <Card className={`${C.shell} print:hidden`}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Label>{t("Week")}</Label>
                <Select value={weekId || "none"} onValueChange={setSelectedWeekId}>
                  <SelectTrigger className={`${C.field} w-[240px]`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("Select schedule")}</SelectItem>
                    {(weeks.data?.weeks || []).map((week) => <SelectItem key={week.id} value={week.id}>{formatWeek(week.weekStartDate, week.weekEndDate)} - {week.status}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {payload && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={statusBadge(payload.schedule.status)}>{payload.schedule.status}</Badge>
                  {payload.schedule.status === "draft" && payload.currentUserPermissions?.canPublishFinal && <Button className={C.green} onClick={() => action.mutate({ name: "publish" })}><CheckCircle2 className="mr-2 h-4 w-4" />Save & Publish Final Schedule</Button>}
                  {payload.schedule.status === "published" && payload.currentUserPermissions?.canPublishFinal && <Button variant="outline" className={C.outline} onClick={() => action.mutate({ name: "reopen", body: { reason: "Manager edit" } })}><RefreshCw className="mr-2 h-4 w-4" />{t("Reopen")}</Button>}
                  {payload.currentUserPermissions?.canPublishFinal && <Button variant="outline" className={C.outline} onClick={() => action.mutate({ name: "archive" })}><Archive className="mr-2 h-4 w-4" />{t("Archive")}</Button>}
                  {payload.schedule.status === "published" && payload.currentUserPermissions?.canPublishFinal && <Button variant="outline" className={C.outline} onClick={() => shareLink.mutate()}><Share2 className="mr-2 h-4 w-4" />{t("Copy share link")}</Button>}
                  {payload.schedule.status === "published" && payload.currentUserPermissions?.canPublishFinal && <Button variant="outline" className={C.outline} disabled={emailSchedule.isPending} onClick={() => emailSchedule.mutate()}><Mail className="mr-2 h-4 w-4" />{emailSchedule.isPending ? t("Emailing...") : t("Email schedule")}</Button>}
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
            spanish={spanish}
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
          <Card className={C.shell}><CardContent className="p-6">{shareToken ? (spanish ? "Cargando horario compartido..." : "Loading shared schedule...") : (spanish ? "Cree o seleccione una semana para comenzar." : "Create or select a week to begin.")}</CardContent></Card>
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
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                  <div className="text-sm text-[#5f5247]">Hourly scheduled hours</div>
                  <div className="text-3xl font-semibold">{payload.totals.totalWeeklyLaborHours}</div>
                  <div className="text-xs text-[#5f5247]">Excludes salaried GM/DOS hours</div>
                </div>
                {payload.totals.totalWeeklyLaborDollarsIncludingSalary != null ? (
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">Total labor $</div>
                    <div className="text-3xl font-semibold">${payload.totals.totalWeeklyLaborDollarsIncludingSalary || "0.00"}</div>
                    <div className="mt-1 text-xs text-[#5f5247]">Hourly only: ${payload.totals.totalWeeklyLaborDollars || "0.00"}</div>
                    <div className="text-xs text-[#5f5247]">Salaried only: ${payload.totals.totalWeeklySalariedLaborDollars || "0.00"}</div>
                    <div className="text-xs font-semibold text-[#5f5247]">Labor % room rev: {payload.totals.totalWeeklyLaborPercentOfRoomRevenueIncludingSalary || "0.0"}%</div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">Displayed hours</div>
                    <div className="text-3xl font-semibold">{payload.totals.totalWeeklyLaborHoursIncludingSalary || payload.totals.totalWeeklyLaborHours}</div>
                    <div className="text-xs text-[#5f5247]">Labor dollars hidden</div>
                  </div>
                )}
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                  <div className="text-sm text-[#5f5247]">HPOR target {payload.totals.laborMetrics?.targets.hpor ?? 1.3}</div>
                  <div className={`text-3xl font-semibold ${metricTone(payload.totals.laborMetrics?.weekly.hpor || 0, payload.totals.laborMetrics?.targets.hpor || 1.3)}`}>{payload.totals.laborMetrics?.weekly.hpor ?? "0.00"}</div>
                </div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                  <div className="text-sm text-[#5f5247]">HK MPOR target {payload.totals.laborMetrics?.targets.hkMporMin ?? 25}-{payload.totals.laborMetrics?.targets.hkMporMax ?? 30}</div>
                  {hasHousekeepingBoardData ? (
                    <div className={`text-3xl font-semibold ${metricTone(payload.totals.laborMetrics?.weekly.hkMpor || 0, payload.totals.laborMetrics?.targets.hkMporMax || 30)}`}>{payload.totals.laborMetrics?.weekly.hkMpor ?? "0.0"}</div>
                  ) : (
                    <>
                      <div className="text-2xl font-semibold text-[#5f5247]">Pending</div>
                      <div className="text-xs text-[#5f5247]">Enter HK board data to calculate actual MPOR.</div>
                    </>
                  )}
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
            {user?.isAdmin && (
              <Card className={C.shell}>
                <CardHeader>
                  <CardTitle className={C.ink}>Department completion</CardTitle>
                  <CardDescription className={C.muted}>Department managers save their section when complete. GM/admin publishes after all required departments are complete.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {(payload.requiredDepartments || []).map((department) => {
                    const completed = Boolean(payload.departmentStatus?.[department]?.completedAt);
                    const canComplete = payload.currentUserPermissions?.editableDepartments?.includes(department);
                    return (
                      <div key={department} className="rounded-lg border border-[#e0d3c1] bg-white p-3">
                        <div className="font-semibold">{department}</div>
                        <Badge variant="outline" className={completed ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"}>{completed ? "Completed" : "Open"}</Badge>
                        {canComplete && !completed && <Button size="sm" className={`${C.green} ml-2`} onClick={() => completeDepartment.mutate(department)}>Save section</Button>}
                      </div>
                    );
                  })}
                  {(payload.requiredDepartments || []).every((department) => payload.departmentStatus?.[department]?.completedAt) && (
                    <div className="w-full rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-900">Full schedule is ready to review and publish.</div>
                  )}
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

            <PersonalScheduleCard payload={payload} user={user} spanish={spanish} />

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
            <ScheduleGrid
              payload={payload}
              editable={editable}
              currentUser={user}
              spanish={spanish}
              onEdit={(employee, date, department, assignment) => setSelectedShift({ employee, date, department, assignment })}
              onCopyShift={(assignment, employee, date, department) => saveShift.mutate({
                employeeId: employee.id,
                shiftDate: date,
                shiftTypeId: assignment.shiftTypeId,
                customStartTime: cleanTime(assignment.customStartTime),
                customEndTime: cleanTime(assignment.customEndTime),
                unpaidBreakMinutes: assignment.unpaidBreakMinutes,
                roleWorked: assignment.roleWorked || rolesArray(employee.rolesJson).find((role) => roleDepartment(role) === department) || department,
                roleNote: assignment.roleNote,
                managerNote: assignment.managerNote,
                isOpenShift: assignment.isOpenShift,
              })}
              onHousekeepingBoard={(employee, date, board) => setSelectedHousekeepingBoard({ employee, date, board })}
            />
            {user?.isAdmin && !shareToken && (
              <EmployeeManager
                employees={payload.employees}
                canViewRates={Boolean(user?.isSuperAdmin)}
                spanish={spanish}
                onAdd={(employee) => addEmployee.mutate(employee)}
                onUpdate={(id, patch) => updateEmployee.mutate({ id, patch })}
                onPayrollImport={(file) => importPayrollRates.mutate(file)}
                importingPayroll={importPayrollRates.isPending}
              />
            )}
            {!editable && !shareToken && payload.schedule.status === "published" && <div className="flex items-center gap-2 text-sm text-[#5f5247]"><Lock className="h-4 w-4" />{t("Published schedules are read-only until reopened.")}</div>}
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
          rowDepartment={selectedShift.department}
          assignment={selectedShift.assignment}
          onSave={(body) => saveShift.mutate(body)}
          onClear={() => saveShift.mutate({ employeeId: selectedShift.employee.id, shiftDate: selectedShift.date, clear: true })}
        />
      )}
      {payload && selectedHousekeepingBoard && (
        <HousekeepingBoardDialog
          open={!!selectedHousekeepingBoard}
          onOpenChange={(open) => !open && setSelectedHousekeepingBoard(null)}
          employee={selectedHousekeepingBoard.employee}
          date={selectedHousekeepingBoard.date}
          board={selectedHousekeepingBoard.board}
          onSave={(body) => saveHousekeepingBoard.mutate(body)}
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
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Current HK MPOR</div><div className="text-2xl font-semibold">{hasHousekeepingBoardData ? aiDraft.laborMetrics?.weekly.hkMpor ?? "-" : "Pending"}</div></div>
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
      {!shareToken && user && <ScheduleTutorial spanish={spanish} isAdmin={Boolean(user.isAdmin)} userId={user.id} />}
    </div>
  );
}
