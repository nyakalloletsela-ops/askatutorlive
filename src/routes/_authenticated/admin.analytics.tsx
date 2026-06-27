import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { Users, GraduationCap, BookOpen, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/access.functions";
import { PageContainer, StatCard, SectionHeader } from "@/components/dashboard/primitives";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  beforeLoad: async () => {
    try {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) throw redirect({ to: "/dashboard" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const [usersRes, tutorsRes, sessionsRes, recentSessions] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "tutor"),
        supabase.from("sessions").select("id", { count: "exact", head: true }),
        supabase
          .from("sessions")
          .select("scheduled_at")
          .gte("scheduled_at", new Date(Date.now() - 30 * 86400000).toISOString())
          .limit(1000),
      ]);
      const byDay = new Map<string, number>();
      (recentSessions.data ?? []).forEach((s) => {
        const k = new Date(s.scheduled_at as string).toISOString().slice(0, 10);
        byDay.set(k, (byDay.get(k) ?? 0) + 1);
      });
      const series = Array.from(byDay.entries())
        .sort()
        .map(([date, count]) => ({ date: date.slice(5), count }));
      return {
        users: usersRes.count ?? 0,
        tutors: tutorsRes.count ?? 0,
        sessions: sessionsRes.count ?? 0,
        series,
      };
    },
  });

  return (
    <PageContainer title="Analytics" description="Platform-wide metrics.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={data?.users ?? "—"} />
        <StatCard icon={GraduationCap} label="Tutors" value={data?.tutors ?? "—"} />
        <StatCard icon={BookOpen} label="Sessions" value={data?.sessions ?? "—"} />
        <StatCard icon={TrendingUp} label="Last 30d" value={data?.series.reduce((a, b) => a + b.count, 0) ?? "—"} />
      </div>

      <Card>
        <CardContent className="p-4">
          <SectionHeader title="Sessions (last 30 days)" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.series ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <SectionHeader title="Sessions per day" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.series ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
