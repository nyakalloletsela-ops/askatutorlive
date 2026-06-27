import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  Trash2,
  Upload,
  Users,
  Video,
  FileText,
  Link as LinkIcon,
  Play,
  Check,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCourseMaterialUrl } from "@/lib/course-materials.functions";

export const Route = createFileRoute("/_authenticated/courses")({
  component: CoursesPage,
});

type Course = { id: string; name: string; level: string; status: string };
type Material = {
  id: string;
  course_id: string;
  tutor_id: string;
  title: string;
  description: string | null;
  kind: string;
  storage_path: string | null;
  external_url: string | null;
  duration_sec: number | null;
  created_at: string;
};
type Access = { material_id: string; student_id: string };
type Student = { id: string; full_name: string };

function kindIcon(kind: string) {
  if (kind === "video") return Video;
  if (kind === "link") return LinkIcon;
  return FileText;
}

function CoursesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: courses = [] } = useQuery({
    queryKey: ["my-courses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_courses")
        .select("id, name, level, status")
        .eq("tutor_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Course[];
    },
    enabled: !!user,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["my-materials", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_materials")
        .select("*")
        .eq("tutor_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Material[];
    },
    enabled: !!user,
  });

  const { data: accessRows = [] } = useQuery({
    queryKey: ["my-material-access", user?.id],
    queryFn: async () => {
      if (materials.length === 0) return [] as Access[];
      const ids = materials.map((m) => m.id);
      const { data, error } = await supabase
        .from("course_material_access")
        .select("material_id, student_id")
        .in("material_id", ids);
      if (error) throw new Error(error.message);
      return (data ?? []) as Access[];
    },
    enabled: !!user && materials.length > 0,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["my-students", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_students_for_tutor");
      if (error) throw new Error(error.message);
      return (data ?? []) as Student[];
    },
    enabled: !!user,
  });

  const del = useMutation({
    mutationFn: async (m: Material) => {
      if (m.storage_path) {
        await supabase.storage.from("course-materials").remove([m.storage_path]);
      }
      const { error } = await supabase.from("course_materials").delete().eq("id", m.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Material removed");
      qc.invalidateQueries({ queryKey: ["my-materials"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const byCourse = new Map<string, Material[]>();
    for (const m of materials) {
      const arr = byCourse.get(m.course_id) ?? [];
      arr.push(m);
      byCourse.set(m.course_id, arr);
    }
    return byCourse;
  }, [materials]);

  return (
    <PageContainer
      title="My Courses"
      description="Upload videos and materials. Choose which students can view each item."
      actions={courses.length > 0 ? <NewMaterialDialog courses={courses} /> : null}
    >
      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="Add a course from your dashboard first, then upload materials here."
        />
      ) : (
        <div className="space-y-6">
          {courses.map((c) => (
            <div key={c.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">{c.name}</h2>
                <Badge variant="outline" className="text-[10px]">{c.level}</Badge>
                <Badge
                  variant={c.status === "approved" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {c.status}
                </Badge>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {(grouped.get(c.id) ?? []).map((m) => (
                  <MaterialCard
                    key={m.id}
                    material={m}
                    students={students}
                    accessFor={accessRows.filter((a) => a.material_id === m.id).map((a) => a.student_id)}
                    onDelete={() => del.mutate(m)}
                  />
                ))}
                {(grouped.get(c.id) ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">No materials uploaded yet.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function MaterialCard({
  material,
  students,
  accessFor,
  onDelete,
}: {
  material: Material;
  students: Student[];
  accessFor: string[];
  onDelete: () => void;
}) {
  const Icon = kindIcon(material.kind);
  const sharedCount = accessFor.length;
  const getUrl = useServerFn(getCourseMaterialUrl);
  const [previewing, setPreviewing] = useState(false);

  const preview = async () => {
    try {
      setPreviewing(true);
      const { url } = await getUrl({ data: { materialId: material.id } });
      if (!url) throw new Error("No URL available");
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <p className="truncate text-sm font-medium">{material.title}</p>
            </div>
            {material.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{material.description}</p>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">
              Shared with {sharedCount} {sharedCount === 1 ? "student" : "students"}
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={preview} disabled={previewing}>
            <Play className="mr-1 h-3 w-3" /> Preview
          </Button>
          <ManageAccessDialog material={material} students={students} accessFor={accessFor} />
        </div>
      </CardContent>
    </Card>
  );
}

function ManageAccessDialog({
  material,
  students,
  accessFor,
}: {
  material: Material;
  students: Student[];
  accessFor: string[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(accessFor));

  const save = useMutation({
    mutationFn: async () => {
      const want = selected;
      const have = new Set(accessFor);
      const toAdd = [...want].filter((id) => !have.has(id));
      const toRemove = [...have].filter((id) => !want.has(id));
      if (toAdd.length) {
        const { error } = await supabase.from("course_material_access").insert(
          toAdd.map((student_id) => ({ material_id: material.id, student_id })),
        );
        if (error) throw new Error(error.message);
      }
      if (toRemove.length) {
        const { error } = await supabase
          .from("course_material_access")
          .delete()
          .eq("material_id", material.id)
          .in("student_id", toRemove);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Access updated");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["my-material-access"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setSelected(new Set(accessFor));
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Users className="mr-1 h-3 w-3" /> Access
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Who can view this?</DialogTitle>
          <DialogDescription>
            Only the students you tick will be able to open “{material.title}”.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {students.length === 0 && (
            <p className="text-sm text-muted-foreground">
              You don’t have any students yet. They’ll appear here after their first session with you.
            </p>
          )}
          {students.map((s) => {
            const checked = selected.has(s.id);
            return (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    const next = new Set(selected);
                    if (v) next.add(s.id);
                    else next.delete(s.id);
                    setSelected(next);
                  }}
                />
                <span className="flex-1 truncate">{s.full_name}</span>
                {checked && <Check className="h-3 w-3 text-primary" />}
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewMaterialDialog({ courses }: { courses: Course[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("video");
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setFile(null);
    setExternalUrl("");
    setKind("video");
  };

  const submit = async () => {
    if (!user) return;
    if (!title.trim()) return toast.error("Title is required");
    if (!courseId) return toast.error("Pick a course");
    if (kind === "link") {
      if (!externalUrl.trim()) return toast.error("URL is required");
    } else if (!file) {
      return toast.error("Pick a file");
    }

    try {
      setUploading(true);
      let storagePath: string | null = null;

      if (kind !== "link" && file) {
        const ext = file.name.split(".").pop() ?? "bin";
        storagePath = `${user.id}/${courseId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("course-materials")
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(upErr.message);
      }

      const { error } = await supabase.from("course_materials").insert({
        course_id: courseId,
        tutor_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        kind,
        storage_path: storagePath,
        external_url: kind === "link" ? externalUrl.trim() : null,
      });
      if (error) throw new Error(error.message);

      toast.success("Material added");
      reset();
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["my-materials"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add material
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload course material</DialogTitle>
          <DialogDescription>
            Videos, PDFs, slides, or a link. You’ll pick which students can view it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="pdf">PDF / Document</SelectItem>
                <SelectItem value="slide">Slides</SelectItem>
                <SelectItem value="link">External link</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {kind === "link" ? (
            <div>
              <Label>URL</Label>
              <Input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          ) : (
            <div>
              <Label>File</Label>
              <Input
                type="file"
                accept={
                  kind === "video"
                    ? "video/*"
                    : kind === "pdf"
                      ? "application/pdf"
                      : undefined
                }
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button disabled={uploading} onClick={submit}>
            {uploading ? (
              <>
                <Upload className="mr-1 h-3 w-3 animate-pulse" /> Uploading…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
