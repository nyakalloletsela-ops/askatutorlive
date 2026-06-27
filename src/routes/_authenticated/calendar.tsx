import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

type CalEvent = { id: string; date: string; title: string; kind: "session" | "assignment" };

function CalendarPage() {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const monthStart = new Date(cursor);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);

  const { data: events = [] } = useQuery({
    queryKey: ["calendar", user?.id, cursor.toISOString()],
    queryFn: async () => {
      const startIso = monthStart.toISOString();
      const endIso = monthEnd.toISOString();
      const [{ data: sessions }, { data: assignments }] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, scheduled_at, subject")
          .gte("scheduled_at", startIso)
          .lte("scheduled_at", endIso),
        supabase
          .from("assignments")
          .select("id, due_at, title")
          .gte("due_at", startIso)
          .lte("due_at", endIso),
      ]);
      const evs: CalEvent[] = [];
      (sessions ?? []).forEach((s) =>
        evs.push({
          id: s.id,
          date: s.scheduled_at as string,
          title: s.subject ?? "Session",
          kind: "session",
        }),
      );
      (assignments ?? []).forEach((a) => {
        if (a.due_at) evs.push({ id: a.id, date: a.due_at, title: a.title, kind: "assignment" });
      });
      return evs;
    },
    enabled: !!user,
  });

  const grid = useMemo(() => buildGrid(cursor, events), [cursor, events]);

  return (
    <PageContainer
      title="Calendar"
      description="Sessions and assignment due dates."
      actions={
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[140px] text-center text-sm font-medium">
            {cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <Card>
        <CardContent className="p-2">
          <div className="grid grid-cols-7 gap-px text-[10px] uppercase tracking-wider text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-2 py-1 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border">
            {grid.map((cell, i) => (
              <div
                key={i}
                className={cn(
                  "min-h-[88px] bg-background p-1.5",
                  !cell.inMonth && "bg-muted/30 text-muted-foreground",
                )}
              >
                <div className="text-xs font-medium">{cell.day}</div>
                <div className="mt-1 space-y-0.5">
                  {cell.events.slice(0, 3).map((e) => (
                    <Badge
                      key={e.id}
                      variant={e.kind === "session" ? "default" : "secondary"}
                      className="block w-full truncate px-1 py-0.5 text-[10px] font-normal"
                    >
                      {e.title}
                    </Badge>
                  ))}
                  {cell.events.length > 3 && (
                    <p className="text-[10px] text-muted-foreground">+{cell.events.length - 3} more</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function buildGrid(cursor: Date, events: CalEvent[]) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(start.getDate() - first.getDay());
  const cells: { day: number; date: Date; inMonth: boolean; events: CalEvent[] }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dayEvents = events.filter((e) => {
      const ed = new Date(e.date);
      return (
        ed.getFullYear() === d.getFullYear() &&
        ed.getMonth() === d.getMonth() &&
        ed.getDate() === d.getDate()
      );
    });
    cells.push({
      day: d.getDate(),
      date: d,
      inMonth: d.getMonth() === cursor.getMonth(),
      events: dayEvents,
    });
  }
  return cells;
}
