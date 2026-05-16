import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileImage, Lock, LogOut, Pencil, ReceiptText, ShieldCheck, Upload } from "lucide-react";
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

type TipsUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeDisplayName: string;
  isAdmin: boolean;
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

function formatDisplayDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function statusForDay(day: DashboardDay, locked: boolean) {
  if (locked) return { label: "Submitted", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  if (!day.entry) return { label: "Not entered", className: "bg-slate-100 text-slate-700 border-slate-200" };
  if (!day.entry.attachments?.length) return { label: "Missing Photo", className: "bg-amber-100 text-amber-900 border-amber-200" };
  return { label: "Saved", className: "bg-blue-100 text-blue-800 border-blue-200" };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(apiUrl(url), { credentials: "include" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function TipsAuth({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    employeeDisplayName: "",
    email: "",
    password: "",
  });

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
    <div className="min-h-screen bg-[#f4f0ea] px-4 py-8 text-[#211a16]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1fr_420px]">
          <div className="flex flex-col justify-center rounded-lg bg-[#2a211c] p-8 text-white shadow-xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#d7a85b] text-[#22170f]">
              <ReceiptText className="h-6 w-6" />
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Courtyard Tips Tracker</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#eadfce]">
              Track daily tips, keep sales report photos together, review pay-period totals, and submit your final summary from your phone.
            </p>
          </div>

          <Card className="border-[#dccdb8] bg-white shadow-xl">
            <CardHeader>
              <CardTitle>{mode === "login" ? "Employee login" : "Create employee account"}</CardTitle>
              <CardDescription>Any valid email can register for the tips tracker.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "register" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>First name</Label>
                    <Input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
                  </div>
                  <div>
                    <Label>Last name</Label>
                    <Input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Employee display name</Label>
                    <Input value={form.employeeDisplayName} placeholder="Name shown on summaries" onChange={(event) => setForm({ ...form, employeeDisplayName: event.target.value })} />
                  </div>
                </div>
              )}
              <div>
                <Label>Email</Label>
                <Input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
              </div>
              <Button className="w-full bg-[#2f5f46] hover:bg-[#274d39]" onClick={() => submit.mutate()} disabled={submit.isPending}>
                {submit.isPending ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setMode(mode === "login" ? "register" : "login")}>
                {mode === "login" ? "Need an account? Register" : "Already registered? Log in"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DayEditor({
  day,
  locked,
  onSaved,
}: {
  day: DashboardDay;
  locked: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(day.entry?.tipAmount || "");
  const [notes, setNotes] = useState(day.entry?.notes || "");
  const [file, setFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/tips/entries", {
        entryDate: day.date,
        tipAmount: Number(amount || 0),
        notes,
      });
      const data = await response.json();
      if (file) {
        const formData = new FormData();
        formData.append("salesReport", file);
        const uploadResponse = await fetch(apiUrl(`/api/tips/entries/${data.entry.id}/attachment`), {
          method: "POST",
          credentials: "include",
          body: formData,
        });
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
    <Card className="border-[#e2d5c3]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{formatDisplayDate(day.date)}</CardTitle>
            <CardDescription>Day {day.dayNumber} of the pay period</CardDescription>
          </div>
          <Badge variant="outline" className={statusForDay(day, locked).className}>{statusForDay(day, locked).label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Tip amount</Label>
          <Input type="number" min="0" step="0.01" value={amount} disabled={locked} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} disabled={locked} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" rows={2} />
        </div>
        <div className="rounded-md border border-dashed border-[#cbbca7] bg-[#fbf8f3] p-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <FileImage className="h-4 w-4" />
            Add Sales Report Photo
          </Label>
          {attachment && (
            <a className="mt-2 block text-sm font-medium text-[#2f5f46] underline" href={apiUrl(`/api/tips/attachments/${attachment.id}/view`)} target="_blank" rel="noreferrer">
              View current report: {attachment.originalFileName}
            </a>
          )}
          <Input className="mt-3" type="file" accept="image/*,application/pdf" capture="environment" disabled={locked} onChange={(event) => setFile(event.target.files?.[0] || null)} />
          {file && <div className="mt-2 text-xs text-[#6a5e52]">Ready to upload: {file.name}</div>}
        </div>
        {!locked && (
          <Button className="w-full bg-[#2f5f46] hover:bg-[#274d39]" onClick={() => save.mutate()} disabled={save.isPending}>
            <Upload className="mr-2 h-4 w-4" />
            {save.isPending ? "Saving..." : "Save"}
          </Button>
        )}
      </CardContent>
    </Card>
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
    onSuccess: () => {
      toast({ title: "Pay period submitted", description: "Your summary has been locked and emailed." });
      onOpenChange(false);
      onSubmitted();
    },
    onError: (error: Error) => toast({ title: "Submission failed", description: error.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review pay period before submitting</DialogTitle>
          <DialogDescription>{dashboard.period.start} to {dashboard.period.end}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {(missingDays.length > 0 || missingImages.length > 0) && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {missingDays.length} missing day(s). {missingImages.length} saved day(s) missing sales report photos.
            </div>
          )}
          <div className="divide-y rounded-md border">
            {dashboard.days.map((day) => (
              <div key={day.date} className="grid gap-1 p-3 text-sm sm:grid-cols-[110px_90px_80px_1fr]">
                <div className="font-medium">{formatDisplayDate(day.date)}</div>
                <div>{formatMoney(day.entry?.tipAmount)}</div>
                <div>{day.entry?.attachments?.length ? "Photo yes" : "No photo"}</div>
                <div className="text-muted-foreground">{day.entry?.notes || "No notes"}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-[#f4f0ea] p-3"><div className="text-xs uppercase text-[#78695c]">Week 1</div><div className="text-xl font-semibold">{formatMoney(dashboard.week1Total)}</div></div>
            <div className="rounded-md bg-[#f4f0ea] p-3"><div className="text-xs uppercase text-[#78695c]">Week 2</div><div className="text-xl font-semibold">{formatMoney(dashboard.week2Total)}</div></div>
            <div className="rounded-md bg-[#e8f1ea] p-3"><div className="text-xs uppercase text-[#48644f]">Grand total</div><div className="text-xl font-semibold">{formatMoney(dashboard.totalTips)}</div></div>
          </div>
          <label className="flex gap-3 rounded-md border p-3 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(Boolean(value))} />
            <span>I confirm these tip amounts are accurate to the best of my knowledge and match the uploaded sales reports.</span>
          </label>
          <Button className="w-full bg-[#2f5f46] hover:bg-[#274d39]" disabled={!confirmed || missingImages.length > 0 || submit.isPending} onClick={() => submit.mutate()}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            {submit.isPending ? "Submitting..." : "Submit final pay period"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TipsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ submissions: any[] }>({
    queryKey: ["/api/tips/admin/submissions"],
    queryFn: () => fetchJson("/api/tips/admin/submissions"),
  });
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => apiRequest("POST", `/api/tips/admin/submissions/${id}/status`, { status }),
    onSuccess: () => {
      toast({ title: "Submission updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/tips/admin/submissions"] });
    },
    onError: (error: Error) => toast({ title: "Update failed", description: error.message, variant: "destructive" }),
  });

  return (
    <Card className="border-[#dccdb8]">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Manager submissions</CardTitle>
            <CardDescription>Review, unlock, approve, and export payroll backup data.</CardDescription>
          </div>
          <Button asChild variant="outline">
            <a href={apiUrl("/api/tips/admin/export.csv")}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading submissions...</div>
        ) : (
          <div className="space-y-3">
            {(data?.submissions || []).map((submission) => (
              <div key={submission.id} className="rounded-md border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-semibold">{submission.user.employeeDisplayName}</div>
                    <div className="text-sm text-muted-foreground">{submission.user.email}</div>
                    <div className="mt-1 text-sm">{submission.payPeriodStart} to {submission.payPeriodEnd}</div>
                  </div>
                  <Badge variant="outline">{submission.status}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                  <div>Week 1: <strong>{formatMoney(submission.week1Total)}</strong></div>
                  <div>Week 2: <strong>{formatMoney(submission.week2Total)}</strong></div>
                  <div>Total: <strong>{formatMoney(submission.totalTips)}</strong></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" asChild variant="outline">
                    <a href={apiUrl(`/api/tips/admin/submissions/${submission.id}/pdf`)}>
                      <Download className="mr-2 h-4 w-4" />
                      PDF
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: submission.id, status: "reopened" })}>Unlock</Button>
                  <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: submission.id, status: "approved" })}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: submission.id, status: "exported" })}>Mark exported</Button>
                </div>
              </div>
            ))}
            {data?.submissions?.length === 0 && <div className="text-sm text-muted-foreground">No submissions yet.</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TipsPage() {
  const { toast } = useToast();
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
  const today = useMemo(() => {
    if (!dashboard) return null;
    const local = new Date().toISOString().slice(0, 10);
    return dashboard.days.find((day) => day.date === local) || dashboard.days[0];
  }, [dashboard]);

  if (authLoading) {
    return <div className="min-h-screen bg-[#f4f0ea] p-8 text-[#211a16]">Loading Tips Tracker...</div>;
  }

  if (!auth?.user) {
    return <TipsAuth onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/tips/auth/me"] })} />;
  }

  return (
    <div className="min-h-screen bg-[#f4f0ea] text-[#211a16]">
      <header className="border-b border-[#deceba] bg-white/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Bistro</div>
            <h1 className="text-2xl font-semibold tracking-tight">Courtyard Tips Tracker</h1>
          </div>
          <div className="flex items-center gap-2">
            {auth.user.isAdmin && <Button asChild variant="outline" size="sm"><a href={isAdminPath ? "/tips" : "/tips/admin"}>{isAdminPath ? "Employee view" : "Admin"}</a></Button>}
            <Button variant="ghost" size="sm" onClick={() => logout.mutate()}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {isAdminPath ? (
          auth.user.isAdmin ? <TipsAdmin /> : <Card><CardContent className="p-6">Manager access is required.</CardContent></Card>
        ) : dashboardLoading || !dashboard ? (
          <div className="text-sm text-muted-foreground">Loading dashboard...</div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-[#dccdb8]">
                <CardHeader>
                  <CardTitle>Current Pay Period</CardTitle>
                  <CardDescription>{dashboard.period.start} to {dashboard.period.end}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-md bg-white p-3"><div className="text-xs uppercase text-[#78695c]">Day</div><div className="text-2xl font-semibold">{dashboard.period.dayNumber}/14</div></div>
                  <div className="rounded-md bg-white p-3"><div className="text-xs uppercase text-[#78695c]">Week 1</div><div className="text-2xl font-semibold">{formatMoney(dashboard.week1Total)}</div></div>
                  <div className="rounded-md bg-white p-3"><div className="text-xs uppercase text-[#78695c]">Week 2</div><div className="text-2xl font-semibold">{formatMoney(dashboard.week2Total)}</div></div>
                  <div className="rounded-md bg-[#e8f1ea] p-3"><div className="text-xs uppercase text-[#48644f]">Total</div><div className="text-2xl font-semibold">{formatMoney(dashboard.totalTips)}</div></div>
                </CardContent>
              </Card>
              <Card className="border-[#dccdb8]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">{locked && <Lock className="h-4 w-4" />} Actions</CardTitle>
                  <CardDescription>{locked ? "This pay period is submitted and locked." : "Review carefully before final submission."}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Button className="bg-[#2f5f46] hover:bg-[#274d39]" disabled={locked} onClick={() => setReviewOpen(true)}>Review and submit period</Button>
                  <Button asChild variant="outline">
                    <a href={apiUrl(`/api/tips/submissions/pdf?start=${dashboard.period.start}`)}>
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF summary
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {today && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">Today’s Tip</h2>
                <DayEditor day={today} locked={locked} onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/tips/dashboard"] })} />
              </section>
            )}

            <section>
              <h2 className="mb-3 text-lg font-semibold">14-Day Tip Log</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {dashboard.days.map((day) => (
                  <DayEditor key={day.date} day={day} locked={locked} onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/tips/dashboard"] })} />
                ))}
              </div>
            </section>

            <ReviewDialog dashboard={dashboard} open={reviewOpen} onOpenChange={setReviewOpen} onSubmitted={() => queryClient.invalidateQueries({ queryKey: ["/api/tips/dashboard"] })} />
          </>
        )}
      </main>
    </div>
  );
}
