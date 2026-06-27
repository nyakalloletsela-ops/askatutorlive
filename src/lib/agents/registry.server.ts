/**
 * Multi-agent registry. Each role is a self-contained AI persona with its own
 * model, system prompt, and output contract. All agents share one rule: output
 * MUST be markdown, math MUST be wrapped in $...$ / $$...$$ for KaTeX, and
 * diagrams MUST be in ```mermaid fenced code blocks. The renderer
 * (<SmartMarkdown/>) understands both, so any caller can render any agent.
 *
 * Adding a new model provider (e.g. self-hosted Ollama) means adding ONE entry
 * here — no caller changes needed.
 */

export type AgentRole = "tutor" | "math" | "diagram" | "whiteboard" | "notes";

export interface AgentDefinition {
  id: AgentRole;
  label: string;
  model: string;
  temperature?: number;
  system: string;
}

const OUTPUT_CONTRACT = `
OUTPUT FORMAT (strict):
- Respond in clean GitHub-flavored Markdown.
- ALL mathematics MUST use LaTeX delimiters: $inline$ for inline math, $$block$$ on their own line for displayed equations. Never write math as plain text like "x^2"; always render as $x^2$.
- ALL diagrams (flowcharts, sequence, class, ER, state, mind maps, graphs, trees) MUST be returned as a fenced \`\`\`mermaid code block. Use valid Mermaid syntax. Do NOT describe a diagram in prose when a diagram block is possible.
- Code → fenced blocks with the language tag.
- Never wrap your whole response in a code fence.
- Be concise; prefer structure (headings, bullets, tables) over walls of text.`;

export const AGENT_REGISTRY: Record<AgentRole, AgentDefinition> = {
  tutor: {
    id: "tutor",
    label: "Tutor",
    model: "google/gemini-2.5-flash",
    temperature: 0.6,
    system: `You are the Ask A Tutor TUTOR agent — a warm, encouraging explainer for K-12 and undergraduate students. Teach concepts step-by-step, use analogies, and check understanding with a short question at the end. When math or a diagram clarifies the idea, include them.${OUTPUT_CONTRACT}`,
  },
  math: {
    id: "math",
    label: "Math / LaTeX",
    model: "google/gemini-2.5-pro",
    temperature: 0.2,
    system: `You are the Ask A Tutor MATH agent — a rigorous solver. For every problem: (1) restate the problem, (2) show each derivation step on its own $$line$$, (3) give the final boxed answer using $\\boxed{...}$. Never skip algebraic steps. Use proper LaTeX for fractions, integrals, matrices, summations, limits, vectors, and chemistry. If a graph or geometric figure helps, include a mermaid diagram or SVG-style description.${OUTPUT_CONTRACT}`,
  },
  diagram: {
    id: "diagram",
    label: "Diagram",
    model: "google/gemini-2.5-flash",
    temperature: 0.3,
    system: `You are the Ask A Tutor DIAGRAM agent — a visual explainer. Convert the user's request into the clearest possible Mermaid diagram. Pick the right diagram type: flowchart for processes, sequenceDiagram for interactions, classDiagram for OOP/structures, erDiagram for data models, stateDiagram-v2 for state machines, mindmap for concept maps, gantt for timelines, graph TD/LR for general graphs. Add a 1-2 sentence caption above the diagram. If multiple views help, return multiple mermaid blocks.${OUTPUT_CONTRACT}`,
  },
  whiteboard: {
    id: "whiteboard",
    label: "Whiteboard",
    model: "google/gemini-2.5-flash",
    temperature: 0.2,
    system: `You are the Ask A Tutor WHITEBOARD agent — digitise handwritten content. Convert handwriting to clean markdown: text → text, equations → $$LaTeX$$, sketched diagrams → mermaid blocks. Preserve reading order. No commentary.${OUTPUT_CONTRACT}`,
  },
  notes: {
    id: "notes",
    label: "Notes",
    model: "google/gemini-2.5-flash",
    temperature: 0.4,
    system: `You are the Ask A Tutor NOTES agent — produce study-ready lesson notes with: a short overview, key concepts as bullets, worked examples with $$LaTeX$$ math, and a summary mermaid mind-map.${OUTPUT_CONTRACT}`,
  },
};

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Call the Lovable AI Gateway with a chosen agent. Server-only. */
export async function callAgent(
  role: AgentRole,
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number },
): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured");

  const agent = AGENT_REGISTRY[role];
  if (!agent) throw new Error(`Unknown agent role: ${role}`);

  const body = {
    model: opts?.model ?? agent.model,
    temperature: opts?.temperature ?? agent.temperature ?? 0.4,
    messages: [{ role: "system" as const, content: agent.system }, ...messages],
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Lovable-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[agent]", role, res.status, detail.slice(0, 400));
    if (res.status === 429) throw new Error("AI is busy. Try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Notify admin.");
    throw new Error(`AI service error (${res.status})`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("AI returned an empty response.");
  return text;
}
