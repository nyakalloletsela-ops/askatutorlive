import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { ScheduleStudentCard } from "@/components/ScheduleStudentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Crown,
  Calendar,
  Plus,
  X,
  Star,
  Clock,
  Sparkles,
  Trophy,
  FlaskConical,
  MessageSquare,
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Wallet,
  Users,
  BookOpen,
  Copy,
  Link2,
} from "lucide-react";
import { StudentHome } from "@/components/dashboard/StudentHome";
import { TutorHome } from "@/components/dashboard/TutorHome";
import { AdminHome } from "@/components/dashboard/AdminHome";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const SUBJECT_SUGGESTIONS = [
  "Math", "Physics", "Chemistry", "Biology", "English", "Sesotho",
  "Calculus", "Linear Algebra", "Statistics", "Computer Science",
  "Programming", "Accounting", "Economics", "Engineering Math",
];

type Profile = {
  id: string;
  full_name: string | null;
  bio: string | null;
  subjects: string[] | null;
  hourly_rate: number | null;
  phone: string | null;
  is_featured: boolean;
  availability: Record<string, string[]> | null;
  free_minutes_remaining: number;
};

type Subscription = {
  id: string;
  transaction_ref: string;
  payment_method: "mpesa" | "ecocash";
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
};

type SessionRow = {
  id: string;
  subject: string | null;
  scheduled_at: string;
  room_id: string;
  status: string;
  tutor_id: string;
  student_id: string;
};

/* ---------- Small primitives ---------- */

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-border">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to as any}
      className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {action}
    </div>
  );
}

/* ---------- Page ---------- */

function Dashboard() {
  const { user, isTutor, roles } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [txnRef, setTxnRef] = useState("");
  const [payMethod, setPayMethod] = useState<"mpesa" | "ecocash">("mpesa");
  const [subjectInput, setSubjectInput] = useState("");

  const addSubject = (raw: string) => {
    if (!profile) return;
    const s = raw.trim();
    if (!s) return;
    const cur = new Set(profile.subjects ?? []);
    cur.add(s);
    setProfile({ ...profile, subjects: Array.from(cur) });
    setSubjectInput("");
  };
  const removeSubject = (s: string) => {
    if (!profile) return;
    setProfile({ ...profile, subjects: (profile.subjects ?? []).filter((x) => x !== s) });
  };

  useEffect(() => {
    if (!user) return;
    refreshAll();
    const t = setInterval(() => { refreshSessions(); }, 15000);
    return () => clearInterval(t);
  }, [user]);

  const refreshSessions = async () => {
    if (!user) return;
    const { data: ss } = await supabase
      .from("sessions")
      .select("*")
      .or(`tutor_id.eq.${user.id},student_id.eq.${user.id}`)
      .order("scheduled_at", { ascending: true });
    setSessions((ss as SessionRow[]) ?? []);
    const { data: names } = await supabase.rpc("get_session_participant_names");
    if (names) {
      const map: Record<string, string> = {};
      for (const r of names as Array<{ user_id: string; full_name: string | null }>) {
        if (r.full_name) map[r.user_id] = r.full_name;
      }
      setParticipantNames(map);
    }
  };

  const startSession = async (s: SessionRow) => {
    const { error } = await supabase
      .from("sessions")
      .update({ status: "live" })
      .eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    window.location.href = `/classroom/${s.room_id}`;
  };

  const refreshAll = async () => {
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(
      (p as Profile) ?? {
        id: user.id,
        full_name: (user.user_metadata as { full_name?: string } | undefined)?.full_name ?? null,
        bio: null,
        subjects: [],
        hourly_rate: null,
        phone: null,
        is_featured: false,
        availability: null,
        free_minutes_remaining: 0,
      },
    );
    setSubs([]);
    const { data: ss } = await supabase
      .from("sessions")
      .select("*")
      .or(`tutor_id.eq.${user.id},student_id.eq.${user.id}`)
      .order("scheduled_at", { ascending: true });
    setSessions((ss as SessionRow[]) ?? []);
  };

  // Tutor onboarding now requires an application reviewed by an admin.


  const saveProfile = async () => {
    if (!profile || !user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        bio: profile.bio,
        subjects: profile.subjects,
        hourly_rate: profile.hourly_rate,
        phone: profile.phone,
      })
      .eq("id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  };

  const submitSub = async () => {
    if (!user || !txnRef.trim()) return;
    const { error } = await supabase.from("tutor_subscriptions").insert({
      tutor_id: user.id,
      transaction_ref: txnRef.trim(),
      payment_method: payMethod,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Transaction submitted for review");
      setTxnRef("");
      refreshAll();
    }
  };

  /* ---------- derived ---------- */

  const upcoming = useMemo(
    () =>
      sessions
        .filter((s) => (s.status === "scheduled" || s.status === "live") &&
          (s.status === "live" || new Date(s.scheduled_at).getTime() + 2 * 60 * 60 * 1000 >= Date.now()))
        .slice(0, 5),
    [sessions],
  );
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const pendingSub = subs.find((s) => s.status === "pending");
  const approvedSub = subs.find((s) => s.status === "approved");

  const profileCompleteness = useMemo(() => {
    if (!profile) return 0;
    const checks = isTutor
      ? [
          !!profile.full_name,
          !!profile.bio && profile.bio.length > 20,
          !!profile.phone,
          !!profile.hourly_rate,
          (profile.subjects ?? []).length > 0,
        ]
      : [!!profile.full_name, !!profile.phone];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile, isTutor]);

  if (!user || !profile) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading…</div>
    );
  }

  const firstName = profile.full_name?.split(" ")[0] ?? "";

  // Phase 2 — students get the redesigned home
  if (!isTutor) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <StudentHome
          firstName={firstName}
          freeMinutes={profile.free_minutes_remaining ?? 0}
          sessions={sessions}
          participantNames={participantNames}
        />
      </main>
    );
  }

  // Phase 4 — admins get the redesigned admin overview
  if (roles.includes("admin")) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <AdminHome firstName={firstName} />
      </main>
    );
  }

  // Phase 3 — tutors get the redesigned home
  if (isTutor) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <TutorHome
          firstName={firstName}
          profile={profile}
          sessions={sessions}
          participantNames={participantNames}
        />
      </main>
    );
  }

  return (
    <div>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {isTutor ? "Tutor dashboard" : "Student dashboard"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.email} · {roles.join(", ") || "student"}
            </p>
          </div>
          <div className="flex gap-2">
            {!isTutor ? (
              <Button asChild>
                <Link to="/">
                  <Plus className="mr-1.5 h-4 w-4" /> Book a tutor
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to="/">View public profile</Link>
              </Button>
            )}
          </div>
        </header>

        {/* Stats */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isTutor ? (
            <>
              <StatCard icon={Calendar} label="Upcoming" value={upcoming.length} hint="sessions scheduled" />
              <StatCard icon={CheckCircle2} label="Completed" value={completedCount} hint="all-time" />
              <StatCard
                icon={Wallet}
                label="Rate"
                value={profile.hourly_rate ? `M${profile.hourly_rate}` : "—"}
                hint="per hour"
              />
              <StatCard
                icon={Users}
                label="Subjects"
                value={(profile.subjects ?? []).length}
                hint="listed on your profile"
              />
            </>
          ) : (
            <>
              <StatCard
                icon={Clock}
                label="Free minutes"
                value={profile.free_minutes_remaining}
                hint="welcome credit"
              />
              <StatCard icon={Calendar} label="Upcoming" value={upcoming.length} hint="sessions booked" />
              <StatCard icon={CheckCircle2} label="Completed" value={completedCount} hint="lessons attended" />
              <StatCard
                icon={Sparkles}
                label="AI access"
                value="Free"
                hint="Coach & Toolkit included"
              />
            </>
          )}
        </section>

        {/* Two-column main grid on lg */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* LEFT COLUMN (main) */}
          <div className="space-y-8 lg:col-span-2">
            {/* Upcoming sessions */}
            <section>
              <SectionHeader
                title="Upcoming sessions"
                action={
                  !isTutor && (
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/tutors">
                        <Plus className="mr-1 h-3.5 w-3.5" /> Book
                      </Link>
                    </Button>
                  )
                }
              />
              <Card>
                <CardContent className="p-0">
                  {upcoming.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                      <Calendar className="mb-2 h-8 w-8 text-muted-foreground/60" />
                      <p className="text-sm font-medium">No sessions scheduled</p>
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                        {isTutor
                          ? "Once a student books you, sessions appear here."
                          : "Browse our tutors and book your first session."}
                      </p>
                      {!isTutor && (
                        <Button asChild size="sm" className="mt-4">
                          <Link to="/tutors">Browse tutors</Link>
                        </Button>
                      )}
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {upcoming.map((s) => {
                        const isLive = s.status === "live";
                        const tutorRow = s.tutor_id === user.id;
                        const meetingUrl = `${window.location.origin}/classroom/${s.room_id}`;
                        const copyLink = async () => {
                          try {
                            await navigator.clipboard.writeText(meetingUrl);
                            toast.success("Meeting link copied");
                          } catch {
                            toast.error("Couldn't copy link");
                          }
                        };
                        return (
                          <li
                            key={s.id}
                            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {s.subject ?? "Tutoring session"}
                                {isLive && (
                                  <Badge className="ml-2 bg-green-500/15 text-green-600 hover:bg-green-500/15" variant="secondary">
                                    Live
                                  </Badge>
                                )}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {tutorRow ? "Student: " : "Tutor: "}
                                <span className="font-medium text-foreground">
                                  {participantNames[tutorRow ? s.student_id : s.tutor_id] ?? "Unnamed"}
                                </span>
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {new Date(s.scheduled_at).toLocaleString(undefined, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <code className="truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  {meetingUrl}
                                </code>
                                <button
                                  type="button"
                                  onClick={copyLink}
                                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                  aria-label="Copy meeting link"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              {tutorRow ? (
                                isLive ? (
                                  <Button asChild size="sm">
                                    <Link to="/classroom/$roomId" params={{ roomId: s.room_id }}>
                                      Open meeting
                                    </Link>
                                  </Button>
                                ) : (
                                  <Button size="sm" onClick={() => startSession(s)}>
                                    Generate link & start
                                  </Button>
                                )
                              ) : (
                                <Button asChild size="sm" variant={isLive ? "default" : "outline"}>
                                  <Link to="/classroom/$roomId" params={{ roomId: s.room_id }}>
                                    Join
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <div className="mt-2 flex justify-end">
                <Button asChild variant="ghost" size="sm">
                  <Link
                    to="/classroom/$roomId"
                    params={{ roomId: `demo-${user.id.slice(0, 8)}` }}
                  >
                    Try demo classroom →
                  </Link>
                </Button>
              </div>
            </section>


            {/* Tutor profile editor */}
            {isTutor && (
              <section>
                <SectionHeader title="Your tutor profile" />
                <Card>
                  <CardContent className="space-y-4 p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Full name</Label>
                        <Input
                          value={profile.full_name ?? ""}
                          onChange={(e) =>
                            setProfile({ ...profile, full_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Phone</Label>
                        <Input
                          value={profile.phone ?? ""}
                          onChange={(e) =>
                            setProfile({ ...profile, phone: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Bio</Label>
                      <Textarea
                        rows={3}
                        value={profile.bio ?? ""}
                        onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                        placeholder="Briefly describe your teaching style, qualifications and experience."
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Hourly rate (M)</Label>
                        <Input
                          type="number"
                          value={profile.hourly_rate ?? ""}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              hourly_rate: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Subjects</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {(profile.subjects ?? []).map((s) => (
                            <Badge key={s} variant="secondary" className="gap-1 pr-1">
                              {s}
                              <button
                                type="button"
                                onClick={() => removeSubject(s)}
                                className="ml-0.5 rounded hover:bg-muted-foreground/20"
                                aria-label={`Remove ${s}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Input
                            value={subjectInput}
                            onChange={(e) => setSubjectInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === ",") {
                                e.preventDefault();
                                addSubject(subjectInput);
                              }
                            }}
                            placeholder="Add subject"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => addSubject(subjectInput)}
                          >
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {SUBJECT_SUGGESTIONS.filter(
                            (s) => !(profile.subjects ?? []).includes(s),
                          )
                            .slice(0, 8)
                            .map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => addSubject(s)}
                                className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                              >
                                + {s}
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <Button onClick={saveProfile}>Save profile</Button>
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}

            {isTutor && (
              <section>
                <SectionHeader title="Schedule a session with an existing student" />
                <ScheduleStudentCard tutorId={user.id} onCreated={refreshSessions} />
              </section>
            )}

            {isTutor && (
              <section>
                <SectionHeader title="Propose a new course" />
                <ProposeCourseCard tutorId={user.id} />
              </section>
            )}

            {/* Become tutor CTA (student only) */}
            {!isTutor && (
              <section>
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">Teach on Ask A Tutor</p>
                        <p className="text-sm text-muted-foreground">
                          Activate a tutor account and start earning by helping students.
                        </p>
                      </div>
                    </div>
                    <Button asChild><Link to="/become-tutor">Apply to tutor</Link></Button>
                  </CardContent>
                </Card>
              </section>
            )}

            {/* Subscription panel intentionally hidden until free options are finalised. */}



            {/* Reviews (students) */}
            {!isTutor && <ReviewsCard userId={user.id} />}
          </div>

          {/* RIGHT COLUMN (sidebar) */}
          <aside className="space-y-8">
            {/* Profile completeness */}
            <section>
              <SectionHeader title="Profile" />
              <Card>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Completeness</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {profileCompleteness}%
                    </span>
                  </div>
                  <Progress value={profileCompleteness} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">
                    {profileCompleteness === 100
                      ? "Your profile is fully set up."
                      : isTutor
                        ? "Complete your profile to appear higher in search."
                        : "Add your name and phone for a better experience."}
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* Quick actions */}
            <section>
              <SectionHeader title="Quick actions" />
              <div className="grid gap-2">
                <QuickAction
                  to="/courses"
                  icon={BookOpen}
                  title="My Courses (Tutor)"
                  desc="Upload videos and pick which students can view them."
                />
                <QuickAction
                  to="/my-courses"
                  icon={BookOpen}
                  title="My Courses (Student)"
                  desc="Watch the videos your tutors shared with you."
                />
                <QuickAction
                  to="/ai-tutor"
                  icon={MessageSquare}
                  title="AI Study Coach"
                  desc="Guided hints for the problem you're stuck on."
                />
                <QuickAction
                  to="/messages"
                  icon={MessageSquare}
                  title="Messages"
                  desc="Chat directly with your tutors and students."
                />
                <QuickAction
                  to="/ai-tools"
                  icon={Sparkles}
                  title="AI Toolkit"
                  desc="Flashcards, quizzes, summaries and more."
                />
                <QuickAction
                  to="/labs"
                  icon={FlaskConical}
                  title="Virtual STEM labs"
                  desc="PhET simulations and 3D experiments."
                />
                <QuickAction
                  to="/community"
                  icon={Users}
                  title="Community"
                  desc="Ask questions and learn together."
                />
                <QuickAction
                  to="/leaderboard"
                  icon={Trophy}
                  title="Leaderboard"
                  desc="See top tutors and learners."
                />
              </div>
            </section>

            {/* AI insight */}
            <section>
              <SectionHeader title="Insight" />
              <Card className="border-border/60 bg-gradient-to-br from-accent/5 to-transparent">
                <CardContent className="p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-accent" />
                    <span className="text-sm font-semibold">Your next step</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isTutor
                      ? upcoming.length === 0
                        ? "Share your tutor profile link to attract your first booking."
                        : `You have ${upcoming.length} upcoming session${upcoming.length > 1 ? "s" : ""}. Prepare your notes in advance.`
                      : completedCount === 0
                        ? "Book your first session and start your learning streak."
                        : "Keep momentum — review last session with the AI Coach."}
                  </p>
                </CardContent>
              </Card>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

/* ---------- Subscription panel ---------- */

function SubscriptionPanel({
  isTutor,
  userId,
  pendingSub,
  approvedSub,
  txnRef,
  setTxnRef,
  payMethod,
  setPayMethod,
  onSubmitTutorSub,
  isFeatured,
}: {
  isTutor: boolean;
  userId: string;
  pendingSub?: Subscription;
  approvedSub?: Subscription;
  txnRef: string;
  setTxnRef: (s: string) => void;
  payMethod: "mpesa" | "ecocash";
  setPayMethod: (v: "mpesa" | "ecocash") => void;
  onSubmitTutorSub: () => void;
  isFeatured: boolean;
}) {
  if (isTutor) {
    return (
      <Card className={isFeatured ? "border-gold/40" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-4 w-4 text-gold" /> Tutor plan · M250 / month
          </CardTitle>
          <CardDescription>
            Pay to one of the numbers below and submit your reference. Admin approves within 24h.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">EcoCash</p>
              <p className="font-mono">62927828 · Nyakallo Letsela</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">M-Pesa</p>
              <p className="font-mono">58152047 · Nyakallo Letsela</p>
            </div>
          </div>
          {isFeatured && (
            <Badge className="bg-gold text-gold-foreground">Featured · Premium Certified</Badge>
          )}
          {pendingSub ? (
            <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
              Pending review — ref <span className="font-mono">{pendingSub.transaction_ref}</span>{" "}
              via {pendingSub.payment_method.toUpperCase()}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select
                  value={payMethod}
                  onValueChange={(v) => setPayMethod(v as "mpesa" | "ecocash")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="ecocash">EcoCash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Transaction reference</Label>
                <div className="flex gap-2">
                  <Input
                    value={txnRef}
                    onChange={(e) => setTxnRef(e.target.value)}
                    placeholder="e.g. QGH7X8K2LM"
                  />
                  <Button onClick={onSubmitTutorSub} disabled={!txnRef.trim()}>
                    Submit
                  </Button>
                </div>
              </div>
            </div>
          )}
          {approvedSub && (
            <p className="text-xs text-muted-foreground">
              Last approved: {new Date(approvedSub.submitted_at).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }
  return <StudentFeeCard userId={userId} />;
}

/* ---------- Student fee card ---------- */

function StudentFeeCard({ userId }: { userId: string }) {
  const [subs, setSubs] = useState<
    Array<{
      id: string;
      transaction_ref: string;
      payment_method: string;
      status: string;
      submitted_at: string;
    }>
  >([]);
  const [txnRef, setTxnRef] = useState("");
  const [payMethod, setPayMethod] = useState<"mpesa" | "ecocash">("mpesa");

  const load = async () => {
    const { data } = await supabase
      .from("student_subscriptions")
      .select("*")
      .eq("student_id", userId)
      .order("submitted_at", { ascending: false });
    setSubs(data ?? []);
  };
  useEffect(() => {
    load();
  }, [userId]);

  const pending = subs.find((s) => s.status === "pending");
  const approved = subs.find((s) => s.status === "approved");

  const submit = async () => {
    const { error } = await supabase.from("student_subscriptions").insert({
      student_id: userId,
      transaction_ref: txnRef.trim(),
      payment_method: payMethod,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Submitted for review");
      setTxnRef("");
      load();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4 text-primary" /> Student plan · M100 / month
        </CardTitle>
        <CardDescription>
          Unlock unlimited AI Coach and AI Toolkit access. Pay then submit your reference.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">EcoCash</p>
            <p className="font-mono">62927828 · Nyakallo Letsela</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">M-Pesa</p>
            <p className="font-mono">58152047 · Nyakallo Letsela</p>
          </div>
        </div>
        {approved && (
          <Badge variant="secondary" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            Active subscription
          </Badge>
        )}
        {pending ? (
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
            Pending review — ref <span className="font-mono">{pending.transaction_ref}</span> via{" "}
            {pending.payment_method.toUpperCase()}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select
                value={payMethod}
                onValueChange={(v) => setPayMethod(v as "mpesa" | "ecocash")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="ecocash">EcoCash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Transaction reference</Label>
              <div className="flex gap-2">
                <Input
                  value={txnRef}
                  onChange={(e) => setTxnRef(e.target.value)}
                  placeholder="e.g. QGH7X8K2LM"
                />
                <Button onClick={submit} disabled={!txnRef.trim()}>
                  Submit
                </Button>
              </div>
            </div>
          </div>
        )}
        {approved && (
          <p className="text-xs text-muted-foreground">
            Last approved: {new Date(approved.submitted_at).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Reviews ---------- */

function ReviewsCard({ userId }: { userId: string }) {
  const [tutors, setTutors] = useState<Array<{ id: string; name: string }>>([]);
  const [reviews, setReviews] = useState<
    Record<string, { rating: number; comment: string | null }>
  >({});
  const [drafts, setDrafts] = useState<Record<string, { rating: number; comment: string }>>({});

  const load = async () => {
    const { data: ss } = await supabase
      .from("sessions")
      .select("tutor_id")
      .eq("student_id", userId);
    const ids = Array.from(new Set((ss ?? []).map((s: any) => s.tutor_id)));
    if (ids.length === 0) {
      setTutors([]);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    setTutors((profs ?? []).map((p: any) => ({ id: p.id, name: p.full_name ?? "Tutor" })));
    const { data: rv } = await supabase
      .from("tutor_reviews")
      .select("tutor_id, rating, comment")
      .eq("student_id", userId);
    const map: Record<string, { rating: number; comment: string | null }> = {};
    (rv ?? []).forEach((r: any) => {
      map[r.tutor_id] = { rating: r.rating, comment: r.comment };
    });
    setReviews(map);
  };
  useEffect(() => {
    load();
  }, [userId]);

  const submit = async (tutorId: string) => {
    const d = drafts[tutorId];
    if (!d || !d.rating) return;
    const { error } = await supabase
      .from("tutor_reviews")
      .upsert(
        {
          tutor_id: tutorId,
          student_id: userId,
          rating: d.rating,
          comment: d.comment || null,
          session_id: null,
        },
        { onConflict: "student_id,tutor_id,session_id" },
      );
    if (error) toast.error(error.message);
    else {
      toast.success("Review saved");
      load();
    }
  };

  if (tutors.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Rate your tutors" />
      <Card>
        <CardContent className="space-y-3 p-5">
          {tutors.map((t) => {
            const existing = reviews[t.id];
            const draft =
              drafts[t.id] ?? {
                rating: existing?.rating ?? 0,
                comment: existing?.comment ?? "",
              };
            return (
              <div key={t.id} className="rounded-lg border border-border/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">{t.name}</p>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setDrafts({ ...drafts, [t.id]: { ...draft, rating: n } })
                        }
                        aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      >
                        <Star
                          className={`h-4 w-4 ${
                            n <= draft.rating
                              ? "fill-gold text-gold"
                              : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Share your experience (optional)"
                  value={draft.comment}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [t.id]: { ...draft, comment: e.target.value } })
                  }
                />
                <div className="mt-2 flex justify-end">
                  <Button size="sm" onClick={() => submit(t.id)} disabled={!draft.rating}>
                    {existing ? "Update review" : "Submit review"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}

/* ===================== PROPOSE A COURSE (TUTOR) ===================== */

type ProposedCourse = {
  id: string;
  name: string;
  level: "primary" | "high_school" | "tertiary";
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

function ProposeCourseCard({ tutorId }: { tutorId: string }) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState<"primary" | "high_school" | "tertiary">("high_school");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<ProposedCourse[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("tutor_courses")
      .select("id, name, level, status, created_at")
      .eq("tutor_id", tutorId)
      .order("created_at", { ascending: false });
    setMine((data as ProposedCourse[]) ?? []);
  };
  useEffect(() => { load(); }, [tutorId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("tutor_courses").insert({
      tutor_id: tutorId, name: name.trim(), level, description: description.trim() || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Submitted for admin review"); setName(""); setDescription(""); load(); }
    setBusy(false);
  };

  const labels: Record<ProposedCourse["level"], string> = {
    primary: "Primary", high_school: "High School", tertiary: "Tertiary",
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="text-sm text-muted-foreground">
          Don't see a subject you teach? Propose it here — an admin will review and add it to the catalog.
        </p>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <Label>Course name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Discrete Mathematics" maxLength={120} />
          </div>
          <div className="md:col-span-2">
            <Label>Level</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as ProposedCourse["level"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="high_school">High School</SelectItem>
                <SelectItem value="tertiary">Tertiary / Undergraduate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-6">
            <Label>Short description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} />
          </div>
          <div className="md:col-span-6 flex justify-end">
            <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit for review"}</Button>
          </div>
        </form>

        {mine.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your proposals</h4>
            <ul className="space-y-1.5 text-sm">
              {mine.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-md border p-2">
                  <span>{c.name} <span className="text-xs text-muted-foreground">· {labels[c.level]}</span></span>
                  <Badge variant={c.status === "approved" ? "default" : c.status === "rejected" ? "destructive" : "secondary"}>
                    {c.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
