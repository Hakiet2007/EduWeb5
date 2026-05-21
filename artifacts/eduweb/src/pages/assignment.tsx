import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import AppLayout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDate, timeAgo } from "@/lib/utils";

interface AssignmentDetail {
  id: number;
  title: string;
  description: string | null;
  classId: number;
  className: string;
  dueDate: string | null;
  createdAt: string;
}

interface Submission {
  id: number;
  assignmentId: number;
  studentId: number;
  studentName: string;
  content: string;
  grade: string | null;
  feedback: string | null;
  createdAt: string;
}

export default function AssignmentPage({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const assignmentId = parseInt(params.id ?? "");

  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [gradeOpen, setGradeOpen] = useState<number | null>(null);
  const [gradeForm, setGradeForm] = useState({ grade: "", feedback: "" });
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    if (!loading && !user) setLocation("/auth");
  }, [user, loading, setLocation]);

  const { data: assignment, isLoading } = useQuery<AssignmentDetail>({
    queryKey: [`/api/assignments/${assignmentId}`],
    queryFn: () => fetch(`/api/assignments/${assignmentId}`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!user && !isNaN(assignmentId),
  });

  const { data: submissions, isLoading: subLoading } = useQuery<Submission[]>({
    queryKey: [`/api/assignments/${assignmentId}/submissions`],
    queryFn: () =>
      fetch(`/api/assignments/${assignmentId}/submissions`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!user && !isNaN(assignmentId),
  });

  const mySubmission = user
    ? submissions?.find((s) => s.studentId === user.id)
    : undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Failed to submit");
        return;
      }
      toast.success("Submitted!");
      setContent("");
      qc.invalidateQueries({ queryKey: [`/api/assignments/${assignmentId}/submissions`] });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGrade(submissionId: number) {
    setGrading(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submissions/${submissionId}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(gradeForm),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Failed to grade");
        return;
      }
      toast.success("Graded!");
      setGradeOpen(null);
      setGradeForm({ grade: "", feedback: "" });
      qc.invalidateQueries({ queryKey: [`/api/assignments/${assignmentId}/submissions`] });
    } finally {
      setGrading(false);
    }
  }

  if (loading || !user) return null;
  const isTeacher = user.role === "teacher";

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {isLoading ? (
            <Skeleton className="h-7 w-64" />
          ) : (
            <div>
              <h1 className="text-2xl font-bold">{assignment?.title}</h1>
              <p className="text-sm text-muted-foreground">{assignment?.className}</p>
            </div>
          )}
          {assignment?.dueDate && (
            <Badge variant="outline" className="ml-auto flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {formatDate(assignment.dueDate)}
            </Badge>
          )}
        </div>

        {assignment?.description && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{assignment.description}</p>
            </CardContent>
          </Card>
        )}

        {!isTeacher && (
          <div className="mb-6">
            {mySubmission ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Your Submission
                  </CardTitle>
                  <CardDescription>{timeAgo(mySubmission.createdAt)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap border rounded-md p-3 bg-muted/40">{mySubmission.content}</p>
                  {mySubmission.grade && (
                    <div className="flex items-center gap-3">
                      <Badge>Grade: {mySubmission.grade}</Badge>
                      {mySubmission.feedback && (
                        <p className="text-sm text-muted-foreground">{mySubmission.feedback}</p>
                      )}
                    </div>
                  )}
                  {!mySubmission.grade && (
                    <p className="text-sm text-muted-foreground">Awaiting grade…</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Submit Your Work</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <Label>Your Answer</Label>
                      <Textarea
                        rows={5}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Write your answer here…"
                        required
                      />
                    </div>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Submitting…" : "Submit"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {isTeacher && (
          <div>
            <h2 className="text-lg font-semibold mb-3">
              Submissions {submissions ? `(${submissions.length})` : ""}
            </h2>
            {subLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : !submissions?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No submissions yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.map((s) => (
                  <Card key={s.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                            {s.studentName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-sm">{s.studentName}</span>
                          <span className="text-xs text-muted-foreground">{timeAgo(s.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.grade && <Badge variant="secondary">{s.grade}</Badge>}
                          <Dialog
                            open={gradeOpen === s.id}
                            onOpenChange={(o) => {
                              setGradeOpen(o ? s.id : null);
                              if (o) setGradeForm({ grade: s.grade ?? "", feedback: s.feedback ?? "" });
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                {s.grade ? "Update Grade" : "Grade"}
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Grade Submission</DialogTitle>
                              </DialogHeader>
                              <p className="text-sm text-muted-foreground mb-4">Student: {s.studentName}</p>
                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <Label>Grade</Label>
                                  <Input
                                    value={gradeForm.grade}
                                    onChange={(e) => setGradeForm((p) => ({ ...p, grade: e.target.value }))}
                                    placeholder="e.g. A, 95/100, Pass"
                                    required
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label>Feedback (optional)</Label>
                                  <Textarea
                                    value={gradeForm.feedback}
                                    onChange={(e) => setGradeForm((p) => ({ ...p, feedback: e.target.value }))}
                                    placeholder="Leave feedback for the student…"
                                  />
                                </div>
                                <Button
                                  onClick={() => handleGrade(s.id)}
                                  disabled={grading}
                                  className="w-full"
                                >
                                  {grading ? "Saving…" : "Save Grade"}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap border rounded-md p-3 bg-muted/40">{s.content}</p>
                      {s.feedback && (
                        <p className="text-xs text-muted-foreground mt-2">Feedback: {s.feedback}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
