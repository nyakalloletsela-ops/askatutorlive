import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyBookingEmails } from "@/lib/booking-emails.functions";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { Search, Crown, Star, CalendarPlus, Gift } from "lucide-react";

export const Route = createFileRoute("/tutors")({
  head: () => ({
    meta: [
      { title: "All Tutors — Ask A Tutor Live" },
      { name: "description", content: "Browse all verified tutors on Ask A Tutor Live. Filter by subject and book a live one-on-one session." },
    ],
  }),
  component: AllTutorsPage,
});

type TutorRow = {
  id: string;
  full_name: string | null;
  bio: string | null;
  subjects: string[] | null;
  hourly_rate: number | null;
  avatar_url: string | null;
  is_featured: boolean;
  avg_rating: number | null;
  review_count: number | null;
  session_count: number | null;
};

function AllTutorsPage() {
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("list_public_tutors");
      if (error) { console.error(error); return; }
      setTutors((data as TutorRow[]) ?? []);
    })();
  }, []);

  const filtered = tutors.filter((t) => {
    if (subject && !(t.subjects ?? []).includes(subject)) return false;
    if (q && !(t.full_name ?? "").toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const allSubjects = Array.from(new Set(tutors.flatMap((t) => t.subjects ?? []))).sort();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">All tutors</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tutors.length} verified tutor{tutors.length === 1 ? "" : "s"} available.
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search tutors…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </div>

        {allSubjects.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {allSubjects.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={subject === s ? "default" : "outline"}
                onClick={() => setSubject(subject === s ? null : s)}
                className="rounded-full"
              >
                {s}
              </Button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            No tutors match your search.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => <TutorCard key={t.id} t={t} />)}
          </div>
        )}

        <div className="mt-10 text-center">
          <Button asChild variant="outline"><Link to="/">Back to home</Link></Button>
        </div>
      </section>
    </div>
  );
}

function TutorCard({ t }: { t: TutorRow }) {
  return (
    <Card className="h-full border-border/60 transition hover:shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
            {t.avatar_url ? (
              <img src={t.avatar_url} alt={t.full_name ?? ""} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                {(t.full_name ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="truncate font-semibold">{t.full_name ?? "Unnamed tutor"}</h4>
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              {(t.review_count ?? 0) > 0 ? (
                <>
                  <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                  <span className="font-medium text-foreground">{Number(t.avg_rating ?? 0).toFixed(1)}</span>
                  <span>· {t.review_count} review{t.review_count === 1 ? "" : "s"}</span>
                </>
              ) : (
                <span className="italic">New tutor</span>
              )}
              {(t.session_count ?? 0) > 0 && (
                <span className="ml-2">· {t.session_count} session{t.session_count === 1 ? "" : "s"}</span>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {t.bio ?? "No bio yet."}
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {(t.subjects ?? []).slice(0, 4).map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
            {t.hourly_rate != null && (
              <p className="mt-3 text-sm font-medium">
                <span className="text-aurora">M{t.hourly_rate}</span>
                <span className="text-muted-foreground">/hour</span>
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" className="bg-aurora text-white">
                <Link to="/book/$tutorId" params={{ tutorId: t.id }}>
                  <CalendarPlus className="mr-1 h-4 w-4" /> Book lesson
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/tutor/$id" params={{ id: t.id }}>View profile</Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BookSessionDialog({ tutor }: { tutor: TutorRow }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const subjects = tutor.subjects ?? [];
  const [subject, setSubject] = useState<string>(subjects[0] ?? "");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [duration, setDuration] = useState<string>("60");
  const [useFree, setUseFree] = useState(false);
  const [freeMinutes, setFreeMinutes] = useState<number>(0);

  useEffect(() => {
    if (!open || !user) return;
    supabase.from("profiles").select("free_minutes_remaining").eq("id", user.id).single()
      .then(({ data }) => setFreeMinutes((data as { free_minutes_remaining?: number } | null)?.free_minutes_remaining ?? 0));
  }, [open, user]);

  if (!user) {
    return (
      <Button size="sm" className="w-full bg-aurora text-white" onClick={() => { toast.info("Please sign in to book"); navigate({ to: "/auth" }); }}>
        <CalendarPlus className="mr-1 h-4 w-4" /> Book session
      </Button>
    );
  }

  if (user.id === tutor.id) {
    return (
      <Button size="sm" variant="outline" className="w-full" disabled>
        This is you
      </Button>
    );
  }

  const canUseFree = freeMinutes >= Number(duration);

  const submit = async () => {
    if (!date || !time) return;
    setLoading(true);
    try {
      const scheduledAt = new Date(`${date}T${time}`);
      if (isNaN(scheduledAt.getTime()) || scheduledAt < new Date()) { toast.error("Pick a future date and time"); return; }
      if (user.id === tutor.id) { toast.error("You can't book a session with yourself"); return; }
      const { data: inserted, error } = await supabase.from("sessions").insert({
        tutor_id: tutor.id, student_id: user.id, subject: subject || null,
        scheduled_at: scheduledAt.toISOString(), duration_min: Number(duration), is_free: useFree,
      }).select("id").single();
      if (error) {
        const msg = /row-level security/i.test(error.message)
          ? "You can't book this session. Make sure you're signed in as a student and not booking yourself."
          : error.message;
        throw new Error(msg);
      }
      if (inserted?.id) {
        notifyBookingEmails({ data: { sessionId: inserted.id } }).catch(() => {});
      }
      toast.success("Session booked!");
      setOpen(false);
      navigate({ to: "/dashboard" });
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full bg-aurora text-white">
          <CalendarPlus className="mr-1 h-4 w-4" /> Book session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book {tutor.full_name ?? "tutor"}</DialogTitle>
          <DialogDescription>Pick a subject, date and time for your session.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {subjects.length > 0 && (
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue placeholder="Choose subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Time</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={(v) => { setDuration(v); if (Number(v) > freeMinutes) setUseFree(false); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="90">1.5 hours</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {freeMinutes > 0 && (
            <label className={`flex items-start gap-3 rounded-md border p-3 text-sm ${canUseFree ? "cursor-pointer hover:bg-muted/40" : "opacity-60"}`}>
              <input type="checkbox" className="mt-1" checked={useFree} disabled={!canUseFree} onChange={(e) => setUseFree(e.target.checked)} />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 font-medium"><Gift className="h-4 w-4 text-gold" /> Use a free welcome lesson</div>
                <p className="text-xs text-muted-foreground">You have <strong>{freeMinutes} minutes</strong> remaining.</p>
              </div>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading || !date || !time} className="bg-aurora text-white">
            {loading ? "Booking…" : "Confirm booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
