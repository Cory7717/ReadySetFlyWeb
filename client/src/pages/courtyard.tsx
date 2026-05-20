import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Coffee, DoorOpen, FileSpreadsheet, LogOut, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const C = {
  page: "bg-[#f5efe7] text-[#201814]",
  shell: "!border-[#ddccb5] !bg-[#fffaf2] !bg-none !text-[#201814] shadow-[0_18px_45px_rgba(74,54,34,0.10)]",
  muted: "!text-[#5f5247]",
  green: "!bg-[#2f5f46] !bg-none !text-white hover:!bg-[#274d39]",
  accent: "!bg-[#b98435] !bg-none !text-white hover:!bg-[#9f6f2b]",
  field: "!border-[#cdbda8] !bg-white !text-[#201814] placeholder:!text-[#76695d]",
  outline: "!border-[#cdbda8] !bg-white !bg-none !text-[#201814] hover:!bg-[#f8efe2]",
};

type CourtyardUser = {
  id: string;
  email: string;
  employeeDisplayName: string;
  role: "employee" | "manager" | "super_admin";
  isAdmin: boolean;
  isSuperAdmin: boolean;
  mustChangePassword?: boolean;
  scheduleRoles?: string[];
};

const DEPARTMENTS = ["Managers", "Front Desk", "Night Audit", "Bistro", "Maintenance", "Housekeeping"];
const SCHEDULE_ROLES = ["GM", "DOS", "MOD", "FD AM", "FD PM", "Night Audit", "Bistro AM", "Bistro PM", "Breakfast", "Maintenance", "Room Attendant", "Laundry", "Room Inspector", "Houseperson"];

function isBistroRole(role: string) {
  const normalized = role.toLowerCase();
  return normalized.includes("bistro") || normalized.includes("breakfast");
}

function userHasTipsAccess(user: CourtyardUser) {
  return user.isAdmin || (user.scheduleRoles || []).some(isBistroRole);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function CourtyardLogin({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [access, setAccess] = useState({ schedule: true, tips: false });
  const [form, setForm] = useState({ firstName: "", lastName: "", employeeDisplayName: "", email: "", password: "", phone: "", department: "Front Desk", rolesJson: [] as string[], position: "" });
  const login = useMutation({
    mutationFn: async () => {
      if (mode === "register" && access.tips && !form.rolesJson.some(isBistroRole)) {
        throw new Error("Tips access requires a Bistro or Breakfast role.");
      }
      const response = await apiRequest(
        "POST",
        mode === "login" ? "/api/tips/auth/login" : "/api/schedule/auth/register",
        mode === "login" ? { email: form.email, password: form.password } : form,
      );
      return response.json();
    },
    onSuccess: onDone,
    onError: (error: Error) => toast({ title: mode === "login" ? "Unable to sign in" : "Unable to create account", description: error.message, variant: "destructive" }),
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
                    <div><Label>Department</Label><Select value={form.department} onValueChange={(department) => setForm({ ...form, department })}><SelectTrigger className={C.field}><SelectValue /></SelectTrigger><SelectContent>{DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}</SelectContent></Select></div>
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
            </CardContent>
          </Card>
      </main>
    </div>
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
  if (!auth.data?.user) return <CourtyardLogin onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/schedule/auth/me", "courtyard"] })} />;

  const user = auth.data.user;
  const tools = [
    {
      href: "/schedule",
      icon: CalendarDays,
      title: "Schedule",
      description: user.isAdmin ? "Build schedules, review requests, complete department sections, and publish final schedules." : "View your published schedule and submit time-off or availability requests.",
      action: user.isAdmin ? "Open schedule builder" : "View schedule",
      tone: C.green,
    },
    {
      href: "/tips",
      icon: Coffee,
      title: "Bistro Tips",
      description: "Open the Bistro tip reporting page. Associates enter the 5 digit team PIN before entering tip reports.",
      action: "Open tips reports",
      tone: C.accent,
      disabled: !userHasTipsAccess(user),
    },
    {
      href: "/opsreport",
      icon: FileSpreadsheet,
      title: "Ops Report",
      description: "Open the weekly operations report workspace when you have access to that tool.",
      action: "Open ops report",
      tone: C.outline,
    },
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

        <section className="grid gap-4 md:grid-cols-3">
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
                    <Button className={`w-full ${C.outline}`} disabled>Bistro role required</Button>
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
