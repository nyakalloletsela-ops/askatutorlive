import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Crown,
  GraduationCap,
  MessageSquare,
  PlayCircle,
  Plus,
  Sparkles,
  Star,
  Users,
  Wallet,
  ArrowRight,
  BookOpen,
  PencilRuler,
  FileText,
  ListChecks,
  CalendarOff,
} from "lucide-react";

type SessionRow = {
  id: string;
  subject: string | null;
  scheduled_at: string;
  room_id: string;
  status: string;
  tutor_id: string;
  student_id: string;
};

type Profile = {
  full_name: string | null;
  bio: string | null;
  subjects: string[] | null;
  hourly_rate: number | null;
  phone: string | null;
  is_featured: boolean;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtMins(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

export function TutorHome({
  firstName,
  profile,
  sessions,
  participantNames,
}: {
  firstName: string;
  profile: Profile;
  sessions: SessionRow[];
  participantNames: Record<string, string>;
}) {
  const { user } = useAuth();

  const upcoming = useMemo(
    () =>
      sessions
        .filter(
          (s) =>
            s.tutor_id === user?.id &&
            (s.status === "scheduled" || s.status === "live") &&
            (s.status === "live" ||
              new Date(s.scheduled_at).getTime() + 2 * 60 * 60 * 1000 >= Date.now()),
        )
        .slice(0, 6),
    [sessions, user],
  );
  const completed = useMemo(
    () => sessions.filter((s) => s.tutor_id === user?.id && s.status === "completed"),
    [sessions, user],
  );
  const uniqueStudents = useMemo(
    () => new Set(sessions.filter((s) => s.tutor_id === user?.id).map((s) => s.student_id)).size,
    [sessions, user],
  );
  const nextClass = upcoming[0];

  // earnings (last 30d): completed sessions × (duration / 60) × hourly_rate
  const earnings30d = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const rate = profile.hourly_rate ?? 0;
    return sessions
      .filter((s) => s.tutor_id === user?.id && s.status === "completed" && new Date(s.scheduled_at).getTime() >= cutoff)
      .reduce((sum) => sum + rate, 0);
  }, [sessions, user, profile.hourly_rate]);

  // profile completeness
  const completeness = useMemo(() => {
    const checks = [
      !!profile.full_name,
      !!profile.bio && profile.bio.length > 20,
      !!profile.phone,
      !!profile.hourly_rate,
      (profile.subjects ?? []).length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile]);
  const profileTodos = useMemo(
    () =>
      [
        !profile.full_name && "Add your full name",
        !(profile.bio && profile.bio.length > 20) && "Write a bio (20+ chars)",
        !profile.phone && "Add a phone number",
        !profile.hourly_rate && "Set your hourly rate",
        !(profile.subjects ?? []).length && "Add at least one subject",
      ].filter(Boolean) as string[],
    [profile],
  );

  // Weekly availability
  const { data: availability = [] } = useQuery({
    queryKey: ["tutor-availability", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tutor_availability")
        .select("weekday, start_min, end_min")
        .eq("tutor_id", user!.id)
        .order("weekday")
        .order("start_min");
      return (data ?? []) as { weekday: number; start_min: number; end_min: number }[];
    },
  });

  const slotsByDay = useMemo(() => {
    const by: Record<number, { start_min: number; end_min: number }[]> = {};
    for (const a of availability) {
      by[a.weekday] ??= [];
      by[a.weekday].push({ start_min: a.start_min, end_min: a.end_min });
    }
    return by;
  }, [availability]);

  return (
    <div className="space-y-6">
      {/* ===== Welcome ===== */}
      <Card className="overflow-hidden border-0 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
        <div className="relative bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white sm:p-8">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider opacity-80">
                Tutor dashboard
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                {firstName ? `Welcome back, ${firstName} 👋` : "Welcome back 👋"}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span className="font-semibold">{upcoming.length}</span>
                  <span className="opacity-80">upcoming</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-semibold">{completed.length}</span>
                  <span className="opacity-80">completed</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span className="font-semibold">{uniqueStudents}</span>
                  <span className="opacity-80">students</span>
                </span>
                {profile.is_featured && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 backdrop-blur">
                    <Crown className="h-3.5 w-3.5" />
                    <span className="font-semibold">Featured</span>
                  </span>
                )}
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
                    {participantNames[nextClass.student_id] ?? "Student"} ·{" "}
                    {new Date(nextClass.scheduled_at).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <Button asChild size="sm" variant="secondary" className="mt-3 w-full">
                    <Link to="/classroom/$roomId" params={{ roomId: nextClass.room_id }}>
                      <PlayCircle className="mr-1.5 h-4 w-4" />
                      Open classroom
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm opacity-90">No class scheduled.</p>
                  <Button asChild size="sm" variant="secondary" className="mt-3 w-full">
                    <Link to="/tutor/availability">
                      <Plus className="mr-1.5 h-4 w-4" />
                      Open availability
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ===== Stat strip ===== */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Wallet}
          label="Rate"
          value={profile.hourly_rate ? `M${profile.hourly_rate}` : "—"}
          hint="per hour"
        />
        <StatTile
          icon={Wallet}
          label="Est. earnings"
          value={`M${earnings30d.toLocaleString()}`}
          hint="last 30 days"
        />
        <StatTile
          icon={BookOpen}
          label="Subjects"
          value={(profile.subjects ?? []).length}
          hint="on profile"
        />
        <StatTile
          icon={Star}
          label="Status"
          value={profile.is_featured ? "Featured" : "Standard"}
          hint={profile.is_featured ? "Premium placement" : "Apply for featuring"}
        />
      </div>

      {/* ===== Main grid ===== */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT */}
        <div className="space-y-6 lg:col-span-2">
          {/* Upcoming student sessions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Upcoming student sessions</CardTitle>
                <CardDescription>Your next bookings</CardDescription>
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
                  <p className="text-sm font-medium">No upcoming sessions</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Update your availability so students can book you.
                  </p>
                  <Button asChild size="sm" className="mt-4">
                    <Link to="/tutor/availability">Set availability</Link>
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
                              <Badge
                                className="bg-green-500/15 text-green-600 hover:bg-green-500/15"
                                variant="secondary"
                              >
                                Live
                              </Badge>
                            )}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            Student:{" "}
                            <span className="font-medium text-foreground">
                              {participantNames[s.student_id] ?? "Unnamed"}
                            </span>{" "}
                            ·{" "}
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
                            {isLive ? "Open" : "Prepare"}
                          </Link>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Weekly availability */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Weekly availability</CardTitle>
                <CardDescription>When students can book you</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="ghost">
                  <Link to="/tutor/holidays">
                    <CalendarOff className="mr-1 h-3.5 w-3.5" /> Holidays
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/tutor/availability">Edit</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {availability.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Clock className="mb-2 h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm font-medium">No availability set</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Add weekly slots so students can book you instantly.
                  </p>
                  <Button asChild size="sm" className="mt-4">
                    <Link to="/tutor/availability">Add slots</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {WEEKDAYS.map((label, i) => {
                    const slots = slotsByDay[i] ?? [];
                    const active = slots.length > 0;
                    return (
                      <div
                        key={label}
                        className={`rounded-xl border p-2 text-center transition ${
                          active ? "border-primary/30 bg-primary/5" : "bg-muted/30"
                        }`}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {label}
                        </p>
                        {active ? (
                          <ul className="mt-1.5 space-y-1">
                            {slots.slice(0, 2).map((s, j) => (
                              <li
                                key={j}
                                className="rounded-md bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary"
                              >
                                {fmtMins(s.start_min)}–{fmtMins(s.end_min)}
                              </li>
                            ))}
                            {slots.length > 2 && (
                              <li className="text-[10px] text-muted-foreground">
                                +{slots.length - 2}
                              </li>
                            )}
                          </ul>
                        ) : (
                          <p className="mt-2 text-[10px] text-muted-foreground">Off</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* Profile completeness */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="h-4 w-4 text-primary" />
                Profile completeness
              </CardTitle>
              <CardDescription>
                {completeness === 100
                  ? "Your profile is fully set up."
                  : "Complete to rank higher in search."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{completeness}%</span>
                <span className="text-xs text-muted-foreground">
                  {5 - profileTodos.length}/5 done
                </span>
              </div>
              <Progress value={completeness} className="h-2" />
              {profileTodos.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {profileTodos.map((t) => (
                    <li
                      key={t}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {t}
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link to="/settings">Edit profile</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Featured placement */}
          <Card
            className={
              profile.is_featured
                ? "border-amber-300/60 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-transparent"
                : ""
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Crown
                  className={`h-4 w-4 ${profile.is_featured ? "text-amber-500" : "text-muted-foreground"}`}
                />
                Featured placement
              </CardTitle>
              <CardDescription>
                {profile.is_featured
                  ? "You're featured — top of search results."
                  : "Get promoted to the top of search."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile.is_featured ? (
                <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                  <Crown className="mr-1 h-3 w-3" /> Premium certified
                </Badge>
              ) : (
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li>• Higher visibility on the home page</li>
                  <li>• Premium badge on your profile</li>
                  <li>• Priority booking slot</li>
                </ul>
              )}
              <Button asChild size="sm" className="w-full">
                <Link to="/dashboard">
                  {profile.is_featured ? "Manage subscription" : "Become featured"}
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* AI Teaching Assistant */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Teaching Assistant
              </CardTitle>
              <CardDescription>Generate teaching materials</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <AiAction icon={FileText} label="Lesson plan" to="/ai-tools" />
              <AiAction icon={ListChecks} label="Quiz" to="/ai-tools" />
              <AiAction icon={PencilRuler} label="Worksheet" to="/ai-tools" />
              <AiAction icon={MessageSquare} label="Feedback" to="/ai-tools" />
              <Button asChild className="col-span-2 mt-1">
                <Link to="/ai-tutor">
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Open AI Coach
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Calendar;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
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
