import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageContainer } from "@/components/dashboard/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Copy, CalendarOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tutor/availability")({
  component: AvailabilityPage,
});

type Slot = { id: string; weekday: number; start_min: number; end_min: number; timezone: string; buffer_minutes: number };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function mins(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function hhmm(min: number) { return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`; }

function AvailabilityPage() {
  const { user, isTutor } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [tz, setTz] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [buffer, setBuffer] = useState<number>(0);

  const [weekday, setWeekday] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tutor_availability")
      .select("id, weekday, start_min, end_min, timezone, buffer_minutes")
      .eq("tutor_id", user.id)
      .order("weekday").order("start_min");
    const rows = (data as Slot[]) ?? [];
    setSlots(rows);
    if (rows[0]) { setTz(rows[0].timezone); setBuffer(rows[0].buffer_minutes); }
  };

  useEffect(() => { load(); }, [user]);

  const add = async () => {
    if (!user) return;
    const s = mins(start), e = mins(end);
    if (e <= s) return toast.error("End must be after start");
    const { error } = await supabase.from("tutor_availability").insert({
      tutor_id: user.id,
      weekday: Number(weekday),
      start_min: s,
      end_min: e,
      timezone: tz,
      buffer_minutes: buffer,
    });
    if (error) return toast.error(error.message);
    load();
  };

  const del = async (id: string) => {
    await supabase.from("tutor_availability").delete().eq("id", id);
    load();
  };

  const updateAll = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("tutor_availability")
      .update({ timezone: tz, buffer_minutes: buffer })
      .eq("tutor_id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Saved");
    load();
  };

  const copyDay = async (from: number, to: number) => {
    if (!user) return;
    const rows = slots.filter((s) => s.weekday === from);
    if (rows.length === 0) return toast.error("Nothing to copy");
    await supabase.from("tutor_availability").delete().eq("tutor_id", user.id).eq("weekday", to);
    await supabase.from("tutor_availability").insert(
      rows.map((r) => ({
        tutor_id: user.id, weekday: to, start_min: r.start_min, end_min: r.end_min,
        timezone: tz, buffer_minutes: buffer,
      })),
    );
    load();
  };

  if (!isTutor) {
    return <PageContainer title="Availability"><p className="text-sm text-muted-foreground">Tutors only.</p></PageContainer>;
  }

  return (
    <PageContainer
      title="Weekly availability"
      description="Set the hours students can book. Times saved in the timezone you choose."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/tutor/holidays"><CalendarOff className="mr-2 h-4 w-4" /> Holidays</Link>
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Add a window</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Day</Label>
                <Select value={weekday} onValueChange={setWeekday}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Start</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div><Label>End</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            </div>
            <Button onClick={add}>Add window</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Timezone</Label>
              <Input value={tz} onChange={(e) => setTz(e.target.value)} placeholder="Africa/Harare" />
            </div>
            <div>
              <Label>Buffer between lessons (minutes)</Label>
              <Input type="number" min={0} max={120} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} />
            </div>
            <Button variant="outline" size="sm" onClick={updateAll}>Save settings</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
            {WEEKDAYS.map((d, i) => {
              const day = slots.filter((s) => s.weekday === i);
              return (
                <div key={d} className="rounded-md border p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase">{d}</p>
                    <Select onValueChange={(v) => copyDay(i, Number(v))}>
                      <SelectTrigger className="h-6 w-6 border-none p-0"><Copy className="h-3 w-3" /></SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((t, j) => j !== i && <SelectItem key={j} value={String(j)}>Copy → {t}</SelectItem>).filter(Boolean) as any}
                      </SelectContent>
                    </Select>
                  </div>
                  {day.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">—</p>
                  ) : (
                    <ul className="space-y-1">
                      {day.map((s) => (
                        <li key={s.id} className="flex items-center justify-between rounded bg-muted px-2 py-1 text-[11px]">
                          <span>{hhmm(s.start_min)}–{hhmm(s.end_min)}</span>
                          <button onClick={() => del(s.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
