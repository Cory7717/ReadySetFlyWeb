import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trackEvent } from "@/lib/analytics";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { SignatureDialog } from "@/components/cfi/SignatureDialog";
import type {
  CfiLesson,
  CfiLessonTemplate,
  CfiStudent,
  CfiStudentEndorsement,
  CfiStudentFile,
  CfiStudentMilestone,
  CfiMessage,
} from "@shared/schema";
import { endorsementTemplates } from "@shared/endorsement-templates";

type StudentWithUser = CfiStudent & {
  user?: {
    id: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
  };
};

type ThreadWithStudent = {
  id: string;
  cfiProfileId: string;
  studentId: string;
  updatedAt?: string | null;
  student: CfiStudent;
  user?: {
    id: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
};

type SyntheticVisionSession = {
  id?: string;
  createdAt?: string;
  scenario?: string;
  durationSec?: number;
  avgScore?: number;
  stablePct?: number;
  unstableEvents?: number;
  sampleCount?: number;
};

type SyntheticVisionSessionsResponse = {
  studentId: string;
  studentUserId: string;
  total: number;
  sessions: SyntheticVisionSession[];
};

const LESSON_TYPES = ["flight", "ground", "sim", "brief"];
const LESSON_STATUSES = ["planned", "in_progress", "complete"];
const MILESTONE_STATUSES = ["not_started", "in_progress", "complete"];
const ENDORSEMENT_STATUSES = ["draft", "issued", "signed"];

const toTaskLines = (value: any) => {
  if (Array.isArray(value)) return value.join("\n");
  if (typeof value === "string") return value;
  return "";
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString();
};

export default function CfiTrainingCenter() {
  const { user } = useAuth();
  const entitlements = (user as any)?.entitlements;
  const canUseCfi = !!entitlements?.canUseCfi;
  const queryClient = useQueryClient();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const [studentForm, setStudentForm] = useState({
    email: "",
    startDate: "",
    notes: "",
  });

  const [templateForm, setTemplateForm] = useState({
    title: "",
    lessonType: "flight",
    objective: "",
    tasks: "",
    estimatedMinutes: "",
  });

  const [lessonForm, setLessonForm] = useState({
    templateId: "custom",
    title: "",
    lessonType: "flight",
    objective: "",
    tasks: "",
    scheduledAt: "",
  });

  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    description: "",
    status: "not_started",
    dueDate: "",
  });

  const [endorsementForm, setEndorsementForm] = useState({
    templateId: "custom",
    title: "",
    endorsementType: "",
    templateText: "",
    issuedAt: "",
    instructorName: "",
    instructorCertificate: "",
    aircraftType: "",
    notes: "",
    status: "draft",
  });

  const [messageDraft, setMessageDraft] = useState("");
  const [signatureTarget, setSignatureTarget] = useState<CfiStudentEndorsement | null>(null);

  useEffect(() => {
    trackEvent("cfi_training_view");
  }, []);

  const { data: students = [], isLoading: studentsLoading } = useQuery<StudentWithUser[]>({
    queryKey: ["/api/cfi/students"],
    enabled: canUseCfi,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/cfi/students");
      if (!res.ok) throw new Error("Failed to load students");
      return res.json();
    },
  });

  const { data: templates = [] } = useQuery<CfiLessonTemplate[]>({
    queryKey: ["/api/cfi/lesson-templates"],
    enabled: canUseCfi,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/cfi/lesson-templates");
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
  });

  const { data: lessons = [] } = useQuery<CfiLesson[]>({
    queryKey: ["/api/cfi/students", selectedStudentId, "lessons"],
    enabled: canUseCfi && !!selectedStudentId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/cfi/students/${selectedStudentId}/lessons`);
      if (!res.ok) throw new Error("Failed to load lessons");
      return res.json();
    },
  });

  const { data: studentFiles = [] } = useQuery<CfiStudentFile[]>({
    queryKey: ["/api/cfi/students", selectedStudentId, "files"],
    enabled: canUseCfi && !!selectedStudentId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/cfi/students/${selectedStudentId}/files`);
      if (!res.ok) throw new Error("Failed to load files");
      return res.json();
    },
  });

  const { data: milestones = [] } = useQuery<CfiStudentMilestone[]>({
    queryKey: ["/api/cfi/students", selectedStudentId, "milestones"],
    enabled: canUseCfi && !!selectedStudentId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/cfi/students/${selectedStudentId}/milestones`);
      if (!res.ok) throw new Error("Failed to load milestones");
      return res.json();
    },
  });

  const { data: endorsements = [] } = useQuery<CfiStudentEndorsement[]>({
    queryKey: ["/api/cfi/students", selectedStudentId, "endorsements"],
    enabled: canUseCfi && !!selectedStudentId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/cfi/students/${selectedStudentId}/endorsements`);
      if (!res.ok) throw new Error("Failed to load endorsements");
      return res.json();
    },
  });

  const { data: syntheticVisionData } = useQuery<SyntheticVisionSessionsResponse>({
    queryKey: ["/api/cfi/students", selectedStudentId, "synthetic-vision-sessions"],
    enabled: canUseCfi && !!selectedStudentId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/cfi/students/${selectedStudentId}/synthetic-vision-sessions`);
      if (!res.ok) throw new Error("Failed to load synthetic vision sessions");
      return res.json();
    },
  });

  const { data: threads = [] } = useQuery<ThreadWithStudent[]>({
    queryKey: ["/api/cfi/messages/threads"],
    enabled: canUseCfi,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/cfi/messages/threads");
      if (!res.ok) throw new Error("Failed to load message threads");
      return res.json();
    },
  });

  const activeThread = useMemo(
    () => threads.find((thread) => thread.studentId === selectedStudentId) || null,
    [threads, selectedStudentId]
  );

  const { data: messages = [] } = useQuery<CfiMessage[]>({
    queryKey: ["/api/cfi/messages", activeThread?.id],
    enabled: canUseCfi && !!activeThread?.id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/cfi/messages/${activeThread?.id}`);
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
  });

  useEffect(() => {
    if (!selectedStudentId && students.length > 0) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const completedMilestones = milestones.filter((milestone) => milestone.status === "complete").length;
  const milestoneProgress = milestones.length
    ? Math.round((completedMilestones / milestones.length) * 100)
    : 0;
  const syntheticVisionSessions = syntheticVisionData?.sessions || [];

  useEffect(() => {
    if (lessonForm.templateId === "custom") return;
    const template = templates.find((item) => item.id === lessonForm.templateId);
    if (!template) return;
    const nextTitle = lessonForm.title || template.title || "";
    const nextObjective = lessonForm.objective || template.objective || "";
    const nextTasks = lessonForm.tasks || toTaskLines(template.tasks);
    const nextType = lessonForm.lessonType || template.lessonType || "flight";
    setLessonForm((prev) => ({
      ...prev,
      title: nextTitle,
      objective: nextObjective,
      tasks: nextTasks,
      lessonType: nextType,
    }));
  }, [lessonForm.templateId, templates]);

  useEffect(() => {
    if (endorsementForm.templateId === "custom") return;
    const template = endorsementTemplates.find((item) => item.id === endorsementForm.templateId);
    if (!template) return;
    setEndorsementForm((prev) => ({
      ...prev,
      title: prev.title || template.title,
      endorsementType: prev.endorsementType || template.reference,
      templateText: prev.templateText || template.template,
    }));
  }, [endorsementForm.templateId]);

  const addStudentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cfi/students", {
        email: studentForm.email.trim(),
        startDate: studentForm.startDate || null,
        notes: studentForm.notes || null,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to add student");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/students"] });
      setStudentForm({ email: "", startDate: "", notes: "" });
      toast({ title: "Student added" });
      trackEvent("cfi_student_added");
    },
    onError: (error: any) => {
      toast({ title: "Unable to add student", description: error?.message, variant: "destructive" });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      const tasks = templateForm.tasks
        .split("\n")
        .map((task) => task.trim())
        .filter(Boolean);
      const res = await apiRequest("POST", "/api/cfi/lesson-templates", {
        title: templateForm.title.trim(),
        lessonType: templateForm.lessonType,
        objective: templateForm.objective || null,
        tasks,
        estimatedMinutes: templateForm.estimatedMinutes ? Number(templateForm.estimatedMinutes) : null,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create template");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/lesson-templates"] });
      setTemplateForm({ title: "", lessonType: "flight", objective: "", tasks: "", estimatedMinutes: "" });
      toast({ title: "Template saved" });
      trackEvent("cfi_lesson_template_created");
    },
    onError: (error: any) => {
      toast({ title: "Unable to save template", description: error?.message, variant: "destructive" });
    },
  });

  const createLessonMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudentId) throw new Error("Select a student first");
      const tasks = lessonForm.tasks
        .split("\n")
        .map((task) => task.trim())
        .filter(Boolean);
      const res = await apiRequest("POST", `/api/cfi/students/${selectedStudentId}/lessons`, {
        templateId: lessonForm.templateId === "custom" ? undefined : lessonForm.templateId,
        title: lessonForm.title.trim() || "Lesson",
        lessonType: lessonForm.lessonType,
        objective: lessonForm.objective || null,
        tasks,
        scheduledAt: lessonForm.scheduledAt || null,
        status: "planned",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create lesson");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/students", selectedStudentId, "lessons"] });
      setLessonForm({
        templateId: "custom",
        title: "",
        lessonType: "flight",
        objective: "",
        tasks: "",
        scheduledAt: "",
      });
      toast({ title: "Lesson assigned" });
      trackEvent("cfi_lesson_created");
    },
    onError: (error: any) => {
      toast({ title: "Unable to create lesson", description: error?.message, variant: "destructive" });
    },
  });

  const updateLessonMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CfiLesson> }) => {
      const res = await apiRequest("PATCH", `/api/cfi/lessons/${id}`, updates);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update lesson");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/students", selectedStudentId, "lessons"] });
    },
    onError: (error: any) => {
      toast({ title: "Unable to update lesson", description: error?.message, variant: "destructive" });
    },
  });

  const deleteLessonMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/cfi/lessons/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete lesson");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/students", selectedStudentId, "lessons"] });
      toast({ title: "Lesson deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Unable to delete lesson", description: error?.message, variant: "destructive" });
    },
  });

  const createMilestoneMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudentId) throw new Error("Select a student first");
      const res = await apiRequest("POST", `/api/cfi/students/${selectedStudentId}/milestones`, {
        title: milestoneForm.title.trim(),
        description: milestoneForm.description || null,
        status: milestoneForm.status,
        dueDate: milestoneForm.dueDate || null,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to add milestone");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/students", selectedStudentId, "milestones"] });
      setMilestoneForm({ title: "", description: "", status: "not_started", dueDate: "" });
      toast({ title: "Milestone added" });
      trackEvent("cfi_milestone_created");
    },
    onError: (error: any) => {
      toast({ title: "Unable to add milestone", description: error?.message, variant: "destructive" });
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CfiStudentMilestone> }) => {
      const res = await apiRequest("PATCH", `/api/cfi/milestones/${id}`, updates);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update milestone");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/students", selectedStudentId, "milestones"] });
      trackEvent("cfi_milestone_updated");
    },
    onError: (error: any) => {
      toast({ title: "Unable to update milestone", description: error?.message, variant: "destructive" });
    },
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/cfi/milestones/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete milestone");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/students", selectedStudentId, "milestones"] });
      toast({ title: "Milestone removed" });
      trackEvent("cfi_milestone_deleted");
    },
    onError: (error: any) => {
      toast({ title: "Unable to delete milestone", description: error?.message, variant: "destructive" });
    },
  });

  const createEndorsementMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudentId) throw new Error("Select a student first");
      const res = await apiRequest("POST", `/api/cfi/students/${selectedStudentId}/endorsements`, {
        title: endorsementForm.title.trim(),
        endorsementType: endorsementForm.endorsementType || null,
        templateText: endorsementForm.templateText || null,
        issuedAt: endorsementForm.issuedAt || null,
        instructorName: endorsementForm.instructorName || null,
        instructorCertificate: endorsementForm.instructorCertificate || null,
        aircraftType: endorsementForm.aircraftType || null,
        notes: endorsementForm.notes || null,
        status: endorsementForm.status || "draft",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create endorsement");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/students", selectedStudentId, "endorsements"] });
      setEndorsementForm({
        templateId: "custom",
        title: "",
        endorsementType: "",
        templateText: "",
        issuedAt: "",
        instructorName: "",
        instructorCertificate: "",
        aircraftType: "",
        notes: "",
        status: "draft",
      });
      toast({ title: "Endorsement created" });
      trackEvent("cfi_endorsement_created");
    },
    onError: (error: any) => {
      toast({ title: "Unable to create endorsement", description: error?.message, variant: "destructive" });
    },
  });

  const updateEndorsementMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CfiStudentEndorsement> }) => {
      const res = await apiRequest("PATCH", `/api/cfi/endorsements/${id}`, updates);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update endorsement");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/students", selectedStudentId, "endorsements"] });
      trackEvent("cfi_endorsement_updated");
    },
    onError: (error: any) => {
      toast({ title: "Unable to update endorsement", description: error?.message, variant: "destructive" });
    },
  });

  const signEndorsementMutation = useMutation({
    mutationFn: async ({
      id,
      signatureDataUrl,
      signedByName,
    }: {
      id: string;
      signatureDataUrl: string;
      signedByName: string;
    }) => {
      const res = await apiRequest("POST", `/api/cfi/endorsements/${id}/sign`, {
        signatureDataUrl,
        signedByName,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to sign endorsement");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/students", selectedStudentId, "endorsements"] });
      setSignatureTarget(null);
      toast({ title: "Endorsement signed" });
      trackEvent("cfi_endorsement_signed");
    },
    onError: (error: any) => {
      toast({ title: "Unable to sign endorsement", description: error?.message, variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!activeThread?.id) throw new Error("Select a student first");
      const res = await apiRequest("POST", `/api/cfi/messages/${activeThread.id}`, {
        body: messageDraft.trim(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to send message");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cfi/messages", activeThread?.id] });
      setMessageDraft("");
      trackEvent("cfi_message_sent");
    },
    onError: (error: any) => {
      toast({ title: "Unable to send message", description: error?.message, variant: "destructive" });
    },
  });

  const formatStudentName = (student?: StudentWithUser | null) => {
    if (!student?.user) return student?.studentUserId || "Student";
    const fullName = [student.user.firstName, student.user.lastName].filter(Boolean).join(" ");
    return fullName || student.user.email || "Student";
  };

  if (!canUseCfi) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>CFI Training Center</CardTitle>
            <CardDescription>
              Start a CFI trial or upgrade to unlock training workflows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <a href="/dashboard/cfi">Go to CFI dashboard</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <div className="space-y-2">
          <Badge variant="outline">CFI Training Center</Badge>
          <h1 className="text-3xl font-bold">Manage students and training plans</h1>
          <p className="text-muted-foreground">
            Track student progress, build lesson templates, and keep training organized.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
          <div className="lg:sticky lg:top-6 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your students</CardTitle>
                <CardDescription>
                  {students.length} student{students.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {studentsLoading ? (
                  <div className="text-xs text-muted-foreground px-1">
                    Loading...
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-xs text-muted-foreground px-1">
                    No students yet.
                  </div>
                ) : (
                  students.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => setSelectedStudentId(student.id)}
                      className={[
                        "w-full rounded-lg border px-3 py-2.5",
                        "text-left text-sm transition-colors",
                        student.id === selectedStudentId
                          ? "border-primary/60 bg-primary/5 font-medium"
                          : "hover:bg-muted/40",
                      ].join(" ")}
                    >
                      <div className="font-medium truncate">
                        {formatStudentName(student)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {student.user?.email}
                      </div>
                      <div className="mt-1">
                        <Badge variant="outline" className="text-[10px] h-4">
                          {student.status || "active"}
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Add student</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-3 pt-0">
                <Input
                  placeholder="student@email.com"
                  value={studentForm.email}
                  onChange={(event) => setStudentForm({ ...studentForm, email: event.target.value })}
                />
                <Input
                  type="date"
                  value={studentForm.startDate}
                  onChange={(event) => setStudentForm({ ...studentForm, startDate: event.target.value })}
                />
                <Button
                  className="w-full"
                  onClick={() => addStudentMutation.mutate()}
                  disabled={addStudentMutation.isPending || !studentForm.email.trim()}
                >
                  {addStudentMutation.isPending ? "Adding..." : "Add student"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 min-w-0">
            {selectedStudent && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Lessons</div>
                  <div className="text-2xl font-bold">{lessons.length}</div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">
                    Milestones
                  </div>
                  <div className="text-2xl font-bold">
                    {completedMilestones}/{milestones.length}
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">
                    Endorsements
                  </div>
                  <div className="text-2xl font-bold">{endorsements.length}</div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">
                    Synth sessions
                  </div>
                  <div className="text-2xl font-bold">
                    {syntheticVisionSessions.length}
                  </div>
                </div>
              </div>
            )}

        <Card>
          <CardHeader>
            <CardTitle>Lesson templates</CardTitle>
            <CardDescription>Reuse common lesson plans across students.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Template title"
                value={templateForm.title}
                onChange={(event) => setTemplateForm({ ...templateForm, title: event.target.value })}
              />
              <Select
                value={templateForm.lessonType}
                onValueChange={(value) => setTemplateForm({ ...templateForm, lessonType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Lesson type" />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Estimated minutes"
                type="number"
                value={templateForm.estimatedMinutes}
                onChange={(event) => setTemplateForm({ ...templateForm, estimatedMinutes: event.target.value })}
              />
              <Input
                placeholder="Objective (optional)"
                value={templateForm.objective}
                onChange={(event) => setTemplateForm({ ...templateForm, objective: event.target.value })}
              />
            </div>
            <Textarea
              placeholder="Tasks (one per line)"
              value={templateForm.tasks}
              onChange={(event) => setTemplateForm({ ...templateForm, tasks: event.target.value })}
              rows={4}
            />
            <Button
              onClick={() => createTemplateMutation.mutate()}
              disabled={createTemplateMutation.isPending || !templateForm.title.trim()}
            >
              {createTemplateMutation.isPending ? "Saving..." : "Save template"}
            </Button>

            {templates.length > 0 && (
              <div className="grid gap-2">
                {templates.map((template) => (
                  <div key={template.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{template.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {template.lessonType || "lesson"} • {template.estimatedMinutes || "—"} min
                        </div>
                      </div>
                    </div>
                    {template.objective && (
                      <div className="text-xs text-muted-foreground mt-2">{template.objective}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assign lessons</CardTitle>
            <CardDescription>
              {selectedStudent ? `Build a plan for ${formatStudentName(selectedStudent)}.` : "Select a student first."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                value={lessonForm.templateId}
                onValueChange={(value) => {
                  if (value === "custom") {
                    setLessonForm((prev) => ({
                      ...prev,
                      templateId: value,
                      title: "",
                      lessonType: "flight",
                      objective: "",
                      tasks: "",
                    }));
                    return;
                  }
                  setLessonForm((prev) => ({ ...prev, templateId: value }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom lesson</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Lesson title"
                value={lessonForm.title}
                onChange={(event) => setLessonForm({ ...lessonForm, title: event.target.value })}
              />
              <Select
                value={lessonForm.lessonType}
                onValueChange={(value) => setLessonForm({ ...lessonForm, lessonType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Lesson type" />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="datetime-local"
                value={lessonForm.scheduledAt}
                onChange={(event) => setLessonForm({ ...lessonForm, scheduledAt: event.target.value })}
              />
              <Input
                placeholder="Objective (optional)"
                value={lessonForm.objective}
                onChange={(event) => setLessonForm({ ...lessonForm, objective: event.target.value })}
              />
            </div>
            <Textarea
              placeholder="Tasks (one per line)"
              value={lessonForm.tasks}
              onChange={(event) => setLessonForm({ ...lessonForm, tasks: event.target.value })}
              rows={4}
            />
            <Button
              onClick={() => createLessonMutation.mutate()}
              disabled={createLessonMutation.isPending || !selectedStudentId}
            >
              {createLessonMutation.isPending ? "Assigning..." : "Assign lesson"}
            </Button>

            {lessons.length === 0 ? (
              <div className="text-sm text-muted-foreground">No lessons assigned yet.</div>
            ) : (
              <div className="space-y-3">
                {lessons.map((lesson) => (
                  <div key={lesson.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{lesson.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {lesson.lessonType || "lesson"} • {lesson.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={lesson.status || "planned"}
                          onValueChange={(value) => updateLessonMutation.mutate({ id: lesson.id, updates: { status: value } })}
                        >
                          <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LESSON_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteLessonMutation.mutate(lesson.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    {lesson.objective && (
                      <div className="text-xs text-muted-foreground mt-2">{lesson.objective}</div>
                    )}
                    {Array.isArray(lesson.tasks) && lesson.tasks.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground space-y-1">
                        {lesson.tasks.map((task, index) => (
                          <li key={`${lesson.id}-task-${index}`}>{String(task)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress milestones</CardTitle>
            <CardDescription>Track ACS items and stage gates for the selected student.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedStudent ? (
              <div className="text-sm text-muted-foreground">Select a student to manage milestones.</div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="milestone-title">Milestone title</Label>
                    <Input
                      id="milestone-title"
                      placeholder="Milestone title"
                      value={milestoneForm.title}
                      onChange={(event) => setMilestoneForm({ ...milestoneForm, title: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="milestone-status">Status</Label>
                    <Select
                      value={milestoneForm.status}
                      onValueChange={(value) => setMilestoneForm({ ...milestoneForm, status: value })}
                    >
                      <SelectTrigger id="milestone-status">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {MILESTONE_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="milestone-due-date">Due date</Label>
                    <Input
                      id="milestone-due-date"
                      type="date"
                      value={milestoneForm.dueDate}
                      onChange={(event) => setMilestoneForm({ ...milestoneForm, dueDate: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="milestone-description">Reference</Label>
                    <Input
                      id="milestone-description"
                      placeholder="ACS area or reference (optional)"
                      value={milestoneForm.description}
                      onChange={(event) => setMilestoneForm({ ...milestoneForm, description: event.target.value })}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => createMilestoneMutation.mutate()}
                    disabled={createMilestoneMutation.isPending || !milestoneForm.title.trim()}
                  >
                    {createMilestoneMutation.isPending ? "Adding..." : "Add milestone"}
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    Progress: {completedMilestones}/{milestones.length} complete ({milestoneProgress}%)
                  </div>
                </div>
                <Progress value={milestoneProgress} className="h-2" />

                {milestones.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No milestones yet.</div>
                ) : (
                  <div className="space-y-2">
                    {milestones.map((milestone) => (
                      <div key={milestone.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{milestone.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {milestone.status} - due {formatDate(milestone.dueDate as any)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={milestone.status || "not_started"}
                              onValueChange={(value) =>
                                updateMilestoneMutation.mutate({
                                  id: milestone.id,
                                  updates: {
                                    status: value,
                                    completedAt: value === "complete" ? new Date().toISOString() : null,
                                  } as any,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 w-[160px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MILESTONE_STATUSES.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMilestoneMutation.mutate(milestone.id)}
                              disabled={deleteMilestoneMutation.isPending}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                        {milestone.description && (
                          <div className="text-xs text-muted-foreground">{milestone.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Synthetic Vision Sessions</CardTitle>
            <CardDescription>
              Review scored RSF Synthetic Vision Lab sessions for the selected student.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedStudent ? (
              <div className="text-sm text-muted-foreground">Select a student to view synthetic sessions.</div>
            ) : syntheticVisionSessions.length === 0 ? (
              <div className="text-sm text-muted-foreground">No synthetic sessions saved yet.</div>
            ) : (
              <div className="space-y-2">
                {syntheticVisionSessions.slice(0, 15).map((session) => (
                  <div key={session.id || `${session.createdAt}-${session.scenario}`} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{session.scenario || "Synthetic session"}</div>
                      <Badge variant="outline">
                        {typeof session.avgScore === "number" ? `AVG ${session.avgScore}` : "AVG --"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatDate(session.createdAt || null)}</span>
                      <span>{typeof session.durationSec === "number" ? `${session.durationSec}s` : "--"}</span>
                      <span>{typeof session.stablePct === "number" ? `Stable ${session.stablePct}%` : "Stable --"}</span>
                      <span>{typeof session.unstableEvents === "number" ? `Unstable ${session.unstableEvents}` : "Unstable --"}</span>
                      <span>{typeof session.sampleCount === "number" ? `Samples ${session.sampleCount}` : "Samples --"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endorsements & sign-offs</CardTitle>
            <CardDescription>Create endorsements and capture signatures for this student.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedStudent ? (
              <div className="text-sm text-muted-foreground">Select a student to manage endorsements.</div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <Select
                    value={endorsementForm.templateId}
                    onValueChange={(value) => {
                      if (value === "custom") {
                        setEndorsementForm((prev) => ({
                          ...prev,
                          templateId: value,
                          title: "",
                          endorsementType: "",
                          templateText: "",
                        }));
                        return;
                      }
                      setEndorsementForm((prev) => ({ ...prev, templateId: value }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Template (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom endorsement</SelectItem>
                      {endorsementTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Endorsement title"
                    value={endorsementForm.title}
                    onChange={(event) => setEndorsementForm({ ...endorsementForm, title: event.target.value })}
                  />
                  <Input
                    placeholder="Endorsement type / ref (optional)"
                    value={endorsementForm.endorsementType}
                    onChange={(event) => setEndorsementForm({ ...endorsementForm, endorsementType: event.target.value })}
                  />
                  <Input
                    type="date"
                    value={endorsementForm.issuedAt}
                    onChange={(event) => setEndorsementForm({ ...endorsementForm, issuedAt: event.target.value })}
                  />
                  <Input
                    placeholder="Instructor name"
                    value={endorsementForm.instructorName}
                    onChange={(event) => setEndorsementForm({ ...endorsementForm, instructorName: event.target.value })}
                  />
                  <Input
                    placeholder="Instructor certificate"
                    value={endorsementForm.instructorCertificate}
                    onChange={(event) => setEndorsementForm({ ...endorsementForm, instructorCertificate: event.target.value })}
                  />
                  <Input
                    placeholder="Aircraft type (optional)"
                    value={endorsementForm.aircraftType}
                    onChange={(event) => setEndorsementForm({ ...endorsementForm, aircraftType: event.target.value })}
                  />
                  <Select
                    value={endorsementForm.status}
                    onValueChange={(value) => setEndorsementForm({ ...endorsementForm, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENDORSEMENT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder="Endorsement text (optional)"
                  value={endorsementForm.templateText}
                  onChange={(event) => setEndorsementForm({ ...endorsementForm, templateText: event.target.value })}
                  rows={4}
                />
                <Textarea
                  placeholder="Notes (optional)"
                  value={endorsementForm.notes}
                  onChange={(event) => setEndorsementForm({ ...endorsementForm, notes: event.target.value })}
                  rows={3}
                />
                <Button
                  onClick={() => createEndorsementMutation.mutate()}
                  disabled={createEndorsementMutation.isPending || !endorsementForm.title.trim()}
                >
                  {createEndorsementMutation.isPending ? "Saving..." : "Create endorsement"}
                </Button>

                {endorsements.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No endorsements created yet.</div>
                ) : (
                  <div className="space-y-3">
                    {endorsements.map((endorsement) => (
                      <div key={endorsement.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{endorsement.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {endorsement.status} - issued {formatDate(endorsement.issuedAt as any)}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {endorsement.status !== "signed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateEndorsementMutation.mutate({
                                    id: endorsement.id,
                                    updates: {
                                      status: "issued",
                                      issuedAt: endorsement.issuedAt || new Date().toISOString().slice(0, 10),
                                    } as any,
                                  })
                                }
                              >
                                Mark issued
                              </Button>
                            )}
                            {endorsement.status !== "signed" && (
                              <Button size="sm" onClick={() => setSignatureTarget(endorsement)}>
                                Sign
                              </Button>
                            )}
                          </div>
                        </div>
                        {endorsement.endorsementType && (
                          <div className="text-xs text-muted-foreground">{endorsement.endorsementType}</div>
                        )}
                        {endorsement.templateText && (
                          <div className="rounded-md bg-muted/60 p-2 text-xs whitespace-pre-wrap">
                            {endorsement.templateText}
                          </div>
                        )}
                        {endorsement.notes && (
                          <div className="text-xs text-muted-foreground">{endorsement.notes}</div>
                        )}
                        {endorsement.signatureDataUrl && (
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                              Signed by {endorsement.signedByName || "CFI"}{" "}
                              {endorsement.signedAt ? `on ${new Date(endorsement.signedAt as any).toLocaleString()}` : ""}
                            </div>
                            <img
                              src={endorsement.signatureDataUrl}
                              alt="Signature"
                              className="h-20 rounded border bg-white p-2"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
            <CardDescription>Coordinate directly with your student inside RSF.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedStudent ? (
              <div className="text-sm text-muted-foreground">Select a student to view messages.</div>
            ) : !activeThread ? (
              <div className="text-sm text-muted-foreground">Message thread not ready yet.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="space-y-2">
                  {threads.map((thread) => {
                    const name = [thread.user?.firstName, thread.user?.lastName].filter(Boolean).join(" ");
                    const isActive = thread.studentId === selectedStudentId;
                    return (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => setSelectedStudentId(thread.studentId)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                          isActive ? "border-primary/60 bg-primary/5" : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="font-medium">{name || thread.user?.email || "Student"}</div>
                        <div className="text-xs text-muted-foreground">{thread.student?.status || "active"}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-3">
                  <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-3">
                    {messages.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No messages yet.</div>
                    ) : (
                      messages.map((message) => {
                        const isMe = message.senderUserId === user?.id;
                        return (
                          <div
                            key={message.id}
                            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                              isMe ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
                            }`}
                          >
                            {message.body}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <Textarea
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    rows={3}
                    placeholder="Write a quick update or question"
                  />
                  <Button
                    onClick={() => sendMessageMutation.mutate()}
                    disabled={sendMessageMutation.isPending || !messageDraft.trim()}
                  >
                    Send message
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Student documents</CardTitle>
            <CardDescription>Shared training files for the selected student.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedStudent ? (
              <div className="text-sm text-muted-foreground">Select a student to view files.</div>
            ) : studentFiles.length === 0 ? (
              <div className="text-sm text-muted-foreground">No files uploaded yet.</div>
            ) : (
              <div className="space-y-2">
                {studentFiles.map((file) => (
                  <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                    <div>
                      <div className="text-sm font-semibold">{file.fileName}</div>
                      <div className="text-xs text-muted-foreground">{file.mimeType || "document"}</div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href={apiUrl(`/api/cfi/students/files/${file.id}/download`)} target="_blank" rel="noopener noreferrer">
                        Download
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endorsement templates (reference)</CardTitle>
            <CardDescription>
              Use official FAA wording from AC 61-65. These are starting drafts for your workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {endorsementTemplates.map((template) => (
              <div key={template.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{template.title}</div>
                    <div className="text-xs text-muted-foreground">{template.reference}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(template.template);
                      toast({ title: "Template copied" });
                      trackEvent("cfi_endorsement_template_copied", { id: template.id });
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">{template.summary}</div>
                <div className="rounded-md bg-muted/60 p-2 text-xs font-mono whitespace-pre-wrap">
                  {template.template}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
          </div>
        </div>

        <SignatureDialog
          open={!!signatureTarget}
          onOpenChange={(open) => {
            if (!open) setSignatureTarget(null);
          }}
          onSign={(signatureDataUrl, signedByName) => {
            if (!signatureTarget) return;
            signEndorsementMutation.mutate({
              id: signatureTarget.id,
              signatureDataUrl,
              signedByName,
            });
          }}
          isPending={signEndorsementMutation.isPending}
          title="Sign endorsement"
          description="Capture a signature to finalize this endorsement."
        />
      </div>
    </div>
  );
}
