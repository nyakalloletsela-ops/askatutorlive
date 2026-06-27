import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { notifyBookingEmails } from "@/lib/booking-emails.functions";
import { PageContainer } from "@/components/dashboard/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Repeat, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScopeGate } from "@/components/ScopeGate";

export const Route = createFileRoute("/_authenticated/book/$tutorId")({
  component: () => (<ScopeGate scope="find_tutors"><BookTutorPage /></ScopeGate>),
});

type Avail = { weekday: number; start_min: number; end_min: number; timezone: string; buffer_minutes: number };
type Busy = { scheduled_at: string; duration_min: number };
type Holiday = { start_date: string; end_date: string };

const STEP_MIN = 30;
const studentTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function BookTutorPage() {
  const { tutorId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tutor, setTutor] = useState<{ full_name: string | null; hourly_rate: number | null; subjects: string[] | null } | null>(null);
  const [avail, setAvail] = useState<Avail[]>([]);
  const [busy, setBusy] = useState<Busy[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [duration, setDuration] = useState(60);
  const [subject, setSubject] = useState<string>("");
  const [recurrence, setRecurrence] = useState<number>(1);
  const [picked, setPicked] = useState<Date | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase
        .from("profiles")
        .select("full_name, hourly_rate, subjects")
        .eq("id", tutorId)
        .maybeSingle();
      setTutor(t as any);
      if (t?.subjects?.[0]) setSubject(t.subjects[0]);

      const [a, h] = await Promise.all([
        supabase.rpc("get_tutor_availability_public", { _tutor: tutorId }),
        supabase.rpc("get_tutor_holidays_public", { _tutor: tutorId }),
      ]);
      setAvail((a.data as Avail[]) ?? []);
      setHolidays((h.data as Holiday[]) ?? []);
    })();
  }, [tutorId]);

  useEffect(() => {
    const from = weekStart.toISOString();
    const to = new Date(weekStart.getTime() + 7 * 86400000).toISOString();
    supabase
      .rpc("get_tutor_busy_slots", { _tutor: tutorId, _from: from, _to: to })
      .then(({ data }) => setBusy((data as Busy[]) ?? []));
  }, [tutorId, weekStart]);

  const tutorTz = avail[0]?.timezone ?? "UTC";
  const buffer = avail[0]?.buffer_minutes ?? 0;

  // Compute slots for the visible week, expressed in student TZ.
  const days = useMemo(() => {
    const out: { date: Date; slots: Date[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const slots: Date[] = [];
      // For each availability window, walk steps and add candidate slots.
      avail.forEach((w) => {
        // Find a date that, when expressed in tutorTz, falls on weekday w.weekday.
        // Use the student's calendar day, then check tutor-side weekday.
        for (let m = w.start_min; m + duration <= w.end_min; m += STEP_MIN) {
          const candidate = buildTutorLocal(day, w.weekday, m, tutorTz);
          if (!candidate) continue;
          if (candidate < new Date()) continue;
          // Check holidays in tutor TZ (date comparison)
          const tutorDate = candidate.toLocaleDateString("en-CA", { timeZone: tutorTz });
          if (holidays.some((h) => tutorDate >= h.start_date && tutorDate <= h.end_date)) continue;
          // Check busy with buffer
          const end = new Date(candidate.getTime() + duration * 60000);
          const clash = busy.some((b) => {
            const bs = new Date(new Date(b.scheduled_at).getTime() - buffer * 60000);
            const be = new Date(new Date(b.scheduled_at).getTime() + (b.duration_min + buffer) * 60000);
            return candidate < be && end > bs;
          });
          if (!clash) slots.push(candidate);
        }
      });
      slots.sort((a, b) => a.getTime() - b.getTime());
      // De-dupe identical timestamps
      const seen = new Set<number>();
      const unique = slots.filter((s) => (seen.has(s.getTime()) ? false : (seen.add(s.getTime()), true)));
      out.push({ date: day, slots: unique });
    }
    return out;
  }, [weekStart, avail, busy, holidays, duration, tutorTz, buffer]);

  const totalSlots = days.reduce((n, d) => n + d.slots.length, 0);

  const onConfirm = async () => {
    if (!picked || !user) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("book_session", {
      _tutor: tutorId,
      _start: picked.toISOString(),
      _duration_min: duration,
      _subject: subject || (tutor?.subjects?.[0] ?? "General"),
      _is_free: false,
      _recurrence_weeks: recurrence,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const ids = (data as string[]) ?? [];
    toast.success(`Booked ${ids.length} session${ids.length > 1 ? "s" : ""}`);
    // fire emails (best-effort)
    ids.forEach((id) => notifyBookingEmails({ data: { sessionId: id } }).catch(() => {}));
    setConfirmOpen(false);
    navigate({ to: "/lessons" });
  };

  return (
    <PageContainer
      title={`Book ${tutor?.full_name ?? "tutor"}`}
      description={`Times shown in your timezone (${studentTz}). Tutor schedules in ${tutorTz}.`}
    >
      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 86400000))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[200px] text-center text-sm font-medium">
                {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} —{" "}
                {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </div>
              <Button size="icon" variant="outline" onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 86400000))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              This week
            </Button>
          </CardHeader>
          <CardContent>
            {avail.length === 0 ? (
              <p className="text-sm text-muted-foreground">This tutor has not set availability yet.</p>
            ) : totalSlots === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No open slots this week.{" "}
                <Button variant="link" size="sm" onClick={() => joinWaitlist(tutorId, subject, duration)}>
                  Join the waitlist
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {days.map((d) => (
                  <div key={d.date.toISOString()} className="min-w-0">
                    <div className="mb-2 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {d.date.toLocaleDateString(undefined, { weekday: "short" })}
                      </p>
                      <p className="text-sm font-semibold">{d.date.getDate()}</p>
                    </div>
                    <div className="space-y-1">
                      {d.slots.length === 0 ? (
                        <p className="text-center text-[10px] text-muted-foreground">—</p>
                      ) : (
                        d.slots.map((s) => (
                          <Button
                            key={s.toISOString()}
                            size="sm"
                            variant={picked?.getTime() === s.getTime() ? "default" : "outline"}
                            className="w-full px-1 text-[11px]"
                            onClick={() => {
                              setPicked(s);
                              setConfirmOpen(true);
                            }}
                          >
                            {s.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </Button>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Lesson</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Duration</Label>
                <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="90">90 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(tutor?.subjects?.length ?? 0) > 0 && (
                <div>
                  <Label>Subject</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tutor!.subjects!.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="flex items-center gap-1"><Repeat className="h-3.5 w-3.5" /> Recurring weekly</Label>
                <Select value={String(recurrence)} onValueChange={(v) => setRecurrence(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">One-off</SelectItem>
                    <SelectItem value="4">4 weeks</SelectItem>
                    <SelectItem value="8">8 weeks</SelectItem>
                    <SelectItem value="12">12 weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {tutor?.hourly_rate != null && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="text-muted-foreground">Estimated price</p>
                  <p className="text-lg font-semibold">${((tutor.hourly_rate * duration) / 60).toFixed(2)} per lesson</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Timezones</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p><Badge variant="secondary">You</Badge> {studentTz}</p>
              <p><Badge variant="outline">Tutor</Badge> {tutorTz}</p>
              {buffer > 0 && <p className="text-xs text-muted-foreground">Tutor buffer between lessons: {buffer} min</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm booking</DialogTitle>
            <DialogDescription>
              {picked?.toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              {" · "}{duration} min{recurrence > 1 ? ` · ${recurrence} weekly sessions` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Tutor: {tutor?.full_name}</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Subject: {subject || "General"}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Back</Button>
            <Button onClick={onConfirm} disabled={submitting}>
              {submitting ? "Booking…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

// Build a Date corresponding to the tutor's local time on the given calendar day.
// We use the student-side "day" only to anchor a date; we then find the tutor-local
// timestamp for that day at start_min on weekday _w_. We accept that day boundaries
// may shift by ±1 day relative to student TZ — slot listing still ends up in student TZ.
function buildTutorLocal(studentDay: Date, weekday: number, startMin: number, tutorTz: string): Date | null {
  // Iterate ±1 day around the student's calendar day to find the matching tutor weekday.
  for (let offset = -1; offset <= 1; offset++) {
    const probe = new Date(studentDay);
    probe.setDate(studentDay.getDate() + offset);
    const y = probe.getFullYear();
    const m = String(probe.getMonth() + 1).padStart(2, "0");
    const d = String(probe.getDate()).padStart(2, "0");
    const hh = String(Math.floor(startMin / 60)).padStart(2, "0");
    const mm = String(startMin % 60).padStart(2, "0");
    // Build "wall time" in tutorTz: YYYY-MM-DDTHH:MM in tutorTz, then convert to UTC.
    const candidate = zonedTimeToUtc(`${y}-${m}-${d}T${hh}:${mm}:00`, tutorTz);
    if (!candidate) continue;
    if (candidate.toLocaleString("en-US", { timeZone: tutorTz, weekday: "short" }) !== ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][weekday]) continue;
    // Only include if the candidate falls on studentDay in student TZ.
    if (candidate.toDateString() === studentDay.toDateString()) return candidate;
  }
  return null;
}

// Lightweight wall-time → UTC for a given IANA timezone.
function zonedTimeToUtc(wall: string, tz: string): Date {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  // Guess: treat wall as UTC, then adjust by offset returned for that instant in tz.
  const utcGuess = new Date(wall + "Z");
  const parts = fmt.formatToParts(utcGuess).reduce<Record<string, string>>((a, p) => {
    if (p.type !== "literal") a[p.type] = p.value;
    return a;
  }, {});
  const asTzMs = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
  );
  const diff = asTzMs - utcGuess.getTime();
  return new Date(utcGuess.getTime() - diff);
}

async function joinWaitlist(tutorId: string, subject: string, duration: number) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { error } = await supabase.from("session_waitlist").insert({
    tutor_id: tutorId,
    student_id: u.user.id,
    subject: subject || null,
    duration_min: duration,
  });
  if (error) toast.error(error.message);
  else toast.success("Added to waitlist — we'll notify you when a slot opens.");
}
