import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BookOpen, Video, FileText, Link as LinkIcon, Play } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCourseMaterialUrl } from "@/lib/course-materials.functions";

export const Route = createFileRoute("/_authenticated/my-courses")({
  component: MyCoursesPage,
});

type Material = {
  id: string;
  course_id: string;
  tutor_id: string;
  title: string;
  description: string | null;
  kind: string;
  storage_path: string | null;
  external_url: string | null;
  created_at: string;
};

function kindIcon(k: string) {
  if (k === "video") return Video;
  if (k === "link") return LinkIcon;
  return FileText;
}

function MyCoursesPage() {
  const { user } = useAuth();
  const getUrl = useServerFn(getCourseMaterialUrl);
  const [playing, setPlaying] = useState<{ title: string; url: string; kind: string } | null>(null);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["student-materials", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_materials")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Material[];
    },
    enabled: !!user,
  });

  const open = async (m: Material) => {
    try {
      const { url } = await getUrl({ data: { materialId: m.id } });
      if (!url) throw new Error("No URL available");
      if (m.kind === "video") {
        setPlaying({ title: m.title, url, kind: m.kind });
      } else {
        window.open(url, "_blank", "noopener");
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <PageContainer
      title="My Courses"
      description="Videos and materials shared with you by your tutors."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : materials.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No materials yet"
          description="When a tutor shares a video or file with you, it will appear here."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {materials.map((m) => {
            const Icon = kindIcon(m.kind);
            return (
              <Card key={m.id}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <p className="truncate text-sm font-semibold">{m.title}</p>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {m.kind}
                    </Badge>
                  </div>
                  {m.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{m.description}</p>
                  )}
                  <Button size="sm" className="w-full" onClick={() => open(m)}>
                    <Play className="mr-1 h-3 w-3" /> Open
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!playing} onOpenChange={(o) => !o && setPlaying(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{playing?.title}</DialogTitle>
          </DialogHeader>
          {playing && (
            <video
              src={playing.url}
              controls
              autoPlay
              className="aspect-video w-full rounded-md bg-black"
            />
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
