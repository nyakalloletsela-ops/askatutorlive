import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  MessageSquare, Video, Bot, ArrowRight, Sparkles, GraduationCap as GradCap, Users,
  Sigma, FlaskConical, BookOpen, Code2, Briefcase, GraduationCap,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AskATutorLive — Get unstuck in seconds" },
      { name: "description", content: "Start a live learning session instantly with real tutors or AI. No waiting, no friction." },
      { property: "og:title", content: "AskATutorLive — Get unstuck in seconds" },
      { property: "og:description", content: "Start a live learning session instantly with real tutors or AI." },
    ],
  }),
  component: Home,
});

type TutorRow = {
  id: string;
  subjects: string[] | null;
};

function Home() {
  const { user, loading } = useAuth();
  const [tutorCount, setTutorCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.rpc("list_public_tutors").then(({ data, error }) => {
      if (error) { setTutorCount(null); return; }
      setTutorCount(((data as TutorRow[]) ?? []).length);
    });
  }, []);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero tutorCount={tutorCount} />
      <ActivityTicker />
      <InstantActions />
      <HowItWorks />
      <TrustMetrics tutorCount={tutorCount} />
      <Subjects />
      <MinimalFooter />
    </div>
  );
}

/* ===================== HERO ===================== */

function Hero({ tutorCount }: { tutorCount: number | null }) {
  const navigate = useNavigate();
  const [learnOpen, setLearnOpen] = useState(false);

  return (
    <section className="border-b border-border/60 bg-gradient-to-b from-muted/40 to-background">
      <div className="mx-auto max-w-3xl px-4 py-20 text-center md:py-28">
        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          Get unstuck in seconds — <span className="text-aurora">with real tutors or AI.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
          One tap to learn, one tap to teach. No waiting, no friction.
        </p>
        <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Button
            size="lg"
            onClick={() => setLearnOpen(true)}
            className="h-14 rounded-2xl bg-aurora px-8 text-base font-semibold text-white shadow-glow-electric hover:opacity-90"
          >
            <GradCap className="mr-2 h-5 w-5" /> Start Learning
          </Button>
          <Button asChild size="lg" variant="outline" className="h-14 rounded-2xl px-8 text-base font-semibold">
            <Link to="/auth" search={{ role: "tutor" } as never}>
              <Users className="mr-2 h-5 w-5" /> Start Teaching
            </Link>
          </Button>
        </div>
        {tutorCount != null && tutorCount > 0 && (
          <p className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="neon-dot" />
            <span className="font-semibold text-foreground tabular-nums">{tutorCount}</span> verified tutors ready now
          </p>
        )}
      </div>

      <Dialog open={learnOpen} onOpenChange={setLearnOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>How do you want to learn?</DialogTitle>
            <DialogDescription>Pick a path. You can switch any time.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <button
              onClick={() => { setLearnOpen(false); void navigate({ to: "/tutors" }); }}
              className="group flex items-start gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary hover:shadow-sm"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Video className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  Human tutor <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Browse verified tutors and start a live session.
                </p>
              </div>
            </button>
            <button
              onClick={() => { setLearnOpen(false); void navigate({ to: "/auth" }); }}
              className="group flex items-start gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary hover:shadow-sm"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  AI tutor <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Socratic coach. Guides you with hints — never just hands you the answer.
                </p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ===================== ACTIVITY TICKER ===================== */
/* Spec: real-time / server-driven. Sessions table is RLS-restricted from guests,
   so we hide the strip entirely when no live data is available. */

type ActivityEvent = { id: string; emoji: string; text: string };

function ActivityTicker() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Try to pull subjects of public tutors as a hint of "what's being learnt now".
      // Only render the strip if we got real data back.
      const { data, error } = await supabase.rpc("list_public_tutors");
      if (cancelled || error) return;
      const rows = (data as TutorRow[]) ?? [];
      const subjects = Array.from(new Set(rows.flatMap((r) => r.subjects ?? []))).slice(0, 8);
      if (subjects.length === 0) return;
      setEvents(
        subjects.map((s, i) => ({
          id: `${s}-${i}`,
          emoji: subjectEmoji(s),
          text: `${s} tutor available now`,
        })),
      );
    })();
    return () => { cancelled = true; };
  }, []);

  if (events.length === 0) return null;

  // Duplicate for seamless marquee.
  const loop = [...events, ...events];

  return (
    <div className="border-b border-border/60 bg-muted/20 py-2.5 overflow-hidden">
      <div className="flex gap-6 whitespace-nowrap animate-[ticker_40s_linear_infinite]">
        {loop.map((e, i) => (
          <span key={`${e.id}-${i}`} className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span aria-hidden>{e.emoji}</span>
            <span>{e.text}</span>
            <span className="mx-3 text-border">·</span>
          </span>
        ))}
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}

function subjectEmoji(s: string) {
  const k = s.toLowerCase();
  if (k.includes("math")) return "📚";
  if (k.includes("phys")) return "🔭";
  if (k.includes("chem")) return "🧪";
  if (k.includes("bio")) return "🧬";
  if (k.includes("eng") || k.includes("lit")) return "📖";
  if (k.includes("cod") || k.includes("prog") || k.includes("comp")) return "💻";
  if (k.includes("bus") || k.includes("econ")) return "💼";
  return "🎓";
}

/* ===================== INSTANT ACTION PANEL ===================== */

function InstantActions() {
  const actions = [
    { icon: MessageSquare, emoji: "📘", title: "Ask a Question", desc: "Type it. Get an answer in seconds.", to: "/auth" as const },
    { icon: Video, emoji: "🎥", title: "Join Live Tutor", desc: "Hop into a session with a verified tutor.", to: "/tutors" as const },
    { icon: Bot, emoji: "🤖", title: "AI Tutor Mode", desc: "Instant explanations, 24/7.", to: "/auth" as const },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
      <div className="grid gap-5 md:grid-cols-3">
        {actions.map((a) => (
          <Link
            key={a.title}
            to={a.to}
            className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card p-7 transition hover:-translate-y-0.5 hover:border-electric hover:shadow-glow-electric"
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl transition group-hover:bg-primary/20" />
            <div className="text-4xl">{a.emoji}</div>
            <h3 className="mt-5 text-xl font-semibold tracking-tight">{a.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{a.desc}</p>
            <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-electric">
              Start now <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ===================== HOW IT WORKS ===================== */

function HowItWorks() {
  const steps = [
    { n: 1, title: "Type your question", desc: "Tell us what you're stuck on." },
    { n: 2, title: "Get matched instantly", desc: "Real tutor or AI — your choice." },
    { n: 3, title: "Learn live", desc: "Video, whiteboard and chat in one room." },
  ];
  return (
    <section className="border-y border-border/60 bg-muted/20">
      <div className="mx-auto max-w-5xl px-4 py-16 md:py-20">
        <h2 className="mb-10 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          How it works
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-border/60 bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-aurora text-base font-bold text-white">
                {s.n}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===================== TRUST METRICS ===================== */
/* Only render metrics we can actually compute. No fake stats. */

function TrustMetrics({ tutorCount }: { tutorCount: number | null }) {
  const metrics: { label: string; value: string }[] = [];
  if (tutorCount != null && tutorCount > 0) {
    metrics.push({ label: "Verified tutors", value: tutorCount.toLocaleString() });
  }
  if (metrics.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="bg-card px-6 py-6 text-center">
            <div className="text-3xl font-semibold tracking-tight text-aurora tabular-nums">{m.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{m.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ===================== SUBJECTS GRID ===================== */

function Subjects() {
  const items = [
    { icon: Sigma, label: "Maths" },
    { icon: FlaskConical, label: "Science" },
    { icon: BookOpen, label: "English" },
    { icon: Code2, label: "Coding" },
    { icon: Briefcase, label: "Business" },
    { icon: GraduationCap, label: "Exam prep" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Jump into a subject</h2>
        <p className="mt-2 text-sm text-muted-foreground">One tap — straight into a session.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((s) => (
          <Link
            key={s.label}
            to="/tutors"
            className="group flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card p-5 text-center transition hover:-translate-y-0.5 hover:border-electric hover:shadow-glow-electric"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-aurora text-white">
              <s.icon className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold">{s.label}</span>
          </Link>
        ))}
      </div>
      <div className="mt-10 text-center">
        <Button asChild size="lg" className="rounded-2xl bg-aurora text-white shadow-glow-electric hover:opacity-90">
          <Link to="/tutors">
            <Sparkles className="mr-2 h-4 w-4" /> Start Session
          </Link>
        </Button>
      </div>
    </section>
  );
}

/* ===================== FOOTER ===================== */

function MinimalFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/20">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row">
        <div>© {new Date().getFullYear()} AskATutorLive</div>
        <nav className="flex flex-wrap items-center gap-5">
          <Link to="/community" className="hover:text-foreground">About</Link>
          <Link to="/auth" className="hover:text-foreground">Become a Tutor</Link>
          <Link to="/help" className="hover:text-foreground">Support</Link>
          <a href="mailto:help@askatutorlive.com" className="hover:text-foreground">Terms</a>
        </nav>
      </div>
    </footer>
  );
}
