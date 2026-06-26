import { useEffect, useState } from "react";
import type { SimulationSchemaT } from "@/lib/sim-lab.functions";

type Props = {
  schema: SimulationSchemaT;
  playing: boolean;
  resetKey: number;
  timeScale: number;
};

export function TimelineView({ schema, playing, resetKey, timeScale }: Props) {
  const events = schema.events ?? [];
  const [idx, setIdx] = useState(0);

  useEffect(() => { setIdx(0); }, [resetKey]);
  useEffect(() => {
    if (!playing || events.length === 0) return;
    const ms = 2500 / Math.max(timeScale, 0.1);
    const h = setInterval(() => setIdx((i) => Math.min(i + 1, events.length - 1)), ms);
    return () => clearInterval(h);
  }, [playing, timeScale, events.length]);

  if (events.length === 0) {
    return <div className="flex h-full items-center justify-center text-white/50">No events</div>;
  }

  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-b from-[#0b1020] to-[#08081a] p-4 text-white">
      <div className="mb-3 text-sm font-semibold">{schema.title}</div>
      <div className="relative mb-6 h-2 rounded-full bg-white/10">
        <div className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-[width]" style={{ width: `${((idx + 1) / events.length) * 100}%` }} />
        {events.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 ${i <= idx ? "border-cyan-300 bg-cyan-400" : "border-white/30 bg-black"}`}
            style={{ left: `calc(${(i / Math.max(events.length - 1, 1)) * 100}% - 8px)` }}
            aria-label={`Event ${i + 1}`}
          />
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {events.map((e, i) => (
          <div
            key={i}
            className={`mb-3 rounded-xl border p-4 transition-all ${i === idx ? "border-cyan-400/60 bg-cyan-400/10" : i < idx ? "border-white/10 bg-black/30 opacity-70" : "border-white/5 bg-black/20 opacity-40"}`}
          >
            <div className="mb-1 text-xs font-mono text-cyan-300">{e.date}</div>
            <div className="text-base font-semibold">{e.title}</div>
            <div className="mt-1 text-sm text-white/70">{e.description}</div>
            {e.location && <div className="mt-2 text-[11px] text-white/50">📍 {e.location.label ?? `${e.location.lat.toFixed(2)}, ${e.location.lng.toFixed(2)}`}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
