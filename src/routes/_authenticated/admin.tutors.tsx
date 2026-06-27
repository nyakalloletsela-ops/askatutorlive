import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { checkIsAdmin } from "@/lib/access.functions";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, SectionHeader } from "@/components/dashboard/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/tutors")({
  beforeLoad: async () => {
    try {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) throw redirect({ to: "/dashboard" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/dashboard" });
    }
  },
  component: TutorsAdmin,
});

type Application = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  submitted_at: string;
  subjects: string[];
};

function TutorsAdmin() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data: apps = [] } = useQuery({
    queryKey: ["admin-tutor-applications"],
    queryFn: async (): Promise<Application[]> => {
      const { data, error } = await supabase
        .from("tutor_applications")
        .select("id, full_name, email, status, submitted_at, subjects")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Application[];
    },
  });

  const decide = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    const fn = action === "approve" ? "approve_tutor_application" : "reject_tutor_application";
    const { error } = await supabase.rpc(fn, { _application_id: id });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(action === "approve" ? "Tutor approved" : "Application rejected");
    qc.invalidateQueries({ queryKey: ["admin-tutor-applications"] });
  };

  return (
    <PageContainer>
      <SectionHeader
        title="Tutor management"
        description="Approve or reject tutor applications inline. Approved tutors get the tutor role immediately."
      />
      <Card>
        <CardContent className="space-y-2 p-4">
          {apps.length === 0 && <p className="text-sm text-muted-foreground">No tutor applications yet.</p>}
          {apps.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-md border bg-card/40 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                {a.subjects?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {a.subjects.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <Badge
                variant={
                  a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "secondary"
                }
              >
                {a.status}
              </Badge>
              {a.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => decide(a.id, "approve")}
                    disabled={busyId === a.id}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => decide(a.id, "reject")}
                    disabled={busyId === a.id}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
