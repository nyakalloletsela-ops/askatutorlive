import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileText, Video, Upload, Download, Trash2, FolderOpen } from "lucide-react";

interface Props {
  roomId: string;
}

type FileRow = { name: string; id?: string; updated_at?: string; metadata?: { size?: number } | null };

const BUCKET = "classroom-files";

export function ClassroomFiles({ roomId }: Props) {
  const [folder, setFolder] = useState<"notes" | "videos">("notes");
  const [files, setFiles] = useState<FileRow[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const prefix = `${roomId}/${folder}`;

  const load = async () => {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setFiles((data as FileRow[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, folder]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const path = `${prefix}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (error) toast.error(error.message);
    else {
      toast.success("Uploaded");
      load();
    }
  };

  const openFile = async (name: string) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(`${prefix}/${name}`, 60 * 60);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Could not open file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };


  const remove = async (name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    const { error } = await supabase.storage.from(BUCKET).remove([`${prefix}/${name}`]);
    if (error) toast.error(error.message);
    else load();
  };

  const accept = folder === "notes" ? ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" : "video/*";

  return (
    <div className="flex h-full flex-col">
      <Tabs value={folder} onValueChange={(v) => setFolder(v as "notes" | "videos")} className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b bg-muted/40 p-2">
          <TabsList>
            <TabsTrigger value="notes">
              <FileText className="mr-1 h-4 w-4" /> Notes
            </TabsTrigger>
            <TabsTrigger value="videos">
              <Video className="mr-1 h-4 w-4" /> Videos
            </TabsTrigger>
          </TabsList>
          <div className="ml-auto flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              onChange={onUpload}
              className="hidden"
              id="cf-upload"
            />
            <Button size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" /> {busy ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>

        <TabsContent value={folder} className="m-0 min-h-0 flex-1 overflow-auto p-3">
          {files.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <FolderOpen className="h-10 w-10" />
              <p className="text-sm">No {folder} yet. Upload one to share with the class.</p>
            </div>
          ) : (
            <ul className="divide-y rounded-md border">
              {files.map((f) => (
                <li key={f.name} className="flex items-center gap-3 p-3">
                  {folder === "videos" ? (
                    <Video className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name.replace(/^\d+-/, "")}</p>
                    {f.metadata?.size != null && (
                      <p className="text-xs text-muted-foreground">
                        {(f.metadata.size / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openFile(f.name)}>
                    <Download className="mr-1 h-4 w-4" /> Open
                  </Button>

                  <Button size="sm" variant="ghost" onClick={() => remove(f.name)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
