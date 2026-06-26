import { useEffect, useState } from "react";

export function useSessionTimer(startedAt?: number) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = startedAt ?? Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - start), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  return elapsed;
}

export function fmtTimer(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
