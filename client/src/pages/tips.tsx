import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  Download,
  Lock,
  LogOut,
  ReceiptText,
  ShieldCheck,
  Upload,
  UserPlus,
  Users,
  Ban,
  RotateCcw,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const C = {
  page: "bg-[#f5efe7] text-[#201814]",
  shell: "!border-[#ddccb5] !bg-[#fffaf2] !bg-none !text-[#201814] shadow-[0_18px_45px_rgba(74,54,34,0.10)]",
  panel: "border-[#e1d1bb] !bg-[#fbf6ee] !bg-none text-[#201814]",
  ink: "!text-[#201814]",
  muted: "!text-[#5f5247]",
  accent: "!bg-[#b98435] !bg-none !text-white hover:!bg-[#9f6f2b]",
  green: "!bg-[#2f5f46] !bg-none !text-white hover:!bg-[#274d39]",
  field: "!border-[#cdbda8] !bg-white !text-[#201814] placeholder:!text-[#76695d]",
  outline: "!border-[#cdbda8] !bg-white !bg-none !text-[#201814] hover:!bg-[#f8efe2]",
  darkButton: "!border-[#111827] !bg-[#1f2937] !bg-none !text-white hover:!bg-[#111827]",
  menu: "!border-[#cdbda8] !bg-white !text-[#201814]",
};

type TipsUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeDisplayName: string;
  position: string | null;
  role: "employee" | "manager" | "super_admin";
  mustChangePassword: boolean;
  disabledAt: string | Date | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

type Attachment = {
  id: string;
  originalFileName: string;
  mimeType: string;
  size: number;
};

type TipEntry = {
  id: string;
  entryDate: string;
  tipAmount: string;
  creditTips: string;
  grossSales: string;
  shiftType?: "breakfast" | "lunch" | "dinner" | "bar" | "other";
  notes?: string | null;
  status: string;
  attachments: Attachment[];
};

type DashboardDay = {
  date: string;
  dayNumber: number;
  entry: TipEntry | null;
};

type TipsDashboard = {
  period: { start: string; end: string; dayNumber: number };
  days: DashboardDay[];
  entries: TipEntry[];
  submission: any | null;
  week1Total: string;
  week2Total: string;
  totalTips: string;
};

type DailyReport = {
  id: string;
  reportDate: string;
  originalFileName: string;
  mimeType: string;
  size: number;
};

type TipsGridCell = {
  date: string;
  entryId: string | null;
  tipAmount: string;
  grossSales: string;
  personalTipPercent: number;
  notes: string;
  status: string;
  confirmed: boolean;
};

type TipsGridRow = {
  associate: TipsUser;
  cells: TipsGridCell[];
  totalTips: string;
};

type TipsGrid = {
  period: { start: string; end: string; dayNumber: number; days: string[] };
  rows: TipsGridRow[];
  dayTotals: Array<{ date: string; totalTips: string; grossSales: string; taxAmount: string; netSales: string; beerSales: string; liquorSales: string; foodSales: string; wineSales: string; tipPercent: number; splitCount: number; splitAmount: string | null; report: DailyReport | null }>;
  banquetReports: Array<{ id: string; eventDate: string; reportType?: "banquet_service" | "group_breakfast"; eventName: string; grossSales: string; serviceRate?: string; banquetTips: string; assignedAssociatesJson?: Array<{ userId: string; displayName: string; department?: string | null; position?: string | null; splitAmount: string }>; notes?: string | null; originalFileName?: string | null; storagePath?: string | null }>;
  banquetAssociates: Array<{ id: string; employeeDisplayName: string; department?: string | null; position?: string | null }>;
  banquetTotal: string;
  salesTotals: Record<"week1" | "week2" | "period" | "month", { grossSales: string; taxAmount: string; netSales: string; beerSales: string; liquorSales: string; foodSales: string; wineSales: string }>;
  canManageSales: boolean;
  week1Total: string;
  week2Total: string;
  totalTips: string;
  submission: any | null;
  locked: boolean;
};

type AuthMode = "login" | "register";

function formatMoney(value: string | number | undefined | null) {
  const numeric = Number(value || 0);
  return `$${(Number.isFinite(numeric) ? numeric : 0).toFixed(2)}`;
}

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function formatDisplayDate(value: string, style: "short" | "long" = "short") {
  const date = parseLocalDate(value);
  return date.toLocaleDateString(undefined, style === "long" ? { weekday: "long", month: "long", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" });
}

function formatTodayLabel(value: string) {
  return `Today, ${formatDisplayDate(value, "long")}`;
}

function formatPercent(value: number | undefined | null) {
  const numeric = Number(value || 0);
  return `${(Number.isFinite(numeric) ? numeric : 0).toFixed(1)}%`;
}

function formatPeriod(start: string, end: string) {
  return `${formatDisplayDate(start, "long")} - ${formatDisplayDate(end, "long")}`;
}

function formatShiftType(value?: string | null) {
  const labels: Record<string, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    bar: "Bar",
    other: "Other",
  };
  return labels[value || "other"] || "Other";
}

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function addDaysKey(value: string, days: number) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

async function compressSalesReportFile(file: File) {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= 2.5 * 1024 * 1024) return file;

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to read sales report image."));
      image.src = objectUrl;
    });

    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.76));
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "sales-report";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function uploadErrorMessage(error: Error) {
  try {
    const parsed = JSON.parse(error.message);
    return parsed?.error || error.message;
  } catch {
    return error.message;
  }
}

function getDayStatus(day: DashboardDay, locked: boolean) {
  if (locked) return { label: "Locked", icon: Lock, className: "border-slate-300 bg-slate-100 text-slate-700" };
  if (!day.entry) return { label: "Not entered", icon: Clock3, className: "border-slate-300 bg-white text-slate-700" };
  if (!day.entry.attachments?.length) return { label: "Needs photo", icon: AlertTriangle, className: "border-amber-300 bg-amber-50 text-amber-900" };
  return { label: "Ready", icon: CheckCircle2, className: "border-emerald-300 bg-emerald-50 text-emerald-800" };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(apiUrl(url), { credentials: "include" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        className={`${C.field} pr-11`}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#5f5247] hover:bg-[#f4eadb]"
        onClick={() => setVisible((next) => !next)}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function TipsAuth({
  onDone,
  allowRegister = true,
  title,
  description,
}: {
  onDone: () => void;
  allowRegister?: boolean;
  title?: string;
  description?: string;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState({ firstName: "", lastName: "", employeeDisplayName: "", email: "", password: "" });

  const submit = useMutation({
    mutationFn: async () => {
      const path = mode === "login" ? "/api/tips/auth/login" : "/api/tips/auth/register";
      const payload = mode === "login" ? { email: form.email, password: form.password } : form;
      const response = await apiRequest("POST", path, payload);
      return response.json();
    },
    onSuccess: () => onDone(),
    onError: (error: Error) => toast({ title: "Unable to continue", description: error.message, variant: "destructive" }),
  });

  return (
    <div className={`min-h-screen px-4 py-8 ${C.page}`}>
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-6 lg:grid-cols-[1fr_430px]">
        <section className="overflow-hidden rounded-[28px] bg-[#241b16] text-white shadow-[0_24px_70px_rgba(48,34,21,0.28)]">
          <div className="relative p-8 sm:p-10">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#b98435]/25 blur-3xl" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#d7a85b] text-[#22170f]">
              <ReceiptText className="h-6 w-6" />
            </div>
            <div className="relative mt-10 text-xs font-semibold uppercase tracking-[0.28em] text-[#d7b77d]">Courtyard Austin Lakeline Bistro</div>
            <h1 className="relative mt-3 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">Courtyard Tips Tracker</h1>
            <p className="relative mt-4 max-w-xl text-base leading-7 text-[#eadfce]">
              Enter daily tips, attach the sales report photo, review weekly totals, and submit the final pay-period summary.
            </p>
          </div>
        </section>

        <Card className={C.shell}>
          <CardHeader>
            <CardTitle className={C.ink}>{title || (mode === "login" ? "Employee login" : "Create employee account")}</CardTitle>
            <CardDescription className={C.muted}>
              {description || "Use the account your manager created, or register with your own email."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "register" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>First name</Label>
                  <Input className={C.field} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input className={C.field} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Display name</Label>
                  <Input className={C.field} value={form.employeeDisplayName} placeholder="Name shown on summaries" onChange={(event) => setForm({ ...form, employeeDisplayName: event.target.value })} />
                </div>
              </div>
            )}
            <div>
              <Label>Email</Label>
              <Input className={C.field} type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>
            <div>
              <Label>Password</Label>
              <PasswordField
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={form.password}
                onChange={(password) => setForm({ ...form, password })}
              />
            </div>
            <Button className={`w-full ${C.green}`} onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
            </Button>
            {allowRegister && (
              <Button variant="ghost" className="w-full text-[#2f5f46]" onClick={() => setMode(mode === "login" ? "register" : "login")}>
                {mode === "login" ? "Need an account? Register" : "Already registered? Log in"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChangePasswordGate({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ temporaryPassword: "", newPassword: "", confirmPassword: "" });
  const changePassword = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/tips/auth/change-password", form);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Password updated" });
      setForm({ temporaryPassword: "", newPassword: "", confirmPassword: "" });
      onDone();
    },
    onError: (error: Error) => toast({ title: "Password update failed", description: error.message, variant: "destructive" }),
  });

  return (
    <div className={`min-h-screen px-4 py-8 ${C.page}`}>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center">
        <Card className={C.shell}>
          <CardHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#2f5f46] text-white">
              <KeyRound className="h-5 w-5" />
            </div>
            <CardTitle className={C.ink}>Create your new password</CardTitle>
            <CardDescription className={C.muted}>
              Confirm the temporary password you were given, then create your permanent Tips Tracker password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Temporary password</Label>
              <PasswordField value={form.temporaryPassword} autoComplete="current-password" onChange={(temporaryPassword) => setForm({ ...form, temporaryPassword })} />
            </div>
            <div>
              <Label>New password</Label>
              <PasswordField value={form.newPassword} autoComplete="new-password" onChange={(newPassword) => setForm({ ...form, newPassword })} />
            </div>
            <div>
              <Label>Confirm new password</Label>
              <PasswordField value={form.confirmPassword} autoComplete="new-password" onChange={(confirmPassword) => setForm({ ...form, confirmPassword })} />
            </div>
            <Button className={`w-full ${C.green}`} disabled={changePassword.isPending} onClick={() => changePassword.mutate()}>
              {changePassword.isPending ? "Updating..." : "Set new password"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DayEditor({
  day,
  locked,
  onSaved,
  defaultOpen,
}: {
  day: DashboardDay;
  locked: boolean;
  onSaved: () => void;
  defaultOpen?: boolean;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(Boolean(defaultOpen));
  const [creditTips, setCreditTips] = useState(day.entry?.creditTips || day.entry?.tipAmount || "");
  const [grossSales, setGrossSales] = useState(day.entry?.grossSales || "");
  const [shiftType, setShiftType] = useState<TipEntry["shiftType"]>(day.entry?.shiftType || "other");
  const [notes, setNotes] = useState(day.entry?.notes || "");
  const [file, setFile] = useState<File | null>(null);
  const hasReport = !!day.entry?.attachments?.length;
  const isToday = day.date === todayKey();
  const status = getDayStatus(day, locked);
  const StatusIcon = status.icon;

  const save = useMutation({
    mutationFn: async () => {
      if (!file && !hasReport) throw new Error("Add a sales report photo before saving this tip entry.");
      const creditValue = Number(creditTips || 0);
      const response = await apiRequest("POST", "/api/tips/entries", {
        entryDate: day.date,
        tipAmount: creditValue,
        creditTips: creditValue,
        grossSales: Number(grossSales || 0),
        shiftType: shiftType || "other",
        notes,
      });
      const data = await response.json();
      if (file) {
        const uploadFile = await compressSalesReportFile(file);
        const formData = new FormData();
        formData.append("salesReport", uploadFile);
        const uploadResponse = await fetch(apiUrl(`/api/tips/entries/${data.entry.id}/attachment`), { method: "POST", credentials: "include", body: formData });
        if (!uploadResponse.ok) throw new Error(await uploadResponse.text());
      }
      return data;
    },
    onSuccess: () => {
      toast({ title: "Tip entry saved" });
      setFile(null);
      onSaved();
    },
    onError: (error: Error) => toast({ title: "Save failed", description: uploadErrorMessage(error), variant: "destructive" }),
  });

  const attachment = day.entry?.attachments?.[0];

  return (
    <div className={`rounded-xl border bg-white text-[#201814] shadow-sm ${isToday ? "border-[#b98435] ring-2 ring-[#d7a85b]/35" : "border-[#e0d3c1]"}`}>
      <button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setExpanded((value) => !value)}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold">{isToday ? formatTodayLabel(day.date) : formatDisplayDate(day.date)}</div>
            {isToday && <Badge className="bg-[#b98435] text-white">Day {day.dayNumber}</Badge>}
          </div>
          <div className="mt-1 text-sm text-[#5f5247]">
            {formatMoney(day.entry?.tipAmount)} {day.entry ? `- ${formatShiftType(day.entry.shiftType)}` : ""} {day.entry?.grossSales ? `- sales ${formatMoney(day.entry.grossSales)}` : ""}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className={status.className}>
            <StatusIcon className="mr-1 h-3.5 w-3.5" />
            {status.label}
          </Badge>
          <ChevronDown className={`h-4 w-4 text-[#5f5247] transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-[#e0d3c1] p-4">
          <div>
            <Label>Credit card tips from sales report</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f5247]">$</span>
              <Input className={`${C.field} pl-7`} type="number" min="0" step="0.01" value={creditTips} disabled={locked} onChange={(event) => setCreditTips(event.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Gross sales</Label>
              <Input className={C.field} type="number" min="0" step="0.01" value={grossSales} disabled={locked} onChange={(event) => setGrossSales(event.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Shift type</Label>
              <Select value={shiftType || "other"} disabled={locked} onValueChange={(value) => setShiftType(value as TipEntry["shiftType"])}>
                <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                <SelectContent className={C.menu}>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg border border-[#bdd5c3] bg-[#e8f1ea] p-3 text-center text-[#173c25]">
            <div className="text-xs font-semibold uppercase tracking-wide">Personal tip percentage</div>
            <div className="text-2xl font-semibold">
              {formatPercent(Number(grossSales || 0) > 0 ? (Number(creditTips || 0) / Number(grossSales)) * 100 : 0)}
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea className={C.field} value={notes} disabled={locked} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" rows={2} />
          </div>
          <div className="rounded-lg border border-dashed border-[#cbbca7] bg-[#fbf8f3] p-3">
            <Label className="flex items-center gap-2 text-sm font-medium text-[#201814]">
              <Camera className="h-4 w-4" />
              Sales report photo
            </Label>
            {attachment && (
              <a className="mt-2 block text-sm font-medium text-[#2f5f46] underline" href={apiUrl(`/api/tips/attachments/${attachment.id}/view`)} target="_blank" rel="noreferrer">
                View current report: {attachment.originalFileName}
              </a>
            )}
            <Input className={`mt-3 ${C.field}`} type="file" accept="image/*,application/pdf" disabled={locked} onChange={(event) => setFile(event.target.files?.[0] || null)} />
            {file && <div className="mt-2 text-xs text-[#5f5247]">Ready to upload: {file.name}</div>}
            {!attachment && !file && <div className="mt-2 text-xs font-medium text-[#8a4d12]">Required before this tip entry can be saved.</div>}
          </div>
          {!locked && (
            <Button className={`w-full ${C.green}`} onClick={() => save.mutate()} disabled={save.isPending || (!file && !hasReport)}>
              <Upload className="mr-2 h-4 w-4" />
              {save.isPending ? "Saving..." : "Save tip entry"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewDialog({
  dashboard,
  open,
  onOpenChange,
  onSubmitted,
}: {
  dashboard: TipsDashboard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const { toast } = useToast();
  const [confirmed, setConfirmed] = useState(false);
  const missingDays = dashboard.days.filter((day) => !day.entry);
  const missingImages = dashboard.days.filter((day) => day.entry && !day.entry.attachments?.length);
  const submit = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/tips/submissions", { start: dashboard.period.start });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Pay period submitted",
        description: data?.emailSent === false ? data.warning || "The period is locked, but the email notification failed." : "Your summary has been locked and emailed.",
        variant: data?.emailSent === false ? "destructive" : "default",
      });
      onOpenChange(false);
      onSubmitted();
    },
    onError: (error: Error) => toast({ title: "Submission failed", description: error.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto bg-[#fffaf2] text-[#201814]">
        <DialogHeader>
          <DialogTitle>Review pay period</DialogTitle>
          <DialogDescription className="text-[#5f5247]">{formatPeriod(dashboard.period.start, dashboard.period.end)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {(missingDays.length > 0 || missingImages.length > 0) && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {missingDays.length} missing day(s). {missingImages.length} saved day(s) missing sales report photos.
            </div>
          )}
          <div className="divide-y rounded-md border border-[#e0d3c1] bg-white">
            {dashboard.days.map((day) => (
              <div key={day.date} className="grid gap-1 p-3 text-sm md:grid-cols-4">
                <div className="font-medium">{formatDisplayDate(day.date)}</div>
                <div>CC tips {formatMoney(day.entry?.creditTips || day.entry?.tipAmount)}</div>
                <div>Sales {formatMoney(day.entry?.grossSales)}</div>
                <div>{formatShiftType(day.entry?.shiftType)}</div>
                <div>{day.entry?.attachments?.length ? "Photo yes" : "No photo"}</div>
                <div className="text-[#5f5247]">{day.entry?.notes || "No notes"}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-[#f4f0ea] p-3"><div className="text-xs uppercase text-[#78695c]">Week 1</div><div className="text-xl font-semibold">{formatMoney(dashboard.week1Total)}</div></div>
            <div className="rounded-md bg-[#f4f0ea] p-3"><div className="text-xs uppercase text-[#78695c]">Week 2</div><div className="text-xl font-semibold">{formatMoney(dashboard.week2Total)}</div></div>
            <div className="rounded-md bg-[#e8f1ea] p-3"><div className="text-xs uppercase text-[#48644f]">Grand total</div><div className="text-xl font-semibold">{formatMoney(dashboard.totalTips)}</div></div>
          </div>
          <label className="flex gap-3 rounded-md border border-[#e0d3c1] bg-white p-3 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(Boolean(value))} />
            <span>I confirm these tip amounts are accurate to the best of my knowledge and match the uploaded sales reports.</span>
          </label>
          <Button className={`w-full ${C.green}`} disabled={!confirmed || missingImages.length > 0 || submit.isPending} onClick={() => submit.mutate()}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            {submit.isPending ? "Submitting..." : "Submit final pay period"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TipsPinGate({ onUnlocked }: { onUnlocked: () => void }) {
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const login = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/tips/kiosk/login", { pin }),
    onSuccess: () => {
      toast({ title: "Tips grid unlocked" });
      onUnlocked();
    },
    onError: (error: Error) => toast({ title: "Unable to unlock", description: error.message, variant: "destructive" }),
  });
  return (
    <div className={`min-h-screen ${C.page}`}>
      <header className="border-b border-[#deceba] bg-[#fffaf2]/95 px-4 py-5">
        <div className="mx-auto max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Lakeline Bistro</div>
          <h1 className="text-3xl font-semibold tracking-tight">Courtyard Tips Tracker</h1>
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl items-center px-4 py-10">
        <Card className={`w-full ${C.shell}`}>
          <CardHeader>
            <CardTitle className={C.ink}>Enter team PIN</CardTitle>
            <CardDescription className={C.muted}>Use the 5 digit PIN assigned by the super admin to open the shared pay-period tip grid.</CardDescription>
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
              {login.isPending ? "Checking PIN..." : "Open tips grid"}
            </Button>
            <div className="flex justify-center">
              <Button asChild variant="ghost" className="text-[#5f5247]">
                <a href="/tips/admin">Manager or super admin login</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function TipsPortalLoginRequired() {
  return (
    <div className={`min-h-screen ${C.page}`}>
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-8">
        <Card className={`w-full ${C.shell}`}>
          <CardHeader>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Lakeline Bistro</div>
            <CardTitle className={C.ink}>Sign in required</CardTitle>
            <CardDescription className={C.muted}>
              Use the Courtyard Associate Portal first. Bistro associates can then enter the 5 digit PIN for tip reporting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className={`w-full ${C.green}`}><a href="/courtyard">Go to Courtyard portal</a></Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function TipsGridTracker({ currentUser }: { currentUser: TipsUser | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [entrySalesDrafts, setEntrySalesDrafts] = useState<Record<string, string>>({});
  const [salesDrafts, setSalesDrafts] = useState<Record<string, Record<string, string>>>({});
  const [addAssociateOpen, setAddAssociateOpen] = useState(false);
  const [activeEntry, setActiveEntry] = useState<{ userId: string; date: string } | null>(null);
  const [entryModalAmount, setEntryModalAmount] = useState("");
  const [entryModalSales, setEntryModalSales] = useState("");
  const [associateForm, setAssociateForm] = useState({ firstName: "", lastName: "", employeeDisplayName: "", position: "Bistro attendant", email: "" });
  const [selectedPeriodStart, setSelectedPeriodStart] = useState("");
  const [banquetForm, setBanquetForm] = useState({ eventDate: todayKey(), reportType: "banquet_service" as "banquet_service" | "group_breakfast", eventName: "", grossSales: "", banquetTips: "", notes: "" });
  const [banquetFile, setBanquetFile] = useState<File | null>(null);
  const [banquetAssociateIds, setBanquetAssociateIds] = useState<string[]>([]);
  const [editingBanquetId, setEditingBanquetId] = useState<string | null>(null);
  const [banquetOpen, setBanquetOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [expandedAssociateIds, setExpandedAssociateIds] = useState<string[]>([]);
  const { data: grid, isLoading } = useQuery<TipsGrid>({
    queryKey: ["/api/tips/grid", selectedPeriodStart],
    queryFn: () => fetchJson(`/api/tips/grid${selectedPeriodStart ? `?start=${selectedPeriodStart}` : ""}`),
  });
  const addAssociate = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/tips/grid/associates", associateForm);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Associate added to grid" });
      setAssociateForm({ firstName: "", lastName: "", employeeDisplayName: "", position: "Bistro attendant", email: "" });
      setAddAssociateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/tips/grid"] });
    },
    onError: (error: Error) => toast({ title: "Unable to add associate", description: error.message, variant: "destructive" }),
  });
  const saveEntry = useMutation({
    mutationFn: async ({ userId, entryDate, tipAmount, grossSales }: { userId: string; entryDate: string; tipAmount: string; grossSales: string }) => {
      const response = await apiRequest("POST", "/api/tips/grid/entries", { userId, entryDate, tipAmount, grossSales });
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tips/grid"] }),
    onError: (error: Error) => toast({ title: "Tip save failed", description: error.message, variant: "destructive" }),
  });
  const saveSalesDay = useMutation({
    mutationFn: async ({ date, sales }: { date: string; sales: Record<string, string> }) => {
      const response = await apiRequest("POST", "/api/tips/grid/days", { date, ...sales });
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tips/grid"] }),
    onError: (error: Error) => toast({ title: "Sales save failed", description: error.message, variant: "destructive" }),
  });
  const confirmEntry = useMutation({
    mutationFn: async (entryId: string) => apiRequest("POST", `/api/tips/grid/entries/${entryId}/confirm`),
    onSuccess: () => {
      toast({ title: "Tip confirmed" });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/grid"] });
    },
    onError: (error: Error) => toast({ title: "Unable to confirm", description: error.message, variant: "destructive" }),
  });
  const unlockEntry = useMutation({
    mutationFn: async (entryId: string) => apiRequest("POST", `/api/tips/grid/entries/${entryId}/unlock`),
    onSuccess: () => {
      toast({ title: "Entry reopened", description: "Correct the tips or shift sales, save, and confirm the entry again." });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/grid"] });
    },
    onError: (error: Error) => toast({ title: "Unable to reopen entry", description: error.message, variant: "destructive" }),
  });
  const uploadReport = useMutation({
    mutationFn: async ({ date, file }: { date: string; file: File }) => {
      const uploadFile = await compressSalesReportFile(file);
      const form = new FormData();
      form.append("salesReport", uploadFile);
      const response = await fetch(apiUrl(`/api/tips/grid/reports/${date}`), { method: "POST", credentials: "include", body: form });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Sales report uploaded" });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/grid"] });
    },
    onError: (error: Error) => toast({ title: "Upload failed", description: uploadErrorMessage(error), variant: "destructive" }),
  });
  const addBanquetReport = useMutation({
    mutationFn: async () => {
      const payload = {
        eventDate: banquetForm.eventDate,
        reportType: banquetForm.reportType,
        eventName: banquetForm.eventName,
        grossSales: banquetForm.grossSales || "0",
        banquetTips: banquetForm.banquetTips || "0",
        assignedUserIds: banquetAssociateIds,
        notes: banquetForm.notes || "",
      };
      if (editingBanquetId) {
        const response = await apiRequest("PATCH", `/api/tips/grid/banquet-reports/${editingBanquetId}`, payload);
        return response.json();
      }
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => form.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value)));
      if (banquetFile) form.append("banquetReport", await compressSalesReportFile(banquetFile));
      const response = await fetch(apiUrl("/api/tips/grid/banquet-reports"), { method: "POST", credentials: "include", body: form });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      toast({ title: editingBanquetId ? "Banquet report updated" : "Banquet tips added" });
      setBanquetForm({ eventDate: grid?.period.start || todayKey(), reportType: "banquet_service", eventName: "", grossSales: "", banquetTips: "", notes: "" });
      setBanquetFile(null);
      setBanquetAssociateIds([]);
      setEditingBanquetId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/tips/grid", selectedPeriodStart] });
    },
    onError: (error: Error) => toast({ title: "Banquet report failed", description: uploadErrorMessage(error), variant: "destructive" }),
  });
  const submitGrid = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/tips/grid/submit", { start: grid?.period.start });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Pay period submitted",
        description: data?.emailSent === false ? data.warning || "Submitted, but email could not be sent." : "The GM notification email was sent.",
        variant: data?.emailSent === false ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/grid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/admin/submissions"] });
    },
    onError: (error: Error) => toast({ title: "Submission failed", description: error.message, variant: "destructive" }),
  });
  const kioskLogout = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tips/kiosk/logout"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tips/kiosk/status"] });
      queryClient.removeQueries({ queryKey: ["/api/tips/grid"] });
    },
  });

  if (isLoading || !grid) return <div className="text-sm text-[#5f5247]">Loading tips grid...</div>;

  const canReopenEntry = !grid.locked;
  const missingReportDays = grid.dayTotals.filter((day) => Number(day.totalTips) > 0 && !day.report);
  const missingSalesDays = grid.dayTotals.filter((day) => Number(day.totalTips) > 0 && Number(day.grossSales) <= 0);
  const unconfirmedCount = grid.rows.reduce((count, row) => count + row.cells.filter((cell) => Number(cell.tipAmount) > 0 && !cell.confirmed).length, 0);
  const enteredDays = grid.dayTotals.filter((day) => Number(day.totalTips) > 0).length;
  const week1Days = grid.period.days.slice(0, 7);
  const week2Days = grid.period.days.slice(7, 14);
  const dayTotal = (date: string) => grid.dayTotals.find((day) => day.date === date);
  const cellValue = (row: TipsGridRow, cell: TipsGridCell) => drafts[`${row.associate.id}:${cell.date}`] ?? cell.tipAmount;
  const cellSalesValue = (row: TipsGridRow, cell: TipsGridCell) => entrySalesDrafts[`${row.associate.id}:${cell.date}`] ?? cell.grossSales;
  const personalTipPercent = (row: TipsGridRow, cell: TipsGridCell) => {
    const sales = Number(cellSalesValue(row, cell) || 0);
    return sales > 0 ? (Number(cellValue(row, cell) || 0) / sales) * 100 : 0;
  };
  const associateTipTotal = (row: TipsGridRow, days: string[]) => (
    days.reduce((sum, date) => {
      const cell = row.cells.find((item) => item.date === date);
      return sum + Number(cell ? cellValue(row, cell) : 0);
    }, 0)
  );
  const salesFieldValue = (date: string, field: keyof TipsGrid["dayTotals"][number]) => salesDrafts[date]?.[field as string] ?? String(dayTotal(date)?.[field] ?? "0.00");
  const canManageSales = Boolean(grid.canManageSales);
  const banquetRate = banquetForm.reportType === "group_breakfast" ? 0.18 : 0.21;
  const computedBanquetTips = Number(banquetForm.banquetTips || 0) > 0 ? Number(banquetForm.banquetTips || 0) : Number(banquetForm.grossSales || 0) * banquetRate;
  const banquetSplitAmount = banquetAssociateIds.length ? computedBanquetTips / banquetAssociateIds.length : 0;
  const toggleBanquetAssociate = (userId: string) => {
    setBanquetAssociateIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
  };
  const toggleAssociateRow = (userId: string) => {
    setExpandedAssociateIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
  };
  const startEditBanquetReport = (report: TipsGrid["banquetReports"][number]) => {
    setEditingBanquetId(report.id);
    setBanquetOpen(true);
    setBanquetForm({
      eventDate: report.eventDate,
      reportType: report.reportType || "banquet_service",
      eventName: report.eventName,
      grossSales: report.grossSales,
      banquetTips: report.banquetTips,
      notes: report.notes || "",
    });
    setBanquetAssociateIds((report.assignedAssociatesJson || []).map((associate) => associate.userId));
    setBanquetFile(null);
  };
  const clearBanquetForm = () => {
    setEditingBanquetId(null);
    setBanquetForm({ eventDate: grid.period.start, reportType: "banquet_service", eventName: "", grossSales: "", banquetTips: "", notes: "" });
    setBanquetAssociateIds([]);
    setBanquetFile(null);
  };
  const commitCell = (row: TipsGridRow, cell: TipsGridCell) => {
    const tipAmount = cellValue(row, cell);
    const grossSales = cellSalesValue(row, cell);
    if ((tipAmount === cell.tipAmount && grossSales === cell.grossSales) || grid.locked || cell.confirmed) return;
    saveEntry.mutate({ userId: row.associate.id, entryDate: cell.date, tipAmount: tipAmount || "0", grossSales: grossSales || "0" });
  };
  const commitSales = (date: string) => {
    if (grid.locked || !canManageSales) return;
    const sales = {
      grossSales: salesFieldValue(date, "grossSales") || "0",
      taxAmount: salesFieldValue(date, "taxAmount") || "0",
      beerSales: salesFieldValue(date, "beerSales") || "0",
      liquorSales: salesFieldValue(date, "liquorSales") || "0",
      foodSales: salesFieldValue(date, "foodSales") || "0",
      wineSales: salesFieldValue(date, "wineSales") || "0",
    };
    saveSalesDay.mutate({ date, sales });
  };
  const activeRow = activeEntry ? grid.rows.find((row) => row.associate.id === activeEntry.userId) : null;
  const activeCell = activeRow && activeEntry ? activeRow.cells.find((cell) => cell.date === activeEntry.date) : null;
  const openEntryModal = (row: TipsGridRow, cell: TipsGridCell) => {
    setActiveEntry({ userId: row.associate.id, date: cell.date });
    setEntryModalAmount(cellValue(row, cell));
    setEntryModalSales(cellSalesValue(row, cell));
  };
  const saveEntryModal = () => {
    if (!activeRow || !activeCell || grid.locked || activeCell.confirmed) return;
    saveEntry.mutate({
      userId: activeRow.associate.id,
      entryDate: activeCell.date,
      tipAmount: entryModalAmount || "0",
      grossSales: entryModalSales || "0",
    });
    setDrafts((current) => ({ ...current, [`${activeRow.associate.id}:${activeCell.date}`]: entryModalAmount || "0" }));
    setEntrySalesDrafts((current) => ({ ...current, [`${activeRow.associate.id}:${activeCell.date}`]: entryModalSales || "0" }));
    setActiveEntry(null);
  };
  const renderSalesInput = (date: string, field: "grossSales" | "taxAmount" | "beerSales" | "liquorSales" | "foodSales" | "wineSales", label: string) => (
    <div>
      <Label className="text-xs text-[#5f5247]">{label}</Label>
      <Input
        className={`${C.field} h-9 text-right`}
        inputMode="decimal"
        disabled={grid.locked || !canManageSales}
        value={salesFieldValue(date, field)}
        onChange={(event) => setSalesDrafts((current) => ({
          ...current,
          [date]: {
            ...(current[date] || {}),
            [field]: event.target.value.replace(/[^0-9.]/g, ""),
          },
        }))}
        onBlur={() => commitSales(date)}
      />
    </div>
  );

  const renderDayControls = (date: string) => {
    const totalForDay = dayTotal(date);
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-[#e0d3c1] bg-white px-3 py-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#5f5247]">Net sales</span>
            <span className="font-semibold text-[#201814]">{formatMoney(totalForDay?.netSales)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-[#5f5247]">
            <span>Gross {formatMoney(totalForDay?.grossSales)}</span>
            <span>Tax {formatMoney(totalForDay?.taxAmount)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-[#5f5247]">
          <span>Tip % {formatPercent(totalForDay?.tipPercent)}</span>
          <span>{formatMoney(totalForDay?.totalTips)} tips</span>
        </div>
        {totalForDay?.splitCount === 2 && (
          <div className="rounded-md border border-[#bdd5c3] bg-[#e8f1ea] px-3 py-2 text-sm text-[#173c25]">
            50/50 split: {formatMoney(totalForDay.splitAmount)} each
          </div>
        )}
        <label className={`flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm ${totalForDay?.report ? "border-emerald-300 bg-emerald-50 text-emerald-800" : Number(totalForDay?.totalTips || 0) > 0 ? "border-amber-300 bg-amber-50 text-amber-900" : "border-[#d7c8b5] bg-white text-[#5f5247]"}`}>
          <Camera className="mr-2 h-4 w-4" />
          {totalForDay?.report ? "Sales report attached" : "Upload sales report"}
          <input
            type="file"
            className="hidden"
            accept="image/*,application/pdf"
            disabled={grid.locked}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadReport.mutate({ date, file });
              event.currentTarget.value = "";
            }}
          />
        </label>
        {totalForDay?.report && (
          <a className="block text-center text-sm font-medium text-[#2f5f46] underline" href={apiUrl(`/api/tips/grid/reports/${totalForDay.report.id}/view`)} target="_blank" rel="noreferrer">
            View sales report
          </a>
        )}
      </div>
    );
  };

  const renderMobileWeek = (days: string[], title: string, total: string) => (
    <Card className={`${C.shell} md:hidden`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className={C.ink}>{title}</CardTitle>
            <CardDescription className={C.muted}>{formatDisplayDate(days[0], "long")} - {formatDisplayDate(days[days.length - 1], "long")}</CardDescription>
          </div>
          <Badge variant="outline" className="border-[#d7c8b5] bg-white text-[#5f5247]">{formatMoney(total)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {days.map((date) => {
          const totalForDay = dayTotal(date);
          return (
            <div key={date} className={`rounded-xl border p-4 ${date === todayKey() ? "border-[#b98435] bg-[#fff3d8]" : "border-[#e0d3c1] bg-white"}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-[#201814]">{date === todayKey() ? "Today" : formatDisplayDate(date).split(",")[0]}</div>
                  <div className="text-sm text-[#5f5247]">{formatDisplayDate(date).replace(/^\w+,\s*/, "")}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-[#173c25]">{formatMoney(totalForDay?.totalTips)}</div>
                  <div className="text-xs text-[#5f5247]">{formatPercent(totalForDay?.tipPercent)}</div>
                </div>
              </div>
              {renderDayControls(date)}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-[#201814]">Associates</div>
                  <Button type="button" size="sm" variant="outline" className={`h-8 ${C.outline}`} onClick={() => setAddAssociateOpen(true)}>
                    <UserPlus className="mr-1 h-4 w-4" />
                    Add
                  </Button>
                </div>
                {grid.rows.map((row) => {
                  const cell = row.cells.find((item) => item.date === date)!;
                  return (
                    <button
                      key={`${row.associate.id}-${date}`}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#e0d3c1] bg-[#fffaf2] p-3 text-left"
                      onClick={() => openEntryModal(row, cell)}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-[#201814]">{row.associate.employeeDisplayName}</div>
                        <div className="truncate text-xs text-[#5f5247]">{row.associate.position || "Associate"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-[#201814]">{formatMoney(cellValue(row, cell))}</div>
                        <div className="text-xs text-[#5f5247]">Sales {formatMoney(cellSalesValue(row, cell))}</div>
                        <div className="text-xs font-semibold text-[#2f5f46]">Personal {formatPercent(personalTipPercent(row, cell))}</div>
                        <div className={`text-xs ${cell.confirmed ? "text-emerald-700" : Number(cellValue(row, cell)) > 0 ? "text-amber-800" : "text-[#5f5247]"}`}>
                          {cell.confirmed ? "Confirmed" : Number(cellValue(row, cell)) > 0 ? "Needs confirm" : "Tap to enter"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );

  const renderWeekTable = (days: string[], title: string, total: string) => (
    <Card className={`${C.shell} hidden md:block`}>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className={C.ink}>{title}</CardTitle>
            <CardDescription className={C.muted}>{formatDisplayDate(days[0], "long")} - {formatDisplayDate(days[days.length - 1], "long")}</CardDescription>
          </div>
          <Badge variant="outline" className="border-[#d7c8b5] bg-white text-[#5f5247]">{formatMoney(total)}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-[#ddccb5] bg-white">
          <table className="w-full table-fixed border-collapse text-xs">
            <colgroup>
              <col className="w-[16%]" />
              {days.map((date) => <col key={date} className="w-[11.2%]" />)}
              <col className="w-[5.6%]" />
            </colgroup>
            <thead>
              <tr className="bg-[#fbf6ee] text-left">
                <th className="border-b border-r border-[#e0d3c1] bg-[#fbf6ee] p-2 align-top">
                  <div className="font-semibold text-[#201814]">Daily sales report</div>
                  <div className="mt-1 text-xs font-normal text-[#5f5247]">
                    Gross sales, tip %, and report upload apply to the whole day.
                  </div>
                </th>
                {days.map((date) => {
                  const totalForDay = dayTotal(date);
                  const isToday = date === todayKey();
                  return (
                    <th key={date} className={`border-b border-r border-[#e0d3c1] p-1.5 align-top ${isToday ? "bg-[#fff3d8]" : ""}`}>
                      <div className="font-semibold">{isToday ? "Today" : formatDisplayDate(date).split(",")[0]}</div>
                      <div className="text-xs text-[#5f5247]">{formatDisplayDate(date).replace(/^\w+,\s*/, "")}</div>
                      <div className="mt-2 space-y-1">
                        <div className="rounded-md border border-[#e0d3c1] bg-white px-2 py-1 text-xs text-[#5f5247]">
                          <div className="flex justify-between gap-2"><span>Gross</span><span>{formatMoney(totalForDay?.grossSales)}</span></div>
                          <div className="flex justify-between gap-2"><span>Tax</span><span>{formatMoney(totalForDay?.taxAmount)}</span></div>
                          <div className="flex justify-between gap-2 font-semibold text-[#201814]"><span>Net</span><span>{formatMoney(totalForDay?.netSales)}</span></div>
                        </div>
                        <div className="text-center text-xs text-[#5f5247]">Tip % {formatPercent(totalForDay?.tipPercent)}</div>
                        {totalForDay?.splitCount === 2 && (
                          <div className="rounded-md border border-[#bdd5c3] bg-[#e8f1ea] px-2 py-1 text-center text-xs text-[#173c25]">
                            50/50: {formatMoney(totalForDay.splitAmount)}
                          </div>
                        )}
                        <label className={`flex cursor-pointer items-center justify-center rounded-md border px-2 py-1 text-xs ${totalForDay?.report ? "border-emerald-300 bg-emerald-50 text-emerald-800" : Number(totalForDay?.totalTips || 0) > 0 ? "border-amber-300 bg-amber-50 text-amber-900" : "border-[#d7c8b5] bg-white text-[#5f5247]"}`}>
                          <Camera className="mr-1 h-3 w-3" />
                          {totalForDay?.report ? "Report" : "Upload"}
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,application/pdf"
                            disabled={grid.locked}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) uploadReport.mutate({ date, file });
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        {totalForDay?.report && (
                          <a className="block truncate text-center text-xs text-[#2f5f46] underline" href={apiUrl(`/api/tips/grid/reports/${totalForDay.report.id}/view`)} target="_blank" rel="noreferrer">
                            View
                          </a>
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="border-b border-[#e0d3c1] p-2 text-right">{title} total</th>
              </tr>
              <tr className="sticky top-0 z-30 bg-[#f4eadb] text-left shadow-sm">
                <th className="sticky left-0 z-40 border-b border-r border-[#e0d3c1] bg-[#f4eadb] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>Bistro associate</span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={`h-7 px-2 text-[10px] ${C.outline}`}
                        onClick={() => setExpandedAssociateIds(
                          grid.rows.every((row) => expandedAssociateIds.includes(row.associate.id))
                            ? []
                            : grid.rows.map((row) => row.associate.id),
                        )}
                      >
                        {grid.rows.every((row) => expandedAssociateIds.includes(row.associate.id)) ? "Collapse all" : "Expand all"}
                      </Button>
                      <Button type="button" size="sm" variant="outline" className={`h-7 w-7 p-0 ${C.outline}`} onClick={() => setAddAssociateOpen(true)} aria-label="Add Bistro associate">
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </th>
                {days.map((date) => {
                  const isToday = date === todayKey();
                  return (
                  <th key={`entry-${date}`} className={`border-b border-r border-[#e0d3c1] p-2 text-center font-semibold ${isToday ? "bg-[#fff3d8] text-[#7a4b00]" : "text-[#5f5247]"}`}>
                    <div>{isToday ? "Today" : formatDisplayDate(date).split(",")[0]}</div>
                    <div className="text-[10px] font-normal">{formatDisplayDate(date).replace(/^\w+,\s*/, "")}</div>
                  </th>
                );})}
                <th className="border-b border-[#e0d3c1] p-2 text-right">{title} total</th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => {
                const expanded = expandedAssociateIds.includes(row.associate.id);
                return (
                <tr key={`${title}-${row.associate.id}`} className="odd:bg-white even:bg-[#fffaf2]">
                  <td className="sticky left-0 z-10 border-r border-t border-[#e0d3c1] bg-inherit p-2">
                    <button type="button" className="flex w-full items-start justify-between gap-1 text-left" onClick={() => toggleAssociateRow(row.associate.id)}>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[#201814]">{row.associate.employeeDisplayName}</span>
                        <span className="block truncate text-[10px] text-[#5f5247]">{row.associate.position || "Associate"}</span>
                      </span>
                      <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-[#5f5247] transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                  </td>
                  {days.map((date) => {
                    const cell = row.cells.find((item) => item.date === date)!;
                    const lockedCell = grid.locked || cell.confirmed;
                    return (
                      <td key={`${row.associate.id}-${date}`} className="border-r border-t border-[#e0d3c1] p-1.5 align-top">
                        {expanded ? <div className="space-y-1.5">
                          <div>
                            <div className="mb-1 text-[10px] font-semibold uppercase text-[#5f5247]">CC tips</div>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#5f5247]">$</span>
                              <Input
                                className={`${C.field} h-8 px-1 pl-4 text-right text-xs`}
                                inputMode="decimal"
                                disabled={lockedCell}
                                value={cellValue(row, cell)}
                                onChange={(event) => setDrafts((current) => ({ ...current, [`${row.associate.id}:${cell.date}`]: event.target.value.replace(/[^0-9.]/g, "") }))}
                                onBlur={() => commitCell(row, cell)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") event.currentTarget.blur();
                                }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 text-[10px] font-semibold uppercase text-[#5f5247]">Shift sales</div>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#5f5247]">$</span>
                              <Input
                                className={`${C.field} h-8 px-1 pl-4 text-right text-xs`}
                                inputMode="decimal"
                                disabled={lockedCell}
                                value={cellSalesValue(row, cell)}
                                onChange={(event) => setEntrySalesDrafts((current) => ({ ...current, [`${row.associate.id}:${cell.date}`]: event.target.value.replace(/[^0-9.]/g, "") }))}
                                onBlur={() => commitCell(row, cell)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") event.currentTarget.blur();
                                }}
                              />
                            </div>
                          </div>
                          <div className="rounded-md bg-[#e8f1ea] px-1 py-1 text-center text-[10px] font-semibold text-[#173c25]">
                            Personal tip % {formatPercent(personalTipPercent(row, cell))}
                          </div>
                        </div> : (
                          <button type="button" className="w-full rounded-md p-1 text-center hover:bg-[#f4eadb]" onClick={() => toggleAssociateRow(row.associate.id)}>
                            <div className="font-semibold text-[#201814]">{formatMoney(cellValue(row, cell))}</div>
                            <div className="text-[10px] text-[#5f5247]">Sales {formatMoney(cellSalesValue(row, cell))}</div>
                            {Number(cellValue(row, cell)) > 0 && <div className="text-[10px] font-semibold text-[#2f5f46]">{formatPercent(personalTipPercent(row, cell))}</div>}
                          </button>
                        )}
                        {expanded && <div className="mt-1.5 min-h-7">
                          {cell.confirmed ? (
                            canReopenEntry && cell.entryId ? (
                              <Button type="button" size="sm" variant="outline" className={`h-7 w-full text-xs ${C.outline}`} onClick={() => unlockEntry.mutate(cell.entryId!)}>
                                Reopen to correct
                              </Button>
                            ) : (
                              <Badge variant="outline" className="w-full justify-center border-emerald-300 bg-emerald-50 text-emerald-800">Confirmed</Badge>
                            )
                          ) : Number(cellValue(row, cell)) > 0 && Number(dayTotal(cell.date)?.grossSales) > 0 && cell.entryId ? (
                            <Button type="button" size="sm" className={`h-7 w-full text-xs ${C.green}`} onClick={() => confirmEntry.mutate(cell.entryId!)}>
                              Confirm
                            </Button>
                          ) : Number(cellValue(row, cell)) > 0 ? (
                            <div className="text-center text-[10px] text-amber-800">Enter shared card sales to confirm</div>
                          ) : null}
                        </div>}
                      </td>
                    );
                  })}
                  <td className="border-t border-[#e0d3c1] bg-[#f8f1e7] p-1.5 text-right font-semibold text-[#201814]">
                    {formatMoney(associateTipTotal(row, days))}
                  </td>
                </tr>
              );})}
              <tr className="bg-[#e8f1ea] font-semibold text-[#173c25]">
                <td className="sticky left-0 z-10 border-r border-t border-[#bdd5c3] bg-[#e8f1ea] p-3">Daily total</td>
                {days.map((date) => (
                  <td key={date} className="border-r border-t border-[#bdd5c3] p-3 text-right">
                    <div>{formatMoney(dayTotal(date)?.totalTips)}</div>
                    <div className="text-xs font-normal">{formatPercent(dayTotal(date)?.tipPercent)}</div>
                  </td>
                ))}
                <td className="border-t border-[#bdd5c3] p-3 text-right">{formatMoney(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card className={C.shell}>
          <CardHeader>
            <CardTitle className={C.ink}>Current pay period</CardTitle>
            <CardDescription className={C.muted}>{formatPeriod(grid.period.start, grid.period.end)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <StatCard label="Day" value={`${grid.period.dayNumber}/14`} />
              <StatCard label="Week 1" value={formatMoney(grid.week1Total)} />
              <StatCard label="Week 2" value={formatMoney(grid.week2Total)} />
              <StatCard label="Total" value={formatMoney(grid.totalTips)} tone="green" />
            </div>
            <div className="rounded-lg border border-[#d7c8b5] bg-white p-3 text-sm text-[#5f5247]">
              Bistro CC tips only. Banquet/meeting tips are tracked separately below and do not change the Bistro grid total.
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-[#5f5247]">
              <Badge variant="outline" className="border-[#d7c8b5] bg-white text-[#5f5247]">{enteredDays} days with CC tips</Badge>
              <Badge variant="outline" className={missingReportDays.length ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-800"}>
                {missingReportDays.length} missing sales reports
              </Badge>
              <Badge variant="outline" className={unconfirmedCount ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-800"}>
                {unconfirmedCount} unconfirmed entries
              </Badge>
              <Badge variant="outline" className={missingSalesDays.length ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-800"}>
                {missingSalesDays.length} days missing sales
              </Badge>
              {grid.locked && <Badge className="bg-[#1f2937] text-white">Submitted and locked</Badge>}
            </div>
          </CardContent>
        </Card>

        <Card className={C.shell}>
          <CardHeader>
            <CardTitle className={C.ink}>Actions</CardTitle>
            <CardDescription className={C.muted}>Final submission emails the pay-period totals to cory.armer@marriott.com.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className={`w-full ${C.outline}`} onClick={() => setAddAssociateOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add associate to grid
            </Button>
            <Button className={`w-full ${C.green}`} disabled={grid.locked || submitGrid.isPending || missingReportDays.length > 0 || missingSalesDays.length > 0 || unconfirmedCount > 0} onClick={() => submitGrid.mutate()}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {submitGrid.isPending ? "Submitting..." : "Submit final tips"}
            </Button>
            <Button asChild variant="outline" className={`w-full ${C.outline}`}>
              <a href={apiUrl(`/api/tips/grid/pdf?start=${grid.period.start}`)}>
                <Download className="mr-2 h-4 w-4" />
                Download grid PDF
              </a>
            </Button>
            {!currentUser?.isAdmin && (
              <Button variant="ghost" className="w-full text-[#5f5247]" onClick={() => kioskLogout.mutate()}>
                <LogOut className="mr-2 h-4 w-4" />
                Lock grid
              </Button>
            )}
            {missingReportDays.length > 0 && <div className="text-sm text-amber-900">Upload a sales report image for every day with entered tips before submitting.</div>}
            {missingSalesDays.length > 0 && <div className="text-sm text-amber-900">For each day with tips, enter the shared card sales under one associate before submitting.</div>}
            {unconfirmedCount > 0 && <div className="text-sm text-amber-900">Each associate must confirm their entered tip amount before final submission.</div>}
          </CardContent>
        </Card>
      </div>

      <Card className={C.shell}>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className={C.ink}>Bistro sales</CardTitle>
              <CardDescription className={C.muted}>
                Daily gross sales are summed automatically from all associate shift entries. Managers can enter tax and sales-category totals. Full-day tip percentage uses net sales after tax.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" className={`${C.outline} shrink-0`} onClick={() => setSalesOpen((open) => !open)} aria-expanded={salesOpen}>
              <ChevronDown className={`mr-2 h-4 w-4 transition-transform ${salesOpen ? "rotate-180" : ""}`} />
              {salesOpen ? "Hide sales" : "Show sales"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Period gross" value={formatMoney(grid.salesTotals.period.grossSales)} />
            <StatCard label="Tax deducted" value={formatMoney(grid.salesTotals.period.taxAmount)} />
            <StatCard label="Period net" value={formatMoney(grid.salesTotals.period.netSales)} tone="green" />
            <StatCard label="Month net" value={formatMoney(grid.salesTotals.month.netSales)} />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-[#e0d3c1] bg-white p-3 text-sm">
              <div className="text-[#5f5247]">Food</div>
              <div className="text-xl font-semibold text-[#201814]">{formatMoney(grid.salesTotals.period.foodSales)}</div>
            </div>
            <div className="rounded-lg border border-[#e0d3c1] bg-white p-3 text-sm">
              <div className="text-[#5f5247]">Beer</div>
              <div className="text-xl font-semibold text-[#201814]">{formatMoney(grid.salesTotals.period.beerSales)}</div>
            </div>
            <div className="rounded-lg border border-[#e0d3c1] bg-white p-3 text-sm">
              <div className="text-[#5f5247]">Liquor</div>
              <div className="text-xl font-semibold text-[#201814]">{formatMoney(grid.salesTotals.period.liquorSales)}</div>
            </div>
            <div className="rounded-lg border border-[#e0d3c1] bg-white p-3 text-sm">
              <div className="text-[#5f5247]">Wine</div>
              <div className="text-xl font-semibold text-[#201814]">{formatMoney(grid.salesTotals.period.wineSales)}</div>
            </div>
          </div>
          {!canManageSales && (
            <div className="rounded-lg border border-[#bdd5c3] bg-[#e8f1ea] p-3 text-sm text-[#173c25]">
              Associates enter their own shift sales with their tips. Tax and sales-category reconciliation is limited to management.
            </div>
          )}
          {salesOpen && (
            <div className="grid gap-3 lg:grid-cols-2">
              {[week1Days, week2Days].map((days, index) => (
                <div key={index} className="rounded-xl border border-[#ddccb5] bg-white">
                  <div className="border-b border-[#e0d3c1] bg-[#fbf6ee] p-3 font-semibold text-[#201814]">Week {index + 1} sales</div>
                  <div className="divide-y divide-[#e0d3c1]">
                    {days.map((date) => {
                      const totalForDay = dayTotal(date);
                      return (
                        <div key={date} className="space-y-3 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold text-[#201814]">{date === todayKey() ? formatTodayLabel(date) : formatDisplayDate(date, "long")}</div>
                              <div className="text-xs text-[#5f5247]">Net {formatMoney(totalForDay?.netSales)} | Tip % {formatPercent(totalForDay?.tipPercent)}</div>
                            </div>
                            <Button type="button" size="sm" variant="outline" className={C.outline} disabled={grid.locked || !canManageSales || saveSalesDay.isPending} onClick={() => commitSales(date)}>
                              Save
                            </Button>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="rounded-md border border-[#e0d3c1] bg-[#fbf6ee] p-2">
                              <div className="text-xs text-[#5f5247]">Gross from associate shifts</div>
                              <div className="text-lg font-semibold text-[#201814]">{formatMoney(totalForDay?.grossSales)}</div>
                            </div>
                            {renderSalesInput(date, "taxAmount", "Tax")}
                            {renderSalesInput(date, "foodSales", "Food")}
                            {renderSalesInput(date, "beerSales", "Beer")}
                            {renderSalesInput(date, "liquorSales", "Liquor")}
                            {renderSalesInput(date, "wineSales", "Wine")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={C.shell}>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className={C.ink}>Banquet and group breakfast tips</CardTitle>
              <CardDescription className={C.muted}>Track meeting service fees at 21% and group breakfast payouts at 18% for selected associates.</CardDescription>
            </div>
            <Button type="button" variant="outline" className={`${C.outline} shrink-0`} onClick={() => setBanquetOpen((open) => !open)} aria-expanded={banquetOpen}>
              <ChevronDown className={`mr-2 h-4 w-4 transition-transform ${banquetOpen ? "rotate-180" : ""}`} />
              {banquetOpen ? "Hide banquet" : "Show banquet"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <Label>Pay period lookup</Label>
              <Input className={C.field} type="date" value={grid.period.start} onChange={(event) => setSelectedPeriodStart(event.target.value)} />
            </div>
            <Button type="button" variant="outline" className={C.outline} onClick={() => setSelectedPeriodStart(addDaysKey(grid.period.start, -14))}>Previous period</Button>
            <Button type="button" variant="outline" className={C.outline} onClick={() => setSelectedPeriodStart(addDaysKey(grid.period.start, 14))}>Next period</Button>
          </div>
          {banquetOpen && (
            <>
              <div className="grid gap-3 lg:grid-cols-[170px_150px_1fr_150px_150px]">
                <div>
                  <Label>Report type</Label>
                  <Select value={banquetForm.reportType} disabled={grid.locked} onValueChange={(reportType: "banquet_service" | "group_breakfast") => setBanquetForm({ ...banquetForm, reportType, banquetTips: "" })}>
                    <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                    <SelectContent className={C.menu}>
                      <SelectItem value="banquet_service">Meeting service fee</SelectItem>
                      <SelectItem value="group_breakfast">Group breakfast</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Event date</Label>
                  <Input className={C.field} type="date" value={banquetForm.eventDate} disabled={grid.locked} onChange={(event) => setBanquetForm({ ...banquetForm, eventDate: event.target.value })} />
                </div>
                <div>
                  <Label>{banquetForm.reportType === "group_breakfast" ? "Group / breakfast name" : "Event / meeting name"}</Label>
                  <Input className={C.field} placeholder="Meeting or group name" value={banquetForm.eventName} disabled={grid.locked} onChange={(event) => setBanquetForm({ ...banquetForm, eventName: event.target.value })} />
                </div>
                <div>
                  <Label>{banquetForm.reportType === "group_breakfast" ? "Breakfast amount" : "Service fee base"}</Label>
                  <Input className={C.field} inputMode="decimal" placeholder="0.00" value={banquetForm.grossSales} disabled={grid.locked} onChange={(event) => setBanquetForm({ ...banquetForm, grossSales: event.target.value.replace(/[^0-9.]/g, ""), banquetTips: "" })} />
                </div>
                <div>
                  <Label>Calculated tips</Label>
                  <Input className={C.field} inputMode="decimal" placeholder="0.00" value={banquetForm.banquetTips || computedBanquetTips.toFixed(2)} disabled={grid.locked} onChange={(event) => setBanquetForm({ ...banquetForm, banquetTips: event.target.value.replace(/[^0-9.]/g, "") })} />
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_260px_auto_auto]">
                <div>
                  <Label>Notes</Label>
                  <Input className={C.field} placeholder="Optional" value={banquetForm.notes} disabled={grid.locked} onChange={(event) => setBanquetForm({ ...banquetForm, notes: event.target.value })} />
                </div>
                <div>
                  <Label>Report file</Label>
                  <Input className={C.field} type="file" accept="image/*,application/pdf" disabled={grid.locked || Boolean(editingBanquetId)} onChange={(event) => setBanquetFile(event.target.files?.[0] || null)} />
                </div>
                <div className="flex items-end">
                  <Button className={`w-full ${C.green}`} disabled={grid.locked || addBanquetReport.isPending || !banquetForm.eventDate || !banquetForm.eventName.trim() || computedBanquetTips <= 0} onClick={() => addBanquetReport.mutate()}>
                    <ReceiptText className="mr-2 h-4 w-4" />
                    {addBanquetReport.isPending ? "Saving..." : editingBanquetId ? "Save changes" : "Add report"}
                  </Button>
                </div>
                {editingBanquetId && <div className="flex items-end"><Button type="button" variant="outline" className={`w-full ${C.outline}`} onClick={clearBanquetForm}>Cancel edit</Button></div>}
              </div>
              <div className="rounded-xl border border-[#ddccb5] bg-white p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold text-[#201814]">Associates who worked</div>
                    <div className="text-sm text-[#5f5247]">Select one or more associates to split this payout evenly.</div>
                  </div>
                  <Badge variant="outline" className="border-[#bdd5c3] bg-[#e8f1ea] text-[#173c25]">
                    {banquetAssociateIds.length ? `${banquetAssociateIds.length} selected | ${formatMoney(banquetSplitAmount)} each` : "No split assigned"}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {grid.banquetAssociates.map((associate) => (
                    <label key={associate.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${banquetAssociateIds.includes(associate.id) ? "border-[#2f5f46] bg-[#e8f1ea]" : "border-[#e0d3c1] bg-[#fffaf2]"}`}>
                      <Checkbox checked={banquetAssociateIds.includes(associate.id)} disabled={grid.locked} onCheckedChange={() => toggleBanquetAssociate(associate.id)} />
                      <span>
                        <span className="block font-semibold text-[#201814]">{associate.employeeDisplayName}</span>
                        <span className="block text-xs text-[#5f5247]">{[associate.department, associate.position].filter(Boolean).join(" | ")}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="rounded-lg border border-[#e0d3c1] bg-white">
            <button type="button" className="flex w-full items-center justify-between border-b border-[#e0d3c1] p-3 text-left" onClick={() => setBanquetOpen((open) => !open)}>
              <div className="font-semibold text-[#201814]">Banquet report total</div>
              <Badge variant="outline" className="border-[#bdd5c3] bg-[#e8f1ea] text-[#173c25]">{formatMoney(grid.banquetTotal)}</Badge>
            </button>
            {(grid.banquetReports || []).length ? (
              <div className="divide-y divide-[#e0d3c1]">
                {(grid.banquetReports || []).map((report) => (
                  <div key={report.id} className="grid w-full gap-2 p-3 text-left text-sm hover:bg-[#fbf6ee] md:grid-cols-[140px_150px_1fr_120px_120px_auto_auto]">
                    <div className="font-medium">{formatDisplayDate(report.eventDate)}</div>
                    <div>{report.reportType === "group_breakfast" ? "Group breakfast" : "Meeting service"}</div>
                    <div>
                      <div className="font-semibold text-[#201814]">{report.eventName}</div>
                      {report.notes && <div className="text-[#5f5247]">{report.notes}</div>}
                      {report.assignedAssociatesJson?.length ? (
                        <div className="mt-1 text-xs text-[#5f5247]">
                          Split: {report.assignedAssociatesJson.map((associate) => `${associate.displayName} ${formatMoney(associate.splitAmount)}`).join(" | ")}
                        </div>
                      ) : null}
                    </div>
                    <div>Sales {formatMoney(report.grossSales)}</div>
                    <div>Tips {formatMoney(report.banquetTips)}</div>
                    {report.originalFileName ? (
                      <a className="font-medium text-[#2f5f46] underline" href={apiUrl(`/api/tips/grid/banquet-reports/${report.id}/view`)} target="_blank" rel="noreferrer">View report</a>
                    ) : (
                      <span className="text-[#5f5247]">No file</span>
                    )}
                    <Button type="button" size="sm" variant="outline" className={C.outline} onClick={() => startEditBanquetReport(report)}>Edit</Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-sm text-[#5f5247]">No banquet tips reported for this pay period.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {renderMobileWeek(week1Days, "Week 1", grid.week1Total)}
      {renderMobileWeek(week2Days, "Week 2", grid.week2Total)}
      {renderWeekTable(week1Days, "Week 1", grid.week1Total)}
      {renderWeekTable(week2Days, "Week 2", grid.week2Total)}
      <Card className={C.shell}>
        <CardHeader>
          <CardTitle className={C.ink}>Associate tip totals</CardTitle>
          <CardDescription className={C.muted}>Week 1, Week 2, and full pay-period totals by associate.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-[#ddccb5] bg-white">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#f4eadb] text-[#201814]">
                  <th className="border-b border-r border-[#ddccb5] p-3 text-left">Bistro associate</th>
                  <th className="border-b border-r border-[#ddccb5] p-3 text-right">Week 1</th>
                  <th className="border-b border-r border-[#ddccb5] p-3 text-right">Week 2</th>
                  <th className="border-b border-[#ddccb5] p-3 text-right">Grand total</th>
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => (
                  <tr key={`summary-${row.associate.id}`} className="odd:bg-white even:bg-[#fffaf2]">
                    <td className="border-b border-r border-[#e0d3c1] p-3">
                      <div className="font-semibold text-[#201814]">{row.associate.employeeDisplayName}</div>
                      <div className="text-xs text-[#5f5247]">{row.associate.position || "Associate"}</div>
                    </td>
                    <td className="border-b border-r border-[#e0d3c1] p-3 text-right font-medium">
                      {formatMoney(associateTipTotal(row, week1Days))}
                    </td>
                    <td className="border-b border-r border-[#e0d3c1] p-3 text-right font-medium">
                      {formatMoney(associateTipTotal(row, week2Days))}
                    </td>
                    <td className="border-b border-[#e0d3c1] bg-[#f8f1e7] p-3 text-right font-semibold text-[#201814]">
                      {formatMoney(associateTipTotal(row, grid.period.days))}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#e8f1ea] font-semibold text-[#173c25]">
                  <td className="border-r border-t border-[#bdd5c3] p-3">All associates</td>
                  <td className="border-r border-t border-[#bdd5c3] p-3 text-right">{formatMoney(grid.week1Total)}</td>
                  <td className="border-r border-t border-[#bdd5c3] p-3 text-right">{formatMoney(grid.week2Total)}</td>
                  <td className="border-t border-[#bdd5c3] p-3 text-right text-base">{formatMoney(grid.totalTips)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {grid.rows.length === 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">No active associates are available. Add the first associate from the grid.</div>}
      <Dialog open={Boolean(activeEntry)} onOpenChange={(open) => !open && setActiveEntry(null)}>
        <DialogContent className="border-[#ddccb5] bg-[#fffaf2] text-[#201814] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{activeRow?.associate.employeeDisplayName || "Tip entry"}</DialogTitle>
            <DialogDescription className="text-[#5f5247]">{activeCell ? formatDisplayDate(activeCell.date, "long") : ""}</DialogDescription>
          </DialogHeader>
          {activeRow && activeCell && (
            <div className="space-y-4">
              <div>
                <Label>CC tips from sales report</Label>
                <div className="relative mt-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-[#5f5247]">$</span>
                  <Input
                    className={`${C.field} h-14 pl-9 text-right text-2xl`}
                    inputMode="decimal"
                    autoFocus
                    disabled={grid.locked || activeCell.confirmed}
                    value={entryModalAmount}
                    onChange={(event) => setEntryModalAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") saveEntryModal();
                    }}
                  />
                </div>
              </div>
              <div>
                <Label>Gross sales for this associate's shift</Label>
                <div className="relative mt-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-[#5f5247]">$</span>
                  <Input
                    className={`${C.field} h-14 pl-9 text-right text-2xl`}
                    inputMode="decimal"
                    disabled={grid.locked || activeCell.confirmed}
                    value={entryModalSales}
                    onChange={(event) => setEntryModalSales(event.target.value.replace(/[^0-9.]/g, ""))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") saveEntryModal();
                    }}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-[#bdd5c3] bg-[#e8f1ea] p-3 text-center text-[#173c25]">
                <div className="text-xs font-semibold uppercase tracking-wide">Personal tip percentage</div>
                <div className="text-2xl font-semibold">
                  {formatPercent(Number(entryModalSales || 0) > 0 ? (Number(entryModalAmount || 0) / Number(entryModalSales)) * 100 : 0)}
                </div>
              </div>
              {activeCell.confirmed ? (
                canReopenEntry && activeCell.entryId ? (
                  <Button type="button" variant="outline" className={`w-full ${C.outline}`} onClick={() => {
                    unlockEntry.mutate(activeCell.entryId!);
                    setActiveEntry(null);
                  }}>
                    Reopen to correct
                  </Button>
                ) : (
                  <Badge variant="outline" className="w-full justify-center border-emerald-300 bg-emerald-50 py-2 text-emerald-800">Confirmed and locked</Badge>
                )
              ) : (
                <div className="grid gap-2">
                  <Button type="button" className={`w-full ${C.green}`} disabled={saveEntry.isPending} onClick={saveEntryModal}>
                    Save tips and sales
                  </Button>
                  {Number(entryModalAmount || 0) > 0 && (Number(entryModalSales || 0) > 0 || Number(dayTotal(activeCell.date)?.grossSales) > 0) && activeCell.entryId && (
                    <Button type="button" variant="outline" className={`w-full ${C.outline}`} onClick={() => {
                      confirmEntry.mutate(activeCell.entryId!);
                      setActiveEntry(null);
                    }}>
                      Confirm and lock
                    </Button>
                  )}
                  {Number(entryModalAmount || 0) > 0 && Number(entryModalSales || 0) <= 0 && Number(dayTotal(activeCell.date)?.grossSales) <= 0 && (
                    <div className="text-center text-sm text-amber-900">Enter the shared card sales under one associate before confirming.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={addAssociateOpen} onOpenChange={setAddAssociateOpen}>
        <DialogContent className="border-[#ddccb5] bg-[#fffaf2] text-[#201814] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add associate to grid</DialogTitle>
            <DialogDescription className="text-[#5f5247]">Only Bistro or Breakfast associates can be added to this tip grid. Email is optional for grid-only associates.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>First name</Label>
              <Input className={C.field} value={associateForm.firstName} onChange={(event) => setAssociateForm({ ...associateForm, firstName: event.target.value })} />
            </div>
            <div>
              <Label>Last name</Label>
              <Input className={C.field} value={associateForm.lastName} onChange={(event) => setAssociateForm({ ...associateForm, lastName: event.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Display name</Label>
              <Input className={C.field} placeholder="Optional" value={associateForm.employeeDisplayName} onChange={(event) => setAssociateForm({ ...associateForm, employeeDisplayName: event.target.value })} />
            </div>
            <div>
              <Label>Position</Label>
              <Input className={C.field} placeholder="Bistro attendant" value={associateForm.position} onChange={(event) => setAssociateForm({ ...associateForm, position: event.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input className={C.field} type="email" placeholder="Optional" value={associateForm.email} onChange={(event) => setAssociateForm({ ...associateForm, email: event.target.value })} />
            </div>
          </div>
          <Button
            className={`w-full ${C.green}`}
            disabled={addAssociate.isPending || !associateForm.firstName.trim() || !associateForm.lastName.trim()}
            onClick={() => addAssociate.mutate()}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {addAssociate.isPending ? "Adding..." : "Add associate"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TipsAdmin({ currentUser }: { currentUser: TipsUser }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newUserForm, setNewUserForm] = useState({
    firstName: "",
    lastName: "",
    employeeDisplayName: "",
    email: "",
    position: "",
    role: "employee" as TipsUser["role"],
    password: "",
  });
  const [kioskPin, setKioskPin] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const { data, isLoading } = useQuery<{ submissions: any[] }>({
    queryKey: ["/api/tips/admin/submissions"],
    queryFn: () => fetchJson("/api/tips/admin/submissions"),
  });
  const { data: usersData, isLoading: usersLoading } = useQuery<{ users: TipsUser[] }>({
    queryKey: ["/api/tips/admin/users"],
    queryFn: () => fetchJson("/api/tips/admin/users"),
  });
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => apiRequest("POST", `/api/tips/admin/submissions/${id}/status`, { status }),
    onSuccess: () => {
      toast({ title: "Submission updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/admin/submissions"] });
    },
    onError: (error: Error) => toast({ title: "Update failed", description: error.message, variant: "destructive" }),
  });
  const positionMutation = useMutation({
    mutationFn: async ({ userId, position }: { userId: string; position: string }) => apiRequest("PATCH", `/api/tips/admin/users/${userId}/position`, { position }),
    onSuccess: () => {
      toast({ title: "Position updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/admin/submissions"] });
    },
    onError: (error: Error) => toast({ title: "Position update failed", description: error.message, variant: "destructive" }),
  });
  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: TipsUser["role"] }) => apiRequest("PATCH", `/api/tips/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      toast({ title: "Role updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/admin/submissions"] });
    },
    onError: (error: Error) => toast({ title: "Role update failed", description: error.message, variant: "destructive" }),
  });
  const createUserMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/tips/admin/users", newUserForm);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Associate added",
        description: data?.emailSent === false ? data.warning || "The associate was created, but the email notification failed." : "An email notification has been sent to the associate.",
        variant: data?.emailSent === false ? "destructive" : "default",
      });
      setNewUserForm({ firstName: "", lastName: "", employeeDisplayName: "", email: "", position: "", role: "employee", password: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/admin/users"] });
    },
    onError: (error: Error) => toast({ title: "Unable to add associate", description: error.message, variant: "destructive" }),
  });
  const passwordResetMutation = useMutation({
    mutationFn: async ({ userId, temporaryPassword }: { userId: string; temporaryPassword: string }) => {
      const response = await apiRequest("POST", `/api/tips/admin/users/${userId}/password-reset`, { temporaryPassword });
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Password change requested",
        description: data?.emailSent === false ? data.warning || "The temporary password was set, but the email notification failed." : "The associate has been emailed their temporary password.",
        variant: data?.emailSent === false ? "destructive" : "default",
      });
      setResetPasswords((current) => ({ ...current, [variables.userId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/tips/admin/users"] });
    },
    onError: (error: Error) => toast({ title: "Password request failed", description: error.message, variant: "destructive" }),
  });
  const disabledMutation = useMutation({
    mutationFn: async ({ userId, disabled }: { userId: string; disabled: boolean }) => apiRequest("PATCH", `/api/tips/admin/users/${userId}/disabled`, { disabled }),
    onSuccess: () => {
      toast({ title: "Associate status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/admin/submissions"] });
    },
    onError: (error: Error) => toast({ title: "Unable to update associate", description: error.message, variant: "destructive" }),
  });
  const kioskPinMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/tips/admin/kiosk-pin", { pin: kioskPin }),
    onSuccess: () => {
      toast({ title: "Team PIN updated" });
      setKioskPin("");
      queryClient.invalidateQueries({ queryKey: ["/api/tips/kiosk/status"] });
    },
    onError: (error: Error) => toast({ title: "PIN update failed", description: error.message, variant: "destructive" }),
  });
  const canCreateAssociates = currentUser.isAdmin;
  const canManageRoles = currentUser.isSuperAdmin;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className={C.shell}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#b98435]" />
            <CardTitle className={C.ink}>Associates</CardTitle>
          </div>
          <CardDescription className={C.muted}>Managers can add employees. Super admin controls roles, password-change requests, and disabled accounts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {canManageRoles && (
            <div className={`rounded-xl border p-4 ${C.panel}`}>
              <div className="mb-3 flex items-center gap-2 font-semibold">
                <KeyRound className="h-4 w-4 text-[#b98435]" />
                Shared team PIN
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Input
                  className={C.field}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="5 digit PIN"
                  value={kioskPin}
                  onChange={(event) => setKioskPin(event.target.value.replace(/\D/g, "").slice(0, 5))}
                />
                <Button className={C.green} disabled={kioskPin.length !== 5 || kioskPinMutation.isPending} onClick={() => kioskPinMutation.mutate()}>
                  Set PIN
                </Button>
              </div>
              <div className="mt-2 text-xs text-[#5f5247]">Associates use this PIN at /tips to open the shared grid. Admin access still requires email and password.</div>
            </div>
          )}

          {canCreateAssociates && (
            <div className={`rounded-xl border p-4 ${C.panel}`}>
              <div className="mb-3 flex items-center gap-2 font-semibold">
                <UserPlus className="h-4 w-4 text-[#b98435]" />
                Add associate
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input className={C.field} placeholder="First name" value={newUserForm.firstName} onChange={(event) => setNewUserForm({ ...newUserForm, firstName: event.target.value })} />
                <Input className={C.field} placeholder="Last name" value={newUserForm.lastName} onChange={(event) => setNewUserForm({ ...newUserForm, lastName: event.target.value })} />
                <Input className={C.field} placeholder="Display name" value={newUserForm.employeeDisplayName} onChange={(event) => setNewUserForm({ ...newUserForm, employeeDisplayName: event.target.value })} />
                <Input className={C.field} placeholder="Position" value={newUserForm.position} onChange={(event) => setNewUserForm({ ...newUserForm, position: event.target.value })} />
                <Input className={C.field} placeholder="Email" type="email" value={newUserForm.email} onChange={(event) => setNewUserForm({ ...newUserForm, email: event.target.value })} />
                <PasswordField placeholder="Temporary password" value={newUserForm.password} onChange={(password) => setNewUserForm({ ...newUserForm, password })} />
                <Select value={newUserForm.role} disabled={!canManageRoles} onValueChange={(role: TipsUser["role"]) => setNewUserForm({ ...newUserForm, role })}>
                  <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                  <SelectContent className={C.menu}>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button className={C.green} onClick={() => createUserMutation.mutate()} disabled={createUserMutation.isPending}>Add associate</Button>
              </div>
            </div>
          )}

          {usersLoading ? (
            <div className={C.muted}>Loading employees...</div>
          ) : (
            <div className="space-y-3">
              {(usersData?.users || []).map((user) => (
                <div key={user.id} className={`rounded-xl border p-4 ${user.disabledAt ? "border-slate-300 bg-slate-100 opacity-85" : "border-[#e0d3c1] bg-white"}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-semibold">{user.employeeDisplayName}</div>
                      <div className="text-sm text-[#5f5247]">{user.email}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {user.role === "super_admin" && <Badge className="bg-[#1f2937]">Super Admin</Badge>}
                        {user.role === "manager" && <Badge className="bg-[#2f5f46]">Manager</Badge>}
                        {user.role === "employee" && <Badge variant="outline" className="border-[#d7c8b5] text-[#5f5247]">Employee</Badge>}
                        {user.mustChangePassword && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">Temporary password</Badge>}
                        {user.disabledAt && <Badge variant="outline" className="border-slate-400 bg-slate-200 text-slate-800">Disabled</Badge>}
                      </div>
                    </div>
                    {currentUser.isAdmin && !user.isSuperAdmin && (currentUser.isSuperAdmin || user.role === "employee") && (
                      <Button
                        type="button"
                        variant={user.disabledAt ? "outline" : "destructive"}
                        className={user.disabledAt ? C.outline : undefined}
                        size="sm"
                        onClick={() => disabledMutation.mutate({ userId: user.id, disabled: !user.disabledAt })}
                      >
                        {user.disabledAt ? <RotateCcw className="mr-2 h-4 w-4" /> : <Ban className="mr-2 h-4 w-4" />}
                        {user.disabledAt ? "Enable" : "Disable"}
                      </Button>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                    <Input className={C.field} defaultValue={user.position || ""} list="tips-position-options" placeholder="Position" onBlur={(event) => {
                      if ((user.position || "") !== event.target.value.trim()) positionMutation.mutate({ userId: user.id, position: event.target.value });
                    }} />
                    <Select value={user.role} disabled={!canManageRoles || user.isSuperAdmin} onValueChange={(role: TipsUser["role"]) => roleMutation.mutate({ userId: user.id, role })}>
                      <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                      <SelectContent className={C.menu}>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" className={C.outline} disabled={!canCreateAssociates} onClick={(event) => {
                      const input = event.currentTarget.parentElement?.querySelector("input");
                      positionMutation.mutate({ userId: user.id, position: input?.value || "" });
                    }}>Save</Button>
                  </div>
                  {canManageRoles && !user.isSuperAdmin && !user.disabledAt && (
                    <div className="mt-4 rounded-lg border border-[#e0d3c1] bg-[#fbf6ee] p-3">
                      <Label>Send password change request</Label>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                        <PasswordField
                          placeholder="Temporary password"
                          value={resetPasswords[user.id] || ""}
                          onChange={(temporaryPassword) => setResetPasswords((current) => ({ ...current, [user.id]: temporaryPassword }))}
                        />
                        <Button
                          type="button"
                          className={C.green}
                          disabled={passwordResetMutation.isPending || (resetPasswords[user.id] || "").length < 8}
                          onClick={() => passwordResetMutation.mutate({ userId: user.id, temporaryPassword: resetPasswords[user.id] || "" })}
                        >
                          <KeyRound className="mr-2 h-4 w-4" />
                          Send request
                        </Button>
                      </div>
                      <div className="mt-1 text-xs text-[#5f5247]">The associate must confirm this temporary password and create a new one at next login.</div>
                    </div>
                  )}
                </div>
              ))}
              <datalist id="tips-position-options">
                <option value="Server" />
                <option value="Bartender" />
                <option value="Host" />
                <option value="Busser" />
                <option value="Food Runner" />
                <option value="Supervisor" />
                <option value="Manager" />
              </datalist>
              {usersData?.users?.length === 0 && <div className="text-sm text-[#5f5247]">No employees have registered yet.</div>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={C.shell}>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className={C.ink}>Manager submissions</CardTitle>
              <CardDescription className={C.muted}>Review, unlock, approve, and export payroll backup data.</CardDescription>
            </div>
            <Button asChild variant="outline" className={C.outline}>
              <a href={apiUrl("/api/tips/admin/export.csv")}>
                <Download className="mr-2 h-4 w-4" />
                Period CSV
              </a>
            </Button>
            <Button asChild variant="outline" className={C.outline}>
              <a href={apiUrl("/api/tips/admin/export-daily.csv")}>
                <Download className="mr-2 h-4 w-4" />
                Daily CSV
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-[#5f5247]">Loading submissions...</div>
          ) : (
            <div className="space-y-3">
              {(data?.submissions || []).map((submission) => (
                <div key={submission.id} className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-semibold">{submission.user.employeeDisplayName}</div>
                      <div className="text-sm text-[#5f5247]">{submission.user.email}</div>
                      <div className="text-sm text-[#5f5247]">Position: {submission.user.position || "Unassigned"}</div>
                      <div className="mt-1 text-sm">{formatPeriod(submission.payPeriodStart, submission.payPeriodEnd)}</div>
                    </div>
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">{submission.status}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                    <div>Week 1: <strong>{formatMoney(submission.week1Total)}</strong></div>
                    <div>Week 2: <strong>{formatMoney(submission.week2Total)}</strong></div>
                    <div>Total: <strong>{formatMoney(submission.totalTips)}</strong></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" asChild variant="outline" className={C.outline}>
                      <a href={apiUrl(`/api/tips/admin/submissions/${submission.id}/pdf`)}>
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" className={C.outline} onClick={() => statusMutation.mutate({ id: submission.id, status: "reopened" })}>Unlock</Button>
                    <Button size="sm" variant="outline" className={C.outline} onClick={() => statusMutation.mutate({ id: submission.id, status: "approved" })}>Approve</Button>
                    <Button size="sm" variant="outline" className={C.outline} onClick={() => statusMutation.mutate({ id: submission.id, status: "exported" })}>Mark exported</Button>
                  </div>
                </div>
              ))}
              {data?.submissions?.length === 0 && <div className="text-sm text-[#5f5247]">No submissions yet.</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "green" }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "green" ? "border-[#bdd5c3] bg-[#e8f1ea] text-[#173c25]" : "border-[#e0d3c1] bg-white text-[#201814]"}`}>
      <div className="text-sm font-medium text-[#6b5f54]">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

export default function TipsPage() {
  const queryClient = useQueryClient();
  const isAdminPath = typeof window !== "undefined" && window.location.pathname.startsWith("/tips/admin");
  const { data: auth, isLoading: authLoading } = useQuery<{ user: TipsUser | null }>({
    queryKey: ["/api/tips/auth/me"],
    queryFn: () => fetchJson("/api/tips/auth/me"),
  });
  const { data: kioskStatus, isLoading: kioskLoading, error: kioskError } = useQuery<{ unlocked: boolean; hasPin: boolean }>({
    queryKey: ["/api/tips/kiosk/status"],
    queryFn: () => fetchJson("/api/tips/kiosk/status"),
    enabled: !!auth?.user,
  });
  const logout = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tips/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/tips";
    },
  });

  if (authLoading) return <div className={`min-h-screen p-8 ${C.page}`}>Loading Tips Tracker...</div>;
  if (isAdminPath && !auth?.user) {
    return (
      <TipsAuth
        allowRegister={false}
        title="Manager login"
        description="Tips admin is for designated managers and super admins. Associates use the shared PIN entry flow."
        onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/tips/auth/me"] })}
      />
    );
  }
  if (auth?.user?.mustChangePassword) {
    return <ChangePasswordGate onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/tips/auth/me"] })} />;
  }
  if (!isAdminPath && !auth?.user) return <TipsPortalLoginRequired />;
  if (!isAdminPath && kioskError) {
    return (
      <div className={`min-h-screen ${C.page}`}>
        <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-8">
          <Card className={`w-full ${C.shell}`}>
            <CardHeader>
              <CardTitle className={C.ink}>Tips access unavailable</CardTitle>
              <CardDescription className={C.muted}>Tips reporting is limited to Bistro-related roles. Contact your manager if your role needs to be updated.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className={`w-full ${C.green}`}><a href="/courtyard">Back to Courtyard portal</a></Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }
  if (!isAdminPath && (kioskLoading || !kioskStatus)) return <div className={`min-h-screen p-8 ${C.page}`}>Loading Tips Tracker...</div>;
  if (!isAdminPath && !kioskStatus?.unlocked) {
    return <TipsPinGate onUnlocked={() => queryClient.invalidateQueries({ queryKey: ["/api/tips/kiosk/status"] })} />;
  }

  return (
    <div className={`min-h-screen ${C.page}`}>
      <header className="border-b border-[#deceba] bg-[#fffaf2]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Lakeline Bistro</div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Courtyard Tips Tracker</h1>
          </div>
          <div className="flex items-center gap-2">
            {auth?.user?.isAdmin && <Button asChild size="sm" className={C.darkButton}><a href={isAdminPath ? "/tips" : "/tips/admin"}>{isAdminPath ? "Grid view" : "Admin"}</a></Button>}
            {auth?.user && (
              <Button variant="ghost" size="sm" className="text-[#5f5247]" onClick={() => logout.mutate()}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {isAdminPath ? (
          auth?.user?.isAdmin ? <TipsAdmin currentUser={auth.user} /> : <Card className={C.shell}><CardContent className="p-6">Manager access is required.</CardContent></Card>
        ) : (
          <TipsGridTracker currentUser={auth?.user || null} />
        )}
      </main>
    </div>
  );
}
