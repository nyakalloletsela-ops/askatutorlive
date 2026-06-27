import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageContainer, StatCard, EmptyState } from "@/components/dashboard/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Clock, CheckCircle2, TrendingUp, Banknote, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

function fmt(cents: number | null | undefined, currency = "USD") {
  const n = Number(cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

type Balance = {
  earned_cents: number;
  paid_out_cents: number;
  pending_cents: number;
  payable_cents: number;
};

type Ledger = {
  id: string;
  entry_type: "credit" | "debit";
  amount_cents: number;
  currency: string;
  balance_type: string;
  description: string | null;
  created_at: string;
  payout_item_id: string | null;
  payment_intent_id: string | null;
};

type PayoutItem = {
  id: string;
  net_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  provider_transfer_ref: string | null;
};

type Method = {
  id: string;
  provider: string;
  type: string;
  display_label: string | null;
  is_default: boolean;
  is_verified: boolean;
};

function WalletPage() {
  const { user, isTutor } = useAuth();
  const uid = user?.id;

  const { data: balance } = useQuery({
    queryKey: ["tutor-balance", uid],
    enabled: !!uid && isTutor,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tutor_balance", { _tutor: uid! });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as Balance | null;
    },
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ["tutor-ledger", uid],
    enabled: !!uid && isTutor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("tutor_id", uid!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Ledger[];
    },
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["tutor-payouts", uid],
    enabled: !!uid && isTutor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_items")
        .select("*")
        .eq("tutor_id", uid!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as PayoutItem[];
    },
  });

  const { data: methods = [] } = useQuery({
    queryKey: ["tutor-methods", uid],
    enabled: !!uid && isTutor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("tutor_id", uid!)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Method[];
    },
  });

  const hasMethod = useMemo(() => methods.length > 0, [methods]);

  if (!isTutor) {
    return (
      <PageContainer title="Wallet" description="Tutor earnings & payouts.">
        <EmptyState
          icon={Wallet}
          title="Tutor-only area"
          description="Your wallet shows lifetime earnings, pending balance during the hold window, and weekly payouts. Apply to teach to unlock it."
          action={<Button asChild><Link to="/become-tutor">Become a tutor</Link></Button>}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Wallet"
      description="Your earnings, pending balance and weekly payouts. Updated in real time from the ledger."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Lifetime earned" value={fmt(balance?.earned_cents)} hint="Net of commission" />
        <StatCard icon={CheckCircle2} label="Available for payout" value={fmt(balance?.payable_cents)} hint="Past hold window" />
        <StatCard icon={Clock} label="Pending (on hold)" value={fmt(balance?.pending_cents)} hint="Funds clearing" />
        <StatCard icon={Banknote} label="Paid out" value={fmt(balance?.paid_out_cents)} hint="Lifetime" />
      </div>

      {!hasMethod && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex flex-col items-start gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium">Add a payout method to receive your Monday payouts.</p>
                <p className="text-xs text-muted-foreground">Bank account or mobile money — we'll send your earnings here every Monday.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" disabled title="Available once provider integration ships">
              Add method (soon)
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payout history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {payouts.length === 0 ? (
              <p className="px-4 pb-6 text-sm text-muted-foreground">No payouts yet. The next run is the upcoming Monday.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {payouts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium tabular-nums">{fmt(p.net_cents, p.currency)}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.paid_at ? new Date(p.paid_at).toLocaleString() : new Date(p.created_at).toLocaleString()}
                        {p.provider_transfer_ref && ` · ${p.provider_transfer_ref}`}
                      </p>
                    </div>
                    <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary"} className="text-[10px] uppercase">
                      {p.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent ledger activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {ledger.length === 0 ? (
              <p className="px-4 pb-6 text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {ledger.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className={e.entry_type === "credit" ? "font-medium text-green-600" : "font-medium text-red-600"}>
                          {e.entry_type === "credit" ? "+" : "−"}
                          {fmt(e.amount_cents, e.currency)}
                        </span>{" "}
                        <span className="text-muted-foreground">· {e.description ?? e.balance_type}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase">{e.balance_type}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
