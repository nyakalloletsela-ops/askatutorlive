import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageContainer, SectionHeader, EmptyState } from "@/components/dashboard/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, Video, FileText, ExternalLink, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/records")({
  component: RecordsPage,
});

type Record = {
  id: string;
  room_id: string;
  title: string | null;
  meeting_recording_url: string | null;
  chat_transcript: string | null;
  ai_summary: string | null;
  created_at: string;
  files?: { id: string; filename: string; storage_path: string; file_type: string | null }[];
};

function RecordsPage() {
  const { user } = useAuth();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["session-records", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Record[]> => {
      const { data, error } = await supabase
        .from("session_records")
        .select("id, room_id, title, meeting_recording_url, chat_transcript, ai_summary, created_at, session_files(id, filename, storage_path, file_type)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      type Row = Omit<Record, "files"> & { session_files: Record["files"] };
      return ((data ?? []) as unknown as Row[]).map((r) => ({
        ...r,
        files: r.session_files ?? [],
      }));
    },
  });

  const openFile = async (path: string) => {
    const { data } = await supabase.storage.from("session-files").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <PageContainer>
      <SectionHeader
        title="Session records"
        description="Every live lesson has a persistent folder with recordings, files, transcripts, and AI summaries."
      />

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && records.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title="No session records yet"
          description="When a tutor saves a lesson, the folder will appear here."
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {records.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="truncate">{r.title || `Lesson · ${r.room_id.slice(-8)}`}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {r.meeting_recording_url && (
                <a
                  href={r.meeting_recording_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md border bg-card/40 p-2 text-sm hover:bg-accent/40"
                >
                  <Video className="h-4 w-4" /> Recording <ExternalLink className="ml-auto h-3.5 w-3.5" />
                </a>
              )}
              {r.ai_summary && (
                <div className="rounded-md border bg-card/40 p-2 text-sm">
                  <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Sparkles className="h-3 w-3" /> AI summary
                  </p>
                  <p className="whitespace-pre-wrap">{r.ai_summary}</p>
                </div>
              )}
              {r.files && r.files.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Files</p>
                  {r.files.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => openFile(f.storage_path)}
                      className="flex w-full items-center gap-2 rounded-md border bg-card/40 p-2 text-left text-sm hover:bg-accent/40"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="truncate">{f.filename}</span>
                      <ExternalLink className="ml-auto h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              )}
              <Button asChild size="sm" variant="outline">
                <a href={`/classroom/${r.room_id}`}>Open classroom</a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
