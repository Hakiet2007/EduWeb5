import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import AppLayout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Hash, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface Class {
  id: number;
  name: string;
  description: string | null;
  inviteCode: string;
  teacherId: number;
  teacherName: string;
  studentCount: number;
  createdAt: string;
}

export default function ClassesPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [joinCode, setJoinCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) setLocation("/auth");
  }, [user, loading, setLocation]);

  const { data: classes, isLoading } = useQuery<Class[]>({
    queryKey: ["/api/classes"],
    queryFn: () => fetch("/api/classes", { credentials: "include" }).then((r) => r.json()),
    enabled: !!user,
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Failed to create class");
        return;
      }
      toast.success("Class created!");
      setCreateOpen(false);
      setCreateForm({ name: "", description: "" });
      qc.invalidateQueries({ queryKey: ["/api/classes"] });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ inviteCode: joinCode }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Failed to join class");
        return;
      }
      toast.success("Joined class!");
      setJoinOpen(false);
      setJoinCode("");
      qc.invalidateQueries({ queryKey: ["/api/classes"] });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;
  const isTeacher = user.role === "teacher";

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Classes</h1>
            <p className="text-muted-foreground">
              {isTeacher ? "Classes you teach" : "Classes you're enrolled in"}
            </p>
          </div>
          {isTeacher ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> New Class</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a New Class</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-1">
                    <Label>Class Name</Label>
                    <Input
                      value={createForm.name}
                      onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Math 101"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Description (optional)</Label>
                    <Textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="What is this class about?"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Creating…" : "Create Class"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Join Class</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join a Class</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleJoin} className="space-y-4">
                  <div className="space-y-1">
                    <Label>Invite Code</Label>
                    <Input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="e.g. AB12CD34"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Joining…" : "Join Class"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : !classes?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="mx-auto h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg">No classes yet.</p>
            <p className="text-sm mt-1">{isTeacher ? "Create your first class to get started." : "Join a class using an invite code."}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls) => (
              <Link key={cls.id} href={`/classes/${cls.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-base">{cls.name}</CardTitle>
                    {cls.description && (
                      <CardDescription className="line-clamp-2">{cls.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{cls.studentCount} students</span>
                    {isTeacher && (
                      <Badge variant="outline" className="ml-auto font-mono text-xs flex items-center gap-1">
                        <Hash className="h-3 w-3" />{cls.inviteCode}
                      </Badge>
                    )}
                    {!isTeacher && (
                      <span className="ml-auto text-xs">{cls.teacherName}</span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
