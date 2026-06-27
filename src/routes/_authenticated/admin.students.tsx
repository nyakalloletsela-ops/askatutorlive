import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { checkIsAdmin } from "@/lib/access.functions";
import { adminListUsers, adminDeleteUser } from "@/lib/admin.functions";
import { PageContainer, SectionHeader } from "@/components/dashboard/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/students")({
  beforeLoad: async () => {
    try {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) throw redirect({ to: "/dashboard" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/dashboard" });
    }
  },
  component: StudentsAdmin,
});

function StudentsAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => adminListUsers(),
  });
  const users = (data ?? []) as Array<{
    id: string;
    email: string;
    full_name?: string | null;
    roles?: string[];
  }>;
  const students = users.filter((u) => (u.roles ?? []).includes("student"));

  const remove = async (id: string) => {
    if (!confirm("Suspend (delete) this account? This cannot be undone.")) return;
    try {
      await adminDeleteUser({ data: { userId: id } });
      toast.success("Account removed");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <PageContainer>
      <SectionHeader
        title="Student management"
        description="Suspend accounts and review activity."
      />
      <Card>
        <CardContent className="space-y-2 p-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && students.length === 0 && (
            <p className="text-sm text-muted-foreground">No students found.</p>
          )}
          {students.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-md border bg-card/40 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.full_name || "Unnamed"}</p>
                <p className="truncate text-xs text-muted-foreground">{s.email}</p>
              </div>
              <Badge variant="secondary">student</Badge>
              <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
