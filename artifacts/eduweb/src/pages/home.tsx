import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import AppLayout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Users, FileText, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface DashboardStats {
  classCount: number;
  assignmentCount: number;
  submissionCount: number;
  pendingCount: number;
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) setLocation("/auth");
  }, [user, loading, setLocation]);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: () =>
      fetch("/api/dashboard/stats", { credentials: "include" }).then((r) => r.json()),
    enabled: !!user,
  });

  if (loading || !user) return null;

  const isTeacher = user.role === "teacher";

  const cards = isTeacher
    ? [
        { label: "My Classes", value: stats?.classCount, icon: Users, color: "text-blue-500" },
        { label: "Assignments", value: stats?.assignmentCount, icon: FileText, color: "text-green-500" },
        { label: "Submissions", value: stats?.submissionCount, icon: BookOpen, color: "text-purple-500" },
        { label: "Pending Grading", value: stats?.pendingCount, icon: Clock, color: "text-orange-500" },
      ]
    : [
        { label: "Enrolled Classes", value: stats?.classCount, icon: Users, color: "text-blue-500" },
        { label: "Assignments", value: stats?.assignmentCount, icon: FileText, color: "text-green-500" },
        { label: "Submitted", value: stats?.submissionCount, icon: BookOpen, color: "text-purple-500" },
        { label: "Pending", value: stats?.pendingCount, icon: Clock, color: "text-orange-500" },
      ];

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Welcome back, {user.name}</h1>
          <p className="text-muted-foreground">
            {isTeacher ? "Manage your classes and assignments below." : "See your classes and pending assignments."}
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Card key={card.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-3xl font-bold">{card.value ?? 0}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
