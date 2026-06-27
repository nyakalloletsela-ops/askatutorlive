import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Award, Printer, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/certificate")({
  component: CertificatePage,
  head: () => ({
    meta: [
      { title: "Your Certificate — Ask A Tutor Live" },
      { name: "description", content: "Download or print your Ask A Tutor Live certificate of completion." },
    ],
  }),
});

function CertificatePage() {
  const { user } = useAuth();
  const [name, setName] = useState<string>("");
  const [completed, setCompleted] = useState(0);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("sessions").select("subject, status").eq("student_id", user.id),
      ]);
      setName(p?.full_name ?? user.email ?? "Student");
      const done = (s ?? []).filter((x) => x.status === "completed");
      setCompleted(done.length);
      setSubjects(Array.from(new Set(done.map((x) => x.subject).filter(Boolean) as string[])));
      setLoading(false);
    })();
  }, [user]);

  const eligible = completed >= 3;
  const issuedDate = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
  const certNo = user ? `AATL-${user.id.slice(0, 8).toUpperCase()}` : "AATL-XXXXXXXX";

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="p-8 text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body { background: white; }
          .no-print { display: none !important; }
          .cert-card { box-shadow: none !important; border: none !important; page-break-inside: avoid; }
        }
      `}</style>
      <div className="no-print"><Navbar /></div>
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <div className="no-print flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Link>
          </Button>
          {eligible && (
            <Button onClick={() => window.print()} className="bg-aurora text-white hover:opacity-90">
              <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
            </Button>
          )}
        </div>

        {!eligible ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-center">
              <Award className="mx-auto h-10 w-10 text-muted-foreground" />
              <h1 className="text-xl font-bold">Certificate not ready yet</h1>
              <p className="text-sm text-muted-foreground">
                Complete at least <strong>3 tutoring sessions</strong> to unlock your certificate.
                You have completed <strong>{completed}</strong> so far.
              </p>
              <Button asChild className="bg-aurora text-white"><Link to="/">Find a tutor</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="cert-card overflow-hidden border-4 border-double border-gold bg-gradient-to-br from-background to-muted/40 shadow-glow">
            <CardContent className="relative px-10 py-12 text-center">
              {/* Corner ornaments */}
              <div className="absolute left-4 top-4 h-16 w-16 rounded-full bg-aurora opacity-20 blur-2xl" />
              <div className="absolute right-4 top-4 h-16 w-16 rounded-full bg-gold/40 blur-2xl" />
              <div className="absolute bottom-4 left-4 h-16 w-16 rounded-full bg-gold/40 blur-2xl" />
              <div className="absolute bottom-4 right-4 h-16 w-16 rounded-full bg-aurora opacity-20 blur-2xl" />

              <div className="relative">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-aurora text-white shadow-glow">
                  <Award className="h-7 w-7" />
                </div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Ask A Tutor Live</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Certificate of Completion</h1>
                <p className="mt-4 text-sm text-muted-foreground">This is to certify that</p>
                <p className="mt-2 font-serif text-4xl font-bold text-aurora md:text-5xl">{name}</p>
                <div className="mx-auto mt-2 h-px w-48 bg-gold" />
                <p className="mt-4 max-w-xl text-balance text-sm leading-relaxed text-foreground/90 md:text-base mx-auto">
                  has successfully completed <strong>{completed}</strong> live tutoring sessions on the
                  Ask A Tutor Live platform, demonstrating sustained learning and dedication
                  {subjects.length > 0 && <> across <strong>{subjects.slice(0, 5).join(", ")}</strong></>}.
                </p>

                <div className="mt-8 flex flex-wrap items-end justify-between gap-6 text-xs">
                  <div className="text-left">
                    <p className="border-b border-foreground/40 pb-1 font-serif text-lg italic">Nyakallo Letsela</p>
                    <p className="mt-1 text-muted-foreground">Founder, Ask A Tutor Live</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Issued</p>
                    <p className="font-semibold">{issuedDate}</p>
                    <p className="mt-1 text-muted-foreground">Certificate ID</p>
                    <p className="font-mono text-[11px]">{certNo}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
