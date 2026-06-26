import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { evaluate, parse } from "mathjs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Copy, FunctionSquare, Sigma, Calculator } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRESETS = [
  { label: "Fraction", tex: "\\frac{a}{b}" },
  { label: "Square root", tex: "\\sqrt{x}" },
  { label: "Power", tex: "x^{n}" },
  { label: "Subscript", tex: "x_{i}" },
  { label: "Sum", tex: "\\sum_{i=1}^{n} x_i" },
  { label: "Integral", tex: "\\int_{a}^{b} f(x)\\, dx" },
  { label: "Limit", tex: "\\lim_{x\\to\\infty} f(x)" },
  { label: "Matrix", tex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
  { label: "Greek π", tex: "\\pi" },
  { label: "Greek θ", tex: "\\theta" },
  { label: "± / ≤ / ≥", tex: "\\pm \\le \\ge" },
  { label: "Vector", tex: "\\vec{v}" },
];

function LatexPreview({ tex }: { tex: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(tex || "\\,", ref.current, {
        throwOnError: false,
        displayMode: true,
        output: "html",
      });
    } catch {
      /* noop */
    }
  }, [tex]);
  return <div ref={ref} className="min-h-12 overflow-x-auto rounded border bg-card p-3 text-center" />;
}

function LatexEditor() {
  const [tex, setTex] = useState("\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}");
  return (
    <div className="space-y-3">
      <LatexPreview tex={tex} />
      <textarea
        value={tex}
        onChange={(e) => setTex(e.target.value)}
        rows={4}
        className="w-full rounded-md border bg-background p-2 font-mono text-sm"
        placeholder="LaTeX source…"
      />
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <Button key={p.label} size="sm" variant="outline" onClick={() => setTex((t) => `${t} ${p.tex}`)}>
            {p.label}
          </Button>
        ))}
      </div>
      <Button
        size="sm"
        onClick={() => {
          navigator.clipboard.writeText(tex);
          toast.success("LaTeX copied");
        }}
      >
        <Copy className="mr-1 h-3.5 w-3.5" /> Copy LaTeX
      </Button>
    </div>
  );
}

function GraphPlotter() {
  const [expr, setExpr] = useState("sin(x)");
  const [xMin, setXMin] = useState(-10);
  const [xMax, setXMax] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const data = useMemo(() => {
    try {
      const node = parse(expr);
      const fn = node.compile();
      const points: { x: number; y: number | null }[] = [];
      const steps = 200;
      for (let i = 0; i <= steps; i++) {
        const x = xMin + ((xMax - xMin) * i) / steps;
        let y: number | null = null;
        try {
          const v = fn.evaluate({ x });
          if (typeof v === "number" && isFinite(v)) y = v;
        } catch {
          y = null;
        }
        points.push({ x: Number(x.toFixed(3)), y });
      }
      setError(null);
      return points;
    } catch (e) {
      setError((e as Error).message);
      return [];
    }
  }, [expr, xMin, xMax]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[180px] text-xs">
          <span className="mb-1 block text-muted-foreground">f(x) =</span>
          <input
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            className="w-full rounded-md border bg-background p-2 font-mono text-sm"
            placeholder="e.g. sin(x), x^2 - 3, log(x)"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">x min</span>
          <input
            type="number"
            value={xMin}
            onChange={(e) => setXMin(Number(e.target.value))}
            className="w-20 rounded-md border bg-background p-2 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">x max</span>
          <input
            type="number"
            value={xMax}
            onChange={(e) => setXMax(Number(e.target.value))}
            className="w-20 rounded-md border bg-background p-2 text-sm"
          />
        </label>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="h-64 w-full rounded-md border bg-card p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="x" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
            <Line type="monotone" dataKey="y" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Supports +, -, *, /, ^, sqrt, sin, cos, tan, log, ln, exp, abs, pi, e and more.
      </p>
    </div>
  );
}

function CalcPad() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string>("");
  const compute = () => {
    try {
      const r = evaluate(input);
      setResult(String(r));
    } catch (e) {
      setResult((e as Error).message);
    }
  };
  return (
    <div className="space-y-3">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={4}
        placeholder="Type any expression, e.g. (3+4)*2, sqrt(81), sin(pi/2), 5 km to m"
        className="w-full rounded-md border bg-background p-2 font-mono text-sm"
      />
      <Button size="sm" onClick={compute}>
        Evaluate
      </Button>
      {result && (
        <div className="rounded-md border bg-card p-3 font-mono text-sm">= {result}</div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Powered by mathjs: arithmetic, algebra, units, constants, functions.
      </p>
    </div>
  );
}

export function MathTools({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-end bg-black/30 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl border bg-background shadow-2xl sm:rounded-xl"
      >
        <div className="flex items-center justify-between border-b px-4 py-2">
          <h2 className="text-sm font-semibold">Math &amp; Science Tools</h2>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Tabs defaultValue="latex" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="m-3 grid grid-cols-3">
            <TabsTrigger value="latex">
              <Sigma className="mr-1 h-3.5 w-3.5" /> LaTeX
            </TabsTrigger>
            <TabsTrigger value="graph">
              <FunctionSquare className="mr-1 h-3.5 w-3.5" /> Graph
            </TabsTrigger>
            <TabsTrigger value="calc">
              <Calculator className="mr-1 h-3.5 w-3.5" /> Calc
            </TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <TabsContent value="latex" className="mt-0">
              <LatexEditor />
            </TabsContent>
            <TabsContent value="graph" className="mt-0">
              <GraphPlotter />
            </TabsContent>
            <TabsContent value="calc" className="mt-0">
              <CalcPad />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
