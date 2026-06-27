import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  imageDataUrl: z
    .string()
    .min(40)
    .max(12_000_000)
    .regex(/^data:image\/(png|jpe?g|webp);base64,/i, "Must be a base64 image data URL"),
});

export const whiteboardConvert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const system = `You are an expert whiteboard OCR digitiser for live mathematics, science, engineering and chemistry tutoring.
Reproduce the page as a clean, polished digital version with ZERO handwritten elements remaining.

Strict output rules:
1. Plain handwriting → output plain text, preserving reading order and line breaks.
2. Every mathematical expression, equation, formula, proof line, chemical equation or physics formula MUST be valid KaTeX-compatible LaTeX wrapped in $$...$$ on its own line.
3. Recognise and correctly digitise all math notation, including integrals (single/double/triple/contour, definite and indefinite), derivatives, partial derivatives, limits, sums, products, fractions, radicals, exponents, subscripts, vectors, matrices, determinants, piecewise functions, logarithms, trig functions, inequalities, set notation, probability/statistics notation, geometry notation, coordinate graphs and units.
4. Integral examples: handwritten ∫ f(x) dx → $$\\int f(x)\\,dx$$; ∫_a^b f(x) dx → $$\\int_{a}^{b} f(x)\\,dx$$; ∬_D → $$\\iint_D$$. Never leave an integral as plain text.
5. Diagrams, sketches, graphs, shapes, arrows, chemistry apparatus, geometric figures → redraw them as inline SVG using <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H" width="W" height="H">…</svg>. Use precise lines with stroke="#0f172a", stroke-width="2", fill="none" unless filled. Preserve proportions and labels.
6. Do NOT replace a visual drawing with a written description; every diagram must remain visual.
7. Preserve reading order by interleaving plain text, $$LaTeX$$ blocks and <svg> blocks exactly where they appear.
8. Do NOT add commentary, headings, Markdown code fences, explanations, or labels such as "LaTeX:". Output only the digitised content.
9. If handwriting is ambiguous, make the most mathematically plausible best-effort conversion instead of refusing.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Digitise this whiteboard. Pay special attention to all mathematical notation, especially integrals and calculus symbols. Return only plain text, $$LaTeX$$ math blocks, and inline SVG diagrams.",
              },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("whiteboardConvert AI error", res.status, detail.slice(0, 500));
      if (res.status === 429) throw new Error("Too many requests — please slow down.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please notify the admin.");
      throw new Error(`AI service error (${res.status})`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new Error("AI returned an empty response. Try again.");
    return { text };
  });
