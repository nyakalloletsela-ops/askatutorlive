import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Code, Play, Sparkles, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { aiToolRun } from "@/lib/ai-tools.functions";

export const Route = createFileRoute("/_authenticated/code")({
  component: CodePlayground,
  head: () => ({
    meta: [
      { title: "Coding Playground — Ask A Tutor Live" },
      { name: "description", content: "In-browser JavaScript playground with an AI code helper for learners." },
    ],
  }),
});

const STARTER = `// Welcome to the Ask A Tutor coding playground.
// Write JavaScript and click Run.
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

for (let i = 1; i <= 6; i++) {
  console.log(i, "! =", factorial(i));
}
`;

function CodePlayground() {
  const [code, setCode] = useState(STARTER);
  const [output, setOutput] = useState<string>("");
  const [aiBusy, setAiBusy] = useState(false);
  const run = useServerFn(aiToolRun);
  const outRef = useRef<HTMLPreElement>(null);

  const execute = () => {
    const logs: string[] = [];
    const fakeConsole = {
      log: (...a: unknown[]) => logs.push(a.map(fmt).join(" ")),
      error: (...a: unknown[]) => logs.push("⚠ " + a.map(fmt).join(" ")),
      warn: (...a: unknown[]) => logs.push("⚠ " + a.map(fmt).join(" ")),
    };
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function("console", code);
      const result = fn(fakeConsole);
      if (result !== undefined) logs.push("→ " + fmt(result));
    } catch (e) {
      logs.push("✗ " + (e instanceof Error ? `${e.name}: ${e.message}` : String(e)));
    }
    setOutput(logs.join("\n") || "(no output)");
    setTimeout(() => outRef.current?.scrollTo({ top: outRef.current.scrollHeight }), 0);
  };

  const askAi = async () => {
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const { reply } = await run({
        data: {
          tool: "code_helper",
          prompt: `Code:\n\`\`\`js\n${code}\n\`\`\`\n\nOutput / error:\n${output || "(none)"}\n\nHelp me understand what's wrong and how to fix it.`,
        },
      });
      setOutput((prev) => (prev ? prev + "\n\n" : "") + "🤖 AI Helper:\n" + reply);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI error");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-3 px-4 py-6 pb-24 md:pb-8">
      <div className="flex items-center gap-2">
        <Code className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Coding Playground</h1>
        <Badge variant="secondary" className="ml-auto">JavaScript</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Write code, run it instantly in your browser, and ask the AI helper when stuck.
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Editor</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setCode(STARTER)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Reset
                </Button>
                <Button size="sm" onClick={execute} className="bg-aurora text-white hover:opacity-90">
                  <Play className="mr-1 h-3.5 w-3.5" /> Run
                </Button>
              </div>
            </div>
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="min-h-[420px] resize-none border-0 bg-[hsl(220_30%_8%)] font-mono text-sm leading-relaxed text-emerald-200 focus-visible:ring-0"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Console</span>
              <Button size="sm" variant="outline" onClick={askAi} disabled={aiBusy}>
                {aiBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
                Ask AI
              </Button>
            </div>
            <pre
              ref={outRef}
              className="h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-[hsl(220_30%_8%)] p-3 font-mono text-sm leading-relaxed text-foreground/90"
            >
              {output || "Click Run to see output here."}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function fmt(v: unknown): string {
  if (typeof v === "string") return v;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}
