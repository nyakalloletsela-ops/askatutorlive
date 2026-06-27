import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wallet, CheckCircle2, Clock, XCircle, Plus, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/access.functions";
import { PageContainer, StatCard } from "@/components/dashboard/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  beforeLoad: async () => {
    try {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) throw redirect({ to: "/dashboard" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/dashboard" });
    }
  },
  component: PaymentsPage,
});

type Status = "pending" | "approved" | "rejected";
type Kind = "student" | "tutor";
type Row = {
  id: string;
  transaction_ref: string;
  payment_method: "mpesa" | "ecocash";
  amount: number;
  status: Status;
  submitted_at: string;
  notes: string | null;
  student_id?: string;
  tutor_id?: string;
  kind: Kind;
};

function tableFor(kind: Kind) {
  return kind === "student" ? "student_subscriptions" : "tutor_subscriptions";
}

function PaymentsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status | "all">("pending");
  const [filterKind, setFilterKind] = useState<"all" | Kind>("all");

  const { data } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const [students, tutors] = await Promise.all([
        supabase.from("student_subscriptions").select("*").order("submitted_at", { ascending: false }).limit(200),
        supabase.from("tutor_subscriptions").select("*").order("submitted_at", { ascending: false }).limit(200),
      ]);
      const sRows = ((students.data ?? []) as Record<string, unknown>[]).map(
        (s) => ({ ...s, kind: "student" }) as unknown as Row,
      );
      const tRows = ((tutors.data ?? []) as Record<string, unknown>[]).map(
        (s) => ({ ...s, kind: "tutor" }) as unknown as Row,
      );
      const all: Row[] = [...sRows, ...tRows].sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
      );
      const totalApproved = all.filter((x) => x.status === "approved").reduce((s, x) => s + Number(x.amount), 0);
      return {
        all,
        totalApproved,
        approved: all.filter((x) => x.status === "approved").length,
        pending: all.filter((x) => x.status === "pending").length,
        rejected: all.filter((x) => x.status === "rejected").length,
      };
    },
  });

  const rows = useMemo(() => {
    let r = data?.all ?? [];
    if (tab !== "all") r = r.filter((x) => x.status === tab);
    if (filterKind !== "all") r = r.filter((x) => x.kind === filterKind);
    return r;
  }, [data, tab, filterKind]);

  const setStatus = useMutation({
    mutationFn: async ({ row, status }: { row: Row; status: Status }) => {
      const { error } = await supabase
        .from(tableFor(row.kind))
        .update({ status, approved_at: status === "approved" ? new Date().toISOString() : null })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (row: Row) => {
      const { error } = await supabase.from(tableFor(row.kind)).delete().eq("id", row.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageContainer
      title="Payments & Subscriptions"
      description="Full control over student and tutor subscriptions."
      actions={<GrantDialog />}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Total approved" value={`M ${data?.totalApproved ?? 0}`} />
        <StatCard icon={CheckCircle2} label="Approved" value={data?.approved ?? 0} />
        <StatCard icon={Clock} label="Pending" value={data?.pending ?? 0} />
        <StatCard icon={XCircle} label="Rejected" value={data?.rejected ?? 0} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Status | "all")}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} />
        </Tabs>

        <Select value={filterKind} onValueChange={(v) => setFilterKind(v as "all" | Kind)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            <SelectItem value="student">Students</SelectItem>
            <SelectItem value="tutor">Tutors</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {rows.map((row) => (
              <div key={`${row.kind}-${row.id}`} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.transaction_ref}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.kind} · {row.payment_method} · {new Date(row.submitted_at).toLocaleDateString()}
                  </p>
                  {row.notes && <p className="mt-1 text-xs italic text-muted-foreground">“{row.notes}”</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums font-medium">M {row.amount}</span>
                  <Badge
                    variant={row.status === "approved" ? "default" : row.status === "pending" ? "secondary" : "destructive"}
                    className="text-[10px]"
                  >
                    {row.status}
                  </Badge>
                  {row.status !== "approved" && (
                    <Button size="sm" variant="default" onClick={() => setStatus.mutate({ row, status: "approved" })}>
                      Approve
                    </Button>
                  )}
                  {row.status !== "rejected" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ row, status: "rejected" })}>
                      Reject
                    </Button>
                  )}
                  {row.status !== "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ row, status: "pending" })}>
                      Revoke
                    </Button>
                  )}
                  <EditDialog row={row} />
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(row)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">No transactions match.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function EditDialog({ row }: { row: Row }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(row.amount));
  const [notes, setNotes] = useState(row.notes ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from(tableFor(row.kind))
        .update({ amount: Number(amount), notes: notes || null })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit subscription</DialogTitle>
          <DialogDescription>Adjust amount or add an internal note.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Amount (M)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GrantDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("student");
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("0");
  const [notes, setNotes] = useState("Manual grant");

  const grant = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User ID required");
      const ref = `ADMIN-${Date.now()}`;
      const base = {
        transaction_ref: ref,
        payment_method: "mpesa" as const,
        amount: Number(amount),
        status: "approved" as const,
        notes: notes || null,
        approved_at: new Date().toISOString(),
      };
      const { error } =
        kind === "student"
          ? await supabase.from("student_subscriptions").insert({ ...base, student_id: userId })
          : await supabase.from("tutor_subscriptions").insert({ ...base, tutor_id: userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Subscription granted");
      setOpen(false);
      setUserId("");
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Grant subscription
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant subscription</DialogTitle>
          <DialogDescription>Manually approve a subscription for a student or tutor (no transaction needed).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>For</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="tutor">Tutor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>User ID</Label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="auth user UUID" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Copy from Admin → {kind === "student" ? "Students" : "Tutors"}.
            </p>
          </div>
          <div>
            <Label>Amount (M)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={grant.isPending} onClick={() => grant.mutate()}>
            {grant.isPending ? "Granting…" : "Grant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
