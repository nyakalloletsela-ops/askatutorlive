import type { SimulationSchemaT } from "@/lib/sim-lab.functions";

type Props = { schema: SimulationSchemaT };

// Simple equirectangular projection
function project(lat: number, lng: number, W: number, H: number) {
  const x = ((lng + 180) / 360) * W;
  const y = ((90 - lat) / 180) * H;
  return [x, y] as const;
}

export function GeoView({ schema }: Props) {
  const g = schema.geo;
  if (!g) return <div className="flex h-full items-center justify-center text-white/50">No geo data</div>;
  const W = 1000, H = 500;

  return (
    <div className="flex h-full w-full flex-col bg-[#0b1020] p-4 text-white">
      <div className="mb-2 text-sm font-semibold">{schema.title}</div>
      <div className="flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#06091a]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
          {/* simple grid as stand-in for continents */}
          <defs>
            <pattern id="globe-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.7" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="#0f172a" />
          <rect width={W} height={H} fill="url(#globe-grid)" />
          {/* equator + prime meridian */}
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#334155" strokeDasharray="4 6" />
          <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="#334155" strokeDasharray="4 6" />

          {/* region polygons */}
          {g.regions.map((r, i) => {
            if (!r.coords || r.coords.length < 3) return null;
            const pts = r.coords.map(([lng, lat]) => project(lat, lng, W, H)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
            return (
              <polygon
                key={`poly-${i}`}
                points={pts}
                fill={(r.color ?? "#22d3ee") + "44"}
                stroke={r.color ?? "#22d3ee"}
                strokeWidth="1.5"
              />
            );
          })}

          {/* pins */}
          {g.regions.map((r, i) => {
            if (!r.pin) return null;
            const [x, y] = project(r.pin.lat, r.pin.lng, W, H);
            return (
              <g key={`pin-${i}`}>
                <circle cx={x} cy={y} r={10} fill={r.color ?? "#fde047"} opacity={0.3}>
                  <animate attributeName="r" from="6" to="18" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={x} cy={y} r={5} fill={r.color ?? "#fde047"} stroke="#000" strokeWidth="1" />
                <text x={x + 8} y={y - 8} fill="#e2e8f0" fontSize="12" fontWeight="600">{r.label ?? r.name}</text>
                {r.value !== undefined && <text x={x + 8} y={y + 6} fill="#94a3b8" fontSize="10">{r.value}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      {g.regions.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          {g.regions.map((r, i) => (
            <div key={i} className="rounded border border-white/10 bg-black/30 p-2 text-xs">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: r.color ?? "#94a3b8" }} /> <span className="font-semibold">{r.name}</span></div>
              {r.label && <div className="mt-1 text-white/60">{r.label}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
