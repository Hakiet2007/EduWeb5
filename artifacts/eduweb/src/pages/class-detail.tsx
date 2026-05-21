import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import AppLayout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowLeft, Hash, Calendar } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface ClassDetail {
  id: number;
  name: string;
  description: string | null;
  inviteCode: string;
  teacherId: number;
  teacherName: string;
  createdAt: string;
  students: { id: number; name: string; email: string; role: string }[];
  assignments: {
    id: number;
    title: string;
    description: string | null;
    classId: number;
    className: string;
    dueDate: string | null;
    createdAt: string;
  }[];
}

export default function ClassDetailPage({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const classId = parseInt(params.id ?? "");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) setLocation("/auth");
  }, [user, loading, setLocation]);

  const { data: cls, isLoading } = useQuery<ClassDetail>({
    queryKey: [`/api/classes/${classId}`],
    queryFn: () => fetch(`/api/classes/${classId}`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!user && !isNaN(classId),
  });

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, classId, dueDate: form.dueDate || null }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Failed to create assignment");
        return;
      }
      toast.success("Assignment created!");
      setCreateOpen(false);
      setForm({ title: "", description: "", dueDate: "" });
      qc.invalidateQueries({ queryKey: [`/api/classes/${classId}`] });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;
  const isTeacher = user.role === "teacher";

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/classes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {isLoading ? (
            <Skeleton className="h-7 w-48" />
          ) : (
            <div>
              <h1 className="text-2xl font-bold">{cls?.name}</h1>
              {cls?.description && <p className="text-muted-foreground text-sm">{cls.description}</p>}
            </div>
          )}
          {cls && isTeacher && (
            <Badge variant="outline" className="ml-auto font-mono flex items-center gap-1">
              <Hash className="h-3 w-3" /> {cls.inviteCode}
            </Badge>
          )}
        </div>

        <Tabs defaultValue="assignments">
          <TabsList>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
          </TabsList>

          <TabsContent value="assignments" className="mt-4">
            {isTeacher && (
              <div className="flex justify-end mb-4">
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-1 h-4 w-4" /> New Assignment</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Assignment</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateAssignment} className="space-y-4">
                      <div className="space-y-1">
                        <Label>Title</Label>
                        <Input
                          value={form.title}
                          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                          placeholder="e.g. Chapter 5 Review"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Instructions (optional)</Label>
                        <Textarea
                          value={form.description}
                          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Describe the assignment…"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Due Date (optional)</Label>
                        <Input
                          type="datetime-local"
                          value={form.dueDate}
                          onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={submitting}>
                        {submitting ? "Creating…" : "Create Assignment"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : !cls?.assignments.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No assignments yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cls.assignments.map((a) => (
                  <Link key={a.id} href={`/assignments/${a.id}`}>
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                      <CardHeader className="py-4">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">{a.title}</CardTitle>
                          {a.dueDate && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground ml-4 shrink-0">
                              <Calendar className="h-3 w-3" />
                              {formatDate(a.dueDate)}
                            </span>
                          )}
                        </div>
                        {a.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>
                        )}
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="students" className="mt-4">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !cls?.students.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No students enrolled yet.</p>
                {isTeacher && cls && (
                  <p className="text-sm mt-1">
                    Share invite code <span className="font-mono font-semibold">{cls.inviteCode}</span> with students.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {cls.students.map((s) => (
                  <Card key={s.id}>
                    <CardContent className="flex items-center gap-3 py-3">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
