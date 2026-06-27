import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Upload, FileText, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/become-tutor")({
  component: BecomeTutorPage,
});

type Existing = {
  id: string;
  status: "pending" | "approved" | "rejected" | "needs_info";
  admin_notes: string | null;
  submitted_at: string;
};

type DocRow = { id: string; label: string; storage_path: string };

type DocSpec = { label: string; required: boolean; accept: string; hint: string };
const DOC_SPECS: DocSpec[] = [
  { label: "Government ID", required: true, accept: "application/pdf,image/*", hint: "Passport or national ID — clear photo or PDF." },
  { label: "Highest Qualification", required: true, accept: "application/pdf,image/*", hint: "Degree certificate, diploma or transcript." },
  { label: "Additional Education Documents", required: false, accept: "application/pdf,image/*", hint: "Extra transcripts, certifications, or training records." },
  { label: "Teaching Certificate", required: false, accept: "application/pdf,image/*", hint: "PGCE, TEFL, or equivalent if available." },
  { label: "CV / Resume", required: true, accept: "application/pdf,image/*", hint: "Up-to-date CV listing teaching experience." },
  { label: "Motivational Letter", required: true, accept: "application/pdf,.doc,.docx,image/*", hint: "Why do you want to tutor on AskATutorLive?" },
  { label: "Introduction Video", required: true, accept: "video/*", hint: "60–120s self-intro. MP4/MOV/WebM, max ~100MB." },
];


function BecomeTutorPage() {
  const { user, isTutor } = useAuth();
  const navigate = useNavigate();
  const [existing, setExisting] = useState<Existing | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [subjects, setSubjects] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [motivation, setMotivation] = useState("");

  const load = async () => {
    if (!user) return;
    const { data: apps } = await supabase
      .from("tutor_applications")
      .select("id, status, admin_notes, submitted_at")
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(1);
    const app = (apps?.[0] as Existing | undefined) ?? null;
    setExisting(app);
    if (app) {
      const { data: d } = await supabase
        .from("tutor_application_documents")
        .select("id, label, storage_path")
        .eq("application_id", app.id);
      setDocs((d as DocRow[]) ?? []);
    }
    setFullName(user.user_metadata?.full_name ?? "");
    setEmail(user.email ?? "");
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const submit = async () => {
    if (!user) return;
    if (!fullName.trim() || !bio.trim() || !qualifications.trim() || !subjects.trim() || !motivation.trim()) {
      return toast.error("Please fill in name, subjects, bio, qualifications and motivation");
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("tutor_applications")
      .insert({
        user_id: user.id,
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        bio: bio.trim(),
        subjects: subjects.split(",").map((s) => s.trim()).filter(Boolean),
        qualifications: `${qualifications.trim()}\n\n--- Motivation ---\n${motivation.trim()}`,
      })
      .select("id, status, admin_notes, submitted_at")
      .single();
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setExisting(data as Existing);
    toast.success("Application submitted. You can now upload your documents.");
  };

  const uploadDoc = async (label: string, file: File) => {
    if (!user || !existing) return;
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${user.id}/${existing.id}/${label.replace(/\s+/g, "_")}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("tutor-applications")
      .upload(path, file, { upsert: false });
    if (upErr) return toast.error(upErr.message);
    const { error: rowErr } = await supabase.from("tutor_application_documents").insert({
      application_id: existing.id,
      user_id: user.id,
      label,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
    });
    if (rowErr) return toast.error(rowErr.message);
    toast.success(`${label} uploaded`);
    load();
  };

  const removeDoc = async (d: DocRow) => {
    await supabase.storage.from("tutor-applications").remove([d.storage_path]);
    await supabase.from("tutor_application_documents").delete().eq("id", d.id);
    toast.success("Removed");
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen"><Navbar /><main className="mx-auto max-w-3xl px-4 py-10">Loading…</main></div>
    );
  }

  if (isTutor) {
    return (
      <div className="min-h-screen"><Navbar />
        <main className="mx-auto max-w-3xl px-4 py-10">
          <Card><CardContent className="p-6">
            <p className="text-lg font-semibold">You are already a tutor.</p>
            <Button className="mt-3" onClick={() => navigate({ to: "/dashboard" })}>Go to dashboard</Button>
          </CardContent></Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Apply to become a tutor</h1>
            <p className="text-sm text-muted-foreground">
              Submit your details and supporting documents. An admin will review your application.
            </p>
          </div>
        </div>

        {existing ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Application status
                <Badge variant={existing.status === "approved" ? "default" : existing.status === "rejected" ? "destructive" : "secondary"}>
                  {existing.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Submitted {new Date(existing.submitted_at).toLocaleString()}.</p>
              {existing.admin_notes && (
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Admin notes</p>
                  <p>{existing.admin_notes}</p>
                </div>
              )}
              {existing.status === "rejected" && (
                <Button variant="outline" onClick={() => { setExisting(null); setDocs([]); }}>
                  Start a new application
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>Your details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Subjects you can teach (comma-separated)</Label><Input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="Mathematics, Physical Sciences, English" /></div>
              <div className="sm:col-span-2"><Label>Short bio</Label><Textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about your teaching experience and approach." /></div>
              <div className="sm:col-span-2"><Label>Qualifications</Label><Textarea rows={3} value={qualifications} onChange={(e) => setQualifications(e.target.value)} placeholder="e.g. BSc Mathematics (UCT, 2022); 3 years tutoring..." /></div>
              <div className="sm:col-span-2"><Label>Motivational letter</Label><Textarea rows={5} value={motivation} onChange={(e) => setMotivation(e.target.value)} placeholder="Why do you want to tutor on AskATutorLive? What's your teaching philosophy?" /></div>
              <div className="sm:col-span-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                After submitting, you'll upload supporting documents: government ID, qualifications, CV, motivational letter (optional file), and a short intro video.
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button disabled={submitting} onClick={submit}>{submitting ? "Submitting…" : "Submit application"}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {existing && existing.status !== "approved" && (
          <Card>
            <CardHeader>
              <CardTitle>Supporting documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload clear PDF, image or video files. Admins use these to verify your identity, qualifications and teaching readiness.
              </p>
              {(() => {
                const missing = DOC_SPECS.filter((d) => d.required && !docs.some((u) => u.label === d.label));
                if (missing.length === 0) return null;
                return (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                    Still needed: {missing.map((m) => m.label).join(", ")}.
                  </div>
                );
              })()}
              {DOC_SPECS.map((spec) => {
                const uploaded = docs.filter((d) => d.label === spec.label);
                return (
                  <div key={spec.label} className="rounded-md border p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          {spec.label}
                          {spec.required ? (
                            <Badge variant="destructive" className="text-[10px]">Required</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Optional</Badge>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{spec.hint}</p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs hover:bg-muted/70">
                        <Upload className="h-3.5 w-3.5" /> Upload
                        <input
                          type="file"
                          className="hidden"
                          accept={spec.accept}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(spec.label, f); e.target.value = ""; }}
                        />
                      </label>
                    </div>
                    <ul className="space-y-1">
                      {uploaded.map((d) => (
                        <li key={d.id} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1 text-xs">
                          <span className="flex items-center gap-1 truncate"><FileText className="h-3.5 w-3.5" /> {d.storage_path.split("/").pop()}</span>
                          <button className="text-destructive" onClick={() => removeDoc(d)}><X className="h-3.5 w-3.5" /></button>
                        </li>
                      ))}
                      {uploaded.length === 0 && <li className="text-xs text-muted-foreground">No file uploaded yet.</li>}
                    </ul>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
