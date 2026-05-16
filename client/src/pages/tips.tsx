import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Lock,
  LogOut,
  ReceiptText,
  ShieldCheck,
  Upload,
  UserPlus,
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
};

type TipsUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeDisplayName: string;
  position: string | null;
  role: "employee" | "manager" | "super_admin";
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

function TipsAuth({ onDone }: { onDone: () => void }) {
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
            <CardTitle className={C.ink}>{mode === "login" ? "Employee login" : "Create employee account"}</CardTitle>
            <CardDescription className={C.muted}>Use the account your manager created, or register with your own email.</CardDescription>
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
              <Input className={C.field} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </div>
            <Button className={`w-full ${C.green}`} onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
            </Button>
            <Button variant="ghost" className="w-full text-[#2f5f46]" onClick={() => setMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? "Need an account? Register" : "Already registered? Log in"}
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
        const formData = new FormData();
        formData.append("salesReport", file);
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
    onError: (error: Error) => toast({ title: "Save failed", description: error.message, variant: "destructive" }),
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
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
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
            <Input className={`mt-3 ${C.field}`} type="file" accept="image/*,application/pdf" capture="environment" disabled={locked} onChange={(event) => setFile(event.target.files?.[0] || null)} />
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
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => apiRequest("DELETE", `/api/tips/admin/users/${userId}`),
    onSuccess: () => {
      toast({ title: "Associate deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/admin/submissions"] });
    },
    onError: (error: Error) => toast({ title: "Unable to delete associate", description: error.message, variant: "destructive" }),
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
          <CardDescription className={C.muted}>Managers can add employees. Super admin controls manager designation and deletion.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
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
                <Input className={C.field} placeholder="Temporary password" type="password" value={newUserForm.password} onChange={(event) => setNewUserForm({ ...newUserForm, password: event.target.value })} />
                <Select value={newUserForm.role} disabled={!canManageRoles} onValueChange={(role: TipsUser["role"]) => setNewUserForm({ ...newUserForm, role })}>
                  <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                  <SelectContent>
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
                <div key={user.id} className="rounded-xl border border-[#e0d3c1] bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-semibold">{user.employeeDisplayName}</div>
                      <div className="text-sm text-[#5f5247]">{user.email}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {user.role === "super_admin" && <Badge className="bg-[#1f2937]">Super Admin</Badge>}
                        {user.role === "manager" && <Badge className="bg-[#2f5f46]">Manager</Badge>}
                        {user.role === "employee" && <Badge variant="outline" className="border-[#d7c8b5] text-[#5f5247]">Employee</Badge>}
                      </div>
                    </div>
                    {canManageRoles && !user.isSuperAdmin && (
                      <Button type="button" variant="destructive" size="sm" onClick={() => deleteUserMutation.mutate(user.id)}>Delete</Button>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                    <Input className={C.field} defaultValue={user.position || ""} list="tips-position-options" placeholder="Position" onBlur={(event) => {
                      if ((user.position || "") !== event.target.value.trim()) positionMutation.mutate({ userId: user.id, position: event.target.value });
                    }} />
                    <Select value={user.role} disabled={!canManageRoles || user.isSuperAdmin} onValueChange={(role: TipsUser["role"]) => roleMutation.mutate({ userId: user.id, role })}>
                      <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                      <SelectContent>
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
  const [reviewOpen, setReviewOpen] = useState(false);
  const isAdminPath = typeof window !== "undefined" && window.location.pathname.startsWith("/tips/admin");
  const { data: auth, isLoading: authLoading } = useQuery<{ user: TipsUser | null }>({
    queryKey: ["/api/tips/auth/me"],
    queryFn: () => fetchJson("/api/tips/auth/me"),
  });
  const { data: dashboard, isLoading: dashboardLoading } = useQuery<TipsDashboard>({
    queryKey: ["/api/tips/dashboard"],
    queryFn: () => fetchJson("/api/tips/dashboard"),
    enabled: !!auth?.user,
  });
  const logout = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tips/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/tips";
    },
  });

  const locked = !!dashboard?.submission && dashboard.submission.status !== "reopened";
  const enteredCount = dashboard?.days.filter((day) => !!day.entry).length || 0;
  const missingPhotoCount = dashboard?.days.filter((day) => day.entry && !day.entry.attachments?.length).length || 0;
  const week1Days = dashboard?.days.slice(0, 7) || [];
  const week2Days = dashboard?.days.slice(7) || [];

  if (authLoading) return <div className={`min-h-screen p-8 ${C.page}`}>Loading Tips Tracker...</div>;
  if (!auth?.user) return <TipsAuth onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/tips/auth/me"] })} />;

  return (
    <div className={`min-h-screen ${C.page}`}>
      <header className="border-b border-[#deceba] bg-[#fffaf2]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Lakeline Bistro</div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Courtyard Tips Tracker</h1>
          </div>
          <div className="flex items-center gap-2">
            {auth.user.isAdmin && <Button asChild size="sm" className={C.darkButton}><a href={isAdminPath ? "/tips" : "/tips/admin"}>{isAdminPath ? "Employee view" : "Admin"}</a></Button>}
            <Button variant="ghost" size="sm" className="text-[#5f5247]" onClick={() => logout.mutate()}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {isAdminPath ? (
          auth.user.isAdmin ? <TipsAdmin currentUser={auth.user} /> : <Card className={C.shell}><CardContent className="p-6">Manager access is required.</CardContent></Card>
        ) : dashboardLoading || !dashboard ? (
          <div className="text-sm text-[#5f5247]">Loading dashboard...</div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <Card className={C.shell}>
                <CardHeader>
                  <CardTitle className={C.ink}>Current pay period</CardTitle>
                  <CardDescription className={C.muted}>{formatPeriod(dashboard.period.start, dashboard.period.end)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <StatCard label="Day" value={`${dashboard.period.dayNumber}/14`} />
                    <StatCard label="Week 1" value={formatMoney(dashboard.week1Total)} />
                    <StatCard label="Week 2" value={formatMoney(dashboard.week2Total)} />
                    <StatCard label="Total" value={formatMoney(dashboard.totalTips)} tone="green" />
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between text-sm text-[#5f5247]">
                      <span>{enteredCount} of 14 days entered</span>
                      <span>{missingPhotoCount} missing photos</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#eadfce]">
                      <div className="h-full rounded-full bg-[#b98435]" style={{ width: `${Math.round((enteredCount / 14) * 100)}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={C.shell}>
                <CardHeader>
                  <CardTitle className={`flex items-center gap-2 ${C.ink}`}>{locked && <Lock className="h-4 w-4" />} Actions</CardTitle>
                  <CardDescription className={C.muted}>{locked ? "This pay period is submitted and locked." : "Review carefully before final submission."}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Button className={C.green} disabled={locked} onClick={() => setReviewOpen(true)}>Review and submit period</Button>
                  <Button asChild variant="outline" className={C.outline}>
                    <a href={apiUrl(`/api/tips/submissions/pdf?start=${dashboard.period.start}`)}>
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF summary
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>

            <section className="grid gap-5 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Week 1</h2>
                  <Badge variant="outline" className="border-[#d7c8b5] bg-white text-[#5f5247]">{formatMoney(dashboard.week1Total)}</Badge>
                </div>
                <div className="space-y-3">
                  {week1Days.map((day) => (
                    <DayEditor key={day.date} day={day} locked={locked} defaultOpen={day.date === todayKey()} onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/tips/dashboard"] })} />
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Week 2</h2>
                  <Badge variant="outline" className="border-[#d7c8b5] bg-white text-[#5f5247]">{formatMoney(dashboard.week2Total)}</Badge>
                </div>
                <div className="space-y-3">
                  {week2Days.map((day) => (
                    <DayEditor key={day.date} day={day} locked={locked} defaultOpen={day.date === todayKey()} onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/tips/dashboard"] })} />
                  ))}
                </div>
              </div>
            </section>

            <ReviewDialog dashboard={dashboard} open={reviewOpen} onOpenChange={setReviewOpen} onSubmitted={() => queryClient.invalidateQueries({ queryKey: ["/api/tips/dashboard"] })} />
          </>
        )}
      </main>
    </div>
  );
}
