import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Navbar } from "@/components/Navbar";
import { ScopeGate } from "@/components/ScopeGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Play, Pause, RotateCcw, Sparkles, Trash2, Maximize2, Loader2, Search, X, BookOpen, GraduationCap,
  Compass, Lock, ClipboardCheck, Wand2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  embedPrompt, findSimilarSimulation, generateSimulationSchema,
  saveSimulation, listSimulations, deleteSimulation,
  type SimulationSchemaT,
} from "@/lib/sim-lab.functions";
import { SimDispatch } from "@/components/lab3d/SimDispatch";
import { SimChat } from "@/components/lab3d/SimChat";
import { AmbientEmpty } from "@/components/lab3d/AmbientEmpty";
import type * as THREE from "three";

type LearningMode = "guided" | "explore" | "tutor" | "assessment";

export const Route = createFileRoute("/_authenticated/labs_/simulation-lab")({
  component: () => <ScopeGate scope="labs"><Lab3DPage /></ScopeGate>,
  head: () => ({
    meta: [
      { title: "Simulation Lab — Ask A Tutor Live" },
      { name: "description", content: "Turn any learning prompt into a live 3D simulation. Save and remix your reusable knowledge universe." },
    ],
  }),
});

type LibraryItem = {
  id: string;
  prompt: string;
  subject: string | null;
  title: string | null;
  tags?: string[] | null;
  thumbnail_url: string | null;
  created_at: string;
  schema_json: SimulationSchemaT;
};

type GenerateResult = { schema: SimulationSchemaT; fallback: boolean };

function toLibraryItems(rows: unknown): LibraryItem[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is LibraryItem => {
    const item = row as Partial<LibraryItem>;
    return typeof item.id === "string" && typeof item.prompt === "string" && !!item.schema_json;
  });
}

function Lab3DPage() {
  const embedFn = useServerFn(embedPrompt);
  const findFn = useServerFn(findSimilarSimulation);
  const genFn = useServerFn(generateSimulationSchema);
  const saveFn = useServerFn(saveSimulation);
  const listFn = useServerFn(listSimulations);
  const delFn = useServerFn(deleteSimulation);

  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [schema, setSchema] = useState<SimulationSchemaT | null>(null);
  const [playing, setPlaying] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [timeScale, setTimeScale] = useState(1);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [match, setMatch] = useState<LibraryItem | null>(null);
  const [pendingEmbedding, setPendingEmbedding] = useState<number[] | null>(null);
  const [selectedObj, setSelectedObj] = useState<number | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizReveal, setQuizReveal] = useState(false);
  const [mode, setMode] = useState<LearningMode>("explore");
  const [rightTab, setRightTab] = useState<"library" | "chat">("library");
  const sceneWrapRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);

  // Mode side effects
  useEffect(() => {
    if (mode === "assessment" && schema?.quiz && schema.quiz.length > 0) {
      setQuizOpen(true);
    }
    if (mode === "tutor") {
      setPlaying(false);
    }
  }, [mode, schema]);

  async function refreshLibrary() {
    try {
      const { simulations } = await listFn({ data: { search: search || undefined, subject: subject || undefined } });
      setLibrary(toLibraryItems(simulations));
    } catch (e: any) {
      // silent
    }
  }

  useEffect(() => { refreshLibrary(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { refreshLibrary(); /* eslint-disable-next-line */ }, [subject]);

  async function handleGenerate(forceNew = false) {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    try {
      let embedding: number[] | null = null;
      try {
        const e = await embedFn({ data: { text: prompt } });
        embedding = e.embedding;
      } catch { /* skip similarity */ }

      if (embedding && !forceNew) {
        try {
          const { match: m } = await findFn({ data: { embedding, minSimilarity: 0.85 } });
          if (m) {
            setMatch(m as unknown as LibraryItem);
            setPendingEmbedding(embedding);
            setBusy(false);
            return;
          }
        } catch { /* ignore */ }
      }

      const { schema: gen, fallback } = (await genFn({ data: { prompt } })) as GenerateResult;
      if (fallback) toast.warning("AI returned an unexpected shape — showing a safe fallback scene.");
      setSchema(gen as SimulationSchemaT);
      setResetKey((k) => k + 1);
      setPlaying(true);

      // capture thumbnail after a short render delay
      setTimeout(async () => {
        let thumb: string | null = null;
        try {
          const gl = glRef.current;
          if (gl) {
            thumb = gl.domElement.toDataURL("image/jpeg", 0.5);
            if (thumb && thumb.length > 350_000) thumb = null;
          }
        } catch { thumb = null; }
        try {
          await saveFn({ data: { prompt, schema: gen, embedding, thumbnailDataUrl: thumb } });
          toast.success("Saved to your library");
          refreshLibrary();
        } catch (e: any) {
          toast.error(e?.message ?? "Could not save");
        }
      }, 600);
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadFromLibrary(item: LibraryItem) {
    setSchema(item.schema_json);
    setPrompt(item.prompt);
    setResetKey((k) => k + 1);
    setPlaying(true);
  }

  async function loadMatched() {
    if (!match) return;
    setSchema(match.schema_json);
    setResetKey((k) => k + 1);
    setPlaying(true);
    setMatch(null);
    setPendingEmbedding(null);
  }

  async function generateAnyway() {
    if (!match) return;
    setMatch(null);
    const emb = pendingEmbedding;
    setPendingEmbedding(null);
    // bypass similarity check by passing through embedding
    setBusy(true);
    try {
      const { schema: gen, fallback } = (await genFn({ data: { prompt } })) as GenerateResult;
      if (fallback) toast.warning("Using a safe fallback scene.");
      setSchema(gen as SimulationSchemaT);
      setResetKey((k) => k + 1);
      setPlaying(true);
      setTimeout(async () => {
        const thumb = glRef.current?.domElement.toDataURL("image/jpeg", 0.5) ?? null;
        await saveFn({ data: { prompt, schema: gen, embedding: emb, thumbnailDataUrl: thumb && thumb.length < 350_000 ? thumb : null } });
        refreshLibrary();
      }, 600);
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: string) {
    if (!confirm("Delete this simulation?")) return;
    try {
      await delFn({ data: { id } });
      setLibrary((l) => l.filter((x) => x.id !== id));
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  }

  async function goFullscreen() {
    if (!sceneWrapRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await sceneWrapRef.current.requestFullscreen();
  }

  const subjects = Array.from(new Set(library.map((l) => l.subject).filter(Boolean))) as string[];

  return (
    <div className="flex h-screen flex-col bg-[#0b1020] text-white">
      <Navbar />
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[300px_1fr_320px]">
        {/* LEFT — prompt */}
        <aside className="hidden flex-col gap-3 border-r border-white/5 bg-black/30 p-4 md:flex">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-violet-400" /> Simulation Lab
          </div>
          <p className="text-xs text-white/60">Type any question, scenario, or statement from <span className="text-white">any subject</span> — physics, biology, chemistry, math, economics, history, language — and the AI builds a live 2D/3D simulation showing motion, structure, and labelled detail.</p>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. How does photosynthesis work? • Plot y = sin(x) and its derivative • A 1200kg car hits a wall at 20 m/s • Supply & demand for coffee"
            className="min-h-[140px] resize-none bg-black/40 text-white placeholder:text-white/40"
          />
          <Button onClick={() => handleGenerate(false)} disabled={busy || !prompt.trim()} className="w-full">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate
          </Button>
          {schema && (
            <div className="rounded border border-white/10 bg-black/30 p-2 text-[11px] text-white/70">
              <div className="font-semibold text-white">{schema.title}</div>
              <div>Subject: {schema.subject}</div>
              <div>Objects: {schema.objects.length}</div>
              <div>Rules: {schema.rules.join(", ") || "—"}</div>
            </div>
          )}
        </aside>

        {/* CENTER — scene */}
        <main ref={sceneWrapRef} className="relative h-full min-h-0 w-full overflow-hidden">
          <div className="absolute inset-0">
            <SimDispatch
              schema={schema}
              playing={playing}
              resetKey={resetKey}
              timeScale={timeScale}
              onCanvasReady={(gl: THREE.WebGLRenderer) => { glRef.current = gl; }}
              onSelectObject={(i: number) => setSelectedObj(i)}
            />
          </div>
          {/* mobile prompt */}
          <div className="absolute left-3 right-3 top-3 z-10 flex gap-2 md:hidden">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe a scenario…"
              className="bg-black/60 text-white placeholder:text-white/50"
            />
            <Button size="sm" onClick={() => handleGenerate(false)} disabled={busy || !prompt.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
          </div>
          {/* mode selector */}
          <div className="absolute left-1/2 top-3 z-10 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/70 px-1.5 py-1 backdrop-blur md:flex">
            {([
              { id: "guided" as const, icon: <Wand2 className="h-3 w-3" />, label: "Guided" },
              { id: "explore" as const, icon: <Compass className="h-3 w-3" />, label: "Explore" },
              { id: "tutor" as const, icon: <Lock className="h-3 w-3" />, label: "Tutor" },
              { id: "assessment" as const, icon: <ClipboardCheck className="h-3 w-3" />, label: "Assess" },
            ]).map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition ${mode === m.id ? "bg-violet-500 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"}`}
              >{m.icon}{m.label}</button>
            ))}
          </div>
          {/* controls */}
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-2 backdrop-blur">
            <Button size="icon" variant="ghost" onClick={() => setPlaying((p) => !p)} disabled={mode === "tutor"} className="h-8 w-8 text-white hover:bg-white/10 disabled:opacity-40">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setResetKey((k) => k + 1)} disabled={mode === "tutor"} className="h-8 w-8 text-white hover:bg-white/10 disabled:opacity-40">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <div className="hidden items-center gap-1 sm:flex">
              {[0.25, 0.5, 1, 2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setTimeScale(s)}
                  className={`rounded px-1.5 py-0.5 text-[10px] transition ${Math.abs(timeScale - s) < 0.01 ? "bg-violet-500 text-white" : "text-white/60 hover:bg-white/10"}`}
                >{s}×</button>
              ))}
            </div>
            <span className="text-[10px] text-white/60 sm:hidden">{timeScale.toFixed(1)}×</span>
            {schema && schema.quiz && schema.quiz.length > 0 && (
              <Button size="icon" variant="ghost" onClick={() => setQuizOpen(true)} className="h-8 w-8 text-white hover:bg-white/10" aria-label="Quiz">
                <GraduationCap className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => { setRightTab("chat"); }} className="h-8 w-8 text-white hover:bg-white/10" aria-label="AI Tutor">
              <Sparkles className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={goFullscreen} className="h-8 w-8 text-white hover:bg-white/10">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          {!schema && (
            <AmbientEmpty onPick={(t) => { setPrompt(t); }} />
          )}

          {/* Explain panel */}
          {selectedObj !== null && schema && schema.objects[selectedObj] && (
            <div className="absolute right-3 top-3 z-20 w-72 rounded-xl border border-violet-400/40 bg-black/85 p-3 text-white shadow-2xl backdrop-blur">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-violet-300" />
                  <div className="text-sm font-semibold">{schema.objects[selectedObj].label ?? schema.objects[selectedObj].type}</div>
                </div>
                <button onClick={() => setSelectedObj(null)} className="text-white/50 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
              </div>
              {(() => {
                const ex = schema.objects[selectedObj].explain;
                if (!ex) return <div className="text-xs text-white/60">No explanation provided. Click another object or generate a new simulation.</div>;
                return (
                  <div className="space-y-2 text-xs">
                    {ex.definition && <div><div className="text-[10px] uppercase tracking-wide text-white/40">Definition</div><div className="text-white/80">{ex.definition}</div></div>}
                    {ex.purpose && <div><div className="text-[10px] uppercase tracking-wide text-white/40">Purpose</div><div className="text-white/80">{ex.purpose}</div></div>}
                    {ex.keyFacts && ex.keyFacts.length > 0 && (
                      <div><div className="text-[10px] uppercase tracking-wide text-white/40">Key facts</div>
                        <ul className="ml-3 list-disc text-white/80">{ex.keyFacts.map((f, i) => <li key={i}>{f}</li>)}</ul>
                      </div>
                    )}
                    {ex.misconceptions && ex.misconceptions.length > 0 && (
                      <div><div className="text-[10px] uppercase tracking-wide text-rose-300">Common misconceptions</div>
                        <ul className="ml-3 list-disc text-rose-200/80">{ex.misconceptions.map((f, i) => <li key={i}>{f}</li>)}</ul>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </main>

        {/* RIGHT — tabs: Library / AI Tutor */}
        <aside className="hidden flex-col border-l border-white/5 bg-black/30 md:flex">
          <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as "library" | "chat")} className="flex h-full min-h-0 flex-col">
            <TabsList className="m-2 grid grid-cols-2 bg-black/40">
              <TabsTrigger value="library" className="text-xs">Library</TabsTrigger>
              <TabsTrigger value="chat" className="text-xs">AI Tutor</TabsTrigger>
            </TabsList>
            <TabsContent value="library" className="m-0 flex min-h-0 flex-1 flex-col">
              <div className="border-b border-white/5 p-3">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && refreshLibrary()}
                    onBlur={refreshLibrary}
                    placeholder="Search title…"
                    className="h-8 bg-black/40 pl-7 text-xs text-white placeholder:text-white/40"
                  />
                </div>
                {subjects.length > 0 && (
                  <select
                    value={subject}
                    onChange={(e) => { setSubject(e.target.value); setTimeout(refreshLibrary, 0); }}
                    className="mt-2 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs"
                  >
                    <option value="">All subjects</option>
                    {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {library.length === 0 ? (
                  <div className="p-6 text-center text-xs text-white/50">No simulations yet</div>
                ) : (
                  library.map((it) => (
                    <div key={it.id} className="group mb-2 flex gap-2 rounded border border-white/10 bg-black/30 p-2 hover:border-violet-400/50">
                      <button onClick={() => loadFromLibrary(it)} className="flex flex-1 items-start gap-2 text-left">
                        {it.thumbnail_url ? (
                          <img src={it.thumbnail_url} alt="" className="h-12 w-16 rounded object-cover" />
                        ) : (
                          <div className="h-12 w-16 rounded bg-gradient-to-br from-violet-500/40 to-cyan-500/40" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold">{it.title || it.prompt.slice(0, 40)}</div>
                          <div className="truncate text-[10px] text-white/50">{it.subject ?? "—"}</div>
                        </div>
                      </button>
                      <button onClick={() => removeItem(it.id)} className="opacity-0 transition-opacity group-hover:opacity-100" aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5 text-white/60 hover:text-red-400" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
            <TabsContent value="chat" className="m-0 flex min-h-0 flex-1 flex-col">
              <SimChat schema={schema} />
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      <Dialog open={!!match} onOpenChange={(o) => !o && setMatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Similar simulation found</DialogTitle>
            <DialogDescription>
              "{match?.title}" looks similar to your prompt. Load it, or generate a brand-new simulation?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={generateAnyway}>Generate new</Button>
            <Button onClick={loadMatched}>Load existing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quiz dialog */}
      <Dialog open={quizOpen} onOpenChange={(o) => { setQuizOpen(o); if (!o) { setQuizIdx(0); setQuizAnswers({}); setQuizReveal(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-violet-400" /> Test your understanding</DialogTitle>
            <DialogDescription>Auto-generated from this simulation.</DialogDescription>
          </DialogHeader>
          {schema?.quiz && schema.quiz.length > 0 ? (() => {
            const q = schema.quiz[quizIdx];
            const userAns = quizAnswers[quizIdx];
            const correct = userAns?.trim().toLowerCase() === q.answer.trim().toLowerCase();
            return (
              <div className="space-y-3">
                <div className="text-xs text-white/50">Question {quizIdx + 1} of {schema.quiz.length} · <span className="uppercase">{q.difficulty}</span> · {q.type}</div>
                <div className="text-base font-medium">{q.question}</div>
                {q.type === "mcq" && q.options ? (
                  <div className="space-y-1">
                    {q.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setQuizAnswers({ ...quizAnswers, [quizIdx]: opt })}
                        className={`w-full rounded border px-3 py-2 text-left text-sm transition ${userAns === opt ? "border-violet-400 bg-violet-500/20" : "border-white/10 hover:border-white/30"}`}
                      >{opt}</button>
                    ))}
                  </div>
                ) : q.type === "tf" ? (
                  <div className="flex gap-2">
                    {["True", "False"].map((opt) => (
                      <button key={opt} onClick={() => setQuizAnswers({ ...quizAnswers, [quizIdx]: opt })} className={`flex-1 rounded border px-3 py-2 text-sm ${userAns === opt ? "border-violet-400 bg-violet-500/20" : "border-white/10"}`}>{opt}</button>
                    ))}
                  </div>
                ) : (
                  <Input value={userAns ?? ""} onChange={(e) => setQuizAnswers({ ...quizAnswers, [quizIdx]: e.target.value })} placeholder="Your answer…" />
                )}
                {quizReveal && (
                  <div className={`rounded border p-2 text-sm ${correct ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-rose-400/40 bg-rose-500/10 text-rose-200"}`}>
                    <div className="font-semibold">{correct ? "✓ Correct" : `✗ Answer: ${q.answer}`}</div>
                    {q.explanation && <div className="mt-1 text-xs opacity-80">{q.explanation}</div>}
                  </div>
                )}
              </div>
            );
          })() : <div className="text-sm text-white/60">No quiz available.</div>}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setQuizReveal(false); setQuizIdx((i) => Math.max(0, i - 1)); }} disabled={quizIdx === 0}>Back</Button>
            {!quizReveal ? (
              <Button onClick={() => setQuizReveal(true)} disabled={!quizAnswers[quizIdx]}>Check</Button>
            ) : quizIdx < (schema?.quiz?.length ?? 0) - 1 ? (
              <Button onClick={() => { setQuizReveal(false); setQuizIdx((i) => i + 1); }}>Next</Button>
            ) : (
              <Button onClick={() => { setQuizOpen(false); setQuizIdx(0); setQuizAnswers({}); setQuizReveal(false); }}>Finish</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
