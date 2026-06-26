import { useState } from "react";
import { Sparkles, Loader2, Calculator, GitBranch, GraduationCap, FileText, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SmartMarkdown } from "@/components/ai/SmartMarkdown";
import { useAgent, type AgentRole } from "@/hooks/use-agent";
import { cn } from "@/lib/utils";

const ROLES: { id: AgentRole; label: string; icon: typeof Sparkles; hint: string }[] = [
  { id: "tutor", label: "Tutor", icon: GraduationCap, hint: "Explain & teach" },
  { id: "math", label: "Math", icon: Calculator, hint: "LaTeX solver" },
  { id: "diagram", label: "Diagram", icon: GitBranch, hint: "Mermaid charts" },
  { id: "notes", label: "Notes", icon: FileText, hint: "Study notes" },
];

export function AIAssistantPanel() {
  const { messages, pending, role, setRole, send, reset } = useAgent("tutor");
  const [prompt, setPrompt] = useState("");

  const run = async () => {
    const text = prompt.trim();
    if (!text || pending) return;
    setPrompt("");
    try {
      await send(text);
    } catch {
      setPrompt(text);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2.5 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-primary" />
        AI Agents
        {messages.length > 0 && (
          <button
            onClick={reset}
            className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1 border-b bg-muted/30 p-1.5">
        {ROLES.map((r) => {
          const active = role === r.id;
          return (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              title={r.hint}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] font-medium transition",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background",
              )}
            >
              <r.icon className="h-3.5 w-3.5" />
              {r.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Pick an agent above and ask anything. Math renders as equations, diagrams render as charts.
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl border p-3 text-xs",
                m.role === "user" ? "ml-6 bg-primary/5 border-primary/20" : "mr-6 bg-background",
              )}
            >
              {m.role === "user" ? (
                <p className="whitespace-pre-wrap">{m.content}</p>
              ) : (
                <SmartMarkdown>{m.content}</SmartMarkdown>
              )}
            </div>
          ))
        )}
        {pending && (
          <div className="mr-6 flex items-center gap-2 rounded-xl border bg-background p-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {role} agent is thinking…
          </div>
        )}
      </div>

      <div className="border-t bg-background/50 p-2">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              run();
            }
          }}
          placeholder={`Ask the ${role} agent… (⌘+Enter)`}
          rows={2}
          className="resize-none text-sm"
          disabled={pending}
        />
        <Button onClick={run} disabled={pending || !prompt.trim()} className="mt-2 w-full" size="sm">
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {pending ? "Thinking…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
