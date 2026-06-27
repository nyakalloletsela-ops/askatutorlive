import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MsgSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});

export const simLabChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      messages: z.array(MsgSchema).min(1).max(20),
      context: z
        .object({
          title: z.string().optional(),
          subject: z.string().optional(),
          summary: z.string().optional(),
          visualization: z.string().optional(),
          objects: z.array(z.object({ label: z.string().optional(), type: z.string().optional() })).optional(),
        })
        .nullable()
        .optional(),
      mode: z.enum(["explain", "simplify", "harder", "quiz", "free"]).default("free"),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const ctx = data.context;
    const ctxBlob = ctx
      ? `Current simulation:\n- Title: ${ctx.title ?? "?"}\n- Subject: ${ctx.subject ?? "?"}\n- View: ${ctx.visualization ?? "?"}\n- Summary: ${ctx.summary ?? ""}\n- Objects: ${(ctx.objects ?? []).map((o) => o.label || o.type).filter(Boolean).join(", ")}`
      : "No active simulation.";

    const modeHint =
      data.mode === "simplify" ? "Re-explain in the simplest possible terms (ELI10)."
      : data.mode === "harder" ? "Give a harder, deeper follow-up question or example."
      : data.mode === "explain" ? "Explain clearly with concrete examples."
      : data.mode === "quiz" ? "Ask the student ONE short question to test understanding. Wait for their reply."
      : "Be a supportive tutor.";

    const sys = `You are AskATutorLive's in-lab AI tutor. ${modeHint}
Keep replies short (under 120 words), friendly, and grounded in the active simulation when available.
${ctxBlob}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, ...data.messages],
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Too many requests — slow down.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI error ${res.status}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = json.choices?.[0]?.message?.content ?? "";
    return { reply };
  });
