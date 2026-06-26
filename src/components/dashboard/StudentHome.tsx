import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  Flame,
  PlayCircle,
  StickyNote,
  FileText,
  Sparkles,
  PencilRuler,
  Languages,
  Brain,
  HelpCircle,
  ListChecks,
  Video,
  CheckCircle2,
  MessageSquare,
  ArrowRight,
  Plus,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type SessionRow = {
  id: string;
  subject: string | null;
  scheduled_at: string;
  room_id: string;
  status: string;
  tutor_id: string;
  student_id: string;
};

type NoteRow = { id: string; title: string; kind: string; created_at: string; body: string | null };
type AssignmentRow = { id: string; title: string; due_at: string | null; created_at: string; status?: string | null };
type RecordRow = { id: string; room_id: string; title: string | null; created_at: string };

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export function StudentHome({
  firstName,
  freeMinutes,
  sessions,
  participantNames,
}: {
  firstName: string;
  freeMinutes: number;
  sessions: SessionRow[];
  participantNames: Record<string, string>;
}) {
  const { user } = useAuth();

  // --- derived: upcoming + next class ---
  const upcoming = useMemo(
    () =>
      sessions
        .filter(
          (s) =>
            (s.status === "scheduled" || s.status === "live") &&
            (s.status === "live" ||
              new Date(s.scheduled_at).getTime() + 2 * 60 * 60 * 1000 >= Date.now()),
        )
        .slice(0, 5),
    [sessions],
  );
  const nextClass = upcoming[0];
  const completed = useMemo(() => sessions.filter((s) => s.status === "completed"), [sessions]);

  // --- streak: consecutive days with a completed session ending today/yesterday ---
  const streak = useMemo(() => {
    const days = new Set(completed.map((s) => dayKey(new Date(s.scheduled_at))));
    let n = 0;
    const cur = new Date();
    if (!days.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
    while (days.has(dayKey(cur))) {
      n += 1;
      cur.setDate(cur.getDate() - 1);
    }
    return n;
  }, [completed]);

  // --- progress by subject (last 60 days completed) ---
  const progressData = useMemo(() => {
    const since = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const counts: Record<string, number> = {};
    for (const s of completed) {
      if (new Date(s.scheduled_at).getTime() < since) continue;
      const k = s.subject ?? "Other";
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([subject, count]) => ({ subject, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [completed]);

  // --- last note ---
  const { data: lastNote } = useQuery({
    queryKey: ["student-home-last-note", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<NoteRow | null> => {
      const { data } = await supabase
        .from("notes")
        .select("id, title, kind, created_at, body")
        .order("created_at", { ascending: false })
        .limit(1);
      return ((data ?? [])[0] as NoteRow) ?? null;
    },
  });

  // --- last assignment (open) ---
  const { data: lastAssignment } = useQuery({
    queryKey: ["student-home-last-assignment", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AssignmentRow | null> => {
      const { data } = await supabase
        .from("assignments")
        .select("id, title, due_at, created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      return ((data ?? [])[0] as AssignmentRow) ?? null;
    },
  });

  // --- last recording ---
  const { data: lastRecording } = useQuery({
    queryKey: ["student-home-last-recording", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<RecordRow | null> => {
      const { data } = await supabase
        .from("session_records")
        .select("id, room_id, title, created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      return ((data ?? [])[0] as RecordRow) ?? null;
    },
  });

  // --- activity feed: merge recent sessions/notes/assignments ---
  const { data: recentNotes = [] } = useQuery({
    queryKey: ["student-home-recent-notes", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<NoteRow[]> => {
      const { data } = await supabase
        .from("notes")
        .select("id, title, kind, created_at, body")
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as NoteRow[];
    },
  });

  const activity = useMemo(() => {
    type Item = { id: string; icon: typeof Calendar; label: string; sub: string; at: string };
    const items: Item[] = [];
    for (const s of sessions.slice(0, 10)) {
      if (s.status === "completed") {
        items.push({
          id: `s-${s.id}`,
          icon: CheckCircle2,
          label: `Attended ${s.subject ?? "session"}`,
          sub: `with ${participantNames[s.tutor_id] ?? "tutor"}`,
          at: s.scheduled_at,
        });
      } else if (s.status === "scheduled") {
        items.push({
          id: `b-${s.id}`,
          icon: Calendar,
          label: `Booked ${s.subject ?? "session"}`,
          sub: `with ${participantNames[s.tutor_id] ?? "tutor"}`,
          at: s.scheduled_at,
        });
      }
    }
    for (const n of recentNotes) {
      items.push({
        id: `n-${n.id}`,
        icon: StickyNote,
        label: `Saved note · ${n.title}`,
        sub: n.kind === "ai-coach" ? "AI Coach" : n.kind.startsWith("ai-tool:") ? "AI Toolkit" : "Notes",
        at: n.created_at,
      });
    }
    return items
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);
  }, [sessions, recentNotes, participantNames]);

  return (
    <div className="space-y-6">
      {/* ===== Welcome ===== */}
      <Card className="overflow-hidden border-0 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
        <div className="relative bg-gradient-to-br from-primary to-primary/70 p-6 text-primary-foreground sm:p-8">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider opacity-80">
                Student dashboard
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                {firstName ? `Welcome back, ${firstName} 👋` : "Welcome back 👋"}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Flame className="h-4 w-4" />
                  <span className="font-semibold">{streak}</span>
                  <span className="opacity-80">day streak</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span className="font-semibold">{freeMinutes}</span>
                  <span className="opacity-80">free minutes</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-semibold">{completed.length}</span>
                  <span className="opacity-80">lessons completed</span>
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur sm:min-w-[260px]">
              <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">
                Next class
              </p>
              {nextClass ? (
                <>
                  <p className="mt-1 truncate text-base font-semibold">
                    {nextClass.subject ?? "Tutoring session"}
                  </p>
                  <p className="text-xs opacity-80">
                    {participantNames[nextClass.tutor_id] ?? "Your tutor"} ·{" "}
                    {new Date(nextClass.scheduled_at).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <Button asChild size="sm" variant="secondary" className="mt-3 w-full">
                    <Link to="/classroom/$roomId" params={{ roomId: nextClass.room_id }}>
                      <PlayCircle className="mr-1.5 h-4 w-4" />
                      Join class
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm opacity-90">No class scheduled.</p>
                  <Button asChild size="sm" variant="secondary" className="mt-3 w-full">
                    <Link to="/tutors">
                      <Plus className="mr-1.5 h-4 w-4" />
                      Find a tutor
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ===== Main grid ===== */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Upcoming Classes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Upcoming classes</CardTitle>
                <CardDescription>Your next sessions</CardDescription>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link to="/calendar">
                  View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {upcoming.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-10 text-center">
                  <Calendar className="mb-2 h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm font-medium">No sessions scheduled</p>
                  <Button asChild size="sm" className="mt-4">
                    <Link to="/tutors">Browse tutors</Link>
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {upcoming.map((s) => {
                    const isLive = s.status === "live";
                    return (
                      <li
                        key={s.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate text-sm font-medium">
                            <span className="truncate">{s.subject ?? "Tutoring session"}</span>
                            {isLive && (
                              <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/15" variant="secondary">
                                Live
                              </Badge>
                            )}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {participantNames[s.tutor_id] ?? "Tutor"} ·{" "}
                            {new Date(s.scheduled_at).toLocaleString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <Button asChild size="sm" variant={isLive ? "default" : "outline"}>
                          <Link to="/classroom/$roomId" params={{ roomId: s.room_id }}>
                            {isLive ? "Join" : "Open"}
                          </Link>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Continue Learning */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Continue learning</CardTitle>
              <CardDescription>Pick up where you left off</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <ContinueTile
                icon={Video}
                title="Last recording"
                subtitle={lastRecording?.title ?? (lastRecording ? "Untitled" : "No recordings yet")}
                to={lastRecording ? "/records" : "/records"}
                empty={!lastRecording}
              />
              <ContinueTile
                icon={StickyNote}
                title="Last notes"
                subtitle={lastNote?.title ?? "No notes yet"}
                to="/notes"
                empty={!lastNote}
              />
              <ContinueTile
                icon={FileText}
                title="Last homework"
                subtitle={lastAssignment?.title ?? "No assignments yet"}
                to="/assignments"
                empty={!lastAssignment}
              />
            </CardContent>
          </Card>

          {/* Learning Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Learning progress</CardTitle>
              <CardDescription>Completed sessions by subject — last 60 days</CardDescription>
            </CardHeader>
            <CardContent>
              {progressData.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <Brain className="mb-2 h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm text-muted-foreground">
                    Complete your first session to see progress.
                  </p>
                </div>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={progressData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="subject"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted))" }}
                        contentStyle={{
                          background: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT (1/3) */}
        <div className="space-y-6">
          {/* AI Study Assistant */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Study Assistant
              </CardTitle>
              <CardDescription>One-tap learning actions</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <AiAction icon={Brain} label="Explain topic" to="/ai-tools" />
              <AiAction icon={HelpCircle} label="Generate quiz" to="/ai-tools" />
              <AiAction icon={StickyNote} label="Create notes" to="/ai-tools" />
              <AiAction icon={Languages} label="Translate" to="/ai-tools" />
              <AiAction icon={PencilRuler} label="Solve problem" to="/ai-tools" />
              <AiAction icon={ListChecks} label="Summarize" to="/ai-tools" />
              <Button asChild className="col-span-2 mt-1">
                <Link to="/ai-tutor">
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Open AI Coach
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent activity</CardTitle>
              <CardDescription>Latest events on your account</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {activity.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  Activity will show up here as you learn.
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {activity.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <a.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.sub}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(a.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link to="/messages">
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                  Messages
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link to="/tutors">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Find tutor
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ContinueTile({
  icon: Icon,
  title,
  subtitle,
  to,
  empty,
}: {
  icon: typeof Calendar;
  title: string;
  subtitle: string;
  to: string;
  empty?: boolean;
}) {
  return (
    <Link
      to={to as never}
      className="group flex items-start gap-3 rounded-xl border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className={`truncate text-sm ${empty ? "text-muted-foreground" : "font-medium"}`}>
          {subtitle}
        </p>
      </div>
    </Link>
  );
}

function AiAction({
  icon: Icon,
  label,
  to,
}: {
  icon: typeof Sparkles;
  label: string;
  to: string;
}) {
  return (
    <Link
      to={to as never}
      className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-xs font-medium transition hover:border-primary/40 hover:bg-primary/5"
    >
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}
