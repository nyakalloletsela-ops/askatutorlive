import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SimulationSchemaT } from "@/lib/sim-lab.functions";

type Props = {
  schema: SimulationSchemaT;
  playing: boolean;
  resetKey: number;
  timeScale: number;
  onSelectObject?: (i: number) => void;
};

export function ProcessView({ schema, playing, resetKey, timeScale, onSelectObject }: Props) {
  const steps = schema.steps ?? [];
  const [idx, setIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  useEffect(() => { setIdx(0); setElapsed(0); last.current = 0; }, [resetKey, schema]);

  useEffect(() => {
    if (!playing || steps.length === 0) return;
    const tick = (now: number) => {
      if (!last.current) last.current = now;
      const dt = ((now - last.current) / 1000) * timeScale;
      last.current = now;
      setElapsed((e) => {
        const dur = steps[idx]?.duration ?? 3;
        const next = e + dt;
        if (next >= dur) {
          if (idx < steps.length - 1) { setIdx((i) => i + 1); return 0; }
          return dur;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); last.current = 0; };
  }, [playing, timeScale, idx, steps]);

  if (steps.length === 0) {
    return <div className="flex h-full items-center justify-center text-white/50">No process steps</div>;
  }

  const current = steps[idx];
  const dur = current.duration ?? 3;
  const progress = Math.min(elapsed / dur, 1);
  const highlighted = new Set(current.highlight ?? []);

  return (
    <div className="flex h-full w-full flex-col bg-[#0b1020] p-4">
      <div className="mb-4 flex items-center justify-between text-white/70">
        <div className="text-sm font-semibold text-white">{schema.title}</div>
        <div className="text-xs">Step {idx + 1} / {steps.length}</div>
      </div>

      {/* object row */}
      <div className="flex flex-1 items-center justify-around">
        {schema.objects.map((o, i) => {
          const active = highlighted.has(i);
          return (
            <button
              key={i}
              onClick={() => onSelectObject?.(i)}
              className={`group flex flex-col items-center gap-2 transition-all ${active ? "scale-125" : "opacity-60 hover:opacity-100"}`}
            >
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full text-xs font-semibold text-black shadow-lg transition-shadow"
                style={{ background: o.color ?? "#94a3b8", boxShadow: active ? `0 0 40px ${o.color ?? "#fff"}` : "none" }}
              >
                {o.label?.slice(0, 6) ?? o.type.slice(0, 3)}
              </div>
              <div className="text-[11px] text-white/70">{o.label ?? o.type}</div>
            </button>
          );
        })}
      </div>

      {/* step card */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-black/50 p-4 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-lg font-semibold text-white">{current.title}</div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setIdx((i) => Math.max(0, i - 1)); setElapsed(0); }}
              disabled={idx === 0}
              className="rounded p-1 text-white/70 hover:bg-white/10 disabled:opacity-30"
              aria-label="Previous step"
            ><ChevronLeft className="h-4 w-4" /></button>
            <button
              onClick={() => { setIdx((i) => Math.min(steps.length - 1, i + 1)); setElapsed(0); }}
              disabled={idx >= steps.length - 1}
              className="rounded p-1 text-white/70 hover:bg-white/10 disabled:opacity-30"
              aria-label="Next step"
            ><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="text-sm text-white/80">{current.description}</div>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-violet-400 transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
