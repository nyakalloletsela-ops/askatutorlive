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
import { Trash2, Plus, UserPlus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  beforeLoad: async () => {
    const { isAdmin } = await checkIsAdmin();
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: AdminPlans,
});

type Plan = {
  id: string;
  name: string;
  audience: "student" | "tutor";
  description: string | null;
  price_cents: number;
  currency: string;
  duration_unit: string;
  duration_count: number;
  features: any;
  feature_scope: string[] | null;
  is_active: boolean;
  sort_order: number;
};

const ALL_SCOPES = ["ai", "find_tutors", "labs"] as const;

const emptyPlan = (audience: "student" | "tutor"): Partial<Plan> => ({
  name: "",
  audience,
  description: "",
  price_cents: 0,
  currency: "USD",
  duration_unit: "month",
  duration_count: 1,
  features: [],
  feature_scope: [],
  is_active: true,
  sort_order: 0,
});

function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Partial<Plan> | null>(null);
  const [assignOpen, setAssignOpen] = useState<Plan | null>(null);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignExpires, setAssignExpires] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("audience")
      .order("sort_order");
    setPlans((data as Plan[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name) return toast.error("Name required");
    const featuresArr =
      typeof editing.features === "string"
        ? (editing.features as string).split("\n").map((s) => s.trim()).filter(Boolean)
        : editing.features ?? [];
    const payload: any = { ...editing, features: featuresArr };
    const { error } = editing.id
      ? await supabase.from("subscription_plans").update(payload).eq("id", editing.id)
      : await supabase.from("subscription_plans").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleActive = async (p: Plan) => {
    await supabase.from("subscription_plans").update({ is_active: !p.is_active }).eq("id", p.id);
    load();
  };

  const assign = async () => {
    if (!assignOpen || !assignEmail) return;
    // Look up user by email via profiles->auth (we use admin user list)
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name");
    // We don't have profiles.email; use the admin function to find by email
    const users = await (await import("@/lib/admin.functions")).adminListUsers();
    const u = (users as any[])?.find((x) => x.email?.toLowerCase() === assignEmail.trim().toLowerCase());
    if (!u) return toast.error("User not found");
    const { error } = await supabase.from("subscription_assignments").insert({
      user_id: u.id,
      plan_id: assignOpen.id,
      source: "admin",
      expires_at: assignExpires || null,
    } as any);
    if (error) return toast.error(error.message);
    toast.success(`Plan assigned to ${assignEmail}`);
    setAssignOpen(null);
    setAssignEmail("");
    setAssignExpires("");
  };

  const renderGroup = (audience: "student" | "tutor") => {
    const list = plans.filter((p) => p.audience === audience);
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="capitalize">{audience} plans</CardTitle>
          <Button size="sm" onClick={() => setEditing(emptyPlan(audience))}>
            <Plus className="mr-1 h-4 w-4" /> New plan
          </Button>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No plans yet.</p>
          ) : (
            <div className="divide-y">
              {list.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{p.name}</p>
                      <Badge variant={p.is_active ? "default" : "secondary"}>
                        {p.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(p.price_cents / 100).toLocaleString(undefined, { style: "currency", currency: p.currency })} ·{" "}
                      every {p.duration_count} {p.duration_unit}
                      {p.description ? ` · ${p.description}` : ""}
                    </p>
                  </div>
                  <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAssignOpen(p)}>
                    <UserPlus className="mr-1 h-3.5 w-3.5" /> Assign
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => del(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription plans</h1>
        <p className="text-sm text-muted-foreground">
          Create, edit and assign plans for students and tutors. Plans drive feature access and billing.
        </p>
      </div>

      {renderGroup("student")}
      <p className="text-xs text-muted-foreground">
        Tutors don't pay a fixed subscription — the platform earns a 5% commission on each lesson
        instead. Configure that in Admin → Commissions.
      </p>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit plan" : "New plan"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <Label>Audience</Label>
                  <Select
                    value={editing.audience}
                    onValueChange={(v) => setEditing({ ...editing, audience: v as "student" | "tutor" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="tutor">Tutor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Price (cents)</Label>
                  <Input
                    type="number"
                    value={editing.price_cents ?? 0}
                    onChange={(e) => setEditing({ ...editing, price_cents: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Input
                    value={editing.currency ?? "USD"}
                    onChange={(e) => setEditing({ ...editing, currency: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <Label>Sort</Label>
                  <Input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Duration unit</Label>
                  <Select
                    value={editing.duration_unit}
                    onValueChange={(v) => setEditing({ ...editing, duration_unit: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="quarter">Quarter</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Duration count</Label>
                  <Input
                    type="number"
                    value={editing.duration_count ?? 1}
                    onChange={(e) => setEditing({ ...editing, duration_count: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label>Features (one per line)</Label>
                <Textarea
                  value={Array.isArray(editing.features) ? editing.features.join("\n") : (editing.features ?? "")}
                  onChange={(e) => setEditing({ ...editing, features: e.target.value as any })}
                  placeholder="HD video&#10;Recording&#10;Whiteboard"
                />
              </div>
              <div>
                <Label>Unlocks (feature scopes)</Label>
                <div className="mt-1 flex flex-wrap gap-3 rounded-md border p-3">
                  {ALL_SCOPES.map((s) => {
                    const scopes = (editing.feature_scope as string[] | undefined) ?? [];
                    const checked = scopes.includes(s);
                    return (
                      <label key={s} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? Array.from(new Set([...scopes, s]))
                              : scopes.filter((x) => x !== s);
                            setEditing({ ...editing, feature_scope: next });
                          }}
                        />
                        {s}
                      </label>
                    );
                  })}
                </div>
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

      {/* Assign dialog */}
      <Dialog open={!!assignOpen} onOpenChange={(o) => !o && setAssignOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign "{assignOpen?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>User email</Label>
              <Input value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <Label>Expires (optional)</Label>
              <Input type="datetime-local" value={assignExpires} onChange={(e) => setAssignExpires(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(null)}>Cancel</Button>
            <Button onClick={assign}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
