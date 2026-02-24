import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CfiSchool, CfiSchoolMember } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";

type SchoolMember = CfiSchoolMember & {
  user?: {
    id: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
  } | null;
};

type SchoolDashboardResponse = {
  school: CfiSchool;
  members: SchoolMember[];
  role: string;
  metrics?: {
    instructors: number;
    students: number;
    lessons: number;
    upcomingLessons: number;
    completedLessons: number;
    milestonesCompleted: number;
  };
} | null;

const toOptional = (value: string) => (value.trim() ? value.trim() : null);

export default function CfiSchoolDashboard() {
  const { toast } = useToast();
  const [formState, setFormState] = useState({
    name: "",
    slug: "",
    description: "",
    locationCity: "",
    locationState: "",
    airportHome: "",
    website: "",
    phone: "",
  });
  const [memberForm, setMemberForm] = useState({
    email: "",
    role: "instructor",
  });

  useEffect(() => {
    trackEvent("cfi_school_dashboard_view");
  }, []);

  const { data: dashboard, isLoading } = useQuery<SchoolDashboardResponse>({
    queryKey: ["/api/cfi/school"],
  });

  useEffect(() => {
    if (!dashboard?.school) return;
    setFormState({
      name: dashboard.school.name || "",
      slug: dashboard.school.slug || "",
      description: dashboard.school.description || "",
      locationCity: dashboard.school.locationCity || "",
      locationState: dashboard.school.locationState || "",
      airportHome: dashboard.school.airportHome || "",
      website: dashboard.school.website || "",
      phone: dashboard.school.phone || "",
    });
  }, [dashboard?.school]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formState.name,
        slug: formState.slug,
        description: toOptional(formState.description),
        locationCity: toOptional(formState.locationCity),
        locationState: toOptional(formState.locationState),
        airportHome: toOptional(formState.airportHome),
        website: toOptional(formState.website),
        phone: toOptional(formState.phone),
      };
      const res = await apiRequest("POST", "/api/cfi/school", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/school"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/schools"] });
      toast({ title: "School created" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create school", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!dashboard?.school) throw new Error("No school found");
      const payload = {
        schoolId: dashboard.school.id,
        name: formState.name,
        slug: formState.slug,
        description: toOptional(formState.description),
        locationCity: toOptional(formState.locationCity),
        locationState: toOptional(formState.locationState),
        airportHome: toOptional(formState.airportHome),
        website: toOptional(formState.website),
        phone: toOptional(formState.phone),
      };
      const res = await apiRequest("PATCH", "/api/cfi/school", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/school"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/schools"] });
      toast({ title: "School updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update school", description: error.message, variant: "destructive" });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      if (!dashboard?.school) throw new Error("No school found");
      const payload = {
        schoolId: dashboard.school.id,
        email: memberForm.email.trim(),
        role: memberForm.role,
      };
      const res = await apiRequest("POST", "/api/cfi/school/members", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/school"] });
      setMemberForm({ email: "", role: "instructor" });
      toast({ title: "Instructor added" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add instructor", description: error.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!dashboard?.school) throw new Error("No school found");
      const res = await apiRequest("DELETE", `/api/cfi/school/members/${memberId}?schoolId=${dashboard.school.id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/school"] });
      toast({ title: "Instructor removed" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove instructor", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Loading school dashboard...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const members = dashboard?.members || [];
  const canManage = dashboard?.role === "owner" || dashboard?.role === "admin";
  const metrics = dashboard?.metrics;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <div className="space-y-2">
          <Badge variant="outline">CFI School Dashboard</Badge>
          <h1 className="text-3xl font-bold">Manage your flight school</h1>
          <p className="text-muted-foreground">
            Create your school profile, invite instructors, and centralize training operations.
          </p>
        </div>

        {dashboard?.school && (
          <Card>
            <CardHeader>
              <CardTitle>School metrics</CardTitle>
              <CardDescription>Snapshot of current training activity.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Instructors</div>
                  <div className="text-2xl font-semibold">{metrics?.instructors ?? members.length}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Active students</div>
                  <div className="text-2xl font-semibold">{metrics?.students ?? 0}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Total lessons</div>
                  <div className="text-2xl font-semibold">{metrics?.lessons ?? 0}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Upcoming lessons</div>
                  <div className="text-2xl font-semibold">{metrics?.upcomingLessons ?? 0}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Completed lessons</div>
                  <div className="text-2xl font-semibold">{metrics?.completedLessons ?? 0}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Milestones completed</div>
                  <div className="text-2xl font-semibold">{metrics?.milestonesCompleted ?? 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{dashboard?.school ? "School profile" : "Create your school"}</CardTitle>
            <CardDescription>
              Keep these details current for instructors and students.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">School name</label>
                <Input
                  value={formState.name}
                  onChange={(event) => setFormState({ ...formState, name: event.target.value })}
                  placeholder="Hill Country Flight Academy"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">School slug</label>
                <Input
                  value={formState.slug}
                  onChange={(event) => setFormState({ ...formState, slug: event.target.value })}
                  placeholder="hill-country-flight"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formState.description}
                  onChange={(event) => setFormState({ ...formState, description: event.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">City</label>
                <Input
                  value={formState.locationCity}
                  onChange={(event) => setFormState({ ...formState, locationCity: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">State</label>
                <Input
                  value={formState.locationState}
                  onChange={(event) => setFormState({ ...formState, locationState: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Home airport</label>
                <Input
                  value={formState.airportHome}
                  onChange={(event) => setFormState({ ...formState, airportHome: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Website</label>
                <Input
                  value={formState.website}
                  onChange={(event) => setFormState({ ...formState, website: event.target.value })}
                  placeholder="https://"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Contact phone</label>
                <Input
                  value={formState.phone}
                  onChange={(event) => setFormState({ ...formState, phone: event.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {dashboard?.school ? (
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !canManage}>
                  {updateMutation.isPending ? "Saving..." : "Save school"}
                </Button>
              ) : (
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create school"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {dashboard?.school && (
          <Card>
            <CardHeader>
              <CardTitle>Instructor roster</CardTitle>
              <CardDescription>Invite instructors who should appear in your school dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto] items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Instructor email</label>
                  <Input
                    value={memberForm.email}
                    onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })}
                    placeholder="instructor@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select
                    value={memberForm.role}
                    onValueChange={(value) => setMemberForm({ ...memberForm, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instructor">Instructor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => addMemberMutation.mutate()}
                  disabled={addMemberMutation.isPending || !memberForm.email.trim() || !canManage}
                >
                  Add instructor
                </Button>
              </div>

              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No instructors added yet.</p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => {
                    const displayName = [member.user?.firstName, member.user?.lastName].filter(Boolean).join(" ");
                    return (
                      <div
                        key={member.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {displayName || member.user?.email || member.userId}
                          </p>
                          <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{member.role}</Badge>
                          {member.role !== "owner" && canManage && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeMemberMutation.mutate(member.id)}
                              disabled={removeMemberMutation.isPending}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
