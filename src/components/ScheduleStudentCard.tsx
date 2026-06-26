import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { notifyBookingEmails } from "@/lib/booking-emails.functions";
import { listSchedulableStudents } from "@/lib/students.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";

type Student = { id: string; name: string };

export function ScheduleStudentCard({
  tutorId,
  onCreated,
}: {
  tutorId: string;
  onCreated?: () => void;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [subject, setSubject] = useState("");
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState("");
  const loadStudents = useServerFn(listSchedulableStudents);

  useEffect(() => {
    (async () => {
      try {
        const rows = await loadStudents();
        setStudents((rows as Student[]).filter((s) => s.id !== tutorId));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load students");
        setStudents([]);
      }
    })();
  }, [loadStudents, tutorId]);

  const filtered = query
    ? students.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : students;

  const submit = async () => {
    if (!studentId || !when) {
      toast.error("Pick a student and a time");
      return;
    }
    setBusy(true);
    const { data: inserted, error } = await supabase
      .from("sessions")
      .insert({
        tutor_id: tutorId,
        student_id: studentId,
        subject: subject || null,
        scheduled_at: new Date(when).toISOString(),
        duration_min: duration,
        is_free: false,
        status: "scheduled",
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (inserted?.id) {
      notifyBookingEmails({ data: { sessionId: inserted.id } }).catch(() => {});
    }
    toast.success("Session scheduled");
    setSubject("");
    setWhen("");
    onCreated?.();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No student accounts found yet. Once students sign up you'll be able to schedule classes
            for them here.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>Search students</Label>
              <Input
                placeholder="Type a name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Student ({filtered.length})</Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {filtered.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subject (optional)</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Date & time</Label>
                <Input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  min={15}
                  step={15}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) || 60)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={submit} disabled={busy}>
                <CalendarPlus className="mr-1.5 h-4 w-4" />
                {busy ? "Scheduling…" : "Schedule session"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
