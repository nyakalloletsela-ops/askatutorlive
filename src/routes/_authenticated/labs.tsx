import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { LorddaLab } from "@/components/LorddaLab";
import { WebGLLab } from "@/components/WebGLLab";
import { FlaskConical, Boxes, ExternalLink, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  STUDENT_LAB_LIMIT,
  readViewedSlugs,
  recordViewedSlug,
} from "@/lib/lab-modules";
import { ScopeGate } from "@/components/ScopeGate";

export const Route = createFileRoute("/_authenticated/labs")({
  component: () => (<ScopeGate scope="labs"><LabsPage /></ScopeGate>),
  head: () => ({
    meta: [
      { title: "Virtual STEM Labs — Ask A Tutor Live" },
      { name: "description", content: "60+ interactive science simulations — available in 2D (PhET) and immersive 3D." },
    ],
  }),
});

type Mode = "phet" | "3d";

function LabsPage() {
  const [mode, setMode] = useState<Mode>("phet");
  const location = useLocation();
  const { isAdmin, isTutor } = useAuth();
  const [viewed, setViewed] = useState<string[]>([]);

  // Students get capped access; tutors and admins are unlimited.
  const enforceLimit = !isAdmin && !isTutor;

  useEffect(() => { setViewed(readViewedSlugs()); }, []);

  const handleOpen = (slug: string) => {
    if (!enforceLimit) return;
    setViewed(recordViewedSlug(slug));
  };

  if (location.pathname !== "/labs") return <Outlet />;

  return (
    <div className="flex h-screen flex-col">
      <Navbar />
      <div className="flex shrink-0 items-center gap-2 border-b bg-background px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lab type</span>
        <div className="ml-1 flex rounded-lg border border-border/60 p-0.5">
          <button
            onClick={() => setMode("phet")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "phet" ? "bg-aurora text-white shadow-glow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5" /> PhET (2D)
          </button>
          <button
            onClick={() => setMode("3d")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "3d" ? "bg-aurora text-white shadow-glow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Boxes className="h-3.5 w-3.5" /> 3D Virtual Labs
          </button>
        </div>
        <Link
          to="/labs/simulation-lab"
          className="ml-2 inline-flex items-center gap-1 rounded-md border border-violet-400/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200 hover:bg-violet-500/20"
        >
          <Sparkles className="h-3 w-3" /> Simulation Lab
        </Link>
        <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">
          {enforceLimit
            ? `Free plan · ${viewed.length}/${STUDENT_LAB_LIMIT} experiments used`
            : "Unlimited access"}
        </span>
      </div>
      <div className="flex-1 overflow-hidden pb-16 md:pb-0">
        {mode === "phet" ? (
          <LorddaLab
            enforceLimit={enforceLimit}
            viewedSlugs={viewed}
            limit={STUDENT_LAB_LIMIT}
            onOpen={handleOpen}
          />
        ) : (
          <WebGLLab
            enforceLimit={enforceLimit}
            viewedSlugs={viewed}
            limit={STUDENT_LAB_LIMIT}
            onOpen={handleOpen}
          />
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-1 border-t bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span>
          {mode === "phet" ? "2D simulations by" : "Inspired by simulations from"}
        </span>
        <a
          href="https://phet.colorado.edu"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 underline hover:text-foreground"
        >
          PhET Interactive Simulations <ExternalLink className="h-2.5 w-2.5" />
        </a>
        <span>· University of Colorado Boulder · CC BY 4.0</span>
        {mode === "3d" && (
          <span className="ml-1 italic">— 3D scenes are independently rendered, not affiliated with PhET.</span>
        )}
      </div>
    </div>
  );
}
