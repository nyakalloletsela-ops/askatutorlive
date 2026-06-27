import { SmartMarkdown } from "@/components/ai/SmartMarkdown";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { StickyNote, Plus, Trash2, FolderOpen } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/notes")({
  component: NotesPage,
});

type Note = {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  created_at: string;
};

// Friendly folder labels for the kind tag we save against AI artifacts.
function folderLabel(kind: string): string {
  if (kind === "note") return "My notes";
  if (kind === "ai-coach") return "AI Coach";
  if (kind === "whiteboard") return "Whiteboard";
  if (kind.startsWith("ai-tool:")) return `AI Toolkit · ${kind.slice("ai-tool:".length)}`;
  return kind;
}


function NotesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Note[];
    },
    enabled: !!user,
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!user || !title.trim()) throw new Error("Title required");
      const { error } = await supabase.from("notes").insert({
        user_id: user.id,
        title: title.trim(),
        body: body.trim() || null,
        kind: "note",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });

  return (
    <PageContainer title="Notes" description="Personal notes and bookmarks.">
      <Card>
        <CardContent className="space-y-2 p-4">
          <Input
            placeholder="Note title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Write something…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Add note
            </Button>
          </div>
        </CardContent>
      </Card>

      <FolderFilter notes={notes} />
    </PageContainer>
  );
}

function FolderFilter({ notes }: { notes: Note[] }) {
  const qc = useQueryClient();
  const [folder, setFolder] = useState<string>("all");

  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    notes.forEach((n) => counts.set(n.kind, (counts.get(n.kind) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [notes]);

  const visible = folder === "all" ? notes : notes.filter((n) => n.kind === folder);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (notes.length === 0) {
    return <EmptyState icon={StickyNote} title="No notes yet" description="Capture ideas, summaries, or save AI Coach answers and Toolkit outputs here." />;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <Button
          size="sm"
          variant={folder === "all" ? "default" : "outline"}
          onClick={() => setFolder("all")}
          className="h-7 rounded-full text-xs"
        >
          All <Badge variant="secondary" className="ml-1 text-[10px]">{notes.length}</Badge>
        </Button>
        {folders.map(([k, count]) => (
          <Button
            key={k}
            size="sm"
            variant={folder === k ? "default" : "outline"}
            onClick={() => setFolder(k)}
            className="h-7 rounded-full text-xs"
          >
            {folderLabel(k)} <Badge variant="secondary" className="ml-1 text-[10px]">{count}</Badge>
          </Button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((n) => (
          <Card key={n.id} className="group">
            <CardContent className="space-y-1 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold">{n.title}</h3>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  onClick={() => remove.mutate(n.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {n.body && <div className="text-xs text-muted-foreground"><SmartMarkdown>{n.body}</SmartMarkdown></div>}
              <div className="flex items-center justify-between pt-1">
                <Badge variant="outline" className="text-[10px]">{folderLabel(n.kind)}</Badge>
                <p className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
