import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runAgent } from "@/lib/agents/run-agent.functions";
import { toast } from "sonner";

export type AgentRole = "tutor" | "math" | "diagram" | "whiteboard" | "notes";

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Multi-agent chat hook. Each call to send() picks an agent role and runs it
 * against the Lovable AI Gateway. Output is markdown with KaTeX + Mermaid —
 * render it with <SmartMarkdown/>.
 */
export function useAgent(defaultRole: AgentRole = "tutor") {
  const run = useServerFn(runAgent);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [role, setRole] = useState<AgentRole>(defaultRole);

  const send = useCallback(
    async (text: string, opts?: { role?: AgentRole }) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const useRole = opts?.role ?? role;
      const next: AgentMessage[] = [...messages, { role: "user", content: trimmed }];
      setMessages(next);
      setPending(true);
      try {
        const { text: reply } = await run({ data: { role: useRole, messages: next } });
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        return reply;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI request failed";
        toast.error(msg);
        // Roll back the user message so they can retry
        setMessages(messages);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [messages, role, run],
  );

  const reset = useCallback(() => setMessages([]), []);

  return { messages, pending, role, setRole, send, reset };
}

/** One-shot helper for non-chat callers (whiteboard convert, notes generator). */
export function useRunAgentOnce() {
  const run = useServerFn(runAgent);
  return useCallback(
    async (role: AgentRole, prompt: string) => {
      const { text } = await run({
        data: { role, messages: [{ role: "user", content: prompt }] },
      });
      return text;
    },
    [run],
  );
}
