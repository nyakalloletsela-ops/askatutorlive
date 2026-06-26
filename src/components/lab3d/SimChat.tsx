import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Sparkles, Wand2, BookOpen, Brain, MessageCircle } from "lucide-react";
import { simLabChat } from "@/lib/sim-chat.functions";
import type { SimulationSchemaT } from "@/lib/sim-lab.functions";

type Msg = { role: "user" | "assistant"; content: string };

export function SimChat({ schema }: { schema: SimulationSchemaT | null }) {
  const chatFn = useServerFn(simLabChat);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(content: string, mode: "explain" | "simplify" | "harder" | "quiz" | "free" = "free") {
    if (!content.trim() || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const ctx = schema ? {
        title: schema.title, subject: schema.subject, summary: schema.summary,
        visualization: schema.visualization,
        objects: schema.objects?.slice(0, 12).map((o) => ({ label: o.label, type: o.type })),
      } : null;
      const { reply } = await chatFn({ data: { messages: next, context: ctx, mode } });
      setMessages([...next, { role: "assistant", content: reply || "(no reply)" }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", content: `⚠️ ${e?.message ?? "Chat failed"}` }]);
    } finally {
      setBusy(false);
    }
  }

  const quick = [
    { mode: "explain" as const, label: "Explain", icon: <BookOpen className="h-3 w-3" />, prompt: "Explain the current simulation step by step." },
    { mode: "simplify" as const, label: "Simplify", icon: <Sparkles className="h-3 w-3" />, prompt: "Simplify this for a beginner." },
    { mode: "harder" as const, label: "Harder", icon: <Brain className="h-3 w-3" />, prompt: "Give me a harder example." },
    { mode: "quiz" as const, label: "Quiz me", icon: <Wand2 className="h-3 w-3" />, prompt: "Quiz me on this topic." },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-xs font-semibold text-white">
        <MessageCircle className="h-3.5 w-3.5 text-violet-400" /> AI Tutor
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-xs text-white/50">
            Ask anything about the current simulation, or use a quick action below.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`rounded-lg px-3 py-2 text-xs ${m.role === "user" ? "ml-6 bg-violet-500/20 text-white" : "mr-6 bg-white/5 text-white/90"}`}>
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="mr-6 inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">
            <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-white/10 p-2">
        <div className="mb-2 flex flex-wrap gap-1">
          {quick.map((q) => (
            <button
              key={q.label}
              onClick={() => send(q.prompt, q.mode)}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/80 transition hover:border-violet-400/50 hover:bg-violet-500/20 disabled:opacity-50"
            >
              {q.icon}{q.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex gap-1"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask…"
            className="h-8 bg-black/40 text-xs text-white placeholder:text-white/40"
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} className="h-8 w-8">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
