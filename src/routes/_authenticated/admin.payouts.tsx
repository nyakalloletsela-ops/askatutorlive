import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Wallet,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Play,
  RefreshCw,
  Download,
  Plus,
  Layers,
  Settings2,
  ShieldCheck,
  RotateCcw,
  Banknote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/access.functions";
import { PageContainer, StatCard, EmptyState } from "@/components/dashboard/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  beforeLoad: async () => {
    try {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) throw redirect({ to: "/dashboard" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminPayoutsPage,
});

/* ====================================================================== */
/*  HELPERS                                                                */
/* ====================================================================== */

function fmt(cents: number | null | undefined, currency = "USD") {
  const n = Number(cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function statusBadge(status: string) {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "secondary", label: "Pending" },
    processing: { variant: "secondary", label: "Processing" },
    succeeded: { variant: "default", label: "Succeeded" },
    completed: { variant: "default", label: "Completed" },
    paid: { variant: "default", label: "Paid" },
    failed: { variant: "destructive", label: "Failed" },
    refunded: { variant: "outline", label: "Refunded" },
    cancelled: { variant: "outline", label: "Cancelled" },
  };
  const cfg = map[status] ?? { variant: "outline" as const, label: status };
  return (
    <Badge variant={cfg.variant} className="text-[10px] uppercase tracking-wide">
      {cfg.label}
    </Badge>
  );
}

/* ====================================================================== */
/*  PAGE                                                                   */
/* ====================================================================== */

function AdminPayoutsPage() {
  const initial = typeof window !== "undefined" && window.location.hash
    ? window.location.hash.replace("#", "")
    : "overview";
  const [tab, setTab] = useState(initial);
  return (
    <PageContainer
      title="Payments & Payouts"
      description="Ledger-backed view of every cent — intakes, holds, commissions and weekly tutor payouts."
    >
      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className="flex w-full flex-wrap gap-1 sm:w-auto">
          <TabsTrigger value="overview"><TrendingUp className="mr-1.5 h-3.5 w-3.5" />Overview</TabsTrigger>
          <TabsTrigger value="intents"><Wallet className="mr-1.5 h-3.5 w-3.5" />Payment Intents</TabsTrigger>
          <TabsTrigger value="runs"><Banknote className="mr-1.5 h-3.5 w-3.5" />Payout Runs</TabsTrigger>
          <TabsTrigger value="providers"><Settings2 className="mr-1.5 h-3.5 w-3.5" />Providers</TabsTrigger>
          <TabsTrigger value="levels"><Layers className="mr-1.5 h-3.5 w-3.5" />Tutor Levels</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="intents"><IntentsTab /></TabsContent>
        <TabsContent value="runs"><PayoutRunsTab /></TabsContent>
        <TabsContent value="providers"><ProvidersTab /></TabsContent>
        <TabsContent value="levels"><TutorLevelsTab /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}

/* ====================================================================== */
/*  OVERVIEW                                                               */
/* ====================================================================== */

function OverviewTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["payments-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("payments_admin_overview");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as {
        total_volume_cents: number;
        total_revenue_cents: number;
        succeeded_count: number;
        pending_payout_cents: number;
        failed_transfers: number;
        refunded_cents: number;
      } | null;
    },
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Total volume" value={isLoading ? "…" : fmt(data?.total_volume_cents)} />
        <StatCard icon={TrendingUp} label="Platform revenue" value={isLoading ? "…" : fmt(data?.total_revenue_cents)} hint={`${data?.succeeded_count ?? 0} paid sessions`} />
        <StatCard icon={Clock} label="Pending payouts" value={isLoading ? "…" : fmt(data?.pending_payout_cents)} />
        <StatCard icon={AlertCircle} label="Failed transfers" value={isLoading ? "…" : data?.failed_transfers ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Ledger integrity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Every student payment writes a <span className="font-medium text-foreground">platform credit</span> and a <span className="font-medium text-foreground">tutor-earnings credit</span> to the immutable ledger.</p>
          <p>• Funds stay in a <span className="font-medium text-foreground">hold window</span> (default 72h) before becoming payable.</p>
          <p>• Refunds reverse the original credits and write a refunds credit — never delete history.</p>
          <p>• Payouts debit tutor earnings and credit the payout balance, linking back to the originating intents.</p>
          <p>• Commission resolution: <span className="font-mono text-xs">per-tutor → tutor level → subject → global</span>.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Record a manual payment</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Use this until live providers are wired. Writes intent + ledger credits in one step.
            </p>
          </div>
          <ManualIntentDialog />
        </CardHeader>
      </Card>

      {(data?.refunded_cents ?? 0) > 0 && (
        <p className="text-xs text-muted-foreground">
          Lifetime refunded: <span className="font-medium text-foreground">{fmt(data?.refunded_cents)}</span>
        </p>
      )}
    </div>
  );
}

/* ====================================================================== */
/*  PAYMENT INTENTS                                                        */
/* ====================================================================== */

type Intent = {
  id: string;
  student_id: string;
  tutor_id: string;
  session_id: string | null;
  provider: string;
  provider_ref: string | null;
  method: string | null;
  gross_cents: number;
  currency: string;
  commission_cents: number;
  tutor_net_cents: number;
  status: "pending" | "succeeded" | "failed" | "refunded";
  hold_until: string | null;
  succeeded_at: string | null;
  created_at: string;
};

function IntentsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"all" | Intent["status"]>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["payment-intents", status],
    queryFn: async () => {
      let q = supabase.from("payment_intents").select("*").order("created_at", { ascending: false }).limit(200);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Intent[];
    },
  });

  const refund = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc("admin_refund_intent", { _intent: id, _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Intent refunded");
      qc.invalidateQueries({ queryKey: ["payment-intents"] });
      qc.invalidateQueries({ queryKey: ["payments-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="succeeded">Succeeded</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
          <TabsTrigger value="refunded">Refunded</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState icon={Wallet} title="No payment intents yet" description="They will appear here as soon as student payments come in." />
          ) : (
            <div className="divide-y divide-border/60">
              {rows.map((r) => <IntentRow key={r.id} row={r} onRefund={(reason) => refund.mutate({ id: r.id, reason })} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function IntentRow({ row, onRefund }: { row: Intent; onRefund: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const canRefund = row.status === "succeeded";

  return (
    <div className="flex flex-col gap-3 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium tabular-nums">{fmt(row.gross_cents, row.currency)}</span>
          {statusBadge(row.status)}
          <Badge variant="outline" className="text-[10px] uppercase">{row.provider}</Badge>
          {row.method && <Badge variant="outline" className="text-[10px]">{row.method}</Badge>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Commission {fmt(row.commission_cents, row.currency)} · Tutor {fmt(row.tutor_net_cents, row.currency)} ·{" "}
          {new Date(row.created_at).toLocaleString()}
        </p>
        <p className="mt-0.5 break-all font-mono text-[10px] text-muted-foreground">
          intent {row.id.slice(0, 8)} · tutor {row.tutor_id.slice(0, 8)} · student {row.student_id.slice(0, 8)}
          {row.provider_ref && ` · ref ${row.provider_ref}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canRefund && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline"><RotateCcw className="mr-1 h-3.5 w-3.5" />Refund</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Refund this payment?</AlertDialogTitle>
                <AlertDialogDescription>
                  Reverses {fmt(row.gross_cents, row.currency)} from platform balance and {fmt(row.tutor_net_cents, row.currency)} from tutor earnings.
                  Cannot be undone. Refunds intents that have already been paid out must be handled offline.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-1">
                <Label className="text-xs">Reason (optional)</Label>
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => onRefund(reason)}
                >
                  Refund
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  PAYOUT RUNS                                                            */
/* ====================================================================== */

type PayoutRun = {
  id: string;
  period_start: string;
  period_end: string;
  status: "pending" | "processing" | "completed" | "failed";
  total_gross_cents: number;
  total_commission_cents: number;
  total_net_cents: number;
  created_at: string;
  completed_at: string | null;
};

type PayoutItem = {
  id: string;
  payout_run_id: string;
  tutor_id: string;
  gross_cents: number;
  commission_cents: number;
  net_cents: number;
  currency: string;
  provider: string | null;
  provider_transfer_ref: string | null;
  status: "pending" | "processing" | "paid" | "failed" | "cancelled";
  failure_reason: string | null;
  paid_at: string | null;
};

function PayoutRunsTab() {
  const qc = useQueryClient();
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["payout-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_runs")
        .select("*")
        .order("period_start", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as PayoutRun[];
    },
  });

  const createRun = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_create_payout_run", {});
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => {
      toast.success("Payout run opened");
      setOpenRunId(id);
      qc.invalidateQueries({ queryKey: ["payout-runs"] });
      qc.invalidateQueries({ queryKey: ["payments-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Each Monday a new run aggregates last week's settled payments. You can also open one manually.
        </p>
        <Button onClick={() => createRun.mutate()} disabled={createRun.isPending}>
          <Play className="mr-1.5 h-4 w-4" /> {createRun.isPending ? "Opening…" : "Open new run"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : runs.length === 0 ? (
            <EmptyState icon={Banknote} title="No payout runs yet" description="Open the first one with the button above." />
          ) : (
            <div className="divide-y divide-border/60">
              {runs.map((r) => (
                <div key={r.id} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {new Date(r.period_start).toLocaleDateString()} → {new Date(r.period_end).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Net {fmt(r.total_net_cents)} · Commission {fmt(r.total_commission_cents)} · Gross {fmt(r.total_gross_cents)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {statusBadge(r.status)}
                    <Button size="sm" variant="outline" onClick={() => setOpenRunId(r.id)}>
                      Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PayoutRunDialog runId={openRunId} onClose={() => setOpenRunId(null)} />
    </div>
  );
}

function PayoutRunDialog({ runId, onClose }: { runId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const open = !!runId;

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["payout-items", runId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_items")
        .select("*")
        .eq("payout_run_id", runId!)
        .order("net_cents", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PayoutItem[];
    },
  });

  const markPaid = useMutation({
    mutationFn: async ({ id, ref }: { id: string; ref: string }) => {
      const { error } = await supabase.rpc("admin_mark_payout_item_paid", {
        _item: id,
        _provider_ref: ref || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked paid");
      refetch();
      qc.invalidateQueries({ queryKey: ["payout-runs"] });
      qc.invalidateQueries({ queryKey: ["payments-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markFailed = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc("admin_mark_payout_item_failed", { _item: id, _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked failed");
      refetch();
      qc.invalidateQueries({ queryKey: ["payments-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = () => {
    if (!items.length) return;
    const header = "tutor_id,gross_cents,commission_cents,net_cents,currency,status,paid_at,provider_transfer_ref";
    const lines = items.map((i) =>
      [i.tutor_id, i.gross_cents, i.commission_cents, i.net_cents, i.currency, i.status, i.paid_at ?? "", i.provider_transfer_ref ?? ""].join(","),
    );
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payout-run-${runId?.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Payout run details</DialogTitle>
          <DialogDescription>Per-tutor breakdown. Mark each line paid once the transfer succeeds.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">{items.length} tutor{items.length === 1 ? "" : "s"}</Badge>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="mr-1.5 h-3.5 w-3.5" />Export CSV</Button>
        </div>
        <div className="max-h-[60vh] divide-y divide-border/60 overflow-y-auto rounded-md border">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No eligible payments in this period.</p>
          ) : (
            items.map((i) => <PayoutItemRow key={i.id} item={i} onPay={(ref) => markPaid.mutate({ id: i.id, ref })} onFail={(r) => markFailed.mutate({ id: i.id, reason: r })} />)
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PayoutItemRow({ item, onPay, onFail }: { item: PayoutItem; onPay: (ref: string) => void; onFail: (reason: string) => void }) {
  const [ref, setRef] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium tabular-nums">{fmt(item.net_cents, item.currency)}</p>
        <p className="text-xs text-muted-foreground">
          Gross {fmt(item.gross_cents, item.currency)} · Commission {fmt(item.commission_cents, item.currency)}
        </p>
        <p className="mt-0.5 break-all font-mono text-[10px] text-muted-foreground">
          tutor {item.tutor_id.slice(0, 8)}
          {item.provider_transfer_ref && ` · ref ${item.provider_transfer_ref}`}
        </p>
        {item.failure_reason && <p className="mt-1 text-xs italic text-destructive">{item.failure_reason}</p>}
      </div>
      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
        {statusBadge(item.status)}
        {item.status === "pending" || item.status === "processing" || item.status === "failed" ? (
          <>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="default"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Mark paid</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm payout sent</DialogTitle>
                  <DialogDescription>Add the bank / provider reference if you have one.</DialogDescription>
                </DialogHeader>
                <Input placeholder="Transfer reference (optional)" value={ref} onChange={(e) => setRef(e.target.value)} />
                <DialogFooter>
                  <Button onClick={() => onPay(ref)}>Confirm</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><XCircle className="mr-1 h-3.5 w-3.5" />Mark failed</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mark transfer failed</DialogTitle>
                  <DialogDescription>Will retry on the next payout run.</DialogDescription>
                </DialogHeader>
                <Textarea rows={2} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                <DialogFooter>
                  <Button variant="destructive" onClick={() => onFail(reason)}>Mark failed</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  PROVIDERS                                                              */
/* ====================================================================== */

type Provider = {
  id: string;
  slug: string;
  display_name: string;
  is_enabled: boolean;
  priority: number;
  mode: "sandbox" | "live";
  credentials_ref: string | null;
  supported_methods: string[];
  supported_currencies: string[];
  supported_countries: string[];
  supported_regions: unknown;
  success_count: number;
  failure_count: number;
  last_error: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
};

function ProvidersTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Provider | null>(null);
  const [adding, setAdding] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["payment-providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_providers")
        .select("*")
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Provider[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase.from("payment_providers").update({ is_enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Provider updated");
      qc.invalidateQueries({ queryKey: ["payment-providers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPriority = useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: number }) => {
      const { error } = await supabase.from("payment_providers").update({ priority }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-providers"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Payment providers</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Smart router picks the best provider per request (priority weighted by recent success rate).
              Add a provider here and paste API keys into project secrets using the credentials prefix.
            </p>
          </div>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add provider
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Settings2}
              title="No providers yet"
              description="Add one to start accepting payments."
            />
          ) : (
            <div className="divide-y divide-border/60">
              {rows.map((p) => {
                const total = p.success_count + p.failure_count;
                const rate = total > 0 ? Math.round((p.success_count / total) * 100) : null;
                const credsOk = !!p.credentials_ref;
                return (
                  <div key={p.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{p.display_name}</p>
                        <Badge variant="outline" className="text-[10px] uppercase">{p.slug}</Badge>
                        <Badge
                          variant={p.mode === "live" ? "default" : "secondary"}
                          className="text-[10px] uppercase"
                        >
                          {p.mode}
                        </Badge>
                        {!credsOk && (
                          <Badge variant="destructive" className="text-[10px]">
                            <AlertCircle className="mr-1 h-3 w-3" /> Keys missing
                          </Badge>
                        )}
                        {rate !== null && (
                          <Badge variant="outline" className="text-[10px]">
                            {rate}% success · {total} attempts
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(p.supported_methods?.join(", ") || "—")} ·{" "}
                        {(p.supported_currencies?.join(", ") || "—")}
                        {p.supported_countries?.length
                          ? ` · ${p.supported_countries.join(", ")}`
                          : ""}
                      </p>
                      {p.last_error && (
                        <p className="mt-1 truncate text-[11px] text-destructive/80">
                          Last error: {p.last_error}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        <Label className="text-xs text-muted-foreground">Priority</Label>
                        <Input
                          type="number"
                          defaultValue={p.priority}
                          className="h-8 w-20"
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isNaN(v) && v !== p.priority)
                              setPriority.mutate({ id: p.id, priority: v });
                          }}
                        />
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                        Edit
                      </Button>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={p.is_enabled}
                          onCheckedChange={(v) => toggle.mutate({ id: p.id, is_enabled: v })}
                        />
                        <span className="text-xs text-muted-foreground">
                          {p.is_enabled ? "Enabled" : "Off"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ProviderFormDialog
        open={adding}
        onOpenChange={setAdding}
        onSaved={() => qc.invalidateQueries({ queryKey: ["payment-providers"] })}
      />
      <ProviderFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        provider={editing ?? undefined}
        onSaved={() => {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["payment-providers"] });
        }}
      />
    </>
  );
}

function ProviderFormDialog({
  open,
  onOpenChange,
  provider,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  provider?: Provider;
  onSaved: () => void;
}) {
  const isEdit = !!provider;
  const [form, setForm] = useState(() => ({
    slug: provider?.slug ?? "",
    display_name: provider?.display_name ?? "",
    mode: provider?.mode ?? "sandbox",
    priority: provider?.priority ?? 100,
    credentials_ref: provider?.credentials_ref ?? "",
    supported_methods: (provider?.supported_methods ?? ["card"]).join(", "),
    supported_currencies: (provider?.supported_currencies ?? ["USD"]).join(", "),
    supported_countries: (provider?.supported_countries ?? ["*"]).join(", "),
    supported_regions: Array.isArray(provider?.supported_regions)
      ? (provider!.supported_regions as string[]).join(", ")
      : "GLOBAL",
  }));

  // Reset when reopening with new provider
  useMemo(() => {
    if (open) {
      setForm({
        slug: provider?.slug ?? "",
        display_name: provider?.display_name ?? "",
        mode: provider?.mode ?? "sandbox",
        priority: provider?.priority ?? 100,
        credentials_ref: provider?.credentials_ref ?? "",
        supported_methods: (provider?.supported_methods ?? ["card"]).join(", "),
        supported_currencies: (provider?.supported_currencies ?? ["USD"]).join(", "),
        supported_countries: (provider?.supported_countries ?? ["*"]).join(", "),
        supported_regions: Array.isArray(provider?.supported_regions)
          ? (provider!.supported_regions as string[]).join(", ")
          : "GLOBAL",
      });
    }
  }, [open, provider?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async () => {
      const split = (s: string) =>
        s.split(",").map((x) => x.trim()).filter(Boolean);
      const payload = {
        slug: form.slug.trim().toLowerCase(),
        display_name: form.display_name.trim(),
        mode: form.mode,
        priority: Number(form.priority) || 100,
        credentials_ref: form.credentials_ref.trim().toUpperCase() || null,
        supported_methods: split(form.supported_methods),
        supported_currencies: split(form.supported_currencies).map((x) => x.toUpperCase()),
        supported_countries: split(form.supported_countries).map((x) => x.toUpperCase()),
        supported_regions: split(form.supported_regions).map((x) => x.toUpperCase()),
      };
      if (!payload.slug || !payload.display_name) throw new Error("Slug and display name required");
      if (isEdit && provider) {
        const { error } = await supabase
          .from("payment_providers")
          .update(payload)
          .eq("id", provider.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_providers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Provider updated" : "Provider added");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${provider?.display_name}` : "Add payment provider"}</DialogTitle>
          <DialogDescription>
            The credentials prefix points to project secrets — never paste raw keys here.
            For prefix <code className="font-mono">PAYPAL</code> the router reads{" "}
            <code className="font-mono">PAYPAL_CLIENT_ID</code>,{" "}
            <code className="font-mono">PAYPAL_CLIENT_SECRET</code>, and{" "}
            <code className="font-mono">PAYPAL_WEBHOOK_ID</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Slug</Label>
              <Input
                value={form.slug}
                disabled={isEdit}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="paypal"
              />
            </div>
            <div>
              <Label className="text-xs">Display name</Label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="PayPal"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Mode</Label>
              <select
                value={form.mode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mode: e.target.value as "sandbox" | "live" }))
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="sandbox">Sandbox (test)</option>
                <option value="live">Live (production)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Priority (lower = first)</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Credentials prefix</Label>
            <Input
              value={form.credentials_ref}
              onChange={(e) => setForm((f) => ({ ...f, credentials_ref: e.target.value }))}
              placeholder="PAYPAL"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Add the actual secret values (<code>{form.credentials_ref || "PREFIX"}_CLIENT_ID</code>,
              etc.) via Backend → Secrets.
            </p>
          </div>
          <div>
            <Label className="text-xs">Supported methods (comma-separated)</Label>
            <Input
              value={form.supported_methods}
              onChange={(e) => setForm((f) => ({ ...f, supported_methods: e.target.value }))}
              placeholder="card, paypal_wallet, mobile_money"
            />
          </div>
          <div>
            <Label className="text-xs">Supported currencies</Label>
            <Input
              value={form.supported_currencies}
              onChange={(e) => setForm((f) => ({ ...f, supported_currencies: e.target.value }))}
              placeholder="USD, EUR, ZAR"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Countries (ISO, * = any)</Label>
              <Input
                value={form.supported_countries}
                onChange={(e) => setForm((f) => ({ ...f, supported_countries: e.target.value }))}
                placeholder="* or LS, ZA, KE"
              />
            </div>
            <div>
              <Label className="text-xs">Regions</Label>
              <Input
                value={form.supported_regions}
                onChange={(e) => setForm((f) => ({ ...f, supported_regions: e.target.value }))}
                placeholder="GLOBAL or AFRICA"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : isEdit ? "Save" : "Add provider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ====================================================================== */
/*  TUTOR LEVELS                                                           */
/* ====================================================================== */

type Level = {
  id: string;
  slug: string;
  display_name: string;
  commission_percent: number;
  min_completed_sessions: number;
  sort_order: number;
};

function TutorLevelsTab() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["tutor-levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_levels")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Level[];
    },
  });

  const save = useMutation({
    mutationFn: async (l: Level) => {
      const { error } = await supabase
        .from("tutor_levels")
        .update({
          commission_percent: l.commission_percent,
          min_completed_sessions: l.min_completed_sessions,
          display_name: l.display_name,
        })
        .eq("id", l.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Level saved");
      qc.invalidateQueries({ queryKey: ["tutor-levels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tutor levels & commission</CardTitle>
        <p className="text-xs text-muted-foreground">
          Each tutor inherits the commission % of their level. Per-tutor overrides take precedence (set in Admin → Commissions).
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((l) => <LevelRow key={l.id} level={l} onSave={save.mutate} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LevelRow({ level, onSave }: { level: Level; onSave: (l: Level) => void }) {
  const [pct, setPct] = useState(level.commission_percent);
  const [min, setMin] = useState(level.min_completed_sessions);
  const [name, setName] = useState(level.display_name);
  const dirty = pct !== level.commission_percent || min !== level.min_completed_sessions || name !== level.display_name;

  return (
    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <Label className="text-[11px] uppercase text-muted-foreground">Level</Label>
          <div className="flex items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
            <Badge variant="outline" className="text-[10px] uppercase">{level.slug}</Badge>
          </div>
        </div>
        <div>
          <Label className="text-[11px] uppercase text-muted-foreground">Commission %</Label>
          <Input type="number" step="0.5" value={pct} onChange={(e) => setPct(Number(e.target.value))} className="h-9" />
        </div>
        <div>
          <Label className="text-[11px] uppercase text-muted-foreground">Min sessions</Label>
          <Input type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} className="h-9" />
        </div>
        <div className="flex items-end">
          <Button
            size="sm"
            disabled={!dirty}
            onClick={() => onSave({ ...level, commission_percent: pct, min_completed_sessions: min, display_name: name })}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  MANUAL INTENT DIALOG                                                   */
/* ====================================================================== */

function ManualIntentDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [method, setMethod] = useState("manual");

  const create = useMutation({
    mutationFn: async () => {
      if (!studentId || !tutorId || !amount) throw new Error("Student, tutor and amount are required");
      const cents = Math.round(Number(amount) * 100);
      if (!Number.isFinite(cents) || cents <= 0) throw new Error("Invalid amount");
      const args: {
        _student: string;
        _tutor: string;
        _gross_cents: number;
        _currency?: string;
        _method?: string;
        _session?: string;
        _subject?: string;
      } = {
        _student: studentId,
        _tutor: tutorId,
        _gross_cents: cents,
        _currency: currency || "USD",
        _method: method || "manual",
      };
      if (sessionId) args._session = sessionId;
      const { error } = await supabase.rpc("admin_record_manual_intent", args);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recorded");
      setOpen(false);
      setStudentId(""); setTutorId(""); setSessionId(""); setAmount("");
      qc.invalidateQueries({ queryKey: ["payments-overview"] });
      qc.invalidateQueries({ queryKey: ["payment-intents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />Record payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a manual payment</DialogTitle>
          <DialogDescription>
            Writes a succeeded intent + ledger credits. Commission is computed from the tutor's level / rules.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Student ID</Label>
            <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="auth user UUID" />
          </div>
          <div>
            <Label>Tutor ID</Label>
            <Input value={tutorId} onChange={(e) => setTutorId(e.target.value)} placeholder="auth user UUID" />
          </div>
          <div>
            <Label>Session ID (optional)</Label>
            <Input value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Currency</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
            </div>
          </div>
          <div>
            <Label>Method label</Label>
            <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="manual, bank_transfer, mpesa…" />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Recording…" : "Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
