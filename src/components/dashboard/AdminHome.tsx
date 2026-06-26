import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  GraduationCap,
  Calendar,
  Wallet,
  ShieldCheck,
  Star,
  Activity,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  History,
} from "lucide-react";

type AppRow = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  subjects: string[];
  bio: string;
  status: "pending" | "approved" | "rejected" | "needs_info";
  submitted_at: string;
};

type TutorProfile = {
  id: string;
  full_name: string | null;
  is_featured: boolean;
  subjects: string[] | null;
  avg_rating?: number;
  session_count?: number;
};

type SessionLite = {
  id: string;
  status: string;
  scheduled_at: string;
  duration_min: number;
};

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  accent = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  accent?: "primary" | "green" | "amber" | "blue";
}) {
  const tone = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-600",
    amber: "bg-amber-500/10 text-amber-600",
    blue: "bg-blue-500/10 text-blue-600",
  }[accent];
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type AuditRow = {
  id: string;
  actor_id: string;
  action: "approve" | "reject";
  application_ids: string[];
  tutor_ids: string[];
  is_bulk: boolean;
  notes: string | null;
  created_at: string;
};

export function AdminHome({ firstName }: { firstName: string }) {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [tutors, setTutors] = useState<TutorProfile[]>([]);
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [counts, setCounts] = useState({ students: 0, tutors: 0, sessions: 0 });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});

  const load = async () => {
    const [{ data: a }, { data: t }, { data: s }, students, tutorRoles, allSessions, { data: al }] = await Promise.all([
      supabase
        .from("tutor_applications")
        .select("id,user_id,full_name,email,subjects,bio,status,submitted_at")
        .order("submitted_at", { ascending: false })
        .limit(20),
      supabase.rpc("list_public_tutors"),
      supabase
        .from("sessions")
        .select("id,status,scheduled_at,duration_min")
        .gte("scheduled_at", new Date(Date.now() - 30 * 86400000).toISOString())
        .order("scheduled_at", { ascending: false })
        .limit(500),
      supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "student"),
      supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "tutor"),
      supabase.from("sessions").select("id", { count: "exact", head: true }),
      supabase
        .from("admin_audit_log")
        .select("id,actor_id,action,application_ids,tutor_ids,is_bulk,notes,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setApps((a as AppRow[]) ?? []);
    setTutors(((t as TutorProfile[]) ?? []).slice(0, 30));
    setSessions((s as SessionLite[]) ?? []);
    setCounts({
      students: students.count ?? 0,
      tutors: tutorRoles.count ?? 0,
      sessions: allSessions.count ?? 0,
    });
    const auditRows = (al as AuditRow[]) ?? [];
    setAudit(auditRows);
    const actorIds = Array.from(new Set(auditRows.map((r) => r.actor_id).filter(Boolean)));
    if (actorIds.length) {
      const { data: pr } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      const map: Record<string, string> = {};
      (pr ?? []).forEach((p: { id: string; full_name: string | null }) => {
        map[p.id] = p.full_name ?? "Admin";
      });
      setActorNames(map);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-home")
      .on("postgres_changes", { event: "*", schema: "public", table: "tutor_applications" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_audit_log" }, load)
      .subscribe();
    const t = setInterval(load, 30000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(t);
    };
  }, []);

  const pending = useMemo(
    () => apps.filter((r) => r.status === "pending" || r.status === "needs_info"),
    [apps],
  );

  const live = sessions.filter((s) => s.status === "live").length;
  const upcoming = sessions.filter(
    (s) => s.status === "scheduled" && new Date(s.scheduled_at).getTime() > Date.now(),
  ).length;
  const completed30d = sessions.filter((s) => s.status === "completed").length;
  const minutes30d = sessions
    .filter((s) => s.status === "completed")
    .reduce((acc, s) => acc + (s.duration_min || 0), 0);
  const featuredCount = tutors.filter((t) => t.is_featured).length;

  const decide = async (row: AppRow, approve: boolean) => {
    setBusy(row.id);
    const fn = approve ? "approve_tutor_application" : "reject_tutor_application";
    const { error } = await supabase.rpc(fn, {
      _application_id: row.id,
      _notes: notes[row.id] ?? null,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    await supabase.rpc("log_tutor_decision", {
      _action: approve ? "approve" : "reject",
      _application_ids: [row.id],
      _notes: notes[row.id] || undefined,
    });
    toast.success(approve ? "Approved — tutor role granted" : "Rejected");
    load();
  };

  // Bulk selection / confirmation
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | "approve" | "reject">(null);
  const toggleSel = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const selectAllVisible = (rows: AppRow[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      rows.forEach((r) => (on ? next.add(r.id) : next.delete(r.id)));
      return next;
    });
  };
  const runBulk = async () => {
    if (!confirm) return;
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setConfirm(null);
      return;
    }
    const fn = confirm === "approve" ? "approve_tutor_application" : "reject_tutor_application";
    setBusy("bulk");
    const results = await Promise.allSettled(
      ids.map((id) => supabase.rpc(fn, { _application_id: id, _notes: notes[id] ?? null })),
    );
    setBusy(null);
    setConfirm(null);
    setSelected(new Set());
    const succeededIds = ids.filter((_, i) => {
      const r = results[i];
      return r.status === "fulfilled" && !r.value.error;
    });
    const failed = ids.length - succeededIds.length;
    if (succeededIds.length > 0) {
      await supabase.rpc("log_tutor_decision", {
        _action: confirm,
        _application_ids: succeededIds,
        _notes: undefined,
      });
    }
    if (failed > 0) toast.error(`${failed} of ${ids.length} failed`);
    else toast.success(`${ids.length} application(s) ${confirm === "approve" ? "approved" : "rejected"}`);
    load();
  };



  const toggleFeatured = async (p: TutorProfile, v: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({
        is_featured: v,
        featured_until: v ? new Date(Date.now() + 30 * 86400000).toISOString() : null,
      })
      .eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success(v ? "Now featured for 30 days" : "Removed from featured");
      load();
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin control
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              {firstName ? `Welcome, ${firstName}` : "Welcome"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Real-time view of the marketplace, verification queue and featured placement.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">Full admin panel <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/admin/analytics">Analytics</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stat strip */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Students" value={counts.students} hint="registered" accent="blue" />
        <Stat icon={GraduationCap} label="Tutors" value={counts.tutors} hint={`${featuredCount} featured`} accent="primary" />
        <Stat icon={Calendar} label="Sessions" value={counts.sessions} hint="all-time" accent="amber" />
        <Stat
          icon={Wallet}
          label="Minutes (30d)"
          value={minutes30d.toLocaleString()}
          hint={`${completed30d} completed`}
          accent="green"
        />
      </section>

      {/* Activity strip */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Activity} label="Live now" value={live} accent="green" />
        <Stat icon={Clock} label="Upcoming" value={upcoming} hint="next 30 days" accent="blue" />
        <Stat icon={CheckCircle2} label="Pending review" value={pending.length} hint="tutor applications" accent="amber" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Verification queue */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Tutor verification queue</CardTitle>
            <Badge variant="secondary">{pending.length} pending</Badge>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Sparkles className="mb-2 h-8 w-8 text-muted-foreground/60" />
                <p className="text-sm font-medium">All caught up</p>
                <p className="mt-1 text-xs text-muted-foreground">No applications waiting for review.</p>
              </div>
            ) : (
              <>
                {(() => {
                  const visible = pending.slice(0, 6);
                  const allChecked = visible.length > 0 && visible.every((r) => selected.has(r.id));
                  return (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                      <label className="flex items-center gap-2 text-xs font-medium">
                        <Checkbox
                          checked={allChecked}
                          onCheckedChange={(v) => selectAllVisible(visible, !!v)}
                          aria-label="Select all visible"
                        />
                        {selected.size > 0 ? `${selected.size} selected` : "Select all"}
                      </label>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={selected.size === 0 || busy === "bulk"}
                          onClick={() => setConfirm("reject")}
                        >
                          Reject selected
                        </Button>
                        <Button
                          size="sm"
                          disabled={selected.size === 0 || busy === "bulk"}
                          onClick={() => setConfirm("approve")}
                        >
                          Approve selected
                        </Button>
                      </div>
                    </div>
                  );
                })()}
                <ul className="divide-y divide-border/60">
                  {pending.slice(0, 6).map((r) => (
                    <li key={r.id} className="py-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          className="mt-1"
                          checked={selected.has(r.id)}
                          onCheckedChange={(v) => toggleSel(r.id, !!v)}
                          aria-label={`Select ${r.full_name}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">
                            {r.full_name}
                            <Badge variant="secondary" className="ml-2 text-[10px]">{r.status}</Badge>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.email} · {new Date(r.submitted_at).toLocaleDateString()}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(r.subjects ?? []).slice(0, 5).map((s) => (
                              <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                            ))}
                          </div>
                          {r.bio && (
                            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{r.bio}</p>
                          )}
                          <div className="mt-2 space-y-2">
                            <Textarea
                              rows={1}
                              placeholder="Optional note to applicant"
                              value={notes[r.id] ?? ""}
                              onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                              className="text-xs"
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === r.id || busy === "bulk"}
                                onClick={() => decide(r, false)}
                              >
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                disabled={busy === r.id || busy === "bulk"}
                                onClick={() => decide(r, true)}
                              >
                                Approve
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {pending.length > 6 && (
              <div className="mt-3 text-right">
                <Button asChild size="sm" variant="ghost">
                  <Link to="/admin">View all {pending.length} <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirm === "approve" ? "Approve" : "Reject"} {selected.size} application{selected.size === 1 ? "" : "s"}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirm === "approve"
                  ? "Each selected applicant will be granted the tutor role and notified."
                  : "Each selected applicant will be marked as rejected. Any notes you've added will be sent with the decision."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy === "bulk"}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy === "bulk"}
                onClick={(e) => { e.preventDefault(); runBulk(); }}
                className={confirm === "reject" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
              >
                {busy === "bulk" ? "Working…" : confirm === "approve" ? "Approve all" : "Reject all"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


        {/* Featured placement */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Featured placement</CardTitle>
            <Badge variant="secondary">
              <Star className="mr-1 h-3 w-3" /> {featuredCount}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="max-h-[480px] divide-y divide-border/60 overflow-y-auto">
              {tutors.length === 0 ? (
                <li className="p-4 text-sm text-muted-foreground">No tutors yet.</li>
              ) : (
                tutors.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.full_name ?? "Unnamed"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {(t.subjects ?? []).slice(0, 2).join(", ") || "No subjects"}
                        {typeof t.session_count === "number" && ` · ${t.session_count} sessions`}
                      </p>
                    </div>
                    <Switch
                      checked={t.is_featured}
                      onCheckedChange={(v) => toggleFeatured(t, v)}
                    />
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Audit log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Decision audit log
          </CardTitle>
          <Badge variant="secondary">{audit.length} recent</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {audit.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No approve/reject actions yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {audit.map((row) => (
                <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                      row.action === "approve"
                        ? "bg-green-500/10 text-green-600"
                        : "bg-red-500/10 text-red-600"
                    }`}
                  >
                    {row.action === "approve" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">
                        {actorNames[row.actor_id] ?? "Admin"}
                      </span>{" "}
                      {row.action === "approve" ? "approved" : "rejected"}{" "}
                      <span className="font-semibold">{row.application_ids.length}</span>{" "}
                      application{row.application_ids.length === 1 ? "" : "s"}
                      {row.is_bulk && (
                        <Badge variant="outline" className="ml-2 text-[10px]">bulk</Badge>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </p>
                    {row.tutor_ids.length > 0 && (
                      <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                        tutor ids: {row.tutor_ids.slice(0, 4).join(", ")}
                        {row.tutor_ids.length > 4 && ` +${row.tutor_ids.length - 4} more`}
                      </p>
                    )}
                    {row.notes && (
                      <p className="mt-1 text-xs italic text-muted-foreground">"{row.notes}"</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
