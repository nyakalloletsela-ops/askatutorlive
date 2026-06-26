import { useEffect, useRef, useState } from "react";
import type { SimulationSchemaT } from "@/lib/sim-lab.functions";

type Props = {
  schema: SimulationSchemaT;
  playing: boolean;
  resetKey: number;
  timeScale: number;
};

function safeEval(expr: string, x: number, t: number): number {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("x", "t", "Math", `return (${expr});`);
    const v = fn(x, t, Math);
    return Number.isFinite(v) ? v : NaN;
  } catch { return NaN; }
}

export function Scene2D({ schema, playing, resetKey, timeScale }: Props) {
  const g = schema.graph2d;
  const [t, setT] = useState(0);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  useEffect(() => { setT(0); last.current = 0; }, [resetKey]);
  useEffect(() => {
    if (!playing) return;
    const tick = (now: number) => {
      if (!last.current) last.current = now;
      const dt = Math.min((now - last.current) / 1000, 0.05);
      last.current = now;
      setT((v) => v + dt * timeScale);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); last.current = 0; };
  }, [playing, timeScale]);

  if (!g) {
    return <div className="flex h-full items-center justify-center text-white/50">No 2D graph data</div>;
  }

  const W = 1000, H = 600, PAD = 50;
  const xRange = g.xMax - g.xMin, yRange = g.yMax - g.yMin;
  const sx = (x: number) => PAD + ((x - g.xMin) / xRange) * (W - 2 * PAD);
  const sy = (y: number) => H - PAD - ((y - g.yMin) / yRange) * (H - 2 * PAD);

  const samples = 240;
  const curvePaths = g.curves.map((c) => {
    let d = "";
    for (let i = 0; i <= samples; i++) {
      const x = g.xMin + (i / samples) * xRange;
      const y = safeEval(c.expr, x, t);
      if (!Number.isFinite(y)) continue;
      const yc = Math.max(g.yMin - yRange, Math.min(g.yMax + yRange, y));
      d += `${d ? "L" : "M"} ${sx(x).toFixed(1)} ${sy(yc).toFixed(1)} `;
    }
    return { d, color: c.color ?? "#22d3ee", label: c.label };
  });

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0b1020] p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full max-w-5xl">
        <defs>
          <pattern id="grid2d" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid2d)" />
        {/* axes */}
        <line x1={PAD} y1={sy(0)} x2={W - PAD} y2={sy(0)} stroke="#64748b" strokeWidth="1.5" />
        <line x1={sx(0)} y1={PAD} x2={sx(0)} y2={H - PAD} stroke="#64748b" strokeWidth="1.5" />
        <text x={W - PAD + 6} y={sy(0) + 4} fill="#94a3b8" fontSize="14">{g.xLabel ?? "x"}</text>
        <text x={sx(0) + 6} y={PAD - 6} fill="#94a3b8" fontSize="14">{g.yLabel ?? "y"}</text>
        {/* curves */}
        {curvePaths.map((c, i) => (
          <g key={i}>
            <path d={c.d} fill="none" stroke={c.color} strokeWidth="2.5" opacity="0.95" />
            {c.label && (
              <text x={W - PAD - 8} y={PAD + 18 + i * 18} textAnchor="end" fill={c.color} fontSize="13">{c.label}</text>
            )}
          </g>
        ))}
        {/* points */}
        {g.points.map((p, i) => (
          <g key={i}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r={5} fill={p.color ?? "#fde047"} />
            {p.label && <text x={sx(p.x) + 8} y={sy(p.y) - 6} fill="#e2e8f0" fontSize="11">{p.label}</text>}
          </g>
        ))}
        <text x={PAD} y={PAD - 16} fill="#cbd5e1" fontSize="14" fontWeight="600">{schema.title}</text>
        <text x={W - PAD} y={H - 12} textAnchor="end" fill="#64748b" fontSize="11">t = {t.toFixed(2)}s</text>
      </svg>
    </div>
  );
}
