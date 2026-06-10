import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ClipboardPlus, Coffee, DollarSign, DoorOpen, FileSpreadsheet, LogOut, Search, Settings2, ShieldCheck } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const C = {
  page: "bg-[#f5efe7] text-[#201814]",
  shell: "!border-[#ddccb5] !bg-[#fffaf2] !bg-none !text-[#201814] shadow-[0_18px_45px_rgba(74,54,34,0.10)]",
  muted: "!text-[#5f5247]",
  green: "!bg-[#2f5f46] !bg-none !text-white hover:!bg-[#274d39]",
  accent: "!bg-[#b98435] !bg-none !text-white hover:!bg-[#9f6f2b]",
  field: "!border-[#cdbda8] !bg-white !text-[#201814] placeholder:!text-[#76695d]",
  outline: "!border-[#cdbda8] !bg-white !bg-none !text-[#201814] hover:!bg-[#f8efe2]",
  menu: "!border-[#cdbda8] !bg-white !text-[#201814]",
};

type CourtyardUser = {
  id: string;
  email: string;
  employeeDisplayName: string;
  position?: string | null;
  role: "employee" | "manager" | "super_admin";
  isAdmin: boolean;
  isSuperAdmin: boolean;
  mustChangePassword?: boolean;
  scheduleRoles?: string[];
  toolAccess?: Record<string, boolean>;
  canAccessSchedule?: boolean;
  canAccessTips?: boolean;
  canAccessOpsReport?: boolean;
};

type ToolKey = "schedule" | "tips" | "opsreport";
type ToolAccessResponse = { users: CourtyardUser[]; tools: ToolKey[] };

const DEPARTMENTS = ["Managers", "Front Desk", "Night Audit", "Bistro", "Maintenance", "Housekeeping"];
const SCHEDULE_ROLES = ["GM", "DOS", "MOD", "Executive Housekeeper", "Exec HK", "FD AM", "FD PM", "Night Audit", "Bistro AM", "Bistro PM", "Breakfast", "Maintenance", "Room Attendant", "Laundry", "Room Inspector", "Houseperson"];

function isBistroRole(role: string) {
  const normalized = role.toLowerCase();
  return normalized.includes("bistro") || normalized.includes("breakfast");
}

function userHasTipsAccess(user: CourtyardUser) {
  return user.canAccessTips ?? (user.isAdmin || (user.scheduleRoles || []).some(isBistroRole));
}

function toolEnabled(user: CourtyardUser, tool: ToolKey) {
  if (user.isSuperAdmin) return true;
  const explicit = user.toolAccess?.[tool];
  if (typeof explicit === "boolean") return explicit;
  if (tool === "schedule") return user.canAccessSchedule !== false;
  if (tool === "tips") return user.canAccessTips ?? userHasTipsAccess(user);
  return user.canAccessOpsReport ?? user.isAdmin;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(apiUrl(url), { credentials: "include" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function CourtyardLogin({ onDone }: { onDone: (user?: CourtyardUser) => void }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [access, setAccess] = useState({ schedule: true, tips: false });
  const [form, setForm] = useState({ firstName: "", lastName: "", employeeDisplayName: "", email: "", password: "", phone: "", department: "Front Desk", rolesJson: [] as string[], position: "" });
  const login = useMutation({
    mutationFn: async () => {
      if (mode === "register" && access.tips && !form.rolesJson.some(isBistroRole)) {
        throw new Error("Tips access requires a Bistro or Breakfast role.");
      }
      if (mode === "register" && form.rolesJson.length === 0) {
        throw new Error("Select at least one role before creating the account.");
      }
      const response = await apiRequest(
        "POST",
        mode === "login" ? "/api/tips/auth/login" : "/api/schedule/auth/register",
        mode === "login" ? { email: form.email, password: form.password } : form,
      );
      return response.json();
    },
    onSuccess: (data: { user?: CourtyardUser }) => onDone(data.user),
    onError: (error: Error) => toast({ title: mode === "login" ? "Unable to sign in" : "Unable to create account", description: error.message, variant: "destructive" }),
  });
  const resetPassword = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tips/auth/password-reset-request", { email: form.email }),
    onSuccess: () => toast({ title: "Check your email", description: "If that account exists, a temporary password was sent." }),
    onError: (error: Error) => toast({ title: "Unable to request reset", description: error.message, variant: "destructive" }),
  });
  const toggleRole = (role: string) => setForm((current) => ({ ...current, rolesJson: current.rolesJson.includes(role) ? current.rolesJson.filter((item) => item !== role) : [...current.rolesJson, role] }));

  return (
    <div className={`min-h-screen ${C.page}`}>
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-8">
          <Card className={`w-full ${C.shell}`}>
            <CardHeader>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Lakeline</div>
              <CardTitle className="text-3xl">Associate Portal</CardTitle>
              <CardDescription className={C.muted}>
                {mode === "login" ? "Sign in with your Courtyard account." : "Create your Courtyard account for schedule access, tips access, or both."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mode === "register" && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" className={`rounded-lg border p-3 text-left text-sm ${access.schedule ? "border-[#2f5f46] bg-[#e8f3ec]" : "border-[#cdbda8] bg-white"}`} onClick={() => setAccess({ ...access, schedule: !access.schedule })}>
                      <div className="font-semibold">Schedule</div>
                      <div className="text-[#5f5247]">View schedules and submit requests.</div>
                    </button>
                    <button type="button" className={`rounded-lg border p-3 text-left text-sm ${access.tips ? "border-[#b98435] bg-[#fff3dd]" : "border-[#cdbda8] bg-white"}`} onClick={() => setAccess({ ...access, tips: !access.tips })}>
                      <div className="font-semibold">Tips</div>
                      <div className="text-[#5f5247]">Bistro roles only.</div>
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>First name</Label><Input className={C.field} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></div>
                    <div><Label>Last name</Label><Input className={C.field} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></div>
                    <div className="sm:col-span-2"><Label>Display name</Label><Input className={C.field} value={form.employeeDisplayName} onChange={(event) => setForm({ ...form, employeeDisplayName: event.target.value })} placeholder="Optional" /></div>
                    <div><Label>Phone</Label><Input className={C.field} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
                    <div><Label>Department</Label><Select value={form.department} onValueChange={(department) => setForm({ ...form, department })}><SelectTrigger className={C.field}><SelectValue /></SelectTrigger><SelectContent className={C.menu}>{DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div>
                    <Label>Roles</Label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {SCHEDULE_ROLES.map((role) => <Button key={role} type="button" size="sm" variant="outline" className={form.rolesJson.includes(role) ? C.green : C.outline} onClick={() => toggleRole(role)}>{role}</Button>)}
                    </div>
                    {access.tips && !form.rolesJson.some(isBistroRole) && <p className="mt-1 text-sm text-amber-800">Select Bistro AM, Bistro PM, or Breakfast to request Tips access.</p>}
                  </div>
                </>
              )}
              <div>
                <Label>Email</Label>
                <Input className={C.field} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </div>
              <div>
                <Label>Password</Label>
                <Input className={C.field} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
              </div>
              <Button className={`w-full ${C.green}`} disabled={login.isPending || !form.email || !form.password} onClick={() => login.mutate()}>
                {login.isPending ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
              </Button>
              <Button variant="outline" className={`w-full ${C.outline}`} onClick={() => setMode(mode === "login" ? "register" : "login")}>
                {mode === "login" ? "Create an account" : "Back to sign in"}
              </Button>
              {mode === "login" && (
                <Button variant="ghost" className="w-full text-[#2f5f46]" disabled={!form.email || resetPassword.isPending} onClick={() => resetPassword.mutate()}>
                  {resetPassword.isPending ? "Sending..." : "Email me a temporary password"}
                </Button>
              )}
            </CardContent>
          </Card>
      </main>
    </div>
  );
}

function CourtyardPasswordChange({ onDone }: { onDone: (user?: CourtyardUser) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ temporaryPassword: "", newPassword: "", confirmPassword: "" });
  const changePassword = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/tips/auth/change-password", form);
      return response.json();
    },
    onSuccess: (data: { user?: CourtyardUser }) => onDone(data.user),
    onError: (error: Error) => toast({ title: "Unable to update password", description: error.message, variant: "destructive" }),
  });
  return (
    <div className={`min-h-screen ${C.page}`}>
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-8">
        <Card className={`w-full ${C.shell}`}>
          <CardHeader>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Lakeline</div>
            <CardTitle>Create your new password</CardTitle>
            <CardDescription className={C.muted}>Confirm the temporary password from your email, then create your permanent password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Temporary password</Label><Input className={C.field} type="password" value={form.temporaryPassword} onChange={(event) => setForm({ ...form, temporaryPassword: event.target.value })} /></div>
            <div><Label>New password</Label><Input className={C.field} type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></div>
            <div><Label>Confirm new password</Label><Input className={C.field} type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></div>
            <Button className={`w-full ${C.green}`} disabled={changePassword.isPending || !form.temporaryPassword || form.newPassword.length < 8 || form.confirmPassword.length < 8} onClick={() => changePassword.mutate()}>
              {changePassword.isPending ? "Updating..." : "Set new password"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function CourtyardToolAccessAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const accessUsers = useQuery<ToolAccessResponse>({
    queryKey: ["/api/tips/admin/tool-access-users"],
    queryFn: () => fetchJson("/api/tips/admin/tool-access-users"),
  });
  const updateAccess = useMutation({
    mutationFn: async ({ userId, tool, enabled }: { userId: string; tool: ToolKey; enabled: boolean }) => {
      const response = await apiRequest("PATCH", `/api/tips/admin/users/${userId}/tool-access`, { tool, enabled });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tips/admin/tool-access-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/auth/me", "courtyard"] });
      toast({ title: "Tool access updated" });
    },
    onError: (error: Error) => toast({ title: "Unable to update access", description: error.message, variant: "destructive" }),
  });
  const users = (accessUsers.data?.users || []).filter((item) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return `${item.employeeDisplayName} ${item.email} ${item.position || ""}`.toLowerCase().includes(query);
  });
  const toolLabels: Record<ToolKey, string> = {
    schedule: "Schedule",
    tips: "Tips",
    opsreport: "Ops Report",
  };

  return (
    <Card className={C.shell}>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-[#8a6b3f]" /> Tool Access</CardTitle>
            <CardDescription className={C.muted}>
              Grant or withdraw access to Courtyard tools without changing an associate's job role.
            </CardDescription>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#76695d]" />
            <Input className={`${C.field} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search associates" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {accessUsers.isLoading ? (
          <div className="text-sm text-[#5f5247]">Loading associates...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#d7c8b5] text-left text-xs uppercase tracking-[0.12em] text-[#6b5f54]">
                  <th className="py-2 pr-3">Associate</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2 text-center">Schedule</th>
                  <th className="px-3 py-2 text-center">Tips</th>
                  <th className="px-3 py-2 text-center">Ops Report</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id} className="border-b border-[#eadfce] last:border-0">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-[#201814]">{item.employeeDisplayName}</div>
                      <div className="text-xs text-[#5f5247]">{item.email}</div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className="border-[#cdbda8] bg-white text-[#201814]">{item.role.replace("_", " ")}</Badge>
                    </td>
                    {(["schedule", "tips", "opsreport"] as ToolKey[]).map((tool) => (
                      <td key={tool} className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={toolEnabled(item, tool)}
                            disabled={item.isSuperAdmin || updateAccess.isPending}
                            aria-label={`${toolLabels[tool]} access for ${item.employeeDisplayName}`}
                            onCheckedChange={(enabled) => updateAccess.mutate({ userId: item.id, tool, enabled })}
                          />
                          <span className="w-16 text-left text-xs text-[#5f5247]">{toolEnabled(item, tool) ? "Enabled" : "Off"}</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CourtyardPortalPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const auth = useQuery<{ user: CourtyardUser | null }>({
    queryKey: ["/api/schedule/auth/me", "courtyard"],
    queryFn: () => fetchJson("/api/schedule/auth/me"),
  });
  const logout = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tips/auth/logout", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/auth/me", "courtyard"] });
    },
    onError: (error: Error) => toast({ title: "Logout failed", description: error.message, variant: "destructive" }),
  });

  if (auth.isLoading) return <div className={`min-h-screen p-8 ${C.page}`}>Loading Courtyard portal...</div>;
  if (!auth.data?.user) {
    return (
      <CourtyardLogin
        onDone={(user) => {
          if (user) queryClient.setQueryData(["/api/schedule/auth/me", "courtyard"], { user });
          queryClient.invalidateQueries({ queryKey: ["/api/schedule/auth/me", "courtyard"] });
        }}
      />
    );
  }
  if (auth.data.user.mustChangePassword) {
    return (
      <CourtyardPasswordChange
        onDone={(user) => {
          if (user) queryClient.setQueryData(["/api/schedule/auth/me", "courtyard"], { user });
          queryClient.invalidateQueries({ queryKey: ["/api/schedule/auth/me", "courtyard"] });
        }}
      />
    );
  }

  const user = auth.data.user;
  const tools = [
    {
      href: "/schedule",
      icon: CalendarDays,
      title: "Schedule",
      description: user.isAdmin ? "Build schedules, review requests, complete department sections, and publish final schedules." : "View your published schedule and submit time-off or availability requests.",
      action: user.isAdmin ? "Open schedule builder" : "View schedule",
      tone: C.green,
      disabled: !toolEnabled(user, "schedule"),
    },
    {
      href: "/tips",
      icon: Coffee,
      title: "Bistro Tips",
      description: "Open the Bistro tip reporting page. Associates enter the 5 digit team PIN before entering tip reports.",
      action: "Open tips reports",
      tone: C.accent,
      disabled: !toolEnabled(user, "tips"),
    },
    {
      href: "/opsreport",
      icon: FileSpreadsheet,
      title: "Ops Report",
      description: "Open the weekly operations report workspace when you have access to that tool.",
      action: "Open ops report",
      tone: C.outline,
      disabled: !toolEnabled(user, "opsreport"),
    },
    {
      href: "/incidentreport",
      icon: ClipboardPlus,
      title: "Incident Report",
      description: "Open saved incident reports, submit a new report, download PDFs, and resend manager email copies.",
      action: "Open incident reports",
      tone: C.green,
      disabled: false,
    },
    ...(user.isAdmin ? [{
      href: "/courtyard/budget",
      icon: DollarSign,
      title: "Budget",
      description: "View monthly labor, expense, revenue, forecast, and department checkbook budgets.",
      action: "Open Budget",
      tone: C.green,
      disabled: false,
    }] : []),
  ];

  return (
    <div className={`min-h-screen ${C.page}`}>
      <header className="border-b border-[#deceba] bg-[#fffaf2]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Lakeline</div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Associate Portal</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {user.isSuperAdmin && <Badge className="bg-[#2f5f46] text-white"><ShieldCheck className="mr-1 h-3 w-3" /> Super Admin</Badge>}
            {!user.isSuperAdmin && user.isAdmin && <Badge variant="outline" className="border-[#cdbda8] bg-white text-[#201814]">Manager</Badge>}
            <Button variant="outline" className={C.outline} disabled={logout.isPending} onClick={() => logout.mutate()}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Card className={C.shell}>
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm text-[#5f5247]">Signed in as</div>
              <div className="text-xl font-semibold">{user.employeeDisplayName || user.email}</div>
              <div className="text-sm text-[#5f5247]">{user.email}</div>
            </div>
            {user.mustChangePassword && (
              <Button asChild className={C.accent}><Link href="/tips">Set your password</Link></Button>
            )}
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card key={tool.href} className={C.shell}>
                <CardHeader>
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-[#f4eadb]">
                    <Icon className="h-5 w-5 text-[#2f5f46]" />
                  </div>
                  <CardTitle>{tool.title}</CardTitle>
                  <CardDescription className={C.muted}>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {tool.disabled ? (
                    <Button className={`w-full ${C.outline}`} disabled>Access not enabled</Button>
                  ) : (
                    <Button asChild className={`w-full ${tool.tone}`}>
                      <Link href={tool.href}>{tool.action}</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>

        {user.isSuperAdmin && <CourtyardToolAccessAdmin />}

        <Card className={C.shell}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DoorOpen className="h-5 w-5 text-[#8a6b3f]" /> Quick Guidance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-[#5f5247] md:grid-cols-3">
            <div>Use <strong className="text-[#201814]">Schedule</strong> for posted schedules and time-off requests.</div>
            <div>Use <strong className="text-[#201814]">Bistro Tips</strong> only if you report Bistro credit-card tips.</div>
            <div>Managers may see additional controls inside each tool based on their assigned role.</div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
