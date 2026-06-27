import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/access.functions";
import { PageContainer, EmptyState } from "@/components/dashboard/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  beforeLoad: async () => {
    try {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) throw redirect({ to: "/dashboard" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ReportsPage,
});

function ReportsPage() {
  const { data: tickets = [] } = useQuery({
    queryKey: ["admin-help"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("help_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  return (
    <PageContainer title="Reports" description="Help tickets and user reports.">
      {tickets.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No reports" />
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{t.subject}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {t.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <Mail className="mr-1 inline h-3 w-3" />
                      {t.name} · {t.email}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-xs">{t.body}</p>
                  </div>
                  <p className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
