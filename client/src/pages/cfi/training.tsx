import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trackEvent } from "@/lib/analytics";
import { apiRequest, apiUrl } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import type { CfiLesson, CfiLessonTemplate, CfiStudent, CfiStudentFile } from "@shared/schema";
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

const LESSON_TYPES = ["flight", "ground", "sim", "brief"];
const LESSON_STATUSES = ["planned", "in_progress", "complete"];

const toTaskLines = (value: any) => {
  if (Array.isArray(value)) return value.join("\n");
  if (typeof value === "string") return value;
  return "";
};

export default function CfiTrainingCenter() {
  const { entitlements } = useAuth();
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

  useEffect(() => {
    if (!selectedStudentId && students.length > 0) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

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

        <Card>
          <CardHeader>
            <CardTitle>Student roster</CardTitle>
            <CardDescription>Add students who already have RSF accounts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
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
              <Input
                placeholder="Notes (optional)"
                value={studentForm.notes}
                onChange={(event) => setStudentForm({ ...studentForm, notes: event.target.value })}
              />
            </div>
            <Button
              onClick={() => addStudentMutation.mutate()}
              disabled={addStudentMutation.isPending || !studentForm.email.trim()}
            >
              {addStudentMutation.isPending ? "Adding..." : "Add student"}
            </Button>

            {studentsLoading ? (
              <div className="text-sm text-muted-foreground">Loading students...</div>
            ) : students.length === 0 ? (
              <div className="text-sm text-muted-foreground">No students yet.</div>
            ) : (
              <div className="grid gap-2">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${
                      student.id === selectedStudentId ? "border-primary/60 bg-primary/5" : ""
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold">{formatStudentName(student)}</div>
                      <div className="text-xs text-muted-foreground">{student.user?.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{student.status || "active"}</Badge>
                      <Button
                        variant={student.id === selectedStudentId ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedStudentId(student.id)}
                      >
                        {student.id === selectedStudentId ? "Selected" : "View"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
                      <a href={apiUrl(`/api/cfi/students/files/${file.id}/download`)} target="_blank" rel="noreferrer">
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
  );
}
