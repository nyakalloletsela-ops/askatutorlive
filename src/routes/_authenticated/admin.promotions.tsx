import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { checkIsAdmin } from "@/lib/access.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageContainer, SectionHeader } from "@/components/dashboard/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/promotions")({
  beforeLoad: async () => {
    try {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) throw redirect({ to: "/dashboard" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/dashboard" });
    }
  },
  component: PromotionsPage,
});

type Promo = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  amount: number;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  active: boolean;
  created_at: string;
};

function PromotionsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [amount, setAmount] = useState("10");
  const [expires, setExpires] = useState("");
  const [maxUses, setMaxUses] = useState("");

  const { data: promos = [] } = useQuery({
    queryKey: ["promotions"],
    queryFn: async (): Promise<Promo[]> => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Promo[];
    },
  });

  const create = async () => {
    if (!user || !code.trim()) return;
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      toast.error("Amount must be a positive number");
      return;
    }
    const { error } = await supabase.from("promotions").insert({
      code: code.trim().toUpperCase(),
      discount_type: type,
      amount: num,
      expires_at: expires ? new Date(expires).toISOString() : null,
      max_uses: maxUses ? Number(maxUses) : null,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Promotion created");
      setCode("");
      setAmount("10");
      setExpires("");
      setMaxUses("");
      qc.invalidateQueries({ queryKey: ["promotions"] });
    }
  };

  const toggle = async (p: Promo) => {
    const { error } = await supabase
      .from("promotions")
      .update({ active: !p.active })
      .eq("id", p.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["promotions"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this promotion?")) return;
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["promotions"] });
  };

  return (
    <PageContainer>
      <SectionHeader
        title="Promotions"
        description="Create discount codes for subscriptions and one-off purchases."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">New promotion</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label htmlFor="promo-code">Code</Label>
            <Input
              id="promo-code"
              placeholder="SUMMER25"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "percent" | "fixed")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percent</SelectItem>
                <SelectItem value="fixed">Fixed amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="promo-amount">{type === "percent" ? "Percent" : "Amount"}</Label>
            <Input
              id="promo-amount"
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="promo-expires">Expires</Label>
            <Input
              id="promo-expires"
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="promo-max">Max uses</Label>
            <Input
              id="promo-max"
              type="number"
              min="1"
              placeholder="unlimited"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <Button onClick={create}>Create promotion</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Active &amp; past codes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {promos.length === 0 && (
            <p className="text-sm text-muted-foreground">No promotions yet.</p>
          )}
          {promos.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-md border bg-card/40 p-3 text-sm"
            >
              <code className="font-semibold">{p.code}</code>
              <Badge variant={p.active ? "default" : "secondary"}>
                {p.active ? "Active" : "Disabled"}
              </Badge>
              <span className="text-muted-foreground">
                {p.discount_type === "percent" ? `${p.amount}% off` : `R${p.amount} off`}
              </span>
              <span className="text-muted-foreground">
                Used {p.uses}{p.max_uses ? ` / ${p.max_uses}` : ""}
              </span>
              {p.expires_at && (
                <span className="text-muted-foreground">
                  Expires {new Date(p.expires_at).toLocaleDateString()}
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => toggle(p)}>
                  {p.active ? "Disable" : "Enable"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
