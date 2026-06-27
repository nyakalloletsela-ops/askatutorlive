import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tutor/holidays")({
  component: Holidays,
});

type H = { id: string; start_date: string; end_date: string; reason: string | null };

function Holidays() {
  const { user, isTutor } = useAuth();
  const [list, setList] = useState<H[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("tutor_holidays")
      .select("id, start_date, end_date, reason")
      .eq("tutor_id", user!.id)
      .order("start_date", { ascending: false });
    setList((data as H[]) ?? []);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const add = async () => {
    if (!start || !end) return toast.error("Pick start and end");
    const { error } = await supabase.from("tutor_holidays").insert({
      tutor_id: user!.id,
      start_date: start,
      end_date: end,
      reason: reason || null,
    });
    if (error) return toast.error(error.message);
    setStart(""); setEnd(""); setReason("");
    load();
  };

  const del = async (id: string) => {
    await supabase.from("tutor_holidays").delete().eq("id", id);
    load();
  };

  if (!isTutor) {
    return (
      <div className="container mx-auto max-w-2xl py-10">
        <Card>
          <CardHeader>
            <CardTitle>Tutor only</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This page is for tutors managing their availability.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">Holidays &amp; time off</h1>
        <p className="text-sm text-muted-foreground">
          Block date ranges so students can't book lessons during your time off.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Add a holiday</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vacation" />
          </div>
          <Button onClick={add}>Add holiday</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Upcoming &amp; past holidays</CardTitle></CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No holidays scheduled.</p>
          ) : (
            <ul className="divide-y">
              {list.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">
                      {new Date(h.start_date).toLocaleDateString()} → {new Date(h.end_date).toLocaleDateString()}
                    </p>
                    {h.reason && <p className="text-xs text-muted-foreground">{h.reason}</p>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => del(h.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
