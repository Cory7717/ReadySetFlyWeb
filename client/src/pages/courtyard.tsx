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
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function CourtyardLogin({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const login = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/tips/auth/login", form);
      return response.json();
    },
    onSuccess: onDone,
    onError: (error: Error) => toast({ title: "Unable to sign in", description: error.message, variant: "destructive" }),
  });

  return (
    <div className={`min-h-screen ${C.page}`}>
      <main className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
          <section className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8a6b3f]">Courtyard Austin Lakeline</div>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Associate Portal</h1>
            <p className="max-w-xl text-lg text-[#5f5247]">
              One place for schedules, Bistro tip reporting, and hotel operations tools.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className={C.shell}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5 text-[#2f5f46]" /> Schedule</CardTitle>
                  <CardDescription className={C.muted}>View published schedules and submit schedule requests.</CardDescription>
                </CardHeader>
              </Card>
              <Card className={C.shell}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><Coffee className="h-5 w-5 text-[#b98435]" /> Tips</CardTitle>
                  <CardDescription className={C.muted}>Bistro associates can enter credit-card tips and upload sales reports.</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </section>

          <Card className={C.shell}>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription className={C.muted}>Use your Courtyard account to continue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Email</Label>
                <Input className={C.field} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </div>
              <div>
                <Label>Password</Label>
                <Input className={C.field} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
              </div>
              <Button className={`w-full ${C.green}`} disabled={login.isPending || !form.email || !form.password} onClick={() => login.mutate()}>
                {login.isPending ? "Signing in..." : "Sign in"}
              </Button>
              <div className="grid gap-2 pt-2 sm:grid-cols-2">
                <Button asChild variant="outline" className={C.outline}><Link href="/schedule">Create schedule login</Link></Button>
                <Button asChild variant="outline" className={C.outline}><Link href="/tips">Tips access</Link></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function CourtyardPortalPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const auth = useQuery<{ user: CourtyardUser | null }>({
    queryKey: ["/api/tips/auth/me", "courtyard"],
    queryFn: () => fetchJson("/api/tips/auth/me"),
  });
  const logout = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tips/auth/logout", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tips/auth/me", "courtyard"] });
    },
    onError: (error: Error) => toast({ title: "Logout failed", description: error.message, variant: "destructive" }),
  });

  if (auth.isLoading) return <div className={`min-h-screen p-8 ${C.page}`}>Loading Courtyard portal...</div>;
  if (!auth.data?.user) return <CourtyardLogin onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/tips/auth/me", "courtyard"] })} />;

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
      description: "Enter credit-card tips from the daily sales report, upload the report photo, and review pay-period totals.",
      action: "Open tips tracker",
      tone: C.accent,
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
                  <Button asChild className={`w-full ${tool.tone}`}>
                    <Link href={tool.href}>{tool.action}</Link>
                  </Button>
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
