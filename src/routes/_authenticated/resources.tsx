import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderOpen, Plus, Trash2, Link as LinkIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/resources")({
  component: ResourcesPage,
});

type Resource = {
  id: string;
  tutor_id: string;
  title: string;
  kind: string;
  storage_path: string | null;
  subject: string | null;
  visibility: string;
  created_at: string;
};

function ResourcesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: resources = [] } = useQuery({
    queryKey: ["resources", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_resources")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Resource[];
    },
    enabled: !!user,
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutor_resources").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources"] }),
  });

  return (
    <PageContainer
      title="Resources"
      description="Reference materials and links shared by tutors."
      actions={<NewResourceDialog />}
    >
      {resources.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No resources yet" description="Tutors can share files and links here." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {resources.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{r.title}</h3>
                    <Badge variant="outline" className="text-[10px]">
                      {r.kind}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {r.visibility}
                    </Badge>
                  </div>
                  {r.subject && <p className="text-xs text-muted-foreground">{r.subject}</p>}
                  {r.storage_path && (
                    <a
                      href={r.storage_path}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <LinkIcon className="h-3 w-3" /> Open
                    </a>
                  )}
                </div>
                {r.tutor_id === user?.id && (
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function NewResourceDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("link");
  const [url, setUrl] = useState("");
  const [subject, setSubject] = useState("");
  const [visibility, setVisibility] = useState("private");

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !title) throw new Error("Title required");
      const { error } = await supabase.from("tutor_resources").insert({
        tutor_id: user.id,
        title,
        kind,
        storage_path: url || null,
        subject: subject || null,
        visibility,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Resource added");
      setOpen(false);
      setTitle("");
      setUrl("");
      setSubject("");
      qc.invalidateQueries({ queryKey: ["resources"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> New resource
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add resource</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="link">Link</SelectItem>
                <SelectItem value="file">File</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="note">Note</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
