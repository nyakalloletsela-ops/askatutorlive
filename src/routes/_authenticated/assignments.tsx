import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Plus, Trash2, CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, EmptyState, SectionHeader } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

export const Route = createFileRoute("/_authenticated/assignments")({
  component: AssignmentsPage,
});

type Assignment = {
  id: string;
  tutor_id: string;
  student_id: string;
  title: string;
  description: string | null;
  subject: string | null;
  due_at: string | null;
  status: string;
  created_at: string;
};

function AssignmentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["assignments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Assignment[];
    },
    enabled: !!user,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["my-students"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_students_for_tutor");
      if (error) return [];
      return (data ?? []) as { id: string; full_name: string }[];
    },
    enabled: !!user,
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Assignment deleted");
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("assignments")
        .update({ status: "completed" })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });

  const isTutor = students.length > 0;

  return (
    <PageContainer
      title="Assignments"
      description="Homework and tasks shared between tutors and students."
      actions={
        isTutor ? (
          <CreateAssignmentDialog students={students} />
        ) : undefined
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No assignments yet"
          description={
            isTutor
              ? "Create your first assignment to share homework with a student."
              : "Your tutor hasn't shared any assignments with you yet."
          }
        />
      ) : (
        <div className="grid gap-3">
          {assignments.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{a.title}</h3>
                    {a.subject && (
                      <Badge variant="secondary" className="text-[10px]">
                        {a.subject}
                      </Badge>
                    )}
                    <Badge
                      variant={a.status === "completed" ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {a.status === "completed" ? (
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                      ) : (
                        <Clock className="mr-1 h-3 w-3" />
                      )}
                      {a.status}
                    </Badge>
                  </div>
                  {a.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {a.description}
                    </p>
                  )}
                  {a.due_at && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Due {new Date(a.due_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {a.status !== "completed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markDone.mutate(a.id)}
                    >
                      Mark done
                    </Button>
                  )}
                  {a.tutor_id === user?.id && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => del.mutate(a.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function CreateAssignmentDialog({
  students,
}: {
  students: { id: string; full_name: string }[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [studentId, setStudentId] = useState("");
  const [dueAt, setDueAt] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !studentId || !title) throw new Error("Title and student required");
      const { error } = await supabase.from("assignments").insert({
        tutor_id: user.id,
        student_id: studentId,
        title,
        description: description || null,
        subject: subject || null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Assignment created");
      setOpen(false);
      setTitle("");
      setDescription("");
      setSubject("");
      setStudentId("");
      setDueAt("");
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> New assignment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New assignment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
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
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label>Due date</Label>
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
