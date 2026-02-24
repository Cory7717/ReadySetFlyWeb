import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ObjectUploader } from "@/components/ObjectUploader";
import { trackEvent } from "@/lib/analytics";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import type {
  CfiLesson,
  CfiMessage,
  CfiProfile,
  CfiStudent,
  CfiStudentEndorsement,
  CfiStudentFile,
  CfiStudentMilestone,
} from "@shared/schema";

type TrainingPayload = {
  student: CfiStudent | null;
  cfiProfile: CfiProfile | null;
  lessons: CfiLesson[];
  files: CfiStudentFile[];
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString();
};

export default function StudentTraining() {
  const queryClient = useQueryClient();
  const uploadMeta = useRef(
    new Map<
      string,
      { storageProvider: string; storagePath: string; fileName: string; fileSizeBytes?: number; mimeType?: string }
    >()
  );
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [messageDraft, setMessageDraft] = useState("");

  useEffect(() => {
    trackEvent("student_training_view");
  }, []);

  const { data, isLoading } = useQuery<TrainingPayload>({
    queryKey: ["/api/student/training"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/student/training");
      if (!res.ok) throw new Error("Failed to load training data");
      return res.json();
    },
  });

  const { data: milestones = [] } = useQuery<CfiStudentMilestone[]>({
    queryKey: ["/api/student/training/milestones"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/student/training/milestones");
      if (!res.ok) throw new Error("Failed to load milestones");
      return res.json();
    },
  });

  const { data: endorsements = [] } = useQuery<CfiStudentEndorsement[]>({
    queryKey: ["/api/student/training/endorsements"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/student/training/endorsements");
      if (!res.ok) throw new Error("Failed to load endorsements");
      return res.json();
    },
  });

  const { data: threads = [] } = useQuery<{ id: string }[]>({
    queryKey: ["/api/student/messages/threads"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/student/messages/threads");
      if (!res.ok) throw new Error("Failed to load threads");
      return res.json();
    },
  });

  const activeThread = threads[0] || null;

  const { data: messages = [] } = useQuery<CfiMessage[]>({
    queryKey: ["/api/student/messages", activeThread?.id],
    enabled: !!activeThread?.id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/student/messages/${activeThread?.id}`);
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
  });

  useEffect(() => {
    if (!data?.lessons) return;
    const draftMap: Record<string, string> = {};
    data.lessons.forEach((lesson) => {
      draftMap[lesson.id] = lesson.studentNotes || "";
    });
    setNoteDrafts(draftMap);
  }, [data?.lessons]);

  const saveNotesMutation = useMutation({
    mutationFn: async ({ lessonId, notes }: { lessonId: string; notes: string }) => {
      const res = await apiRequest("PATCH", `/api/student/training/lessons/${lessonId}`, {
        studentNotes: notes,
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to save notes");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student/training"] });
      toast({ title: "Notes saved" });
    },
    onError: (error: any) => {
      toast({ title: "Unable to save notes", description: error?.message, variant: "destructive" });
    },
  });

  const handleUploadParameters = async (file?: { id?: string; name?: string; type?: string; size?: number }) => {
    const res = await apiRequest("POST", "/api/student/training/files/upload", {
      fileName: file?.name || "training-file",
      contentType: file?.type || "application/pdf",
    });
    const data = await res.json();
    if (file?.id) {
      uploadMeta.current.set(file.id, {
        storageProvider: data.storageProvider,
        storagePath: data.storagePath,
        fileName: file?.name || "training-file",
        fileSizeBytes: file?.size,
        mimeType: file?.type,
      });
    }
    return { method: "PUT" as const, url: data.uploadURL };
  };

  const handleUploadComplete = async (result: any) => {
    const successfulFiles = (result?.successful ?? []) as Array<{ id?: string }>;
    if (!successfulFiles.length) {
      toast({ title: "No uploads detected", description: "Please try again.", variant: "destructive" });
      return;
    }
    let created = 0;
    for (const file of successfulFiles) {
      if (!file?.id) continue;
      const meta = uploadMeta.current.get(file.id);
      if (!meta) continue;
      await apiRequest("POST", "/api/student/training/files", {
        fileName: meta.fileName,
        fileSizeBytes: meta.fileSizeBytes ?? null,
        storageProvider: meta.storageProvider,
        storagePath: meta.storagePath,
        mimeType: meta.mimeType,
      });
      created += 1;
    }
    uploadMeta.current.clear();
    if (created > 0) {
      queryClient.invalidateQueries({ queryKey: ["/api/student/training"] });
      toast({ title: "Files uploaded", description: `${created} file(s) added.` });
      trackEvent("student_training_file_uploaded", { count: created });
    }
  };

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await apiRequest("DELETE", `/api/student/training/files/${fileId}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to delete file");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student/training"] });
      toast({ title: "File deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Unable to delete file", description: error?.message, variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!activeThread?.id) throw new Error("Conversation not ready");
      const res = await apiRequest("POST", `/api/student/messages/${activeThread.id}`, {
        body: messageDraft.trim(),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to send message");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student/messages", activeThread?.id] });
      setMessageDraft("");
      trackEvent("student_message_sent");
    },
    onError: (error: any) => {
      toast({ title: "Unable to send message", description: error?.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <StudentLayout title="Training Workspace" subtitle="Loading your training plan...">
        <div className="text-sm text-muted-foreground">Loading training data...</div>
      </StudentLayout>
    );
  }

  if (!data?.student) {
    return (
      <StudentLayout
        title="Training Workspace"
        subtitle="Your assigned training plan will appear here once a CFI adds you."
      >
        <div className="text-sm text-muted-foreground">
          Ask your instructor to add you to their RSF training roster.
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout
      title="Training Workspace"
      subtitle="Track lessons, add notes, and store your training documents."
    >
      <Card>
        <CardHeader>
          <CardTitle>Your instructor</CardTitle>
          <CardDescription>Keep this information for quick coordination.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm font-semibold">{data.cfiProfile?.displayName || "CFI"}</div>
          <div className="text-xs text-muted-foreground">
            {data.cfiProfile?.airportHome || "Home airport"} • {data.cfiProfile?.locationCity || "City"}
          </div>
          {data.cfiProfile?.contactNote && (
            <div className="text-xs text-muted-foreground mt-2">{data.cfiProfile.contactNote}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assigned lessons</CardTitle>
          <CardDescription>Review objectives and capture your own notes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.lessons.length === 0 ? (
            <div className="text-sm text-muted-foreground">No lessons assigned yet.</div>
          ) : (
            data.lessons.map((lesson) => (
              <div key={lesson.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{lesson.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {lesson.lessonType || "lesson"} • {lesson.status}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {lesson.scheduledAt ? `Scheduled ${formatDateTime(lesson.scheduledAt as any)}` : "Schedule TBD"}
                  </div>
                </div>
                {lesson.objective && (
                  <div className="text-xs text-muted-foreground">{lesson.objective}</div>
                )}
                {Array.isArray(lesson.tasks) && lesson.tasks.length > 0 && (
                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                    {lesson.tasks.map((task, index) => (
                      <li key={`${lesson.id}-task-${index}`}>{String(task)}</li>
                    ))}
                  </ul>
                )}
                <Textarea
                  value={noteDrafts[lesson.id] ?? ""}
                  onChange={(event) =>
                    setNoteDrafts((prev) => ({ ...prev, [lesson.id]: event.target.value }))
                  }
                  rows={3}
                  placeholder="Add your notes after the lesson"
                />
                <Button
                  size="sm"
                  onClick={() => saveNotesMutation.mutate({ lessonId: lesson.id, notes: noteDrafts[lesson.id] || "" })}
                  disabled={saveNotesMutation.isPending}
                >
                  Save notes
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Progress milestones</CardTitle>
          <CardDescription>Track your ACS progress and training checkpoints.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {milestones.length === 0 ? (
            <div className="text-sm text-muted-foreground">No milestones shared yet.</div>
          ) : (
            milestones.map((milestone) => (
              <div key={milestone.id} className="rounded-lg border p-3 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{milestone.title}</div>
                  <div className="text-xs text-muted-foreground">{milestone.status}</div>
                </div>
                {milestone.description && (
                  <div className="text-xs text-muted-foreground">{milestone.description}</div>
                )}
                <div className="text-xs text-muted-foreground">
                  Due {formatDate(milestone.dueDate as any)}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endorsements</CardTitle>
          <CardDescription>Review endorsements and sign-offs from your instructor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {endorsements.length === 0 ? (
            <div className="text-sm text-muted-foreground">No endorsements yet.</div>
          ) : (
            endorsements.map((endorsement) => (
              <div key={endorsement.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{endorsement.title}</div>
                  <div className="text-xs text-muted-foreground">{endorsement.status}</div>
                </div>
                {endorsement.endorsementType && (
                  <div className="text-xs text-muted-foreground">{endorsement.endorsementType}</div>
                )}
                {endorsement.templateText && (
                  <div className="rounded-md bg-muted/60 p-2 text-xs whitespace-pre-wrap">
                    {endorsement.templateText}
                  </div>
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
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Messages with your CFI</CardTitle>
          <CardDescription>Keep communication tied to your training plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!activeThread ? (
            <div className="text-sm text-muted-foreground">Messaging will appear once your CFI is connected.</div>
          ) : (
            <>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3">
                {messages.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No messages yet.</div>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className="rounded-lg bg-muted px-3 py-2 text-sm">
                      {message.body}
                    </div>
                  ))
                )}
              </div>
              <Textarea
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                rows={3}
                placeholder="Share an update or ask a question"
              />
              <Button
                onClick={() => sendMessageMutation.mutate()}
                disabled={sendMessageMutation.isPending || !messageDraft.trim()}
              >
                Send message
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Training documents</CardTitle>
          <CardDescription>Upload PDFs or images to keep everything in one place.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ObjectUploader
            maxNumberOfFiles={5}
            maxFileSize={25 * 1024 * 1024}
            allowedFileTypes={["application/pdf", "image/*"]}
            enableImageEditor={false}
            buttonVariant="outline"
            onGetUploadParameters={handleUploadParameters}
            onComplete={handleUploadComplete}
            onError={(message) => toast({ title: "Upload failed", description: message, variant: "destructive" })}
          >
            Upload training files
          </ObjectUploader>

          {data.files.length === 0 ? (
            <div className="text-sm text-muted-foreground">No files uploaded yet.</div>
          ) : (
            <div className="space-y-2">
              {data.files.map((file) => (
                <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-semibold">{file.fileName}</div>
                    <div className="text-xs text-muted-foreground">
                      {file.mimeType || "document"} • {formatDateTime(file.createdAt as any)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={apiUrl(`/api/student/training/files/${file.id}/download`)} target="_blank" rel="noreferrer">
                        Download
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteFileMutation.mutate(file.id)}
                      disabled={deleteFileMutation.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </StudentLayout>
  );
}
