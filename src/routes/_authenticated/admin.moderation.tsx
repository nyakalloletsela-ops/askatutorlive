import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/access.functions";
import { PageContainer, EmptyState } from "@/components/dashboard/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/moderation")({
  beforeLoad: async () => {
    try {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) throw redirect({ to: "/dashboard" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ModerationPage,
});

function ModerationPage() {
  const qc = useQueryClient();
  const { data: posts = [] } = useQuery({
    queryKey: ["admin-forum-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forum_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("forum_posts").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Post removed");
      qc.invalidateQueries({ queryKey: ["admin-forum-posts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageContainer title="Moderation" description="Review and remove user-generated content.">
      {posts.length === 0 ? (
        <EmptyState icon={Flag} title="Nothing to moderate" />
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  {p.title && <p className="text-sm font-semibold">{p.title}</p>}
                  <p className="line-clamp-3 text-xs text-muted-foreground">{p.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
