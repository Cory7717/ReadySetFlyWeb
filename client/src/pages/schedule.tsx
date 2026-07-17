import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  GripVertical,
  Image,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Search,
  Share2,
  Sparkles,
  Trash2,
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
  menu: "!border-[#cdbda8] !bg-white !text-[#201814]",
};

const DEPARTMENTS = ["Managers", "Above Property", "Front Desk", "Night Audit", "Bistro", "Maintenance", "Housekeeping"];
const SCHEDULE_ROLES = ["Above Property", "GM", "DOS", "DOS / Sales", "Sales", "MOD", "Executive Housekeeper", "Exec HK", "Front Desk Supervisor", "FD AM", "FD PM", "Night Audit", "Bistro Manager", "Bistro Attendant", "Maintenance", "Room Attendant", "Laundry", "Room Inspector", "Houseperson"];
const DAY_LABELS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_LABELS_ES = ["Sab", "Dom", "Lun", "Mar", "Mie", "Jue", "Vie"];
const HOUSEKEEPING_OUT_TIME_NOTICE = "Housekeeping scheduled end times are planning estimates used to calculate labor hours. Associates may leave once their assigned work is complete and they have been released by their supervisor. If additional time is needed to complete assigned duties, associates should remain until the work is finished.";
const HOUSEKEEPING_OUT_TIME_NOTICE_ES = "Las horas de salida de Housekeeping son estimados de planificacion utilizados para calcular las horas laborales. Los asociados pueden retirarse cuando hayan terminado el trabajo asignado y su supervisor los haya autorizado. Si necesitan tiempo adicional para completar sus responsabilidades, deben permanecer hasta finalizar el trabajo.";
const HOUSEKEEPING_BREAK_NOTICE = "Any time you take a break, you are required to clock out when the break begins and clock back in before returning to work.";
const HOUSEKEEPING_BREAK_NOTICE_ES = "Cada vez que tome un descanso, debe marcar la salida al comenzar el descanso y volver a marcar la entrada antes de regresar al trabajo.";

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
  "Show removed employees": "Mostrar empleados removidos",
  "Remove from schedule": "Remover del horario",
  "Restore to schedule": "Restaurar al horario",
  "No position": "Sin puesto",
  "Schedule requests": "Solicitudes de horario",
  "Requests inside 14 days are outside hotel policy and subject to manager approval.": "Las solicitudes dentro de 14 dias estan fuera de la politica del hotel y estan sujetas a aprobacion del gerente.",
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
  Cancel: "Cancelar",
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
  isDepartmentManager?: boolean;
  canManageTemplates?: boolean;
  department?: string | null;
  canAccessTips?: boolean;
};

type ScheduleRequest = {
  id: string;
  requesterUserId: string;
  department?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  requestDate: string;
  requestEndDate?: string | null;
  originalRequestDate?: string | null;
  requestType: string;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
  status: string;
  createdAt?: string | null;
  conflictCount?: number;
  isPast?: boolean;
  overlapConflictCount?: number;
  firstOverlapRequest?: {
    id: string;
    requesterName: string;
    requestDate: string;
    requestEndDate?: string | null;
    status: string;
    createdAt?: string | null;
    isCurrentRequest?: boolean;
  } | null;
  overlapConflicts?: Array<{
    id: string;
    requesterName: string;
    requestDate: string;
    requestEndDate?: string | null;
    status: string;
    createdAt?: string | null;
  }>;
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
  roleRatesJson?: Record<string, number | string> | null;
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
  forecastAdr?: string | number | null;
  roomRevenue?: string | number | null;
  otbRoomsSold?: number | null;
  otbOccupancyPercent?: string | number | null;
  otbArrivals?: number | null;
  otbDepartures?: number | null;
  otbRoomRevenue?: string | number | null;
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

type ScheduleActualHours = {
  id?: string;
  scheduleId?: string;
  employeeId: string;
  workDate: string;
  actualHours: number | string;
  notes?: string | null;
  source?: string | null;
};

type ScheduleTemplate = {
  id: string;
  name: string;
  occupancyTier: "minimal" | "low" | "moderate" | "high" | "peak" | "custom";
  description?: string | null;
  shiftCount: number;
  updatedAt?: string | null;
};

type ScheduleTemplatePreview = {
  template: ScheduleTemplate;
  schedule: WeeklySchedule;
  shiftCount: number;
  applicableCount: number;
  conflicts: {
    missingAssociates: string[];
    inactiveAssociates: string[];
    missingShiftTypes: string[];
    approvedRequests: string[];
    existingCells: string[];
    weeklyHours: string[];
  };
};

type SchedulePayload = {
  schedule: WeeklySchedule;
  days: string[];
  departments: string[];
  requiredDepartments?: string[];
  employees: ScheduleEmployee[];
  shiftTypes: ShiftType[];
  forecast: ForecastDay[];
  forecastAccuracy?: {
    current: {
      ready: boolean;
      completedDays: number;
      daily: Array<{
        date: string;
        originalPickupRooms: number | null;
        forecastVarianceRooms: number;
        absoluteForecastErrorRooms: number;
        forecastVariancePercent: number | null;
        revenueVariance: number | null;
      }>;
      weekly: {
        originalPickupRooms: number;
        forecastVarianceRooms: number;
        forecastAccuracyPercent: number | null;
        meanAbsoluteErrorRooms: number;
        revenueVariance: number;
        forecastRooms: number;
        actualRooms: number;
        forecastRevenue: number;
        actualRevenue: number;
      };
    };
    historical: {
      sampleDays: number;
      byWeekday: Record<string, {
        sampleDays: number;
        averageRoomsVariance: number;
        averageArrivalsVariance: number;
        averageDeparturesVariance: number;
      }>;
    };
  };
  assignments: ShiftAssignment[];
  actualHours?: ScheduleActualHours[];
  housekeepingBoards?: HousekeepingBoard[];
  approvedRequests?: ScheduleRequest[];
  totals: {
    employeeWeeklyHours: Record<string, number>;
    employeeDepartmentWeeklyHours?: Record<string, Record<string, number>>;
    departmentDailyHours: Record<string, Record<string, number>>;
    departmentWeeklyHours: Record<string, number>;
    departmentSupervisorDailyHours?: Record<string, Record<string, number>>;
    departmentSupervisorWeeklyHours?: Record<string, number>;
    departmentAssociateDailyHours?: Record<string, Record<string, number>>;
    departmentAssociateWeeklyHours?: Record<string, number>;
    departmentWeeklyLaborDollars?: Record<string, number>;
    departmentWeeklyLaborDollarsIncludingSalary?: Record<string, number>;
    dailyLaborHours: Record<string, number>;
    dailyScheduledHours?: Record<string, number>;
    dailyLaborHoursIncludingSalary?: Record<string, number>;
    dailySalariedLaborHours?: Record<string, number>;
    dailyLaborDollars?: Record<string, number>;
    dailyLaborDollarsIncludingSalary?: Record<string, number>;
    dailySalariedLaborDollars?: Record<string, number>;
    totalWeeklyLaborHours: string;
    totalWeeklyScheduledHours?: string;
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
  departmentStatus?: Record<string, { completedAt?: string; completedBy?: string; reopenedAt?: string; reopenedBy?: string }>;
  currentUserPermissions?: { editableDepartments: string[]; canPublishFinal: boolean };
};

type HoursComparisonRow = {
  employeeId?: string | null;
  employeeName: string;
  department: string;
  scheduledHours: number;
  actualHours: number;
  variance: number;
  scheduledByDay: Record<string, number>;
  actualByDay: Record<string, number>;
  matched: boolean;
  notes?: string[];
};

type HoursComparison = {
  fileName: string;
  weekStartDate: string;
  weekEndDate: string;
  rows: HoursComparisonRow[];
  totals: { scheduledHours: number; actualHours: number; variance: number; unmatched: number };
};

type LaborMetrics = {
  targets: { hpor: number; hkMporMin: number; hkMporMax: number };
  daily: Record<string, {
    roomsSold: number;
    laborHours: number;
    laborDollars: number;
    hpor: number;
    housekeepingHours: number;
    roomAttendantHours?: number;
    roomCredits: number;
    hkMpor: number;
    targetHousekeepingHoursMin: number;
    targetHousekeepingHoursMax: number;
    targetRoomAttendantHours?: number;
    targetLaundryHours?: number;
    targetHousepersonHours?: number;
    targetTotalHousekeepingOperatingHours?: number;
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
    roomAttendantHours?: number;
    roomCredits: number;
    hkMpor: number;
    targetHousekeepingHoursMin: number;
    targetHousekeepingHoursMax: number;
    standardHousekeepingMinutes?: number;
    targetRoomAttendantHours?: number;
    targetLaundryHours?: number;
    targetHousepersonHours?: number;
    targetTotalHousekeepingOperatingHours?: number;
    fullDepartmentHousekeepingMpor?: {
      target: number;
      forecastHours: number;
      forecastRooms: number;
      forecastMpor: number;
      actualHours: number;
      actualRooms: number;
      actualMpor: number | null;
      actualReady: boolean;
    };
  };
};

type AiScheduleDraft = {
  assignments: ShiftAssignment[];
  warnings: string[];
  laborMetrics?: LaborMetrics;
  department?: string;
  mode?: "frontDesk" | "housekeeping";
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

function daysBetweenLocal(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  return Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
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

function formatRequestDateRange(request: ScheduleRequest) {
  const start = request.originalRequestDate || request.requestDate;
  const end = request.requestEndDate || start;
  return end && end !== start ? `${formatDate(start)} - ${formatDate(end)}` : formatDate(start);
}

function shiftText(assignment: ShiftAssignment | undefined, shiftType: ShiftType | undefined) {
  if (!assignment || !shiftType) return "";
  if (isNonWorkingShift(shiftType.label) || isNonWorkingShift(assignment.roleWorked)) return shiftType.label;
  const start = assignment.customStartTime || shiftType.startTime;
  const end = assignment.customEndTime || shiftType.endTime;
  const base = start && end ? `${formatTimeCompact(start)} - ${formatTimeCompact(end)}` : shiftType.label;
  return [base, usefulRoleWorkedLabel(assignment.roleWorked, shiftType), usefulShiftNote(assignment.roleNote, assignment.roleWorked, shiftType)].filter(Boolean).join("\n");
}

function isNonWorkingShift(value?: string | null) {
  return ["OFF", "PTO", "CALL OFF"].includes(String(value || "").trim().toUpperCase());
}

function usefulRoleWorkedLabel(roleWorked: string | null | undefined, shiftType: ShiftType | undefined) {
  const value = String(roleWorked || "").trim();
  if (!value || roleDepartment(value) !== "Housekeeping") return "";
  const normalized = value.toLowerCase();
  if (normalized === "housekeeping") return "";
  return value;
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

function operationalManagerDepartment(employee: ScheduleEmployee) {
  const text = [
    employee.department,
    employee.position,
    ...rolesArray(employee.rolesJson),
  ].filter(Boolean).join(" ").toLowerCase();
  if (text.includes("general manager") || /\bgm\b/.test(text) || text.includes("director of sales") || /\bdos\b/.test(text)) return "";
  if (text.includes("executive housekeeper") || text.includes("exec hk") || text.includes("housekeeping manager")) return "Housekeeping";
  if (
    (text.includes("bistro") || text.includes("breakfast"))
    && (text.includes("manager") || text.includes("supervisor") || text.includes("lead"))
  ) return "Bistro";
  if (
    (text.includes("front desk") || text.includes("front office") || /\bfd\b/.test(text))
    && (text.includes("manager") || text.includes("supervisor") || text.includes("lead"))
  ) return "Front Desk";
  return "";
}

function employeeDepartments(employee: ScheduleEmployee) {
  const managerDepartment = operationalManagerDepartment(employee);
  const departments = Array.from(new Set([
    normalizeDepartment(employee.department),
    roleDepartment(employee.position),
    ...rolesArray(employee.rolesJson).map(roleDepartment).filter(Boolean),
  ]));
  if (!managerDepartment) return departments;
  return Array.from(new Set([
    managerDepartment,
    ...departments.filter((department) => department !== "Managers"),
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
  if (isNonWorkingShift(assignment?.roleWorked) || isNonWorkingShift(shiftType?.label)) {
    const managerDepartment = operationalManagerDepartment(employee);
    if (managerDepartment) return managerDepartment;
    const departments = [employee.department, employee.position, ...rolesArray(employee.rolesJson)]
      .filter(Boolean)
      .map((value) => normalizeDepartment(value));
    return departments.find((department) => department !== "Managers") || departments[0] || "Front Desk";
  }
  const resolved = roleDepartment(shiftType?.departmentHint || shiftType?.label || assignment?.roleWorked || employee.department);
  const managerDepartment = operationalManagerDepartment(employee);
  return resolved === "Managers" && managerDepartment ? managerDepartment : resolved;
}

function assignmentBelongsToDepartment(assignment: ShiftAssignment | undefined, employee: ScheduleEmployee, shiftType: ShiftType | undefined, department: string) {
  if (!assignment) return false;
  return assignmentDepartment(assignment, employee, shiftType) === department;
}

function scheduleEmployeeSort(department: string, a: ScheduleEmployee, b: ScheduleEmployee) {
  if (department === "Managers") {
    const propertyLeadershipRank = (employee: ScheduleEmployee) => {
      const text = [employee.position, employee.department, ...rolesArray(employee.rolesJson)].filter(Boolean).join(" ").toLowerCase();
      if (text.includes("general manager") || /\bgm\b/.test(text)) return 0;
      if (text.includes("director of sales") || /\bdos\b/.test(text)) return 1;
      return 2;
    };
    const rank = propertyLeadershipRank(a) - propertyLeadershipRank(b);
    if (rank) return rank;
  }
  const aIsDepartmentManager = operationalManagerDepartment(a) === department
    || (Boolean(a.isDepartmentManager) && normalizeDepartment(a.department) === department);
  const bIsDepartmentManager = operationalManagerDepartment(b) === department
    || (Boolean(b.isDepartmentManager) && normalizeDepartment(b.department) === department);
  const managerRank = Number(bIsDepartmentManager) - Number(aIsDepartmentManager);
  return managerRank || Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.displayName.localeCompare(b.displayName);
}

function employeeScheduleSubtitle(employee: ScheduleEmployee) {
  return String(employee.position || normalizeDepartment(employee.department) || "").trim();
}

function cleanTime(value?: string | null) {
  return value ? value.slice(0, 5) : null;
}

function shiftTone(assignment: ShiftAssignment | undefined, shiftType: ShiftType | undefined, shiftTypes: Map<string, ShiftType>) {
  const roleText = String(assignment?.roleWorked || "").toLowerCase();
  if (shiftType && normalizeDepartment(shiftType.departmentHint || shiftType.label) === "Bistro" && (roleText.includes("bistro") || roleText.includes("breakfast"))) {
    return shiftType;
  }
  const roleShift = assignment?.roleWorked
    ? Array.from(shiftTypes.values()).find((shift) => {
        const role = String(assignment.roleWorked).toLowerCase();
        const label = shift.label.toLowerCase();
        return label === role
          || (role.includes("room attendant") && (label === "room attendant" || label === "housekeeping"))
          || ((role.includes("executive housekeeper") || role.includes("exec hk")) && label === "exec hk")
          || (role.includes("laundry") && label === "laundry")
          || ((role.includes("houseperson") || role.includes("houseman")) && label === "houseperson")
          || (role.includes("inspector") && label === "room inspector")
          || (role.includes("maintenance") && label === "maintenance")
          || (role.includes("bistro am") && label === "bistro am")
          || (role.includes("bistro pm") && label === "bistro pm")
          || (role.includes("breakfast") && label === "breakfast")
          || (role.includes("front desk supervisor") && label === "front desk supervisor")
          || (role.includes("fd am") && label === "fd am")
          || (role.includes("fd pm") && label === "fd pm")
          || (role.includes("audit") && label === "night audit");
      })
    : undefined;
  return roleShift || shiftType;
}

function matchingShiftForRole(roleWorked: string, shiftTypes: ShiftType[]) {
  const role = roleWorked.toLowerCase();
  return shiftTypes.find((shift) => {
    const label = shift.label.toLowerCase();
    return label === role
      || (role.includes("audit") && (label === "night audit" || label === "audit"))
      || ((role.includes("dos") || role.includes("sales")) && label === "dos / sales")
      || (role.includes("room attendant") && (label === "room attendant" || label === "housekeeping"))
      || ((role.includes("executive housekeeper") || role.includes("exec hk")) && label === "exec hk")
      || (role.includes("laundry") && label === "laundry")
      || ((role.includes("houseperson") || role.includes("houseman")) && label === "houseperson")
      || (role.includes("inspector") && label === "room inspector")
      || (role.includes("maintenance") && label === "maintenance")
      || (role.includes("bistro am") && label === "bistro am")
      || (role.includes("bistro pm") && label === "bistro pm")
      || (role.includes("breakfast") && label === "breakfast")
      || (role.includes("front desk supervisor") && label === "front desk supervisor")
      || (role.includes("fd am") && label === "fd am")
      || (role.includes("fd pm") && label === "fd pm")
      || (role === "gm" && label === "gm");
  });
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

function fmtHours(value: unknown) {
  const n = numberValue(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

function rolesArray(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value.map(String)
    : typeof value === "string"
      ? value.split(",")
      : [];
  return Array.from(new Set(source.map(normalizeScheduleRole).filter(Boolean)));
}

function normalizeScheduleRole(value: unknown) {
  const role = String(value || "").trim();
  if (!role) return "";
  const normalized = role.toLowerCase();
  if (["bistro am", "bistro pm", "breakfast"].includes(normalized)) return "Bistro Attendant";
  return role;
}

function normalizeRoleRates(value: Record<string, number | string> | null | undefined) {
  const rates: Record<string, number | string> = {};
  for (const [role, rate] of Object.entries(value || {})) {
    const normalizedRole = normalizeScheduleRole(role);
    if (!normalizedRole || rate === "" || rate == null) continue;
    rates[normalizedRole] = rate;
  }
  return rates;
}

function roleRateValue(rates: Record<string, number | string> | null | undefined, role: string) {
  const normalizedRole = normalizeScheduleRole(role);
  const normalizedRates = normalizeRoleRates(rates);
  return normalizedRates[normalizedRole] ?? "";
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
  if (!Number(board.roomCredits || 0)) return "border-sky-300 bg-sky-50 text-sky-800";
  if (mpor >= 25 && mpor <= 30) return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (mpor >= 20 && mpor <= 34) return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-red-300 bg-red-50 text-red-800";
}

function isRoomAttendantAssignment(assignment?: ShiftAssignment, shiftType?: ShiftType, employee?: ScheduleEmployee) {
  if (!assignment && !shiftType) return false;
  const employeeText = [employee?.position, ...(employee?.rolesJson || [])].filter(Boolean).join(" ").toLowerCase();
  if (employeeText.includes("executive housekeeper") || employeeText.includes("exec hk") || employeeText.includes("housekeeping manager")) return false;
  const text = [
    assignment?.roleWorked,
    assignment?.roleNote,
    shiftType?.label,
    shiftType?.departmentHint,
  ].filter(Boolean).join(" ").toLowerCase();
  if (/(laundry|houseperson|houseman|inspector|executive housekeeper|exec hk|housekeeping manager)/.test(text)) return false;
  return text.includes("room attendant") || text.includes("housekeeping");
}

function weeklyRoomAttendantMpor(employeeId: string, boards: HousekeepingBoard[]) {
  const employeeBoards = boards.filter((board) => board.employeeId === employeeId && Number(board.roomCredits || 0) > 0);
  const actualHours = employeeBoards.reduce((sum, board) => sum + Number(board.actualHours || 0), 0);
  const roomCredits = employeeBoards.reduce((sum, board) => sum + Number(board.roomCredits || 0), 0);
  return roomCredits > 0 ? (actualHours * 60) / roomCredits : null;
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
  onScreenshotImport,
  onActualizedImport,
  onPopupGroupSave,
  importing,
  importingScreenshot,
  actualizing,
  canActualize,
  spanish,
}: {
  payload: SchedulePayload;
  editable: boolean;
  onSave: (days: ForecastDay[]) => void;
  onImport: (file: File) => void;
  onScreenshotImport: (file: File) => void;
  onActualizedImport: (file: File) => void;
  onPopupGroupSave: (body: { forecastDate: string; popupGroupRooms: number; popupGroupNotes: string }) => void;
  importing: boolean;
  importingScreenshot: boolean;
  actualizing: boolean;
  canActualize: boolean;
  spanish: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement | null>(null);
  const actualizedInputRef = useRef<HTMLInputElement | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const t = (value: string) => spanish ? ES[value] || value : value;
  const [forecastDirty, setForecastDirty] = useState(false);
  const [days, setDays] = useState<ForecastDay[]>(payload.days.map((date) => payload.forecast.find((day) => day.forecastDate === date) || { forecastDate: date, roomsSold: 0, occupancyPercent: 0, arrivals: 0, departures: 0, stayovers: 0 }));
  const [groupForm, setGroupForm] = useState({ forecastDate: payload.days[0] || "", popupGroupRooms: "0", popupGroupNotes: "" });
  useEffect(() => {
    setDays(payload.days.map((date) => payload.forecast.find((day) => day.forecastDate === date) || { forecastDate: date, roomsSold: 0, occupancyPercent: 0, arrivals: 0, departures: 0, stayovers: 0 }));
    setForecastDirty(false);
  }, [payload.schedule.id, payload.forecast, payload.days]);
  useEffect(() => {
    if (!editable || !forecastDirty) return;
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      onSave(days);
      setForecastDirty(false);
    }, 700);
    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    };
  }, [days, editable, forecastDirty, onSave]);
  const hasOriginalUpload = days.some((day) =>
    day.otbRoomsSold != null ||
    day.otbOccupancyPercent != null ||
    day.otbArrivals != null ||
    day.otbDepartures != null ||
    day.otbRoomRevenue != null
  );
  const forecastVarianceForDate = (date: string) => payload.forecastAccuracy?.current.daily.find((day) => day.date === date);
  const updateDayField = (index: number, key: string, value: string) => {
    setForecastDirty(true);
    setDays((current) => current.map((item, i) => {
      if (i !== index) return item;
      if (key === "arrivals") {
        const arrivals = Math.max(0, Math.round(numberValue(value)));
        return {
          ...item,
          arrivals,
          stayovers: Math.max(0, numberValue(item.roomsSold) - arrivals),
        };
      }
      if (key === "forecastAdr") {
        const forecastAdr = Math.max(0, numberValue(value));
        const totalForecastRooms = Math.max(0, numberValue(item.roomsSold) + numberValue(item.popupGroupRooms));
        return {
          ...item,
          forecastAdr,
          roomRevenue: Number((totalForecastRooms * forecastAdr).toFixed(2)),
        };
      }
      if (key !== "roomsSold") return { ...item, [key]: value };

      const nextRoomsSold = Math.max(0, Math.round(numberValue(value)));
      const capacity = inferRoomCapacity(item);
      const occupancyPercent = Number(((nextRoomsSold / capacity) * 100).toFixed(2));
      const arrivals = Math.max(0, Math.round(numberValue(item.arrivals)));
      const stayovers = Math.max(0, nextRoomsSold - arrivals);
      const forecastAdr = numberValue(item.forecastAdr) || (
        numberValue(item.roomsSold) + numberValue(item.popupGroupRooms) > 0
          ? numberValue(item.roomRevenue) / (numberValue(item.roomsSold) + numberValue(item.popupGroupRooms))
          : 0
      );
      const roomRevenue = forecastAdr > 0
        ? Number(((nextRoomsSold + numberValue(item.popupGroupRooms)) * forecastAdr).toFixed(2))
        : numberValue(item.roomRevenue);

      return {
        ...item,
        roomsSold: nextRoomsSold,
        occupancyPercent,
        arrivals,
        stayovers,
        forecastAdr: forecastAdr > 0 ? Number(forecastAdr.toFixed(2)) : null,
        roomRevenue,
      };
    }));
  };
  return (
    <Card className={C.shell} data-tour="forecast">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className={C.ink}>{t("Forecast")}</CardTitle>
            <CardDescription className={C.muted}>
              {spanish
                ? "Cuartos, ocupacion, llegadas, salidas y notas controlan alertas de personal. Cuartos y llegadas recalculan estadias."
                : "Rooms, occupancy, arrivals, departures, and notes drive staffing warnings. Rooms sold and arrivals recalculate stayovers."}
            </CardDescription>
          </div>
          {(editable || canActualize) && (
            <div className="flex flex-wrap gap-2">
              {editable && (
                <>
                  <Button variant="outline" className={C.outline} disabled={importing} onClick={() => fileInputRef.current?.click()}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    {importing ? (spanish ? "Importando..." : "Importing...") : t("Import OTB CSV")}
                  </Button>
                  <Button variant="outline" className={C.outline} disabled={importingScreenshot} onClick={() => screenshotInputRef.current?.click()}>
                    <Image className="mr-2 h-4 w-4" />
                    {importingScreenshot ? (spanish ? "Leyendo imagen..." : "Reading screenshot...") : (spanish ? "Importar imagen Agilysys" : "Import Agilysys screenshot")}
                  </Button>
                </>
              )}
              {canActualize && <Button variant="outline" className={C.outline} disabled={actualizing} onClick={() => actualizedInputRef.current?.click()}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {actualizing ? (spanish ? "Subiendo..." : "Uploading...") : (spanish ? "Subir pickup real" : "Upload actual pickup")}
              </Button>}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {canActualize && (
          <div className="mb-4 rounded-xl border border-[#bdd5c3] bg-[#e8f1ea] p-3 text-sm text-[#173c25]">
            <div className="font-semibold">{spanish ? "Actualizar pickup despues de cerrar la semana" : "Ended-week actual pickup upload"}</div>
            <p className="mt-1">
              {spanish
                ? "Despues de terminar el horario, suba el reporte On the Books actualizado aqui. El sistema compara cuartos reales contra la carga original para medir pickup y mejorar el pronostico."
                : "After the schedule week closes, upload the updated On the Books CSV here. The system compares actual rooms against the original upload so pickup accuracy can be tracked for future AI scheduling."}
            </p>
          </div>
        )}
        {canActualize && (
          <input
            ref={actualizedInputRef}
            aria-label={spanish ? "Subir archivo CSV de pickup real" : "Upload actual pickup CSV"}
            title={spanish ? "Subir archivo CSV de pickup real" : "Upload actual pickup CSV"}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onActualizedImport(file);
              event.target.value = "";
            }}
          />
        )}
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
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="w-fit border-[#bdd5c3] bg-[#e8f1ea] text-[#173c25]">
                    {spanish ? "Pickup vs original" : "Pickup vs original"}: {payload.forecastAccuracy?.current.weekly.originalPickupRooms ?? 0} rooms
                  </Badge>
                  <Badge variant="outline" className="w-fit border-[#d9c9b4] bg-white text-[#4f3d2e]">
                    {spanish ? "Varianza vs pronostico" : "Variance vs forecast"}: {(payload.forecastAccuracy?.current.weekly.forecastVarianceRooms ?? 0) > 0 ? "+" : ""}{payload.forecastAccuracy?.current.weekly.forecastVarianceRooms ?? 0} rooms
                  </Badge>
                  <Badge variant="outline" className="w-fit border-[#d9c9b4] bg-white text-[#4f3d2e]">
                    {spanish ? "Precision" : "Forecast accuracy"}: {payload.forecastAccuracy?.current.weekly.forecastAccuracyPercent?.toFixed(1) ?? "-"}%
                  </Badge>
                  <Badge variant="outline" className="w-fit border-[#d9c9b4] bg-white text-[#4f3d2e]">
                    {spanish ? "Varianza ingresos" : "Revenue variance"}: ${Number(payload.forecastAccuracy?.current.weekly.revenueVariance ?? 0).toFixed(2)}
                  </Badge>
                </div>
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
                  ["otbRoomRevenue", spanish ? "Ingresos cuartos" : "Room revenue"],
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
                  <>
                    {[
                      ["actualRoomsSold", spanish ? "Cuartos reales" : "Actual rooms sold"],
                      ["actualOccupancyPercent", spanish ? "Occ real %" : "Actual occ %"],
                      ["actualArrivals", spanish ? "Llegadas reales" : "Actual arrivals"],
                      ["actualDepartures", spanish ? "Salidas reales" : "Actual departures"],
                      ["actualRoomRevenue", spanish ? "Ingresos reales" : "Actual room rev"],
                    ].map(([key, label]) => (
                      <tr key={key}>
                        <td className="border border-[#e0d3c1] bg-[#edf5ef] p-2 font-medium text-[#173c25]">{label}</td>
                        {days.map((day) => (
                          <td key={day.forecastDate} className="border border-[#e0d3c1] bg-[#edf5ef] p-2 text-center font-semibold text-[#173c25]">
                            {(day as any)[key] ?? "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
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
                    <tr>
                      <td className="border border-[#e0d3c1] bg-[#fff4df] p-2 font-medium">{spanish ? "Real vs pronostico" : "Actual vs forecast"}</td>
                      {days.map((day) => {
                        const variance = forecastVarianceForDate(day.forecastDate)?.forecastVarianceRooms;
                        return (
                          <td key={day.forecastDate} className="border border-[#e0d3c1] bg-[#fff4df] p-2 text-center font-semibold">
                            {variance == null ? "-" : variance > 0 ? `+${variance}` : variance}
                          </td>
                        );
                      })}
                    </tr>
                  </>
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
              ["forecastAdr", "ADR"],
              ["roomRevenue", spanish ? "Ingresos cuartos calculados" : "Calculated room rev"],
              ["popupGroupRooms", spanish ? "Cuartos grupo" : "Pop-up rooms"],
              ["notes", t("Notes")],
            ].map(([key, label]) => (
              <tr key={key}>
                <td className="border border-[#e0d3c1] p-2 font-medium">{label}</td>
                {days.map((day, index) => (
                  <td key={day.forecastDate} className="border border-[#e0d3c1] p-1">
                    <Input
                      className={C.field}
                      disabled={!editable || key === "roomRevenue"}
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
            <Button className={C.green} onClick={() => {
              if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
              onSave(days);
              setForecastDirty(false);
            }}><Save className="mr-2 h-4 w-4" />{forecastDirty ? (spanish ? "Guardar ahora" : "Save now") : t("Save forecast")}</Button>
            <input
              ref={fileInputRef}
              aria-label={spanish ? "Importar archivo CSV OTB" : "Import OTB CSV"}
              title={spanish ? "Importar archivo CSV OTB" : "Import OTB CSV"}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
                event.target.value = "";
              }}
            />
            <input
              ref={screenshotInputRef}
              aria-label={spanish ? "Importar imagen de pronostico Agilysys" : "Import Agilysys forecast screenshot"}
              title={spanish ? "Importar imagen de pronostico Agilysys" : "Import Agilysys forecast screenshot"}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onScreenshotImport(file);
                event.target.value = "";
              }}
            />
            <Button variant="outline" className={C.outline} disabled={importing} onClick={() => fileInputRef.current?.click()}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {importing ? (spanish ? "Importando..." : "Importing...") : t("Import OTB CSV")}
            </Button>
            <Button variant="outline" className={C.outline} disabled={importingScreenshot} onClick={() => screenshotInputRef.current?.click()}>
              <Image className="mr-2 h-4 w-4" />
              {importingScreenshot ? (spanish ? "Leyendo imagen..." : "Reading screenshot...") : (spanish ? "Importar imagen Agilysys" : "Import Agilysys screenshot")}
            </Button>
            {canActualize && <Button variant="outline" className={C.outline} disabled={actualizing} onClick={() => actualizedInputRef.current?.click()}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {actualizing ? (spanish ? "Subiendo..." : "Uploading...") : (spanish ? "Subir pickup real" : "Upload actual pickup")}
            </Button>}
          </div>
        )}
        {editable && (
          <div className="mt-4 rounded-xl border border-[#e0d3c1] bg-white p-3">
            <div className="mb-2 font-semibold">{t("DOS pop-up group adjustment")}</div>
            <div className="grid gap-2 md:grid-cols-[160px_140px_1fr_auto]">
              <Select value={groupForm.forecastDate} onValueChange={(forecastDate) => setGroupForm({ ...groupForm, forecastDate })}>
                <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                <SelectContent className={C.menu}>{payload.days.map((day, index) => <SelectItem key={day} value={day}>{(spanish ? DAY_LABELS_ES : DAY_LABELS)[index]} {formatDate(day)}</SelectItem>)}</SelectContent>
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

function HoursComparisonPanel({
  payload,
  comparison,
  importing,
  onImport,
  spanish,
}: {
  payload: SchedulePayload;
  comparison: HoursComparison | null;
  importing: boolean;
  onImport: (file: File) => void;
  spanish: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const rows = comparison?.rows || [];
  const exceptionRows = rows.filter((row) => Math.abs(numberValue(row.variance)) >= 0.25 || !row.matched);
  return (
    <Card className={`${C.shell} print:hidden`}>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className={C.ink}>{spanish ? "Horas programadas vs reales" : "Scheduled vs Actual Hours"}</CardTitle>
            <CardDescription className={C.muted}>
              {spanish
                ? "Suba el reporte Hours Detail despues de cerrar la semana para comparar los turnos programados contra las horas reales por asociado."
                : "Upload the Hours Detail report after the week closes to compare scheduled shifts against actual associate hours."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              aria-label={spanish ? "Subir reporte XLSX de horas reales" : "Upload actual hours XLSX"}
              title={spanish ? "Subir reporte XLSX de horas reales" : "Upload actual hours XLSX"}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
                event.target.value = "";
              }}
            />
            <Button variant="outline" className={C.outline} onClick={() => setExpanded((value) => !value)}>
              {expanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
              {expanded ? (spanish ? "Ocultar" : "Collapse") : (spanish ? "Mostrar" : "Expand")}
            </Button>
            <Button className={C.green} disabled={importing} onClick={() => inputRef.current?.click()}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {importing ? (spanish ? "Importando..." : "Importing...") : (spanish ? "Subir horas reales" : "Upload actual hours")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {comparison ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Scheduled</div><div className="text-2xl font-semibold">{fmtHours(comparison.totals.scheduledHours)}</div></div>
              <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Actual</div><div className="text-2xl font-semibold">{fmtHours(comparison.totals.actualHours)}</div></div>
              <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Variance</div><div className={`text-2xl font-semibold ${Math.abs(comparison.totals.variance) >= 1 ? "text-amber-800" : "text-emerald-800"}`}>{comparison.totals.variance > 0 ? "+" : ""}{fmtHours(comparison.totals.variance)}</div></div>
              <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Unmatched</div><div className={`text-2xl font-semibold ${comparison.totals.unmatched ? "text-red-700" : "text-emerald-800"}`}>{comparison.totals.unmatched}</div></div>
            </div>
            <div className="text-xs text-[#5f5247]">Source: {comparison.fileName} | Schedule: {formatWeek(payload.schedule.weekStartDate, payload.schedule.weekEndDate)}</div>
            {!expanded && exceptionRows.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {exceptionRows.length} associate(s) have a variance of 0.25+ hours or were not matched to the schedule employee list. Expand to review.
              </div>
            )}
            {expanded && (
              <div className="overflow-x-auto rounded-xl border border-[#e0d3c1]">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#2a211c] text-white">
                      <th className="border border-[#d8c8b2] p-2 text-left">Associate</th>
                      <th className="border border-[#d8c8b2] p-2 text-left">Department</th>
                      <th className="border border-[#d8c8b2] p-2 text-right">Scheduled</th>
                      <th className="border border-[#d8c8b2] p-2 text-right">Actual</th>
                      <th className="border border-[#d8c8b2] p-2 text-right">Variance</th>
                      {payload.days.map((day, index) => <th key={day} className="border border-[#d8c8b2] p-2 text-center">{DAY_LABELS[index]}<br />{formatDate(day)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.employeeId || row.employeeName}`} className={!row.matched ? "bg-red-50" : Math.abs(row.variance) >= 0.25 ? "bg-amber-50" : "odd:bg-white even:bg-[#fbf6ee]"}>
                        <td className="border border-[#e0d3c1] p-2 font-semibold">
                          {row.employeeName}
                          {!row.matched && <div className="text-xs text-red-700">Not matched to schedule employee</div>}
                          {row.notes?.length ? <div className="mt-1 text-xs font-normal text-[#5f5247]">{row.notes.join("; ")}</div> : null}
                        </td>
                        <td className="border border-[#e0d3c1] p-2">{row.department}</td>
                        <td className="border border-[#e0d3c1] p-2 text-right">{fmtHours(row.scheduledHours)}</td>
                        <td className="border border-[#e0d3c1] p-2 text-right">{fmtHours(row.actualHours)}</td>
                        <td className={`border border-[#e0d3c1] p-2 text-right font-semibold ${Math.abs(row.variance) >= 0.25 ? "text-amber-900" : "text-emerald-800"}`}>{row.variance > 0 ? "+" : ""}{fmtHours(row.variance)}</td>
                        {payload.days.map((day) => (
                          <td key={day} className="border border-[#e0d3c1] p-2 text-center text-xs">
                            <div>S {fmtHours(row.scheduledByDay?.[day] || 0)}</div>
                            <div>A {fmtHours(row.actualByDay?.[day] || 0)}</div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-[#e0d3c1] bg-white p-4 text-sm text-[#5f5247]">
            {spanish
              ? "Suba el reporte Hours Detail para ver las horas reales por asociado contra el horario publicado."
              : "Upload the Hours Detail report to see actual associate hours compared with the published schedule."}
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
  const assignedShiftType = payload.shiftTypes.find((shift) => shift.id === assignment?.shiftTypeId);
  const initialBreakMinutes = assignment?.unpaidBreakMinutes ?? assignedShiftType?.unpaidBreakMinutes ?? 0;
  const [form, setForm] = useState({
    shiftTypeId: assignment?.shiftTypeId || "",
    customStartTime: assignment?.customStartTime?.slice(0, 5) || "",
    customEndTime: assignment?.customEndTime?.slice(0, 5) || "",
    unpaidBreakMinutes: initialBreakMinutes.toString(),
    roleWorked: assignment?.roleWorked || defaultRole,
    roleNote: assignment?.roleNote || "",
    managerNote: assignment?.managerNote || "",
    isOpenShift: assignment?.isOpenShift || false,
  });
  const selectShiftType = (shiftTypeId: string) => {
    const shift = payload.shiftTypes.find((item) => item.id === shiftTypeId);
    const nonWorking = isNonWorkingShift(shift?.label);
    const shiftDept = normalizeDepartment(shift?.departmentHint || shift?.label);
    const currentRoleDept = roleDepartment(form.roleWorked);
    const shouldUseShiftRole = Boolean(!nonWorking && shift && (!form.roleWorked || (shiftDept && currentRoleDept && shiftDept !== currentRoleDept)));
    setForm({
      ...form,
      shiftTypeId: shiftTypeId === "none" ? "" : shiftTypeId,
      customStartTime: nonWorking ? "" : shift?.startTime?.slice(0, 5) || "",
      customEndTime: nonWorking ? "" : shift?.endTime?.slice(0, 5) || "",
      unpaidBreakMinutes: nonWorking ? "" : String(shift?.unpaidBreakMinutes ?? 0),
      roleWorked: shouldUseShiftRole ? shift?.label || "" : form.roleWorked || shift?.label || "",
    });
  };
  const selectRoleWorked = (roleWorked: string) => {
    const nextRole = roleWorked === "none" ? "" : roleWorked;
    const matchingShift = matchingShiftForRole(nextRole, payload.shiftTypes);
    const nonWorking = isNonWorkingShift(nextRole) || isNonWorkingShift(matchingShift?.label);
    const currentShift = payload.shiftTypes.find((shift) => shift.id === form.shiftTypeId);
    const roleDept = roleDepartment(nextRole);
    const currentShiftDept = normalizeDepartment(currentShift?.departmentHint || currentShift?.label);
    const shouldReplaceShift = Boolean(matchingShift && (!form.shiftTypeId || (roleDept && roleDept !== currentShiftDept)));
    setForm({
      ...form,
      roleWorked: nextRole,
      shiftTypeId: shouldReplaceShift ? matchingShift?.id || "" : form.shiftTypeId || matchingShift?.id || "",
      customStartTime: nonWorking ? "" : form.customStartTime || matchingShift?.startTime?.slice(0, 5) || "",
      customEndTime: nonWorking ? "" : form.customEndTime || matchingShift?.endTime?.slice(0, 5) || "",
      unpaidBreakMinutes: nonWorking ? "" : form.unpaidBreakMinutes,
    });
  };
  const roleOptions = rowDepartment === "Bistro"
    ? Array.from(new Set([
        ...rolesArray(employee?.rolesJson).filter((role) => !["Bistro AM", "Bistro PM", "Breakfast"].includes(role)),
        "Bistro Manager",
        "Bistro Attendant",
      ].filter(Boolean)))
    : employee
      ? Array.from(new Set([...rolesArray(employee.rolesJson), rowDepartment || ""].filter(Boolean)))
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
              <SelectContent className={C.menu}>
                <SelectItem value="none">Clear / no shift</SelectItem>
                {payload.shiftTypes.filter((shift) => shift.active).map((shift) => <SelectItem key={shift.id} value={shift.id}>{shift.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Role worked</Label>
            <Select value={form.roleWorked || "none"} onValueChange={selectRoleWorked}>
              <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
              <SelectContent className={C.menu}>
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
            <Button className={C.green} onClick={() => {
              const shift = payload.shiftTypes.find((item) => item.id === form.shiftTypeId);
              const nonWorking = isNonWorkingShift(shift?.label) || isNonWorkingShift(form.roleWorked);
              onSave({
                employeeId: employee?.id || null,
                shiftDate: date,
                ...form,
                customStartTime: nonWorking ? null : form.customStartTime || null,
                customEndTime: nonWorking ? null : form.customEndTime || null,
                roleWorked: form.roleWorked || null,
                unpaidBreakMinutes: nonWorking || form.unpaidBreakMinutes === "" ? null : Number(form.unpaidBreakMinutes),
              });
            }}>Save shift</Button>
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
  trackMpor,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: ScheduleEmployee;
  date: string;
  board?: HousekeepingBoard;
  trackMpor: boolean;
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
          <DialogTitle>{trackMpor ? "Room attendant board" : "Housekeeping actual hours"} - {employee?.displayName || "Associate"}</DialogTitle>
          <DialogDescription className={C.muted}>
            {trackMpor
              ? `${formatDate(date)}. DND rooms are deducted from stayover service count.`
              : `${formatDate(date)}. Enter actual time worked for Laundry, Houseperson, Inspector, or other non-board HK work.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Actual hours worked</Label><Input className={C.field} type="number" step="0.25" value={form.actualHours} onChange={(event) => setForm({ ...form, actualHours: event.target.value })} /></div>
          {trackMpor && (
            <>
              <div><Label>Checkout rooms</Label><Input className={C.field} type="number" value={form.checkoutRooms} onChange={(event) => setForm({ ...form, checkoutRooms: event.target.value })} /></div>
              <div><Label>Stayover rooms</Label><Input className={C.field} type="number" value={form.stayoverRooms} onChange={(event) => setForm({ ...form, stayoverRooms: event.target.value })} /></div>
              <div><Label>DND / refused service</Label><Input className={C.field} type="number" value={form.dndRooms} onChange={(event) => setForm({ ...form, dndRooms: event.target.value })} /></div>
              <div><Label>Out of order rooms</Label><Input className={C.field} type="number" value={form.oooRooms} onChange={(event) => setForm({ ...form, oooRooms: event.target.value })} /></div>
              <div><Label>Deep cleans</Label><Input className={C.field} type="number" value={form.deepCleanRooms} onChange={(event) => setForm({ ...form, deepCleanRooms: event.target.value })} /></div>
            </>
          )}
          <div className="sm:col-span-2"><Label>Notes</Label><Textarea className={C.field} rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
        </div>
        {trackMpor ? (
          <div className="grid gap-3 rounded-xl border border-[#e0d3c1] bg-white p-3 sm:grid-cols-3">
            <div><div className="text-xs uppercase text-[#6d5d50]">Room credits</div><div className="text-xl font-semibold">{roomCredits.toFixed(1)}</div></div>
            <div><div className="text-xs uppercase text-[#6d5d50]">Standard minutes</div><div className="text-xl font-semibold">{standardMinutes}</div></div>
            <div><div className="text-xs uppercase text-[#6d5d50]">MPOR</div><div className={`text-xl font-semibold ${mpor >= 25 && mpor <= 30 ? "text-emerald-800" : "text-amber-800"}`}>{mpor.toFixed(1)}</div></div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#e0d3c1] bg-white p-3">
            <div className="text-xs uppercase text-[#6d5d50]">Actual hours</div>
            <div className="text-xl font-semibold">{actualHours.toFixed(2)}</div>
            <div className="mt-1 text-sm text-[#5f5247]">MPOR is only calculated for Room Attendant boards.</div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" className={C.outline} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className={C.green} disabled={!employee} onClick={() => onSave({
            employeeId: employee?.id,
            boardDate: date,
            actualHours,
            checkoutRooms: trackMpor ? checkoutRooms : 0,
            stayoverRooms: trackMpor ? stayoverRooms : 0,
            dndRooms: trackMpor ? dndRooms : 0,
            oooRooms: trackMpor ? Number(form.oooRooms || 0) : 0,
            deepCleanRooms: trackMpor ? deepCleanRooms : 0,
            notes: form.notes || null,
          })}>Save board</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActualHoursDialog({
  open,
  onOpenChange,
  employee,
  date,
  actual,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: ScheduleEmployee;
  date: string;
  actual?: ScheduleActualHours;
  onSave: (body: any) => void;
}) {
  const [form, setForm] = useState({ actualHours: "", notes: "" });
  useEffect(() => {
    setForm({
      actualHours: actual?.actualHours?.toString() || "",
      notes: actual?.notes || "",
    });
  }, [actual, employee?.id, date, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#fffaf2] text-[#201814]">
        <DialogHeader>
          <DialogTitle>Actual hours - {employee?.displayName || "Associate"}</DialogTitle>
          <DialogDescription className={C.muted}>{formatDate(date)}. Enter actual hours worked for this associate/day.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Actual hours worked</Label>
            <Input className={C.field} type="number" step="0.25" min="0" max="24" value={form.actualHours} onChange={(event) => setForm({ ...form, actualHours: event.target.value })} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea className={C.field} rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className={C.outline} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className={C.green} disabled={!employee || form.actualHours === ""} onClick={() => onSave({
              employeeId: employee?.id,
              workDate: date,
              actualHours: Number(form.actualHours || 0),
              notes: form.notes || null,
            })}>Save actual</Button>
          </div>
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
  const recommendationForDay = (day: string) => {
    const metrics = payload.totals.laborMetrics?.daily[day];
    const roomCredits = Number(metrics?.roomCredits || 0);
    const roomAttendantHours = Number(metrics?.targetRoomAttendantHours || 0);
    const roomAttendants = roomAttendantHours > 0 ? Math.ceil(roomAttendantHours / 8) : 0;
    return {
      roomCredits,
      roomAttendantHours,
      roomAttendants,
      housekeepingHours: Number(metrics?.targetTotalHousekeepingOperatingHours || 0),
      scheduledRoomAttendantHours: Number(metrics?.roomAttendantHours || 0),
      scheduledHousekeepingHours: Number(metrics?.housekeepingHours || 0),
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
            const recommendation = recommendationForDay(day);
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
                  <div className="flex justify-between gap-2"><span>RA hrs</span><strong className="text-[#201814]">{recommendation.scheduledRoomAttendantHours} / {recommendation.roomAttendantHours}</strong></div>
                  <div className="flex justify-between gap-2"><span>Total HK hrs</span><strong className="text-[#201814]">{recommendation.scheduledHousekeepingHours} / {recommendation.housekeepingHours}</strong></div>
                  <div className="text-[10px]">30 MPOR workload: {recommendation.roomCredits} weighted room credits</div>
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
  const recommendationForDay = (day: string) => {
    const metrics = payload.totals.laborMetrics?.daily[day];
    const roomCredits = Number(metrics?.roomCredits || 0);
    const roomAttendantHours = Number(metrics?.targetRoomAttendantHours || 0);
    const roomAttendants = roomAttendantHours > 0 ? Math.ceil(roomAttendantHours / 8) : 0;
    return {
      roomCredits,
      roomAttendantHours,
      roomAttendants,
      housekeepingHours: Number(metrics?.targetTotalHousekeepingOperatingHours || 0),
      scheduledRoomAttendantHours: Number(metrics?.roomAttendantHours || 0),
      scheduledHousekeepingHours: Number(metrics?.housekeepingHours || 0),
    };
  };
  return (
    <div className="mb-3 rounded-xl border border-[#e0d3c1] bg-[#fbf6ee] p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-[#5f5247]">Housekeeping working forecast</div>
      <div className="text-[11px] text-[#5f5247]">Uses the saved manager forecast, not the original upload baseline.</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {payload.days.map((day, index) => {
          const forecast = forecastByDay.get(day);
          const recommendation = recommendationForDay(day);
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
                <div>RA scheduled / target: <strong className="text-[#201814]">{recommendation.scheduledRoomAttendantHours} / {recommendation.roomAttendantHours}</strong></div>
                <div>Total HK scheduled / target: <strong className="text-[#201814]">{recommendation.scheduledHousekeepingHours} / {recommendation.housekeepingHours}</strong></div>
                <div>Workload: {recommendation.roomCredits} weighted room credits</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HousekeepingSchedulingGuide({ spanish }: { spanish: boolean }) {
  const [open, setOpen] = useState(false);
  const sections = spanish ? [
    {
      title: "Cobertura de Camaristas",
      items: [
        "Programe aproximadamente 1 camarista por cada 16-20 habitaciones estimadas por tablero",
        "Use 16 habitaciones en dias con muchas salidas",
        "Use 20 habitaciones en dias con mas stayovers",
      ],
    },
    {
      title: "Cobertura de Houseperson",
      items: [
        "Programe 1 Houseperson diariamente",
        "Turno estandar: 7 horas",
        "Agregue cobertura adicional en dias vendidos o con grupos si es necesario",
      ],
    },
    {
      title: "Cobertura de Lavanderia",
      items: [
        "Programe 1 asistente de lavanderia diariamente",
        "Turno estandar: 7 horas",
        "Agregue apoyo durante alta rotacion o volumen de linos",
      ],
    },
    {
      title: "Cobertura de Inspeccion",
      items: [
        "La Executive Housekeeper realiza inspecciones 5 dias por semana",
        "Una camarista designada realiza inspecciones los 2 dias restantes",
        "El tiempo de inspeccion debe ajustarse segun ocupacion y volumen de salidas",
        "La inspeccion promedio debe tomar aproximadamente 4-5 horas con ocupacion moderada",
      ],
    },
    {
      title: "Uso recomendado del tiempo de inspeccion cuando no inspecciona",
      items: [
        "Ayudar con tableros en periodos de muchas salidas",
        "Realizar inspecciones de deep clean",
        "Hacer recorridos de calidad en areas publicas",
        "Completar auditorias de linos e inventario",
        "Ayudar con habitaciones VIP/Elite antes de llegadas",
        "Entrenar y dar coaching a camaristas",
        "Reportar PM / mantenimiento preventivo",
        "Dar seguimiento a habitaciones fuera de servicio",
        "Apoyar lavanderia en periodos de alto volumen",
        "Revisar habitaciones listas antes de llegadas fuertes",
      ],
    },
    {
      title: "Ajustes basados en ocupacion",
      items: [
        "Menos de 60% OCC: minimo overlap, modelo lean, un houseperson/lavanderia suficiente",
        "60-79% OCC: modelo estandar, agregue overlap selectivo en dias con muchas salidas",
        "80%+ OCC: agregue apoyo de camaristas, inspeccion, lavanderia o houseperson segun volumen",
      ],
    },
    {
      title: "Guia de grupos / eventos",
      items: [
        "Revise patrones de salida de grupos antes de asignar tableros",
        "Agregue apoyo para grupos con llegadas tempranas o salidas masivas",
        "No incluya deep cleans o proyectos especiales en calculos estandar de tableros",
      ],
    },
  ] : [
    {
      title: "Room Attendant Coverage",
      items: [
        "Schedule approximately 1 room attendant per 16-20 estimated rooms per board",
        "Lean toward 16 rooms on heavy checkout days",
        "Lean toward 20 rooms on stayover-heavy days",
      ],
    },
    {
      title: "Houseperson Coverage",
      items: [
        "Schedule 1 Houseperson daily",
        "Standard shift: 7 hours",
        "Add additional coverage on sold-out or group-heavy days if needed",
      ],
    },
    {
      title: "Laundry Coverage",
      items: [
        "Schedule 1 Laundry Attendant daily",
        "Standard shift: 7 hours",
        "Add support coverage during heavy turnover or linen volume days",
      ],
    },
    {
      title: "Inspector Coverage",
      items: [
        "Executive Housekeeper performs inspections 5 days per week",
        "Designated Room Attendant performs inspections remaining 2 days",
        "Inspection time should flex based on occupancy and checkout volume",
        "Average inspection workload should generally take approximately 4-5 hours at moderate occupancy",
      ],
    },
    {
      title: "Recommended Use of Inspector Time When Not Inspecting",
      items: [
        "Assist with room boards during heavy checkout periods",
        "Perform deep clean inspections",
        "Conduct public area quality walks",
        "Complete linen and inventory audits",
        "Assist with VIP/Elite arrival room checks",
        "Training and coaching room attendants",
        "PM / preventative maintenance reporting",
        "Follow-up on out-of-order rooms",
        "Laundry assistance during peak linen periods",
        "Final room readiness walkthroughs before peak arrivals",
      ],
    },
    {
      title: "Occupancy-Based Adjustments",
      items: [
        "Under 60% OCC: minimal overlap, lean staffing model, single houseperson/laundry coverage sufficient",
        "60-79% OCC: standard staffing model, add selective overlap during heavy checkout days",
        "80%+ OCC: add room attendant support, inspection assistance, and laundry or houseperson support based on turnover volume",
      ],
    },
    {
      title: "Group / Event Guidance",
      items: [
        "Review group departure patterns before assigning boards",
        "Add staffing support for early arrival groups or mass departures",
        "Do not include deep cleans or special projects in standard room board calculations",
      ],
    },
  ];
  const title = spanish ? "Guia de programacion HK" : "HK Scheduling Guide";
  const philosophy = spanish ? "Programe segun la demanda, no por costumbre." : "Staff to demand, not habit.";
  const body = (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#d6c8b5] bg-white px-3 py-2 text-sm font-semibold text-[#2f5f46]">{philosophy}</div>
      <div className="grid gap-3 lg:grid-cols-2">
        {sections.map((section) => (
          <div key={section.title} className="rounded-lg border border-[#eadfce] bg-white p-3">
            <div className="font-semibold text-[#201814]">{section.title}</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[#5f5247]">
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="mb-3 rounded-xl border border-[#e0d3c1] bg-[#fffaf2] p-3 shadow-[0_8px_22px_rgba(74,54,34,0.07)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6b3f]">Housekeeping</div>
          <h3 className="text-base font-semibold text-[#201814]">{title}</h3>
          <p className="text-sm text-[#5f5247]">{spanish ? "Abra la guia para referencias rapidas de cobertura." : "Open the guide for quick coverage standards."}</p>
        </div>
        <Button variant="outline" className={C.outline} onClick={() => setOpen(true)}>{spanish ? "Ver guia" : "View guide"}</Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl bg-[#fffaf2] text-[#201814]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className={C.muted}>{spanish ? "Referencia operacional para programar Housekeeping." : "Operational reference for Housekeeping scheduling."}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[72vh] overflow-y-auto pr-1">{body}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PrintableSchedule({ payload, spanish }: { payload: SchedulePayload; spanish: boolean }) {
  const assignments = new Map(payload.assignments.map((assignment) => [`${assignment.employeeId}:${assignment.shiftDate}`, assignment]));
  const shiftTypes = new Map(payload.shiftTypes.map((shift) => [shift.id, shift]));
  const approvedRequests = new Map((payload.approvedRequests || []).map((request) => [`${request.employeeId}:${request.requestDate}`, request]));
  const labels = spanish ? DAY_LABELS_ES : DAY_LABELS;
  const pageGroups = [
    ["Managers"],
    ["Front Desk", "Night Audit"],
    ["Bistro"],
    ["Maintenance"],
    ["Housekeeping"],
  ];
  const employeesForDepartment = (department: string) => payload.employees
    .filter((employee) => employee.active && (
      employeeDepartments(employee).includes(department)
      || payload.assignments.some((assignment) => {
        if (assignment.employeeId !== employee.id) return false;
        const shiftType = shiftTypes.get(assignment.shiftTypeId || "");
        return assignmentBelongsToDepartment(assignment, employee, shiftType, department);
      })
    ))
    .sort((a, b) => scheduleEmployeeSort(department, a, b));

  return (
    <div className="schedule-print-root hidden print:block">
      {pageGroups.map((departments, pageIndex) => (
        <section className="schedule-print-page" key={departments.join("-")}>
          <header className="schedule-print-header">
            <div>
              <h1>{payload.schedule.propertyName}</h1>
              <div>{formatWeek(payload.schedule.weekStartDate, payload.schedule.weekEndDate)}</div>
            </div>
            <div className="schedule-print-page-title">{departments.join(" / ")}</div>
          </header>
          {departments.map((department) => {
            const employees = employeesForDepartment(department);
            if (!employees.length) return null;
            return (
              <div className="schedule-print-department" key={department}>
                <h2>{department} - {fmtHours(payload.totals.departmentWeeklyHours[department] || 0)} hours</h2>
                {department === "Housekeeping" && (
                  <div className="schedule-print-notice">
                    <strong>Housekeeping schedule note:</strong> {spanish ? HOUSEKEEPING_OUT_TIME_NOTICE_ES : HOUSEKEEPING_OUT_TIME_NOTICE}
                  </div>
                )}
                <table>
                  <colgroup>
                    <col className="schedule-print-associate-col" />
                    {payload.days.map((day) => <col key={day} />)}
                    <col className="schedule-print-hours-col" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="schedule-print-associate">Associate</th>
                      {payload.days.map((day, index) => <th key={day}>{labels[index]}<br />{formatDate(day)}</th>)}
                      <th>Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee) => (
                      <tr key={employee.id}>
                        <td className="schedule-print-associate">
                          <strong>{employee.displayName}</strong>
                          <span>{employeeScheduleSubtitle(employee)}</span>
                        </td>
                        {payload.days.map((day) => {
                          const rawAssignment = assignments.get(`${employee.id}:${day}`);
                          const rawShift = rawAssignment ? shiftTypes.get(rawAssignment.shiftTypeId || "") : undefined;
                          const assignment = assignmentBelongsToDepartment(rawAssignment, employee, rawShift, department) ? rawAssignment : undefined;
                          const approvedRequest = approvedRequests.get(`${employee.id}:${day}`);
                          const shift = assignment ? shiftTone(assignment, rawShift, shiftTypes) : undefined;
                          return (
                            <td
                              key={day}
                              className="schedule-print-shift"
                              style={{ backgroundColor: approvedRequest ? "#e5e7eb" : shift?.color || "#ffffff", color: approvedRequest ? "#374151" : shift?.textColor || "#201814" }}
                            >
                              {approvedRequest ? (spanish ? "Solicitud aprobada" : "Approved request") : shiftText(assignment, shift) || "-"}
                            </td>
                          );
                        })}
                        <td className="schedule-print-total">{fmtHours(payload.totals.employeeDepartmentWeeklyHours?.[employee.id]?.[department] || 0)}</td>
                      </tr>
                    ))}
                    <tr className="schedule-print-daily-total">
                      <td className="schedule-print-associate">{department} daily total</td>
                      {payload.days.map((day) => <td key={day}>{fmtHours(payload.totals.departmentDailyHours[department]?.[day] || 0)}</td>)}
                      <td>{fmtHours(payload.totals.departmentWeeklyHours[department] || 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
          <footer>{pageIndex + 1} of {pageGroups.length}</footer>
        </section>
      ))}
    </div>
  );
}

function ScheduleGrid({ payload, editable, currentUser, onEdit, onCopyShift, onCopyPreviousEmployee, onHousekeepingBoard, onActualHours, spanish }: { payload: SchedulePayload; editable: boolean; currentUser?: ScheduleUser | null; spanish: boolean; onEdit: (employee: ScheduleEmployee, date: string, department: string, assignment?: ShiftAssignment) => void; onCopyShift: (assignment: ShiftAssignment, employee: ScheduleEmployee, date: string, department: string) => void; onCopyPreviousEmployee: (employee: ScheduleEmployee, department: string) => void; onHousekeepingBoard: (employee: ScheduleEmployee, date: string, board: HousekeepingBoard | undefined, trackMpor: boolean) => void; onActualHours: (employee: ScheduleEmployee, date: string, actual?: ScheduleActualHours) => void }) {
  const assignments = useMemo(() => new Map(payload.assignments.map((assignment) => [`${assignment.employeeId}:${assignment.shiftDate}`, assignment])), [payload.assignments]);
  const housekeepingBoards = useMemo(() => new Map((payload.housekeepingBoards || []).map((board) => [`${board.employeeId}:${board.boardDate}`, board])), [payload.housekeepingBoards]);
  const actualHours = useMemo(() => new Map((payload.actualHours || []).map((actual) => [`${actual.employeeId}:${actual.workDate}`, actual])), [payload.actualHours]);
  const shiftTypes = useMemo(() => new Map(payload.shiftTypes.map((shift) => [shift.id, shift])), [payload.shiftTypes]);
  const approvedRequests = useMemo(() => new Map((payload.approvedRequests || []).map((request) => [`${request.employeeId}:${request.requestDate}`, request])), [payload.approvedRequests]);
  const t = (value: string) => spanish ? ES[value] || value : value;
  const labels = spanish ? DAY_LABELS_ES : DAY_LABELS;
  const editableDepartments = payload.currentUserPermissions?.editableDepartments || [];
  const currentEmployee = findEmployeeForUser(payload, currentUser);
  const canEditHousekeepingBoards = Boolean(currentUser?.isSuperAdmin || currentUser?.isAdmin || editableDepartments.includes("Housekeeping"));
  const weeklyMporByEmployee = useMemo(() => new Map(payload.employees.map((employee) => [employee.id, weeklyRoomAttendantMpor(employee.id, payload.housekeepingBoards || [])])), [payload.employees, payload.housekeepingBoards]);
  const employeesForDepartment = (department: string) => payload.employees
    .filter((employee) => employee.active && (
      employeeDepartments(employee).includes(department)
      || payload.assignments.some((assignment) => {
        if (assignment.employeeId !== employee.id) return false;
        const shiftType = shiftTypes.get(assignment.shiftTypeId || "");
        return assignmentBelongsToDepartment(assignment, employee, shiftType, department);
      })
    ))
    .sort((a, b) => scheduleEmployeeSort(department, a, b));
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
                const employees = employeesForDepartment(department);
                if (!employees.length) return null;
                const showHousekeepingReference = department === "Housekeeping" && editable && editableDepartments.includes("Housekeeping");
                return [
                  <tr key={`${department}-header`}><td colSpan={9} className="border border-[#e0d3c1] bg-[#2a211c] p-2 font-semibold text-white">{department} - {payload.totals.departmentWeeklyHours[department] || 0} hrs</td></tr>,
                  department === "Housekeeping" ? (
                    <tr key={`${department}-out-time-notice`}>
                      <td colSpan={9} className="border border-[#c8d9cd] bg-[#edf5ef] px-4 py-3 text-sm leading-relaxed text-[#173c25]">
                        <strong>Housekeeping schedule note:</strong> {spanish ? HOUSEKEEPING_OUT_TIME_NOTICE_ES : HOUSEKEEPING_OUT_TIME_NOTICE}
                      </td>
                    </tr>
                  ) : null,
                  showHousekeepingReference ? <tr key={`${department}-guide`}><td colSpan={9} className="border border-[#e0d3c1] bg-[#fbf6ee] p-3"><HousekeepingSchedulingGuide spanish={spanish} /></td></tr> : null,
                  showHousekeepingReference ? <HousekeepingForecastMini key={`${department}-forecast`} payload={payload} labels={labels} /> : null,
                  <tr key={`${department}-days`}>
                    <td className="sticky left-0 z-10 border border-[#e0d3c1] bg-[#f4eadb] p-2 text-left text-xs font-semibold uppercase tracking-wide text-[#5f5247]">{t("Associate")}</td>
                    {payload.days.map((day, index) => <td key={day} className="border border-[#e0d3c1] bg-[#f4eadb] p-2 text-center text-xs font-semibold uppercase tracking-wide text-[#5f5247]">{labels[index]}<br />{formatDate(day)}</td>)}
                    <td className="border border-[#e0d3c1] bg-[#f4eadb] p-2 text-center text-xs font-semibold uppercase tracking-wide text-[#5f5247]">{t("Hours")}</td>
                  </tr>,
                  ...employees.map((employee) => (
                    <tr key={employee.id}>
                      <td className="sticky left-0 z-10 border border-[#e0d3c1] bg-white p-2 align-middle font-medium">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            {employee.displayName}
                            <div className="text-xs text-[#5f5247]">{employeeScheduleSubtitle(employee)}</div>
                            {department === "Housekeeping" && weeklyMporByEmployee.get(employee.id) != null && (
                              <div className="mt-1 text-xs font-semibold text-[#28624f]">Weekly MPOR {weeklyMporByEmployee.get(employee.id)!.toFixed(1)}</div>
                            )}
                          </div>
                          {editable && editableDepartments.includes(department) && (
                            <Button type="button" size="sm" variant="outline" className={`h-7 px-2 text-[11px] ${C.outline}`} onClick={() => onCopyPreviousEmployee(employee, department)}>
                              Copy prior
                            </Button>
                          )}
                        </div>
                      </td>
                      {payload.days.map((day) => {
                        const rawAssignment = assignments.get(`${employee.id}:${day}`);
                        const hkBoard = housekeepingBoards.get(`${employee.id}:${day}`);
                        const actual = actualHours.get(`${employee.id}:${day}`);
                        const rawShift = rawAssignment ? shiftTypes.get(rawAssignment.shiftTypeId || "") : undefined;
                        const assignment = assignmentBelongsToDepartment(rawAssignment, employee, rawShift, department) ? rawAssignment : undefined;
                        const isHousekeeping = department === "Housekeeping";
                        const canEditCell = editable && (editableDepartments.includes(department) || currentEmployee?.id === employee.id);
                        const canEditBoard = isHousekeeping && canEditHousekeepingBoards;
                        const canEditActual = Boolean(currentUser?.isSuperAdmin || currentUser?.isAdmin || editableDepartments.includes(department));
                        const approvedRequest = approvedRequests.get(`${employee.id}:${day}`);
                        const shift = assignment ? shiftTone(assignment, rawShift, shiftTypes) : undefined;
                        const trackMpor = isRoomAttendantAssignment(assignment, shift, employee);
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
                          <td key={day} className="h-[118px] border border-[#e0d3c1] p-1 align-middle" onDragOver={(event) => canEditCell && event.preventDefault()} onDrop={handleShiftDrop}>
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
                                  disabled={!canEditBoard}
                                  className={`w-full rounded-md border px-2 py-1 text-center text-[11px] font-semibold disabled:cursor-default ${housekeepingBoardTone(hkBoard)}`}
                                  onClick={() => onHousekeepingBoard(employee, day, hkBoard, trackMpor)}
                                >
                                  {trackMpor
                                    ? hkBoard ? `${Number(hkBoard.mpor || 0).toFixed(1)} MPOR` : "Board"
                                    : hkBoard ? `${Number(hkBoard.actualHours || 0).toFixed(2)} hrs` : "Hours"}
                                </button>
                              )}
                              {!isHousekeeping && (
                                <button
                                  type="button"
                                  disabled={!canEditActual}
                                  className={`w-full rounded-md border px-2 py-1 text-center text-[11px] font-semibold disabled:cursor-default ${actual ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-300 bg-slate-50 text-slate-700"}`}
                                  onClick={() => onActualHours(employee, day, actual)}
                                >
                                  {actual ? `Actual ${Number(actual.actualHours || 0).toFixed(2)} hrs` : "Actual"}
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="border border-[#e0d3c1] p-2 text-center font-semibold">{payload.totals.employeeDepartmentWeeklyHours?.[employee.id]?.[department] || 0}</td>
                    </tr>
                  )),
                  !["Managers", "Night Audit", "Maintenance"].includes(department) ? <tr key={`${department}-associate-totals`}>
                    <td className="sticky left-0 z-10 border border-[#d6c8b5] bg-[#f8f1e7] p-2 font-medium text-[#201814]">Associate hours</td>
                    {payload.days.map((day) => (
                      <td key={day} className="border border-[#d6c8b5] bg-[#f8f1e7] p-2 text-center font-medium text-[#201814]">
                        {fmtHours(payload.totals.departmentAssociateDailyHours?.[department]?.[day] || 0)}
                      </td>
                    ))}
                    <td className="border border-[#d6c8b5] bg-[#f8f1e7] p-2 text-center font-medium text-[#201814]">
                      {fmtHours(payload.totals.departmentAssociateWeeklyHours?.[department] || 0)}
                    </td>
                  </tr> : null,
                  !["Managers", "Night Audit", "Maintenance"].includes(department) ? <tr key={`${department}-supervisor-totals`}>
                    <td className="sticky left-0 z-10 border border-[#c8d9cd] bg-[#edf5ef] p-2 font-semibold text-[#173c25]">Supervisor hours</td>
                    {payload.days.map((day) => (
                      <td key={day} className="border border-[#c8d9cd] bg-[#edf5ef] p-2 text-center font-semibold text-[#173c25]">
                        {fmtHours(payload.totals.departmentSupervisorDailyHours?.[department]?.[day] || 0)}
                      </td>
                    ))}
                    <td className="border border-[#c8d9cd] bg-[#edf5ef] p-2 text-center font-semibold text-[#173c25]">
                      {fmtHours(payload.totals.departmentSupervisorWeeklyHours?.[department] || 0)}
                    </td>
                  </tr> : null,
                  <tr key={`${department}-daily-totals`}>
                    <td className="sticky left-0 z-10 border border-[#cdbda8] bg-[#eadfce] p-2 font-semibold text-[#201814]">{department} daily hours</td>
                    {payload.days.map((day) => (
                      <td key={day} className="border border-[#cdbda8] bg-[#eadfce] p-2 text-center font-semibold text-[#201814]">
                        {fmtHours(payload.totals.departmentDailyHours[department]?.[day] || 0)}
                      </td>
                    ))}
                    <td className="border border-[#cdbda8] bg-[#eadfce] p-2 text-center font-semibold text-[#201814]">
                      {fmtHours(payload.totals.departmentWeeklyHours[department] || 0)}
                    </td>
                  </tr>,
                ];
              })}
              <tr>
                <td className="border border-[#e0d3c1] bg-[#f4eadb] p-2 font-semibold">{t("Daily labor hours")}</td>
                {payload.days.map((day) => <td key={day} className="border border-[#e0d3c1] bg-[#f4eadb] p-2 text-center font-semibold">{payload.totals.dailyScheduledHours?.[day] ?? payload.totals.dailyLaborHours[day] ?? 0}</td>)}
                <td className="border border-[#e0d3c1] bg-[#f4eadb] p-2 text-center font-semibold">{payload.totals.totalWeeklyScheduledHours ?? payload.totals.totalWeeklyLaborHours}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="space-y-4 lg:hidden">
          {payload.departments.map((department) => {
            const employees = employeesForDepartment(department);
            if (!employees.length) return null;
            const showHousekeepingReference = department === "Housekeeping" && editable && editableDepartments.includes("Housekeeping");
            return (
              <div key={department}>
                <h3 className="mb-2 font-semibold">{department}</h3>
                {department === "Housekeeping" && (
                  <div className="mb-3 rounded-xl border border-[#c8d9cd] bg-[#edf5ef] p-3 text-sm leading-relaxed text-[#173c25]">
                    <strong>Housekeeping schedule note:</strong> {spanish ? HOUSEKEEPING_OUT_TIME_NOTICE_ES : HOUSEKEEPING_OUT_TIME_NOTICE}
                  </div>
                )}
                {showHousekeepingReference && (
                  <>
                    <HousekeepingSchedulingGuide spanish={spanish} />
                    <HousekeepingForecastMiniCards payload={payload} labels={labels} />
                  </>
                )}
                <div className="space-y-3">
                  {employees.map((employee) => (
                    <div key={employee.id} className="rounded-xl border border-[#e0d3c1] bg-white p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{employee.displayName}</div>
                          {department === "Housekeeping" && weeklyMporByEmployee.get(employee.id) != null && (
                            <div className="mt-1 text-xs font-semibold text-[#28624f]">Weekly MPOR {weeklyMporByEmployee.get(employee.id)!.toFixed(1)}</div>
                          )}
                          {editable && editableDepartments.includes(department) && (
                            <Button type="button" size="sm" variant="outline" className={`mt-1 h-7 px-2 text-xs ${C.outline}`} onClick={() => onCopyPreviousEmployee(employee, department)}>
                              Copy prior week
                            </Button>
                          )}
                        </div>
                        <Badge variant="outline">{payload.totals.employeeDepartmentWeeklyHours?.[employee.id]?.[department] || 0} hrs</Badge>
                      </div>
                      <div className="grid gap-2">
                        {payload.days.map((day, index) => {
                          const rawAssignment = assignments.get(`${employee.id}:${day}`);
                          const hkBoard = housekeepingBoards.get(`${employee.id}:${day}`);
                          const actual = actualHours.get(`${employee.id}:${day}`);
                          const rawShift = rawAssignment ? shiftTypes.get(rawAssignment.shiftTypeId || "") : undefined;
                          const assignment = assignmentBelongsToDepartment(rawAssignment, employee, rawShift, department) ? rawAssignment : undefined;
                          const isHousekeeping = department === "Housekeeping";
                          const approvedRequest = approvedRequests.get(`${employee.id}:${day}`);
                          const shift = assignment ? shiftTone(assignment, rawShift, shiftTypes) : undefined;
                          const canEditCell = editable && (editableDepartments.includes(department) || currentEmployee?.id === employee.id);
                          const canEditBoard = isHousekeeping && canEditHousekeepingBoards;
                          const canEditActual = Boolean(currentUser?.isSuperAdmin || currentUser?.isAdmin || editableDepartments.includes(department));
                          const trackMpor = isRoomAttendantAssignment(assignment, shift, employee);
                          return (
                            <div key={day} className="rounded-md border border-[#e0d3c1] bg-white p-2">
                              <button disabled={!canEditCell || Boolean(approvedRequest)} className="w-full text-left text-sm disabled:cursor-default" style={{ color: approvedRequest ? "#374151" : shift?.textColor || "#201814" }} onClick={() => onEdit(employee, day, department, assignment)}>
                                <strong>{labels[index]} {formatDate(day)}:</strong> {approvedRequest ? t("Approved request") : shiftText(assignment, shift) || "-"}
                              </button>
                              {isHousekeeping && (
                                <button
                                  type="button"
                                  disabled={!canEditBoard}
                                  className={`mt-2 w-full rounded-md border px-2 py-1 text-xs font-semibold disabled:cursor-default ${housekeepingBoardTone(hkBoard)}`}
                                  onClick={() => onHousekeepingBoard(employee, day, hkBoard, trackMpor)}
                                >
                                  {trackMpor
                                    ? hkBoard ? `${Number(hkBoard.mpor || 0).toFixed(1)} MPOR` : "Enter board"
                                    : hkBoard ? `${Number(hkBoard.actualHours || 0).toFixed(2)} hrs` : "Enter hours"}
                                </button>
                              )}
                              {!isHousekeeping && (
                                <button
                                  type="button"
                                  disabled={!canEditActual}
                                  className={`mt-2 w-full rounded-md border px-2 py-1 text-xs font-semibold disabled:cursor-default ${actual ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-300 bg-slate-50 text-slate-700"}`}
                                  onClick={() => onActualHours(employee, day, actual)}
                                >
                                  {actual ? `Actual ${Number(actual.actualHours || 0).toFixed(2)} hrs` : "Enter actual"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div className="rounded-xl border border-[#cdbda8] bg-[#eadfce] p-3 text-[#201814]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{department} daily hours</div>
                      <Badge variant="outline" className="border-[#9f8b72] bg-white text-[#201814]">
                        {fmtHours(payload.totals.departmentWeeklyHours[department] || 0)} weekly
                      </Badge>
                    </div>
                    {!["Managers", "Night Audit", "Maintenance"].includes(department) && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-md border border-[#d6c8b5] bg-[#f8f1e7] p-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-[#5f5247]">Associate hours</div>
                          <div className="mt-1 text-lg font-semibold">{fmtHours(payload.totals.departmentAssociateWeeklyHours?.[department] || 0)} weekly</div>
                        </div>
                        <div className="rounded-md border border-[#c8d9cd] bg-[#edf5ef] p-2 text-[#173c25]">
                          <div className="text-xs font-semibold uppercase tracking-wide">Supervisor hours</div>
                          <div className="mt-1 text-lg font-semibold">{fmtHours(payload.totals.departmentSupervisorWeeklyHours?.[department] || 0)} weekly</div>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {payload.days.map((day, index) => (
                        <div key={day} className="rounded-md border border-[#d6c8b5] bg-white p-2 text-center">
                          <div className="text-xs font-semibold text-[#5f5247]">{labels[index]} {formatDate(day)}</div>
                          <div className="text-lg font-semibold">{fmtHours(payload.totals.departmentDailyHours[department]?.[day] || 0)}</div>
                          {!["Managers", "Night Audit", "Maintenance"].includes(department) && (
                            <div className="mt-1 text-[11px] text-[#5f5247]">
                              Associates {fmtHours(payload.totals.departmentAssociateDailyHours?.[department]?.[day] || 0)} / Sup {fmtHours(payload.totals.departmentSupervisorDailyHours?.[department]?.[day] || 0)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="rounded-xl border border-[#9f8b72] bg-[#f4eadb] p-3 text-[#201814]">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">{t("Daily labor hours")} - all departments</div>
              <Badge variant="outline" className="border-[#9f8b72] bg-white text-[#201814]">
                {fmtHours(payload.totals.totalWeeklyScheduledHours ?? payload.totals.totalWeeklyLaborHours)} weekly
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {payload.days.map((day, index) => (
                <div key={day} className="rounded-md border border-[#d6c8b5] bg-white p-2 text-center">
                  <div className="text-xs font-semibold text-[#5f5247]">{labels[index]} {formatDate(day)}</div>
                  <div className="text-lg font-semibold">{fmtHours(payload.totals.dailyScheduledHours?.[day] ?? payload.totals.dailyLaborHours[day] ?? 0)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeeManager({ employees, canViewRates, onAdd, onUpdate, onPayrollImport, importingPayroll, spanish }: { employees: ScheduleEmployee[]; canViewRates: boolean; spanish: boolean; onAdd: (employee: any) => void; onUpdate: (id: string, patch: any) => void; onPayrollImport: (file: File) => void; importingPayroll: boolean }) {
  const payrollInputRef = useRef<HTMLInputElement | null>(null);
  const emptyForm = { firstName: "", lastName: "", displayName: "", department: "Front Desk", position: "", rolesJson: [] as string[], roleRatesJson: {} as Record<string, string>, hourlyRate: "", email: "", phone: "", isSalaried: false, isDepartmentManager: false };
  const [form, setForm] = useState(emptyForm);
  const [expanded, setExpanded] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [showRemovedEmployees, setShowRemovedEmployees] = useState(false);
  const [editing, setEditing] = useState<Record<string, any>>({});
  const t = (value: string) => tr(spanish, value);
  const toggleRole = (role: string) => setForm((current) => {
    if (role === "Above Property") {
      return {
        ...current,
        department: "Above Property",
        position: "Above Property",
        isDepartmentManager: false,
        rolesJson: current.rolesJson.includes(role) ? [] : [role],
      };
    }
    return {
      ...current,
      department: current.department === "Above Property" ? "Managers" : current.department,
      position: current.position === "Above Property" ? "" : current.position,
      rolesJson: current.rolesJson.includes(role)
        ? current.rolesJson.filter((item) => item !== role)
        : [...current.rolesJson.filter((item) => item !== "Above Property"), role],
    };
  });
  const employeePatch = (employee: ScheduleEmployee) => editing[employee.id] || employee;
  const saveEmployee = (employee: ScheduleEmployee) => {
    const patch = employeePatch(employee);
    const normalizedRoles = rolesArray(patch.rolesJson);
    const roleRatesJson = Object.fromEntries(
      Object.entries(normalizeRoleRates(patch.roleRatesJson || {}))
        .filter(([, rate]) => rate !== "" && rate != null)
        .map(([role, rate]) => [normalizeScheduleRole(role), Number(rate)]),
    );
    onUpdate(employee.id, {
      ...patch,
      hourlyRate: patch.hourlyRate === "" || patch.hourlyRate == null ? null : Number(patch.hourlyRate),
      rolesJson: normalizedRoles,
      roleRatesJson,
    });
  };
  const toggleEmployeeRole = (employee: ScheduleEmployee, role: string) => {
    const draft = employeePatch(employee);
    const roles = rolesArray(draft.rolesJson);
    if (role === "Above Property") {
      setEditing({
        ...editing,
        [employee.id]: {
          ...draft,
          department: "Above Property",
          position: "Above Property",
          isDepartmentManager: false,
          active: false,
          rolesJson: roles.includes(role) ? [] : [role],
        },
      });
      return;
    }
    const nextRoles = roles.includes(role) ? roles.filter((item) => item !== role) : [...roles.filter((item) => item !== "Above Property"), role];
    setEditing({
      ...editing,
      [employee.id]: {
        ...draft,
        department: draft.department === "Above Property" ? "Managers" : draft.department,
        position: draft.position === "Above Property" ? "" : draft.position,
        rolesJson: nextRoles,
      },
    });
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
  const removedEmployeeCount = employees.filter((employee) => !employee.active).length;
  const query = employeeSearch.trim().toLowerCase();
  const filteredEmployees = sortedEmployees.filter((employee) => {
    if (!showRemovedEmployees && !employee.active) return false;
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
  const removeEmployeeFromSchedule = (employee: ScheduleEmployee) => {
    if (!employee.active) {
      onUpdate(employee.id, { active: true });
      return;
    }
    if (window.confirm(`Remove ${employee.displayName} from active scheduling? Their historical shifts, payroll rates, and actual hours stay saved, but they will no longer appear on schedule grids or future schedule emails.`)) {
      onUpdate(employee.id, { active: false });
    }
  };
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
            <SelectContent className={C.menu}>{DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}</SelectContent>
          </Select>
          <Input className={C.field} placeholder={t("Position")} value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} />
          <div className="sm:col-span-2">
            <Label>{t("Approved roles / cross-department access")}</Label>
            <p className="mb-2 text-xs text-[#5f5247]">Select every role this associate is approved to work. Extra department roles make them available in those schedule sections.</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {SCHEDULE_ROLES.map((role) => <Button key={role} type="button" size="sm" variant="outline" className={form.rolesJson.includes(role) ? C.green : C.outline} onClick={() => toggleRole(role)}>{role}</Button>)}
            </div>
          </div>
          {canViewRates && (
            <div>
              <Label>{form.isSalaried ? "Salary labor rate" : "Base hourly rate"}</Label>
              <Input
                className={C.field}
                placeholder={form.isSalaried ? "Salary hourly equivalent" : "Base hourly rate"}
                type="number"
                step="0.01"
                min="0"
                value={form.hourlyRate}
                onChange={(event) => setForm({ ...form, hourlyRate: event.target.value })}
              />
              <div className="mt-1 text-xs text-[#5f5247]">Used for labor dollar calculations. Manual edits override missing payroll import data.</div>
            </div>
          )}
          {canViewRates && form.rolesJson.length > 0 && (
            <div className="sm:col-span-2 rounded-lg border border-[#e0d3c1] bg-white p-3">
              <Label>Role-specific hourly rates</Label>
              <p className="mb-2 text-xs text-[#5f5247]">Optional. Leave a role blank to use the base hourly rate.</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {form.rolesJson.map((role) => (
                  <div key={role}>
                    <Label className="text-xs">{role}</Label>
                    <Input
                      className={C.field}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={form.hourlyRate ? `Base $${form.hourlyRate}` : "Use base rate"}
                      value={roleRateValue(form.roleRatesJson, role)}
                      onChange={(event) => setForm({ ...form, roleRatesJson: { ...form.roleRatesJson, [role]: event.target.value } })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <Input className={C.field} placeholder={t("Email")} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <Input className={C.field} placeholder={t("Phone")} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isSalaried} onChange={(event) => setForm({ ...form, isSalaried: event.target.checked })} /> Salaried</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isDepartmentManager} onChange={(event) => setForm({ ...form, isDepartmentManager: event.target.checked })} /> Department manager</label>
          <Button className={C.green} onClick={() => {
            const roleRatesJson = Object.fromEntries(
              Object.entries(form.roleRatesJson).filter(([, rate]) => rate !== "").map(([role, rate]) => [role, Number(rate)]),
            );
            onAdd({ ...form, hourlyRate: form.hourlyRate === "" ? null : Number(form.hourlyRate), roleRatesJson });
            setForm(emptyForm);
          }}><Plus className="mr-2 h-4 w-4" />{t("Add employee")}</Button>
          {canViewRates && (
            <>
              <input
                ref={payrollInputRef}
                aria-label={t("Import payroll rates")}
                title={t("Import payroll rates")}
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
          {expanded && (
            <div className="flex flex-wrap items-center gap-2">
              {removedEmployeeCount > 0 && (
                <label className="flex items-center gap-2 rounded-full border border-[#d6c8b5] bg-white px-3 py-1 text-sm text-[#5f5247]">
                  <input
                    type="checkbox"
                    checked={showRemovedEmployees}
                    onChange={(event) => setShowRemovedEmployees(event.target.checked)}
                  />
                  {t("Show removed employees")} ({removedEmployeeCount})
                </label>
              )}
              <Badge variant="outline" className="border-[#d6c8b5] bg-white text-[#5f5247]">{filteredEmployees.length} of {employees.length} associates</Badge>
            </div>
          )}
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
                <SelectContent className={C.menu}>
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
                {canViewRates && (
                  <>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <div>
                        <Label>{draft.isSalaried ? "Salary labor rate" : "Base hourly rate"}</Label>
                        <Input
                          className={C.field}
                          type="number"
                          step="0.01"
                          min="0"
                          value={draft.hourlyRate ?? ""}
                          placeholder={draft.isSalaried ? "Salary hourly equivalent" : "Base hourly rate"}
                          onChange={(event) => setEditing({ ...editing, [employee.id]: { ...draft, hourlyRate: event.target.value } })}
                        />
                      </div>
                      <label className="mt-6 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(draft.isSalaried)}
                          onChange={(event) => setEditing({ ...editing, [employee.id]: { ...draft, isSalaried: event.target.checked } })}
                        />
                        Salaried
                      </label>
                    </div>
                    {roles.length > 0 && (
                      <div className="mt-2 rounded-lg border border-[#e0d3c1] bg-[#fbf6ee] p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[#5f5247]">Role-specific hourly rates</div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {roles.map((role) => (
                            <div key={role}>
                              <Label className="text-xs">{role}</Label>
                              <Input
                                className={C.field}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder={draft.hourlyRate ? `Base $${draft.hourlyRate}` : "Use base rate"}
                                value={roleRateValue(draft.roleRatesJson, role)}
                                onChange={(event) => setEditing({
                                  ...editing,
                                  [employee.id]: {
                                    ...draft,
                                    roleRatesJson: { ...(draft.roleRatesJson || {}), [role]: event.target.value },
                                  },
                                })}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {(!draft.phone || !draft.email) && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">Missing phone/email</Badge>}
                  {!employee.active && <Badge variant="outline" className="border-slate-300 bg-slate-200 text-slate-800">Removed from active schedule</Badge>}
                </div>
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
                <SelectContent className={C.menu}>{DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex flex-col gap-2">
                <Button className={C.green} onClick={() => saveEmployee(employee)}>Save</Button>
                <Button
                  variant="outline"
                  className={employee.active ? "!border-red-200 !bg-red-50 !text-red-800 hover:!bg-red-100" : C.outline}
                  onClick={() => removeEmployeeFromSchedule(employee)}
                >
                  {employee.active ? <X className="mr-2 h-4 w-4" /> : null}
                  {employee.active ? t("Remove from schedule") : t("Restore to schedule")}
                </Button>
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

function ScheduleRequestsPanel({ requests, isAdmin, spanish, onSubmit, onStatus, onCancel }: { requests: ScheduleRequest[]; isAdmin: boolean; spanish: boolean; onSubmit: (request: any) => void; onStatus: (request: ScheduleRequest, status: string) => void; onCancel: (request: ScheduleRequest) => void }) {
  const [form, setForm] = useState({ requestDate: "", requestEndDate: "", requestType: "time_off", startTime: "", endTime: "", notes: "" });
  const [expanded, setExpanded] = useState(true);
  const [pastExpanded, setPastExpanded] = useState(false);
  const t = (value: string) => tr(spanish, value);
  const today = localDateKey();
  const isPastRequest = (request: ScheduleRequest) => Boolean(request.isPast ?? ((request.requestEndDate || request.requestDate) < today));
  const activeRequests = requests.filter((request) => !isPastRequest(request));
  const pastRequests = requests.filter(isPastRequest);
  const submit = () => {
    if (daysBetweenLocal(localDateKey(), form.requestDate) < 14) {
      window.alert(spanish
        ? "Esta solicitud es para una fecha dentro de los proximos 14 dias. Puede enviarla, pero es posible que no sea aprobada."
        : "This request is for a date within the next 14 days. You may submit it, but approval is not guaranteed.");
    }
    onSubmit({ ...form, requestEndDate: form.requestEndDate || form.requestDate, startTime: form.startTime || null, endTime: form.endTime || null });
    setForm({ requestDate: "", requestEndDate: "", requestType: "time_off", startTime: "", endTime: "", notes: "" });
  };
  const pendingCount = activeRequests.filter((request) => request.status === "submitted").length;
  const approvedCount = activeRequests.filter((request) => request.status === "approved").length;
  const deniedCount = activeRequests.filter((request) => request.status === "denied").length;
  const cancelledCount = activeRequests.filter((request) => request.status === "cancelled").length;
  const renderRequestCard = (request: ScheduleRequest) => {
    const overlapCount = Number(request.overlapConflictCount || 0);
    const first = request.firstOverlapRequest;
    const conflictNames = (request.overlapConflicts || [])
      .slice(0, 4)
      .map((conflict) => `${conflict.requesterName} (${conflict.status})`)
      .join(", ");
    return (
      <div key={request.id} className="flex flex-col gap-2 rounded-lg border border-[#e0d3c1] bg-white p-3 text-sm md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{isAdmin ? `${request.requester?.employeeDisplayName || "Associate"} - ` : ""}{formatRequestDateRange(request)} - {request.requestType.replace("_", " ")}</div>
          <div className="text-[#5f5247]">{isAdmin && request.department ? `${request.department} - ` : ""}{[request.startTime?.slice(0, 5), request.endTime?.slice(0, 5)].filter(Boolean).join(" - ")} {request.notes}</div>
          {isAdmin && overlapCount > 0 && (
            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-950">
              <div className="flex items-start gap-2 font-semibold">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {spanish ? "Alerta de cobertura" : "Coverage warning"}: {overlapCount} {overlapCount === 1 ? (spanish ? "otra solicitud coincide" : "other request overlaps") : (spanish ? "otras solicitudes coinciden" : "other requests overlap")} {request.department || (spanish ? "este departamento" : "this department")}.
                </span>
              </div>
              {first && (
                <div className="mt-1 text-xs">
                  {spanish ? "Primera solicitud" : "First requested"}: {first.requesterName} ({first.status}) for {formatRequestDateRange({ ...request, requestDate: first.requestDate, requestEndDate: first.requestEndDate } as ScheduleRequest)}.
                </div>
              )}
              {conflictNames && <div className="mt-1 text-xs">{spanish ? "Coincide con" : "Overlaps with"}: {conflictNames}</div>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {isAdmin && request.status === "submitted" && overlapCount > 0 && (
            <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-900">
              {overlapCount} {spanish ? "coincidente(s)" : "overlap(s)"}
            </Badge>
          )}
          <Badge variant="outline" className={request.status === "approved" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : request.status === "denied" ? "border-red-300 bg-red-50 text-red-800" : request.status === "cancelled" ? "border-slate-300 bg-slate-50 text-slate-700" : "border-amber-300 bg-amber-50 text-amber-900"}>{request.status}</Badge>
          {isAdmin && request.status === "submitted" && !isPastRequest(request) && (
            <>
              <Button size="sm" variant="outline" className={C.outline} onClick={() => onStatus(request, "approved")}>{t("Approve")}</Button>
              <Button size="sm" variant="outline" className={C.outline} onClick={() => onStatus(request, "denied")}>{t("Deny")}</Button>
            </>
          )}
          {(request.status === "submitted" || request.status === "approved") && !isPastRequest(request) && (
            <Button size="sm" variant="outline" className={C.outline} onClick={() => onCancel(request)}>{t("Cancel")}</Button>
          )}
        </div>
      </div>
    );
  };
  return (
    <Card className={`${C.shell} print:hidden`} data-tour="requests">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className={C.ink}>{t("Schedule requests")}</CardTitle>
            <CardDescription className={C.muted}>{t("Requests inside 14 days are outside hotel policy and subject to manager approval.")}</CardDescription>
            {isAdmin && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">{pendingCount} {spanish ? "pendiente(s)" : "pending"}</Badge>
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">{approvedCount} {spanish ? "aprobada(s)" : "approved"}</Badge>
                <Badge variant="outline" className="border-red-300 bg-red-50 text-red-800">{deniedCount} {spanish ? "negada(s)" : "denied"}</Badge>
                <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">{cancelledCount} {spanish ? "cancelada(s)" : "cancelled"}</Badge>
                <Badge variant="outline" className="border-[#d6c8b5] bg-white text-[#5f5247]">{pastRequests.length} {spanish ? "pasada(s)" : "past"}</Badge>
              </div>
            )}
          </div>
          <Button variant="outline" className={`${C.outline} w-fit`} onClick={() => setExpanded((value) => !value)}>
            {expanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
            {expanded ? (spanish ? "Ocultar" : "Collapse") : (spanish ? "Mostrar" : "Expand")}
          </Button>
        </div>
      </CardHeader>
      {expanded && <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[150px_150px_180px_120px_120px_1fr_auto]">
          <div><Label>{spanish ? "Fecha inicio" : "Start date"}</Label><Input className={C.field} type="date" value={form.requestDate} onChange={(event) => setForm({ ...form, requestDate: event.target.value, requestEndDate: form.requestEndDate || event.target.value })} /></div>
          <div><Label>{spanish ? "Fecha fin" : "End date"}</Label><Input className={C.field} type="date" min={form.requestDate || undefined} value={form.requestEndDate} onChange={(event) => setForm({ ...form, requestEndDate: event.target.value })} /></div>
          <div>
            <Label>{t("Type")}</Label>
            <Select value={form.requestType} onValueChange={(requestType) => setForm({ ...form, requestType })}>
              <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
              <SelectContent className={C.menu}>
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
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-[#201814]">{spanish ? "Solicitudes actuales" : "Current requests"}</div>
            <Badge variant="outline" className="border-[#d6c8b5] bg-white text-[#5f5247]">{activeRequests.length}</Badge>
          </div>
          {activeRequests.map(renderRequestCard)}
          {activeRequests.length === 0 && <div className="rounded-lg border border-dashed border-[#d6c8b5] bg-[#fbf6ee] p-3 text-sm text-[#5f5247]">{t("No schedule requests yet.")}</div>}
          {pastRequests.length > 0 && (
            <div className="pt-2">
              <Button variant="outline" className={`${C.outline} w-full justify-between`} onClick={() => setPastExpanded((value) => !value)}>
                <span className="flex items-center gap-2"><Archive className="h-4 w-4" /> {spanish ? "Solicitudes pasadas" : "Past requests"} ({pastRequests.length})</span>
                {pastExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              {pastExpanded && <div className="mt-2 space-y-2">{pastRequests.map(renderRequestCard)}</div>}
            </div>
          )}
        </div>
      </CardContent>}
    </Card>
  );
}

function AiDraftPreview({ payload, draft }: { payload: SchedulePayload; draft: AiScheduleDraft }) {
  const shiftTypes = useMemo(() => new Map(payload.shiftTypes.map((shift) => [shift.id, shift])), [payload.shiftTypes]);
  const currentAssignments = useMemo(() => new Map(payload.assignments.map((assignment) => [`${assignment.employeeId}:${assignment.shiftDate}`, assignment])), [payload.assignments]);
  const draftAssignments = useMemo(() => new Map(draft.assignments.map((assignment) => [`${assignment.employeeId}:${assignment.shiftDate}`, assignment])), [draft.assignments]);
  const departments = draft.mode === "housekeeping" ? ["Housekeeping"] : ["Front Desk"];
  const labels = DAY_LABELS;
  return (
    <div className="rounded-xl border border-[#d8c8b2] bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">AI draft visual preview</h3>
          <p className="text-sm text-[#5f5247]">Blue outline cells are proposed by AI. This is a preview only until you apply it.</p>
        </div>
        <Badge variant="outline" className="border-[#2d6a57] bg-[#e6f4ee] text-[#1f4d3f]">{draft.mode === "housekeeping" ? "Housekeeping" : "Front Desk"} draft</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#2a211c] text-white">
              <th className="w-[180px] border border-[#d8c8b2] p-2 text-left">Associate</th>
              {payload.days.map((day, index) => <th key={day} className="border border-[#d8c8b2] p-2 text-center">{labels[index]}<br /><span className="text-xs font-normal">{formatDate(day)}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {departments.flatMap((department) => payload.employees
              .filter((employee) => employee.active && employeeDepartments(employee).includes(department))
              .sort((a, b) => scheduleEmployeeSort(department, a, b))
              .map((employee) => (
                <tr key={`${department}-${employee.id}`}>
                  <td className="border border-[#e0d3c1] p-2 font-semibold">
                    {employee.displayName}
                    <div className="text-xs font-normal text-[#5f5247]">{employeeScheduleSubtitle(employee)}</div>
                  </td>
                  {payload.days.map((day) => {
                    const draftAssignment = draftAssignments.get(`${employee.id}:${day}`);
                    const assignment = draftAssignment || currentAssignments.get(`${employee.id}:${day}`);
                    const shift = assignment ? shiftTypes.get(assignment.shiftTypeId || "") : undefined;
                    const text = shiftText(assignment, shift) || "-";
                    return (
                      <td key={day} className={`h-16 border border-[#e0d3c1] p-1 align-middle ${draftAssignment ? "bg-blue-50" : "bg-white"}`}>
                        <div
                          className={`min-h-12 rounded-md border p-2 text-xs whitespace-pre-line ${draftAssignment ? "border-blue-500 ring-1 ring-blue-300" : "border-[#e0d3c1]"}`}
                          style={{ background: shift?.color || "#fff", color: shift?.textColor || "#201814" }}
                        >
                          {text}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const shareToken = params.get("share");
  const requestOnly = params.get("requests") === "1";
  const [selectedWeekId, setSelectedWeekId] = useState<string>("");
  const [weekStartDate, setWeekStartDate] = useState(localDateKey());
  const [selectedShift, setSelectedShift] = useState<{ employee: ScheduleEmployee; date: string; department: string; assignment?: ShiftAssignment } | null>(null);
  const [selectedHousekeepingBoard, setSelectedHousekeepingBoard] = useState<{ employee: ScheduleEmployee; date: string; board?: HousekeepingBoard; trackMpor: boolean } | null>(null);
  const [selectedActualHours, setSelectedActualHours] = useState<{ employee: ScheduleEmployee; date: string; actual?: ScheduleActualHours } | null>(null);
  const [aiDraft, setAiDraft] = useState<AiScheduleDraft | null>(null);
  const [aiGeneratingMode, setAiGeneratingMode] = useState<"frontDesk" | "housekeeping" | null>(null);
  const [aiToolsOpen, setAiToolsOpen] = useState(false);
  const [hoursComparison, setHoursComparison] = useState<HoursComparison | null>(null);
  const [teamMessageOpen, setTeamMessageOpen] = useState(false);
  const [scheduleEmailOpen, setScheduleEmailOpen] = useState(false);
  const [selectedScheduleEmailEmployeeIds, setSelectedScheduleEmailEmployeeIds] = useState<string[]>([]);
  const [housekeepingBreakNoticeOpen, setHousekeepingBreakNoticeOpen] = useState(false);
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templatePreview, setTemplatePreview] = useState<ScheduleTemplatePreview | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    occupancyTier: "minimal",
    description: "",
  });
  const [teamMessage, setTeamMessage] = useState({
    subject: "Current Week Schedule Catch-Up",
    message: "Team,\n\nI am publishing the current week's schedule in the system to catch it up. No schedule changes were made. Please continue following the current schedule as already communicated.\n\nThank you.",
  });
  const [spanish, setSpanish] = useState(false);
  const dailyHporToastKey = useRef("");
  const housekeepingBreakNoticeUserKey = useRef("");

  const auth = useQuery<{ user: ScheduleUser | null }>({ queryKey: ["/api/schedule/auth/me"], queryFn: () => fetchJson("/api/schedule/auth/me"), enabled: !shareToken });
  const weeks = useQuery<{ weeks: WeeklySchedule[] }>({ queryKey: ["/api/schedule/weeks"], queryFn: () => fetchJson("/api/schedule/weeks"), enabled: !!auth.data?.user && !shareToken && !requestOnly });
  const requests = useQuery<{ requests: ScheduleRequest[] }>({ queryKey: ["/api/schedule/requests"], queryFn: () => fetchJson("/api/schedule/requests"), enabled: !!auth.data?.user && !shareToken });
  const share = useQuery<SchedulePayload>({ queryKey: ["/api/schedule/share", shareToken], queryFn: () => fetchJson(`/api/schedule/share/${shareToken}`), enabled: !!shareToken });
  const weekId = selectedWeekId || weeks.data?.weeks?.[0]?.id || "";
  const detail = useQuery<SchedulePayload>({ queryKey: ["/api/schedule/weeks", weekId], queryFn: () => fetchJson(`/api/schedule/weeks/${weekId}`), enabled: !!weekId && !shareToken && !requestOnly });
  const payload = shareToken ? share.data : detail.data;
  const user = auth.data?.user;
  const canManageSchedule = Boolean(user?.isAdmin || user?.isDepartmentManager || user?.role === "manager");
  const canManageTemplates = Boolean(user?.canManageTemplates);
  const templates = useQuery<{ templates: ScheduleTemplate[] }>({
    queryKey: ["/api/schedule/templates"],
    queryFn: () => fetchJson("/api/schedule/templates"),
    enabled: canManageTemplates && !shareToken && !requestOnly,
  });
  const editable = Boolean(canManageSchedule && payload?.schedule.status === "draft" && !shareToken);
  const canActualizeForecast = Boolean(user?.isAdmin && payload && !shareToken);
  const t = (value: string) => tr(spanish, value);
  const hasHousekeepingBoardData = Boolean(payload?.housekeepingBoards?.some((board) => Number(board.actualHours || 0) > 0));

  useEffect(() => {
    if (!payload || !user || shareToken || canManageSchedule) return;
    const employee = findEmployeeForUser(payload, user);
    if (!employee || normalizeDepartment(employee.department) !== "Housekeeping") return;
    const noticeKey = `${user.id}:${employee.id}`;
    if (housekeepingBreakNoticeUserKey.current === noticeKey) return;
    housekeepingBreakNoticeUserKey.current = noticeKey;
    setHousekeepingBreakNoticeOpen(true);
  }, [canManageSchedule, payload, shareToken, user]);

  useEffect(() => {
    if (!payload || !canManageSchedule || shareToken) return;
    const daily = payload.totals.laborMetrics?.daily || {};
    const hporTarget = Number(payload.totals.laborMetrics?.targets.hpor || 1.4);
    const overTarget = payload.days
      .map((day) => ({ day, hpor: Number(daily[day]?.hpor || 0) }))
      .filter((item) => item.hpor > hporTarget);
    if (!overTarget.length) return;
    const key = `${payload.schedule.id}:${overTarget.map((item) => `${item.day}:${item.hpor.toFixed(2)}`).join("|")}`;
    if (dailyHporToastKey.current === key) return;
    dailyHporToastKey.current = key;
    toast({
      title: "Daily labor HPOR alert",
      description: `${overTarget.map((item) => `${formatDate(item.day)} ${item.hpor.toFixed(2)} HPOR`).join(", ")}. Target ${hporTarget.toFixed(2)}.`,
      variant: "destructive",
    });
  }, [canManageSchedule, payload, shareToken, toast]);

  useEffect(() => {
    setHoursComparison(null);
    setAiDraft(null);
    setAiToolsOpen(false);
  }, [payload?.schedule.id]);

  const createWeek = useMutation({
    mutationFn: async (mode: "blank" | "copyPrevious") => {
      const response = await apiRequest("POST", "/api/schedule/weeks", { weekStartDate, propertyName: "Courtyard Austin Lakeline", mode });
      return response.json();
    },
    onSuccess: (data: SchedulePayload) => {
      setSelectedWeekId(data.schedule.id);
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks"] });
      if ((data as SchedulePayload & { existingWeek?: boolean }).existingWeek) {
        toast({ title: "Existing week opened", description: "That schedule already existed, so no shifts were copied or changed." });
      }
    },
    onError: (error: Error) => toast({ title: "Unable to create week", description: error.message, variant: "destructive" }),
  });
  const deleteDraftWeek = useMutation({
    mutationFn: async () => {
      if (!payload?.schedule.id) throw new Error("Select a draft schedule first.");
      const response = await apiRequest("DELETE", `/api/schedule/weeks/${payload.schedule.id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Draft deleted", description: "The unused draft schedule was removed." });
      setSelectedWeekId("");
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks"] });
    },
    onError: (error: Error) => toast({ title: "Unable to delete draft", description: error.message, variant: "destructive" }),
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
    mutationFn: async (days: ForecastDay[]) => {
      const response = await apiRequest("PUT", `/api/schedule/weeks/${payload?.schedule.id}/forecast`, { days });
      return response.json() as Promise<SchedulePayload>;
    },
    onSuccess: (updatedPayload) => {
      queryClient.setQueryData(["/api/schedule/weeks", weekId], updatedPayload);
    },
    onError: (error: Error) => toast({ title: "Forecast save failed", description: error.message, variant: "destructive" }),
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
  const importForecastScreenshot = useMutation({
    mutationFn: async (file: File) => {
      if (!payload?.schedule.id) throw new Error("Select a schedule before importing forecast data.");
      const formData = new FormData();
      formData.append("forecastScreenshot", file);
      const response = await fetch(apiUrl(`/api/schedule/weeks/${payload.schedule.id}/forecast/import-screenshot`), {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "The Agilysys screenshot could not be imported.");
      }
      return response.json() as Promise<SchedulePayload>;
    },
    onSuccess: (updatedPayload) => {
      toast({
        title: "Agilysys forecast imported",
        description: "Arrivals, departures, stayovers, rooms sold, and housekeeping staffing targets were updated.",
      });
      queryClient.setQueryData(["/api/schedule/weeks", weekId], updatedPayload);
    },
    onError: (error: Error) => toast({ title: "Screenshot import failed", description: error.message, variant: "destructive" }),
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
  const importHoursDetail = useMutation({
    mutationFn: async (file: File) => {
      if (!payload?.schedule.id) throw new Error("Select a schedule before uploading hours detail.");
      const formData = new FormData();
      formData.append("hoursDetail", file);
      const response = await fetch(apiUrl(`/api/schedule/weeks/${payload.schedule.id}/hours-detail`), {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<HoursComparison>;
    },
    onSuccess: (data) => {
      setHoursComparison(data);
      toast({ title: "Actual hours imported", description: `${data.rows.length} associate(s) compared against the schedule.` });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "Hours import failed", description: error.message, variant: "destructive" }),
  });
  const generateAiSchedule = useMutation({
    mutationFn: async ({ mode }: { mode: "frontDesk" | "housekeeping" }) => {
      const response = await apiRequest("POST", `/api/schedule/weeks/${payload?.schedule.id}/ai/generate`, { mode, userInitiated: true });
      return response.json() as Promise<AiScheduleDraft>;
    },
    onMutate: ({ mode }) => setAiGeneratingMode(mode),
    onSuccess: (data) => {
      setAiDraft(data);
      toast({ title: "AI draft generated", description: `${data.assignments.length} proposed shifts are ready to review.` });
    },
    onSettled: () => setAiGeneratingMode(null),
    onError: (error: Error) => toast({ title: "AI draft failed", description: error.message, variant: "destructive" }),
  });
  const applyAiSchedule = useMutation({
    mutationFn: async () => {
      if (!aiDraft) throw new Error("Generate an AI draft first.");
      const response = await apiRequest("POST", `/api/schedule/weeks/${payload?.schedule.id}/ai/apply`, {
        mode: aiDraft.mode,
        assignments: aiDraft.assignments,
        userInitiated: true,
      });
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
  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (!payload?.schedule.id) throw new Error("Choose a schedule week first.");
      const response = await apiRequest("POST", `/api/schedule/weeks/${payload.schedule.id}/templates`, templateForm);
      return response.json() as Promise<{ template: ScheduleTemplate }>;
    },
    onSuccess: (data) => {
      setSelectedTemplateId(data.template.id);
      setTemplateForm({ name: "", occupancyTier: "minimal", description: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/templates"] });
      toast({ title: "Staffing template saved", description: `${data.template.name} now contains ${data.template.shiftCount} shifts.` });
    },
    onError: (error: Error) => toast({ title: "Template save failed", description: error.message, variant: "destructive" }),
  });
  const previewTemplate = useMutation({
    mutationFn: async () => {
      if (!payload?.schedule.id || !selectedTemplateId) throw new Error("Choose a template and schedule week first.");
      return fetchJson(`/api/schedule/templates/${selectedTemplateId}/preview?scheduleId=${payload.schedule.id}`) as Promise<ScheduleTemplatePreview>;
    },
    onSuccess: setTemplatePreview,
    onError: (error: Error) => toast({ title: "Template preview failed", description: error.message, variant: "destructive" }),
  });
  const applyTemplate = useMutation({
    mutationFn: async (mode: "replace" | "fillOpen") => {
      if (!payload?.schedule.id || !selectedTemplateId) throw new Error("Choose a template and schedule week first.");
      const response = await apiRequest("POST", `/api/schedule/weeks/${payload.schedule.id}/templates/${selectedTemplateId}/apply`, { mode });
      return response.json() as Promise<{ payload: SchedulePayload; applied: number; skipped: number }>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/schedule/weeks", weekId], data.payload);
      setTemplatePreview(null);
      toast({ title: "Staffing template applied", description: `${data.applied} shifts applied${data.skipped ? `; ${data.skipped} skipped` : ""}.` });
    },
    onError: (error: Error) => toast({ title: "Template apply failed", description: error.message, variant: "destructive" }),
  });
  const copyPreviousShifts = useMutation({
    mutationFn: async (body: { scope: "all" | "employee"; employeeId?: string; department?: string }) => {
      if (!payload?.schedule.id) throw new Error("Select a schedule before copying previous shifts.");
      const response = await apiRequest("POST", `/api/schedule/weeks/${payload.schedule.id}/copy-previous`, body);
      return response.json();
    },
    onSuccess: (data: SchedulePayload & { copied?: number }) => {
      toast({ title: "Previous schedule copied", description: `${data.copied || 0} shift(s) copied into this week.` });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "Copy failed", description: error.message, variant: "destructive" }),
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
  const saveActualHours = useMutation({
    mutationFn: (body: any) => apiRequest("PUT", `/api/schedule/weeks/${payload?.schedule.id}/actual-hours`, body),
    onSuccess: () => {
      setSelectedActualHours(null);
      toast({ title: "Actual hours saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "Actual hours save failed", description: error.message, variant: "destructive" }),
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
  const reopenDepartment = useMutation({
    mutationFn: (department: string) => apiRequest("POST", `/api/schedule/weeks/${payload?.schedule.id}/departments/${encodeURIComponent(department)}/reopen`, {}),
    onSuccess: () => {
      toast({ title: "Department reopened", description: "Managers can make last-minute edits to that section again." });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "Department reopen failed", description: error.message, variant: "destructive" }),
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
    mutationFn: async (employeeIds: string[]) => {
      const response = await apiRequest("POST", `/api/schedule/weeks/${payload?.schedule.id}/email-selected`, { employeeIds });
      return response.json();
    },
    onSuccess: (data) => {
      setScheduleEmailOpen(false);
      setSelectedScheduleEmailEmployeeIds([]);
      toast({
        title: "Schedule emailed",
        description: `${data.sentCount || 0} of ${data.recipientCount || 0} selected employee email(s) sent.${data.missingEmail?.length ? ` Missing email: ${data.missingEmail.join(", ")}.` : ""}`,
      });
    },
    onError: (error: Error) => toast({ title: "Email failed", description: error.message, variant: "destructive" }),
  });
  const messageTeam = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/schedule/weeks/${payload?.schedule.id}/message-team`, teamMessage);
      return response.json();
    },
    onSuccess: (data) => {
      setTeamMessageOpen(false);
      toast({
        title: "Team message sent",
        description: `${data.sentCount || 0} of ${data.recipientCount || 0} employee email(s) sent.`,
      });
    },
    onError: (error: Error) => toast({ title: "Team message failed", description: error.message, variant: "destructive" }),
  });
  const submitRequest = useMutation({
    mutationFn: async (request: any) => {
      const response = await apiRequest("POST", "/api/schedule/requests", request);
      return response.json();
    },
    onSuccess: (data: { emailSent?: boolean; policyWarning?: boolean }) => {
      toast({
        title: "Schedule request submitted",
        description: data.policyWarning
          ? "Request saved with policy warning: inside 14 days and subject to manager approval."
          : data.emailSent ? "Your department manager was notified." : "Your request was saved. Manager email could not be sent automatically.",
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
      if (weekId) queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "Request update failed", description: error.message, variant: "destructive" }),
  });
  const cancelRequest = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/schedule/requests/${id}/cancel`, {}),
    onSuccess: () => {
      toast({ title: "Request cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/requests"] });
      if (weekId) queryClient.invalidateQueries({ queryKey: ["/api/schedule/weeks", weekId] });
    },
    onError: (error: Error) => toast({ title: "Request cancellation failed", description: error.message, variant: "destructive" }),
  });

  if (!shareToken && auth.isLoading) return <div className={`min-h-screen p-8 ${C.page}`}>Loading Schedule...</div>;
  if (!shareToken && !auth.data?.user) return <ScheduleAuthGate onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/schedule/auth/me"] })} />;
  const editableDepartmentsForAi = payload?.currentUserPermissions?.editableDepartments || [];
  const canGenerateFrontDeskAi = editable && editableDepartmentsForAi.includes("Front Desk");
  const canGenerateHousekeepingAi = editable && editableDepartmentsForAi.includes("Housekeeping");
  const fullDepartmentHkMpor = payload?.totals.laborMetrics?.weekly.fullDepartmentHousekeepingMpor;

  return (
    <div className={`min-h-screen ${C.page}`}>
      <header className="border-b border-[#deceba] bg-[#fffaf2]/95 px-4 py-4 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">{t("Courtyard Austin Lakeline")}</div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{requestOnly ? t("Schedule requests") : t("Courtyard Schedule Builder")}</h1>
          </div>
          <div className="flex flex-wrap gap-2" data-tour="week-controls">
            {!shareToken && (
              <Button asChild variant="outline" className={C.outline}>
                <a href="/courtyard">Home</a>
              </Button>
            )}
            {!shareToken && user?.canAccessTips && (
              <Button asChild className={C.green}>
                <a href="/tips">Tips</a>
              </Button>
            )}
            <Button variant="outline" className={C.outline} onClick={() => setSpanish((value) => !value)}>
              {spanish ? "English" : "Espanol"}
            </Button>
            {!shareToken && !requestOnly && canManageSchedule && <Input className={`${C.field} w-[160px]`} type="date" value={weekStartDate} onChange={(event) => setWeekStartDate(event.target.value)} />}
            {!shareToken && !requestOnly && canManageSchedule && <Button className={C.green} onClick={() => createWeek.mutate("blank")}><CalendarDays className="mr-2 h-4 w-4" />{t("Blank week")}</Button>}
            {!shareToken && !requestOnly && canManageSchedule && <Button variant="outline" className={C.outline} onClick={() => createWeek.mutate("copyPrevious")}><Copy className="mr-2 h-4 w-4" />{t("Copy previous")}</Button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 print:hidden">
        {!shareToken && !requestOnly && (
          <Card className={`${C.shell} print:hidden`}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Label>{t("Week")}</Label>
                <Select value={weekId || "none"} onValueChange={setSelectedWeekId}>
                  <SelectTrigger className={`${C.field} w-[240px]`}><SelectValue /></SelectTrigger>
                  <SelectContent className={C.menu}>
                    <SelectItem value="none">{t("Select schedule")}</SelectItem>
                    {(weeks.data?.weeks || []).map((week) => <SelectItem key={week.id} value={week.id}>{formatWeek(week.weekStartDate, week.weekEndDate)} - {week.status}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {payload && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={statusBadge(payload.schedule.status)}>{payload.schedule.status}</Badge>
                  {payload.schedule.status === "draft" && payload.currentUserPermissions?.canPublishFinal && <Button className={C.green} onClick={() => action.mutate({ name: "publish" })}><CheckCircle2 className="mr-2 h-4 w-4" />Save & Publish Final Schedule</Button>}
                  {payload.schedule.status === "draft" && payload.currentUserPermissions?.canPublishFinal && (
                    <Button
                      variant="outline"
                      className="border-red-300 bg-white text-red-700 hover:bg-red-50"
                      disabled={deleteDraftWeek.isPending}
                      onClick={() => {
                        if (window.confirm(`Delete draft schedule ${formatWeek(payload.schedule.weekStartDate, payload.schedule.weekEndDate)}? This cannot be undone.`)) {
                          deleteDraftWeek.mutate();
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />Delete draft
                    </Button>
                  )}
                  {payload.schedule.status === "published" && payload.currentUserPermissions?.canPublishFinal && <Button variant="outline" className={C.outline} onClick={() => action.mutate({ name: "reopen", body: { reason: "Manager edit" } })}><RefreshCw className="mr-2 h-4 w-4" />{t("Reopen")}</Button>}
                  {payload.currentUserPermissions?.canPublishFinal && <Button variant="outline" className={C.outline} onClick={() => action.mutate({ name: "archive" })}><Archive className="mr-2 h-4 w-4" />{t("Archive")}</Button>}
                  {payload.schedule.status === "published" && payload.currentUserPermissions?.canPublishFinal && <Button variant="outline" className={C.outline} onClick={() => shareLink.mutate()}><Share2 className="mr-2 h-4 w-4" />{t("Copy share link")}</Button>}
                  {payload.schedule.status === "published" && payload.currentUserPermissions?.canPublishFinal && <Button variant="outline" className={C.outline} disabled={emailSchedule.isPending} onClick={() => setScheduleEmailOpen(true)}><Mail className="mr-2 h-4 w-4" />Email selected</Button>}
                  {payload.currentUserPermissions?.canPublishFinal && <Button variant="outline" className={C.outline} onClick={() => setTeamMessageOpen(true)}><Users className="mr-2 h-4 w-4" />Team message</Button>}
                  {editable && canManageSchedule && (
                    <Button
                      variant="outline"
                      className={C.outline}
                      disabled={copyPreviousShifts.isPending}
                      onClick={() => {
                        if (window.confirm("Copy eligible shifts from the previous schedule into this week? Existing cells in the copied scope will be overwritten.")) {
                          copyPreviousShifts.mutate({ scope: "all" });
                        }
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      {copyPreviousShifts.isPending ? "Copying..." : "Copy prior shifts"}
                    </Button>
                  )}
                  <Button asChild variant="outline" className={C.outline}><a href={apiUrl(`/api/schedule/weeks/${payload.schedule.id}/pdf`)}><Download className="mr-2 h-4 w-4" />PDF</a></Button>
                  <Button asChild variant="outline" className={C.outline}><a href={apiUrl(`/api/schedule/weeks/${payload.schedule.id}/excel`)}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</a></Button>
                  {canManageSchedule && <Button asChild variant="outline" className={C.outline}><a href={apiUrl(`/api/schedule/weeks/${payload.schedule.id}/labor-performance`)}><Download className="mr-2 h-4 w-4" />Labor PDF</a></Button>}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!shareToken && !requestOnly && canManageTemplates && (
          <Card className={`${C.shell} print:hidden`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className={C.ink}>Staffing Templates</CardTitle>
                  <CardDescription className={C.muted}>Save a complete schedule by occupancy tier, then preview and apply it to another week.</CardDescription>
                </div>
                <Button variant="outline" className={C.outline} onClick={() => setTemplatePanelOpen((open) => !open)}>
                  {templatePanelOpen ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                  {templatePanelOpen ? "Collapse" : "Manage"}
                </Button>
              </div>
            </CardHeader>
            {templatePanelOpen && (
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-[#e0d3c1] bg-white p-4">
                  <div className="font-semibold">Save current schedule</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Template name</Label>
                      <Input className={C.field} value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} placeholder="Minimal Coverage" />
                    </div>
                    <div>
                      <Label>Occupancy tier</Label>
                      <Select value={templateForm.occupancyTier} onValueChange={(occupancyTier) => setTemplateForm({ ...templateForm, occupancyTier })}>
                        <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                        <SelectContent className={C.menu}>
                          <SelectItem value="minimal">Minimal Coverage</SelectItem>
                          <SelectItem value="low">Low Occupancy</SelectItem>
                          <SelectItem value="moderate">Moderate Occupancy</SelectItem>
                          <SelectItem value="high">High Occupancy</SelectItem>
                          <SelectItem value="peak">Sellout / Peak</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input className={C.field} value={templateForm.description} onChange={(event) => setTemplateForm({ ...templateForm, description: event.target.value })} placeholder="Optional notes about when this model should be used" />
                  </div>
                  <Button className={C.green} disabled={!payload || templateForm.name.trim().length < 2 || saveTemplate.isPending} onClick={() => saveTemplate.mutate()}>
                    <Save className="mr-2 h-4 w-4" />
                    {saveTemplate.isPending ? "Saving..." : "Save current week as template"}
                  </Button>
                  <div className="text-xs text-[#5f5247]">Saving an existing template name updates it with the currently selected week.</div>
                </div>
                <div className="space-y-3 rounded-xl border border-[#e0d3c1] bg-white p-4">
                  <div className="font-semibold">Apply a saved template</div>
                  <div>
                    <Label>Template</Label>
                    <Select value={selectedTemplateId || "none"} onValueChange={(value) => setSelectedTemplateId(value === "none" ? "" : value)}>
                      <SelectTrigger className={C.field}><SelectValue placeholder="Choose a template" /></SelectTrigger>
                      <SelectContent className={C.menu}>
                        <SelectItem value="none">Choose a template</SelectItem>
                        {(templates.data?.templates || []).map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name} - {template.occupancyTier.replace("_", " ")} ({template.shiftCount} shifts)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedTemplateId && (() => {
                    const selected = templates.data?.templates.find((template) => template.id === selectedTemplateId);
                    return selected ? (
                      <div className="rounded-lg border border-[#e0d3c1] bg-[#fbf6ee] p-3 text-sm">
                        <div className="font-semibold">{selected.name}</div>
                        <div className="text-[#5f5247]">{selected.description || "No template notes."}</div>
                      </div>
                    ) : null;
                  })()}
                  <Button className={C.green} disabled={!payload || !selectedTemplateId || previewTemplate.isPending} onClick={() => previewTemplate.mutate()}>
                    <Search className="mr-2 h-4 w-4" />
                    {previewTemplate.isPending ? "Checking..." : "Preview against selected week"}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {!shareToken && user && (
          <ScheduleRequestsPanel
            requests={requests.data?.requests || []}
            isAdmin={canManageSchedule}
            spanish={spanish}
            onSubmit={(request) => submitRequest.mutate(request)}
            onStatus={(request, status) => {
              const overlapCount = Number(request.overlapConflictCount || request.conflictCount || 0);
              const first = request.firstOverlapRequest;
              const firstText = first ? ` First request: ${first.requesterName} (${first.status}) for ${formatRequestDateRange({ ...request, requestDate: first.requestDate, requestEndDate: first.requestEndDate } as ScheduleRequest)}.` : "";
              if (
                status === "approved" &&
                overlapCount > 0 &&
                !window.confirm(`${overlapCount} other associate request(s) in ${request.department || "this department"} overlap ${formatRequestDateRange(request)}.${firstText} Approve this additional request?`)
              ) {
                return;
              }
              updateRequestStatus.mutate({ id: request.id, status });
            }}
            onCancel={(request) => {
              if (window.confirm(`Cancel this request for ${formatRequestDateRange(request)}?`)) cancelRequest.mutate(request.id);
            }}
          />
        )}

        {!requestOnly && (!payload ? (
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
                  <Badge variant="outline" className={statusBadge(payload.schedule.status)}>{payload.schedule.status}</Badge>
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
                    <div className="text-3xl font-semibold">{payload.totals.totalWeeklyScheduledHours || payload.totals.totalWeeklyLaborHoursIncludingSalary || payload.totals.totalWeeklyLaborHours}</div>
                    <div className="text-xs text-[#5f5247]">Labor dollars hidden</div>
                  </div>
                )}
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                  <div className="text-sm text-[#5f5247]">HPOR target {payload.totals.laborMetrics?.targets.hpor ?? 1.4}</div>
                  <div className={`text-3xl font-semibold ${metricTone(payload.totals.laborMetrics?.weekly.hpor || 0, payload.totals.laborMetrics?.targets.hpor || 1.4)}`}>{payload.totals.laborMetrics?.weekly.hpor ?? "0.00"}</div>
                </div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                  <div className="text-sm text-[#5f5247]">Scheduled RA MPOR</div>
                  <div className={`text-3xl font-semibold ${metricTone(payload.totals.laborMetrics?.weekly.hkMpor || 0, payload.totals.laborMetrics?.targets.hkMporMax || 30)}`}>{payload.totals.laborMetrics?.weekly.hkMpor ?? "0.0"}</div>
                  <div className="text-xs text-[#5f5247]">Target {payload.totals.laborMetrics?.targets.hkMporMin ?? 25}-{payload.totals.laborMetrics?.targets.hkMporMax ?? 30}; room-attendant hours only</div>
                </div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">{spanish ? ES["Open shifts"] : "Open shifts"}</div><div className="text-3xl font-semibold">{payload.totals.openShiftCount}</div></div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">{spanish ? ES.Employees : "Employees"}</div><div className="text-3xl font-semibold">{payload.employees.filter((e) => e.active).length}</div></div>
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">{spanish ? ES.Warnings : "Warnings"}</div><div className="text-3xl font-semibold">{payload.totals.warnings.length}</div></div>
              </CardContent>
            </Card>

            {fullDepartmentHkMpor && (
              <Card className={`${C.shell} ${fullDepartmentHkMpor.forecastMpor > fullDepartmentHkMpor.target || (fullDepartmentHkMpor.actualReady && Number(fullDepartmentHkMpor.actualMpor || 0) > fullDepartmentHkMpor.target) ? "!border-amber-400" : "!border-emerald-300"}`}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className={`${C.ink} flex items-center gap-2`}>
                        <AlertTriangle className={`h-5 w-5 ${fullDepartmentHkMpor.forecastMpor > fullDepartmentHkMpor.target ? "text-amber-700" : "text-emerald-700"}`} />
                        Overall HK Department MPOR
                      </CardTitle>
                      <CardDescription className={C.muted}>
                        Ops report reference: all Housekeeping hours, including Exec HK, divided by occupied rooms. RVP target: {fullDepartmentHkMpor.target} minutes.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="border-[#9f8b72] bg-white text-[#201814]">OPS REPORT METRIC</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <div className={`rounded-xl border p-4 ${fullDepartmentHkMpor.forecastMpor > fullDepartmentHkMpor.target ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
                    <div className="text-sm font-semibold text-[#5f5247]">Forecast full-department MPOR</div>
                    <div className={`text-4xl font-semibold ${fullDepartmentHkMpor.forecastMpor > fullDepartmentHkMpor.target ? "text-amber-900" : "text-emerald-900"}`}>
                      {fullDepartmentHkMpor.forecastMpor.toFixed(1)}
                    </div>
                    <div className="text-sm text-[#5f5247]">
                      {fmtHours(fullDepartmentHkMpor.forecastHours)} scheduled HK hours / {fullDepartmentHkMpor.forecastRooms} forecast rooms
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[#201814]">
                      Variance to target: {(fullDepartmentHkMpor.forecastMpor - fullDepartmentHkMpor.target) > 0 ? "+" : ""}{(fullDepartmentHkMpor.forecastMpor - fullDepartmentHkMpor.target).toFixed(1)} minutes
                    </div>
                  </div>
                  <div className={`rounded-xl border p-4 ${fullDepartmentHkMpor.actualReady && Number(fullDepartmentHkMpor.actualMpor || 0) > fullDepartmentHkMpor.target ? "border-amber-300 bg-amber-50" : fullDepartmentHkMpor.actualReady ? "border-emerald-300 bg-emerald-50" : "border-[#e0d3c1] bg-white"}`}>
                    <div className="text-sm font-semibold text-[#5f5247]">Actual full-department MPOR</div>
                    {fullDepartmentHkMpor.actualReady ? (
                      <>
                        <div className={`text-4xl font-semibold ${Number(fullDepartmentHkMpor.actualMpor || 0) > fullDepartmentHkMpor.target ? "text-amber-900" : "text-emerald-900"}`}>
                          {Number(fullDepartmentHkMpor.actualMpor).toFixed(1)}
                        </div>
                        <div className="text-sm text-[#5f5247]">
                          {fmtHours(fullDepartmentHkMpor.actualHours)} actual HK hours / {fullDepartmentHkMpor.actualRooms} actual rooms
                        </div>
                        <div className="mt-1 text-sm font-semibold text-[#201814]">
                          Variance to target: {Number(fullDepartmentHkMpor.actualMpor) - fullDepartmentHkMpor.target > 0 ? "+" : ""}{(Number(fullDepartmentHkMpor.actualMpor) - fullDepartmentHkMpor.target).toFixed(1)} minutes
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-semibold text-[#5f5247]">Waiting for closed-week reports</div>
                        <div className="mt-1 text-sm text-[#5f5247]">Upload both Hours Detail and final actualized OTB production to calculate actual MPOR.</div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {(canGenerateFrontDeskAi || canGenerateHousekeepingAi) && (
              <Card className={`${C.shell} print:hidden`}>
                <CardHeader className="pb-3">
                  <Button
                    type="button"
                    variant="outline"
                    className={`${C.outline} h-auto w-full justify-between px-4 py-3 text-left`}
                    aria-expanded={aiToolsOpen}
                    onClick={() => setAiToolsOpen((open) => !open)}
                  >
                    <span>
                      <span className="block font-semibold">Optional AI scheduling tools</span>
                      <span className="mt-1 block text-xs font-normal text-[#5f5247]">
                        Manual entry and drag-to-copy are the primary scheduling workflow. AI runs only when you open this section and choose a draft.
                      </span>
                    </span>
                    {aiToolsOpen ? <ChevronUp className="ml-3 h-4 w-4 shrink-0" /> : <ChevronDown className="ml-3 h-4 w-4 shrink-0" />}
                  </Button>
                </CardHeader>
                {aiToolsOpen && (
                  <CardContent className="flex flex-wrap items-center gap-3 pt-0">
                    {canGenerateFrontDeskAi && (
                      <Button className={C.accent} disabled={Boolean(aiGeneratingMode)} onClick={() => generateAiSchedule.mutate({ mode: "frontDesk" })}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        {aiGeneratingMode === "frontDesk" ? "Generating FD..." : "Create Front Desk AI draft"}
                      </Button>
                    )}
                    {canGenerateHousekeepingAi && (
                      <Button variant="outline" className={C.outline} disabled={Boolean(aiGeneratingMode)} onClick={() => generateAiSchedule.mutate({ mode: "housekeeping" })}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        {aiGeneratingMode === "housekeeping" ? "Generating HK..." : "Create Housekeeping AI draft"}
                      </Button>
                    )}
                    <p className="text-sm text-[#5f5247]">Generating a draft does not change or publish the schedule. You must review and explicitly apply it.</p>
                  </CardContent>
                )}
              </Card>
            )}

            {payload.totals.laborMetrics && (
              <Card className={C.shell}>
                <CardHeader>
                  <CardTitle className={C.ink}>Labor targets</CardTitle>
                  <CardDescription className={C.muted}>HPOR is total labor hours per occupied room. HK MPOR is room-attendant minutes per weighted room credit.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">Forecast rooms</div>
                    <div className="text-2xl font-semibold">{payload.totals.laborMetrics.weekly.roomsSold}</div>
                  </div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">HK room credits</div>
                    <div className="text-2xl font-semibold">{payload.totals.laborMetrics.weekly.roomCredits}</div>
                  </div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">Room Attendant hours</div>
                    <div className="text-2xl font-semibold">{payload.totals.laborMetrics.weekly.roomAttendantHours ?? 0} scheduled</div>
                    <div className="text-xs text-[#5f5247]">Target {payload.totals.laborMetrics.weekly.targetRoomAttendantHours ?? payload.totals.laborMetrics.weekly.targetHousekeepingHoursMax} at 30 MPOR</div>
                    <div className="text-xs font-semibold text-[#5f5247]">
                      Variance {Number(((payload.totals.laborMetrics.weekly.roomAttendantHours ?? 0) - (payload.totals.laborMetrics.weekly.targetRoomAttendantHours ?? payload.totals.laborMetrics.weekly.targetHousekeepingHoursMax)).toFixed(2))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">Laundry coverage</div>
                    <div className="text-2xl font-semibold">{payload.totals.laborMetrics.weekly.targetLaundryHours ?? 49}</div>
                    <div className="text-xs text-[#5f5247]">7 hrs daily x 7 days</div>
                  </div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">Houseperson coverage</div>
                    <div className="text-2xl font-semibold">{payload.totals.laborMetrics.weekly.targetHousepersonHours ?? 49}</div>
                    <div className="text-xs text-[#5f5247]">7 hrs daily x 7 days</div>
                  </div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">Total Housekeeping hours</div>
                    <div className="text-2xl font-semibold">{payload.totals.laborMetrics.weekly.housekeepingHours} scheduled</div>
                    <div className="text-xs text-[#5f5247]">Target {payload.totals.laborMetrics.weekly.targetTotalHousekeepingOperatingHours ?? payload.totals.laborMetrics.weekly.targetHousekeepingHoursMax}: RA + Laundry + Houseperson</div>
                    <div className="text-xs font-semibold text-[#5f5247]">
                      Variance {Number((payload.totals.laborMetrics.weekly.housekeepingHours - (payload.totals.laborMetrics.weekly.targetTotalHousekeepingOperatingHours ?? payload.totals.laborMetrics.weekly.targetHousekeepingHoursMax)).toFixed(2))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">Room revenue</div>
                    <div className="text-2xl font-semibold">${payload.totals.laborMetrics.weekly.roomRevenue || 0}</div>
                  </div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">Actual pickup</div>
                    <div className="text-2xl font-semibold">
                      {payload.forecastAccuracy?.current.ready
                        ? payload.forecastAccuracy.current.weekly.originalPickupRooms
                        : "-"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                    <div className="text-sm text-[#5f5247]">Actual vs forecast</div>
                    <div className="text-2xl font-semibold">
                      {payload.forecastAccuracy?.current.ready
                        ? `${payload.forecastAccuracy.current.weekly.forecastVarianceRooms > 0 ? "+" : ""}${payload.forecastAccuracy.current.weekly.forecastVarianceRooms}`
                        : "-"}
                    </div>
                    <div className="text-xs text-[#5f5247]">
                      {payload.forecastAccuracy?.current.ready
                        ? `${payload.forecastAccuracy.current.weekly.forecastAccuracyPercent?.toFixed(1) ?? "-"}% accuracy`
                        : "Upload final actual pickup"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {canManageSchedule && (
              <Card className={C.shell}>
                <CardHeader>
                  <CardTitle className={C.ink}>Department completion</CardTitle>
                  <CardDescription className={C.muted}>Department managers save their section when complete. GM/admin publishes after all required departments are complete.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {(payload.requiredDepartments || []).map((department) => {
                    const completed = Boolean(payload.departmentStatus?.[department]?.completedAt);
                    const canManageSection = Boolean(payload.currentUserPermissions?.canPublishFinal || payload.currentUserPermissions?.editableDepartments?.includes(department));
                    return (
                      <div key={department} className="rounded-lg border border-[#e0d3c1] bg-white p-3">
                        <div className="font-semibold">{department}</div>
                        <Badge variant="outline" className={completed ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"}>{completed ? "Completed" : "Open"}</Badge>
                        {canManageSection && !completed && <Button size="sm" className={`${C.green} ml-2`} onClick={() => completeDepartment.mutate(department)} disabled={completeDepartment.isPending}>Save section</Button>}
                        {canManageSection && completed && <Button size="sm" variant="outline" className="ml-2 border-[#b98a43] text-[#2a211c]" onClick={() => reopenDepartment.mutate(department)} disabled={reopenDepartment.isPending}>Reopen</Button>}
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
                  <CardDescription className={C.muted}>Sliding scale from the Bistro labor guide based on weekly occupancy. Scheduled hours include Bistro Manager coverage.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Forecast rooms</div><div className="text-2xl font-semibold">{payload.totals.laborMetrics?.weekly.roomsSold || 0}</div></div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Forecast room revenue</div><div className="text-2xl font-semibold">${payload.totals.laborMetrics?.weekly.roomRevenue || 0}</div></div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Weekly Occ</div><div className="text-2xl font-semibold">{payload.totals.bistroLabor.weeklyOccupancyPercent}%</div></div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Model</div><div className="text-xl font-semibold">{payload.totals.bistroLabor.model}</div></div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Target hours</div><div className="text-2xl font-semibold">{payload.totals.bistroLabor.targetMinHours}-{payload.totals.bistroLabor.targetMaxHours}</div></div>
                  <div className="rounded-xl border border-[#e0d3c1] bg-white p-4"><div className="text-sm text-[#5f5247]">Scheduled incl. Bistro Manager</div><div className="text-2xl font-semibold">{payload.totals.bistroLabor.scheduledHours}</div></div>
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
              onScreenshotImport={(file) => importForecastScreenshot.mutate(file)}
              onActualizedImport={(file) => importActualized.mutate(file)}
              onPopupGroupSave={(body) => savePopupGroup.mutate(body)}
              importing={importForecast.isPending}
              importingScreenshot={importForecastScreenshot.isPending}
              actualizing={importActualized.isPending}
              canActualize={canActualizeForecast}
              spanish={spanish}
            />
            {canManageSchedule && !shareToken && (
              <HoursComparisonPanel
                payload={payload}
                comparison={hoursComparison}
                importing={importHoursDetail.isPending}
                onImport={(file) => importHoursDetail.mutate(file)}
                spanish={spanish}
              />
            )}
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
              onCopyPreviousEmployee={(employee, department) => {
                if (window.confirm(`Copy ${employee.displayName}'s prior-week ${department} shifts into this schedule? Existing cells for that associate/department will be overwritten.`)) {
                  copyPreviousShifts.mutate({ scope: "employee", employeeId: employee.id, department });
                }
              }}
              onHousekeepingBoard={(employee, date, board, trackMpor) => setSelectedHousekeepingBoard({ employee, date, board, trackMpor })}
              onActualHours={(employee, date, actual) => setSelectedActualHours({ employee, date, actual })}
            />
            {canManageSchedule && !shareToken && (
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
        ))}
      </main>
      {payload && <PrintableSchedule payload={payload} spanish={spanish} />}
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
          trackMpor={selectedHousekeepingBoard.trackMpor}
          onSave={(body) => saveHousekeepingBoard.mutate(body)}
        />
      )}
      {payload && selectedActualHours && (
        <ActualHoursDialog
          open={!!selectedActualHours}
          onOpenChange={(open) => !open && setSelectedActualHours(null)}
          employee={selectedActualHours.employee}
          date={selectedActualHours.date}
          actual={selectedActualHours.actual}
          onSave={(body) => saveActualHours.mutate(body)}
        />
      )}
      <Dialog open={!!templatePreview} onOpenChange={(open) => !open && setTemplatePreview(null)}>
        <DialogContent className="max-w-2xl bg-[#fffaf2] text-[#201814]">
          <DialogHeader>
            <DialogTitle>Template Preview: {templatePreview?.template.name}</DialogTitle>
            <DialogDescription className={C.muted}>
              {templatePreview?.applicableCount || 0} of {templatePreview?.shiftCount || 0} shifts can be applied to {templatePreview ? formatWeek(templatePreview.schedule.weekStartDate, templatePreview.schedule.weekEndDate) : "this week"}.
            </DialogDescription>
          </DialogHeader>
          {templatePreview && (
            <div className="space-y-4">
              {[
                ["Approved requests - skipped", templatePreview.conflicts.approvedRequests],
                ["Inactive associates - skipped", templatePreview.conflicts.inactiveAssociates],
                ["Missing associates - skipped", templatePreview.conflicts.missingAssociates],
                ["Missing shift types", templatePreview.conflicts.missingShiftTypes],
                ["Existing scheduled cells", templatePreview.conflicts.existingCells],
                ["Weekly hour warnings", templatePreview.conflicts.weeklyHours],
              ].map(([label, items]) => {
                const values = items as string[];
                if (!values.length) return null;
                return (
                  <div key={label as string} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                    <div className="font-semibold">{label as string} ({values.length})</div>
                    <div className="mt-1 max-h-24 overflow-y-auto">{values.join(", ")}</div>
                  </div>
                );
              })}
              {!Object.values(templatePreview.conflicts).some((items) => items.length > 0) && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
                  No conflicts found. All template shifts are ready to apply.
                </div>
              )}
              <div className="rounded-lg border border-[#e0d3c1] bg-white p-3 text-sm text-[#5f5247]">
                Approved-request, inactive-associate, and missing-associate shifts are always skipped. Weekly-hour warnings do not prevent application.
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" className={C.outline} onClick={() => setTemplatePreview(null)}>Cancel</Button>
                <Button className={C.green} disabled={applyTemplate.isPending} onClick={() => applyTemplate.mutate("fillOpen")}>
                  Fill open cells
                </Button>
                <Button
                  className={C.accent}
                  disabled={applyTemplate.isPending}
                  onClick={() => {
                    if (window.confirm("Replace all shifts in the selected week with this template? This removes the current schedule assignments first.")) {
                      applyTemplate.mutate("replace");
                    }
                  }}
                >
                  Replace schedule
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={scheduleEmailOpen}
        onOpenChange={(open) => {
          setScheduleEmailOpen(open);
          if (!open) setSelectedScheduleEmailEmployeeIds([]);
        }}
      >
        <DialogContent className="max-w-2xl bg-[#fffaf2] text-[#201814]">
          <DialogHeader>
            <DialogTitle>Email Schedule to Selected Associates</DialogTitle>
            <DialogDescription className={C.muted}>
              Select only the associates who need the current published schedule. They will receive the read-only schedule link.
            </DialogDescription>
          </DialogHeader>
          {payload && (() => {
            const activeEmployees = payload.employees
              .filter((employee) => employee.active)
              .sort((a, b) => normalizeDepartment(a.department).localeCompare(normalizeDepartment(b.department)) || a.displayName.localeCompare(b.displayName));
            const emailableEmployees = activeEmployees.filter((employee) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(employee.email || "").trim()));
            const allSelected = emailableEmployees.length > 0 && emailableEmployees.every((employee) => selectedScheduleEmailEmployeeIds.includes(employee.id));
            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e0d3c1] bg-white p-3">
                  <div className="text-sm">
                    <strong>{selectedScheduleEmailEmployeeIds.length}</strong> selected
                    <span className="ml-2 text-[#5f5247]">{emailableEmployees.length} with valid email</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={C.outline}
                    onClick={() => setSelectedScheduleEmailEmployeeIds(allSelected ? [] : emailableEmployees.map((employee) => employee.id))}
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </Button>
                </div>
                <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                  {activeEmployees.map((employee) => {
                    const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(employee.email || "").trim());
                    const scheduledDays = new Set(payload.assignments.filter((assignment) => assignment.employeeId === employee.id).map((assignment) => assignment.shiftDate)).size;
                    return (
                      <label
                        key={employee.id}
                        className={`flex items-center gap-3 rounded-lg border p-3 ${hasEmail ? "cursor-pointer border-[#e0d3c1] bg-white" : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"}`}
                      >
                        <input
                          type="checkbox"
                          disabled={!hasEmail}
                          checked={selectedScheduleEmailEmployeeIds.includes(employee.id)}
                          onChange={(event) => setSelectedScheduleEmailEmployeeIds((current) => event.target.checked
                            ? [...current, employee.id]
                            : current.filter((id) => id !== employee.id))}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold">{employee.displayName}</div>
                          <div className="text-xs text-[#5f5247]">
                            {normalizeDepartment(employee.department)} - {scheduledDays} scheduled day{scheduledDays === 1 ? "" : "s"} - {hasEmail ? employee.email : "Missing email address"}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" className={C.outline} onClick={() => setScheduleEmailOpen(false)}>Cancel</Button>
                  <Button
                    className={C.green}
                    disabled={!selectedScheduleEmailEmployeeIds.length || emailSchedule.isPending}
                    onClick={() => emailSchedule.mutate(selectedScheduleEmailEmployeeIds)}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {emailSchedule.isPending ? "Sending..." : `Email ${selectedScheduleEmailEmployeeIds.length} selected`}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
      <Dialog open={teamMessageOpen} onOpenChange={setTeamMessageOpen}>
        <DialogContent className="max-w-2xl bg-[#fffaf2] text-[#201814]">
          <DialogHeader>
            <DialogTitle>Message entire team</DialogTitle>
            <DialogDescription className={C.muted}>
              Send a one-time email to all active associates with schedule access. The message includes a link to this schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Subject</Label>
              <Input
                className={C.field}
                value={teamMessage.subject}
                onChange={(event) => setTeamMessage({ ...teamMessage, subject: event.target.value })}
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                className={C.field}
                rows={8}
                value={teamMessage.message}
                onChange={(event) => setTeamMessage({ ...teamMessage, message: event.target.value })}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" className={C.outline} onClick={() => setTeamMessageOpen(false)}>Cancel</Button>
              <Button
                className={C.green}
                disabled={messageTeam.isPending || teamMessage.subject.trim().length < 3 || teamMessage.message.trim().length < 10}
                onClick={() => messageTeam.mutate()}
              >
                <Mail className="mr-2 h-4 w-4" />
                {messageTeam.isPending ? "Sending..." : "Send team message"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={housekeepingBreakNoticeOpen}>
        <DialogContent
          className="max-w-md bg-[#fffaf2] text-[#201814]"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{spanish ? "Recordatorio de descansos" : "Break Clocking Reminder"}</DialogTitle>
            <DialogDescription className="text-base leading-6 !text-[#40362e]">
              {spanish ? HOUSEKEEPING_BREAK_NOTICE_ES : HOUSEKEEPING_BREAK_NOTICE}
            </DialogDescription>
          </DialogHeader>
          <Button className={`${C.green} w-full`} onClick={() => setHousekeepingBreakNoticeOpen(false)}>
            {spanish ? "Entiendo" : "I understand"}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!aiDraft} onOpenChange={(open) => !open && setAiDraft(null)}>
        <DialogContent className="max-w-3xl bg-[#fffaf2] text-[#201814]">
          <DialogHeader>
            <DialogTitle>AI schedule draft</DialogTitle>
            <DialogDescription className={C.muted}>
              Review the draft before applying. Only the associate/date cells shown in this proposal are updated. Existing shifts not shown here are preserved.
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
                <div className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                  <div className="text-sm text-[#5f5247]">{aiDraft.mode === "housekeeping" ? "Current HK MPOR" : "Draft scope"}</div>
                  <div className="text-2xl font-semibold">{aiDraft.mode === "housekeeping" ? (hasHousekeepingBoardData ? aiDraft.laborMetrics?.weekly.hkMpor ?? "-" : "Pending") : "Front Desk only"}</div>
                </div>
              </div>
              {payload && <AiDraftPreview payload={payload} draft={aiDraft} />}
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
                <Button className={C.green} disabled={applyAiSchedule.isPending} onClick={() => {
                  if (window.confirm("Apply only the proposed associate/date cells? Existing shifts outside this proposal will remain unchanged.")) applyAiSchedule.mutate();
                }}>
                  {applyAiSchedule.isPending ? "Applying..." : "Apply proposed cells"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {!shareToken && user && <ScheduleTutorial spanish={spanish} isAdmin={canManageSchedule} userId={user.id} />}
    </div>
  );
}
