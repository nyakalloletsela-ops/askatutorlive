import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/access.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/commissions")({
  beforeLoad: async () => {
    const { isAdmin } = await checkIsAdmin();
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: AdminCommissions,
});

type Rule = {
  id: string;
  scope: "global" | "tutor" | "subject" | "promo";
  target_id: string | null;
  target_text: string | null;
  method: "percent" | "fixed" | "hybrid";
  percent: number;
  fixed_cents: number;
  active_from: string;
  active_to: string | null;
  is_active: boolean;
  notes: string | null;
};

const empty = (): Partial<Rule> => ({
  scope: "global",
  method: "percent",
  percent: 20,
  fixed_cents: 0,
  is_active: true,
});

function AdminCommissions() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [editing, setEditing] = useState<Partial<Rule> | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("commission_rules")
      .select("*")
      .order("scope")
      .order("active_from", { ascending: false });
    setRules((data as Rule[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const payload: any = { ...editing };
    if (payload.scope === "global") {
      payload.target_id = null;
      payload.target_text = null;
    } else if (payload.scope === "subject") {
      payload.target_id = null;
    } else if (payload.scope === "tutor") {
      payload.target_text = null;
    }
    const { error } = editing.id
      ? await supabase.from("commission_rules").update(payload).eq("id", editing.id)
      : await supabase.from("commission_rules").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    await supabase.from("commission_rules").delete().eq("id", id);
    load();
  };

  const toggleActive = async (r: Rule) => {
    await supabase.from("commission_rules").update({ is_active: !r.is_active }).eq("id", r.id);
    load();
  };

  const formatRule = (r: Rule) =>
    r.method === "percent"
      ? `${r.percent}%`
      : r.method === "fixed"
      ? `$${(r.fixed_cents / 100).toFixed(2)}`
      : `${r.percent}% + $${(r.fixed_cents / 100).toFixed(2)}`;

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Commission rules</h1>
          <p className="text-sm text-muted-foreground">
            Set the platform commission. Tutor-specific and subject-specific rules override the
            global default.
          </p>
        </div>
        <Button onClick={() => setEditing(empty())}>
          <Plus className="mr-1 h-4 w-4" /> New rule
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active &amp; inactive rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules yet.</p>
          ) : (
            <div className="divide-y">
              {rules.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="capitalize">{r.scope}</Badge>
                      <span className="font-semibold">{formatRule(r)}</span>
                      {r.target_text && (
                        <Badge variant="secondary">{r.target_text}</Badge>
                      )}
                      {r.target_id && (
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {r.target_id.slice(0, 8)}…
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      From {new Date(r.active_from).toLocaleDateString()}
                      {r.active_to ? ` to ${new Date(r.active_to).toLocaleDateString()}` : " · ongoing"}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </p>
                  </div>
                  <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                  <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Edit</Button>
                  <Button size="icon" variant="ghost" onClick={() => del(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit rule" : "New rule"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Scope</Label>
                  <Select
                    value={editing.scope}
                    onValueChange={(v) => setEditing({ ...editing, scope: v as Rule["scope"] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global</SelectItem>
                      <SelectItem value="tutor">Specific tutor</SelectItem>
                      <SelectItem value="subject">Subject</SelectItem>
                      <SelectItem value="promo">Promotional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Method</Label>
                  <Select
                    value={editing.method}
                    onValueChange={(v) => setEditing({ ...editing, method: v as Rule["method"] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent</SelectItem>
                      <SelectItem value="fixed">Fixed amount</SelectItem>
                      <SelectItem value="hybrid">Hybrid (percent + fixed)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editing.scope === "tutor" && (
                <div>
                  <Label>Tutor user id</Label>
                  <Input
                    value={editing.target_id ?? ""}
                    onChange={(e) => setEditing({ ...editing, target_id: e.target.value })}
                    placeholder="uuid"
                  />
                </div>
              )}
              {editing.scope === "subject" && (
                <div>
                  <Label>Subject</Label>
                  <Input
                    value={editing.target_text ?? ""}
                    onChange={(e) => setEditing({ ...editing, target_text: e.target.value })}
                    placeholder="Math"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Percent</Label>
                  <Input
                    type="number"
                    value={editing.percent ?? 0}
                    onChange={(e) => setEditing({ ...editing, percent: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Fixed (cents)</Label>
                  <Input
                    type="number"
                    value={editing.fixed_cents ?? 0}
                    onChange={(e) => setEditing({ ...editing, fixed_cents: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Active from</Label>
                  <Input
                    type="datetime-local"
                    value={editing.active_from?.slice(0, 16) ?? ""}
                    onChange={(e) => setEditing({ ...editing, active_from: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Active to (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={editing.active_to?.slice(0, 16) ?? ""}
                    onChange={(e) => setEditing({ ...editing, active_to: e.target.value || null })}
                  />
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
