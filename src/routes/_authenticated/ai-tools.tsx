import { SmartMarkdown } from "@/components/ai/SmartMarkdown";
import { SaveToNotes } from "@/components/ai/SaveToNotes";

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Sparkles, BookOpen, Layers, ListChecks, FileText, ScrollText,
  Code, FlaskConical, Briefcase, Languages, CalendarDays, Loader2, Send,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { aiToolRun } from "@/lib/ai-tools.functions";
import { ScopeGate } from "@/components/ScopeGate";

export const Route = createFileRoute("/_authenticated/ai-tools")({
  component: () => (<ScopeGate scope="ai"><AiToolsPage /></ScopeGate>),
  head: () => ({
    meta: [
      { title: "AI Toolkit — Ask A Tutor Live" },
      { name: "description", content: "12 AI-powered study tools: explain, flashcards, quizzes, essay outlines, code help, lab reports, career guide and more." },
    ],
  }),
});

type ToolId =
  | "explain" | "flashcards" | "quiz" | "essay_outline" | "summarize"
  | "code_helper" | "lab_report" | "career" | "translate" | "study_plan";

const TOOLS: { id: ToolId; label: string; icon: any; tagline: string; placeholder: string; accent: string }[] = [
  { id: "explain", label: "Explain", icon: BookOpen, tagline: "Concepts in plain language", placeholder: "Explain Newton's third law with an analogy", accent: "from-primary to-accent" },
  { id: "flashcards", label: "Flashcards", icon: Layers, tagline: "Auto-generate 8 cards", placeholder: "Photosynthesis (Form D Biology)", accent: "from-accent to-gold" },
  { id: "quiz", label: "Quiz", icon: ListChecks, tagline: "5 multiple-choice questions", placeholder: "Quadratic equations", accent: "from-primary to-gold" },
  { id: "essay_outline", label: "Essay Outline", icon: FileText, tagline: "Structured argument plan", placeholder: "Causes of WWI for IGCSE History", accent: "from-gold to-primary" },
  { id: "summarize", label: "Summarize", icon: ScrollText, tagline: "TL;DR + key bullets", placeholder: "Paste a chapter or article here", accent: "from-accent to-primary" },
  { id: "code_helper", label: "Code Helper", icon: Code, tagline: "Debug and fix snippets", placeholder: "My Python loop never ends — here's the code…", accent: "from-primary to-accent" },
  { id: "lab_report", label: "Lab Report", icon: FlaskConical, tagline: "Template for any experiment", placeholder: "Titration of HCl with NaOH", accent: "from-accent to-gold" },
  { id: "career", label: "Career Guide", icon: Briefcase, tagline: "African STEM career paths", placeholder: "I love math and computers", accent: "from-gold to-accent" },
  { id: "translate", label: "Translate", icon: Languages, tagline: "Sesotho ↔ English", placeholder: "Translate: The mitochondria is the powerhouse of the cell", accent: "from-primary to-accent" },
  { id: "study_plan", label: "Study Plan", icon: CalendarDays, tagline: "7-day plan tailored to you", placeholder: "Prepare for COSC Physics paper in 2 weeks", accent: "from-accent to-primary" },
];

function AiToolsPage() {
  const run = useServerFn(aiToolRun);
  const [tool, setTool] = useState<ToolId>("explain");
  const [prompt, setPrompt] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  const active = TOOLS.find((t) => t.id === tool)!;

  const submit = async () => {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    setOutput("");
    try {
      const { reply } = await run({ data: { tool, prompt: text, subject: subject || undefined, level: level || undefined } });
      setOutput(reply || "(empty response)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 pb-24 md:pb-8">
      <div className="flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">AI Toolkit</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Pick a tool, give it your topic, and let Lordda do the heavy lifting.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const isActive = t.id === tool;
          return (
            <motion.button
              key={t.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => setTool(t.id)}
              className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all ${
                isActive ? "border-primary shadow-glow" : "border-border/60 hover:border-primary/50"
              }`}
            >
              <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br ${t.accent} opacity-${isActive ? "30" : "10"} blur-xl transition-opacity group-hover:opacity-25`} />
              <div className="relative">
                <div className={`mb-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${t.accent} text-white`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold">{t.label}</p>
                <p className="text-[11px] text-muted-foreground">{t.tagline}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <active.icon className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">{active.label}</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" />
              <Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Level (e.g. Form D)" />
            </div>
            <Textarea
              rows={8}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={active.placeholder}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(); }}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">⌘/Ctrl + Enter to run</p>
              <Button onClick={submit} disabled={loading || !prompt.trim()} className="bg-aurora text-white hover:opacity-90">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Run
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="min-h-[300px] space-y-2 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Output</h2>
              {output && !loading && (
                <SaveToNotes
                  content={output}
                  title={`${active.label}: ${(subject || prompt).slice(0, 80)}`}
                  kind={`ai-tool:${tool}`}
                />
              )}
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </div>
            )}
            {!loading && !output && (
              <p className="text-sm text-muted-foreground">Your result will appear here.</p>
            )}
            {output && (
              <SmartMarkdown>{output}</SmartMarkdown>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
