import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, FileText, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/parent")({
  component: ParentDashboard,
});

type Child = {
  child_id: string;
  full_name: string;
  relationship: string;
  status: string;
};

type Session = {
  id: string;
  subject: string;
  scheduled_at: string;
  student_id: string;
  status: string;
  duration_min: number;
};

function ParentDashboard() {
  const { isParent } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [upcoming, setUpcoming] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: kids } = await supabase.rpc("list_my_children");
      const arr = (kids as Child[]) ?? [];
      setChildren(arr);

      if (arr.length) {
        const ids = arr.map((c) => c.child_id);
        const { data: sess } = await supabase
          .from("sessions")
          .select("id, subject, scheduled_at, student_id, status, duration_min")
          .in("student_id", ids)
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(10);
        setUpcoming((sess as Session[]) ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const childName = (id: string) =>
    children.find((c) => c.child_id === id)?.full_name ?? "Student";

  if (!isParent) {
    return (
      <div className="container mx-auto max-w-2xl py-10">
        <Card>
          <CardHeader>
            <CardTitle>Parent area</CardTitle>
            <CardDescription>
              You don't have a parent role on this account. Sign up for a new parent account to
              manage children.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Parent dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Track your children's lessons, tutors and progress.
          </p>
        </div>
        <Button asChild>
          <Link to="/parent/children">
            <Users className="mr-2 h-4 w-4" /> Manage children
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Linked children" value={children.length} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Upcoming lessons" value={upcoming.length} icon={<Calendar className="h-4 w-4" />} />
        <StatCard label="Active tutors" value={new Set(upcoming.map((s) => s.id)).size} icon={<FileText className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your children</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : children.length === 0 ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>No children linked yet.</p>
              <Button asChild size="sm">
                <Link to="/parent/children">Invite a child</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {children.map((c) => (
                <li key={c.child_id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground">{c.relationship} · {c.status}</p>
                  </div>
                  <Badge variant="outline">{c.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming lessons</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming lessons.</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{s.subject || "Lesson"}</p>
                    <p className="text-xs text-muted-foreground">
                      {childName(s.student_id)} · {new Date(s.scheduled_at).toLocaleString()} · {s.duration_min} min
                    </p>
                  </div>
                  <Badge variant="secondary">{s.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
