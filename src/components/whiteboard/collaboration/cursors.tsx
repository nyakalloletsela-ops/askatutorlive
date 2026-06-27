import type { CursorMsg } from "../canvas/realtime";

interface Props {
  peers: Array<CursorMsg & { lastSeen: number }>;
  project: (px: number, py: number) => { x: number; y: number };
}

export function LiveCursors({ peers, project }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {peers.map((p) => {
        const s = project(p.x, p.y);
        return (
          <div
            key={p.senderId}
            className="absolute -translate-x-0.5 -translate-y-0.5"
            style={{ transform: `translate(${s.x}px, ${s.y}px)` }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 2 L2 14 L6 10 L9 16 L11 15 L8 9 L14 9 Z" fill={p.color} stroke="white" strokeWidth="1" />
            </svg>
            <span
              className="ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
              style={{ backgroundColor: p.color }}
            >
              {p.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
