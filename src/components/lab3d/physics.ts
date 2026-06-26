import type { SimulationSchemaT } from "@/lib/sim-lab.functions";

export type Vec3 = [number, number, number];

export type SimObjectState = {
  index: number;
  type: string;
  basePosition: Vec3;
  position: Vec3;
  velocity: Vec3;
  mass: number;
  radius: number;
  size: Vec3;
  color: string;
  label?: string;
  fixed: boolean;
};

const PALETTE = ["#7c3aed", "#06b6d4", "#22d3ee", "#f472b6", "#facc15", "#34d399", "#fb923c"];

const FIXED_TYPES = new Set(["wall", "plane", "axis", "organ", "node", "graph"]);

function toVec3(v: unknown, fallback: Vec3): Vec3 {
  if (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number")) return v as Vec3;
  if (typeof v === "number") return [v, 0, 0];
  return fallback;
}
function toSize(v: unknown, fallback: Vec3): Vec3 {
  if (typeof v === "number") return [v, v, v];
  return toVec3(v, fallback);
}

export function buildInitialState(schema: SimulationSchemaT): SimObjectState[] {
  return schema.objects.map((o, i) => {
    const type = (o.type || "cube").toLowerCase();
    return {
      index: i,
      type,
      basePosition: toVec3((o as any).position, [i * 2 - schema.objects.length, type === "plane" || type === "axis" ? 0 : 1, 0]),
      position: toVec3((o as any).position, [i * 2 - schema.objects.length, type === "plane" || type === "axis" ? 0 : 1, 0]),
      velocity: toVec3((o as any).velocity, [0, 0, 0]),
      mass: typeof (o as any).mass === "number" ? (o as any).mass : 1,
      radius: typeof (o as any).radius === "number" ? (o as any).radius : type === "particle" || type === "flow" || type === "curve" ? 0.35 : 0.7,
      size: toSize(
        (o as any).size,
        type === "wall"
          ? [0.5, 4, 6]
          : type === "plane"
            ? [40, 0.1, 40]
            : type === "axis"
              ? [10, 0.06, 10]
            : type === "car"
              ? [2, 1, 1]
              : type === "graph"
                ? [7, 0.08, 5]
              : [1, 1, 1],
      ),
      color: (o as any).color || PALETTE[i % PALETTE.length],
      label: (o as any).label,
      fixed: !!(o as any).fixed || FIXED_TYPES.has(type),
    };
  });
}

export function stepSim(state: SimObjectState[], rules: string[], dt: number) {
  const hasGravity = rules.includes("gravity");
  const hasCollision = rules.includes("collision_response");
  const hasFlow = rules.includes("flow_dynamics") || rules.includes("market_flow") || rules.includes("semantic_flow");
  const hasOrbit = rules.includes("orbital_motion") || rules.includes("chemical_bonding");
  const hasGrowth = rules.includes("growth_cycle");
  const hasGraph = rules.includes("graph_transform");
  const g = 9.81;
  const t = performance.now() * 0.001;

  for (const o of state) {
    if (o.fixed) {
      if (hasGrowth && (o.type === "organ" || o.type === "node")) {
        o.position[1] = o.basePosition[1] + Math.sin(t * 1.6 + o.index) * 0.08;
      }
      continue;
    }
    if (hasGravity) o.velocity[1] -= g * dt;
    if (hasOrbit) {
      const angle = t * (0.6 + o.index * 0.05) + o.index;
      const orbit = 0.35 + o.index * 0.04;
      o.position[0] += Math.sin(angle) * orbit * dt;
      o.position[2] += Math.cos(angle) * orbit * dt;
    }
    if (hasGraph && (o.type === "curve" || o.type === "particle")) {
      o.position[1] = Math.max(0.35, o.basePosition[1] + Math.sin(t * 1.4 + o.index) * 0.8);
    }
    if (hasGrowth && (o.type === "cell" || o.type === "dna" || o.type === "particle")) {
      o.position[1] = Math.max(o.radius, o.position[1] + Math.sin(t * 2 + o.index) * 0.08 * dt);
    }
    if (hasFlow) {
      // gentle circular drift
      o.velocity[0] += Math.sin(t * 0.5 + o.index) * 0.05 * dt;
      o.velocity[2] += Math.cos(t * 0.5 + o.index) * 0.05 * dt;
    }
    o.position[0] += o.velocity[0] * dt;
    o.position[1] += o.velocity[1] * dt;
    o.position[2] += o.velocity[2] * dt;

    // floor
    if (o.position[1] < o.radius) {
      o.position[1] = o.radius;
      if (o.velocity[1] < 0) o.velocity[1] = -o.velocity[1] * 0.5;
    }
  }

  if (hasCollision) {
    for (let i = 0; i < state.length; i++) {
      for (let j = i + 1; j < state.length; j++) {
        const a = state[i];
        const b = state[j];
        const dx = b.position[0] - a.position[0];
        const dy = b.position[1] - a.position[1];
        const dz = b.position[2] - a.position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const minD = (a.radius + b.radius) * 0.9;
        if (dist > 0 && dist < minD) {
          const nx = dx / dist, ny = dy / dist, nz = dz / dist;
          const overlap = minD - dist;
          if (!a.fixed) {
            a.position[0] -= nx * overlap * 0.5;
            a.position[1] -= ny * overlap * 0.5;
            a.position[2] -= nz * overlap * 0.5;
          }
          if (!b.fixed) {
            b.position[0] += nx * overlap * 0.5;
            b.position[1] += ny * overlap * 0.5;
            b.position[2] += nz * overlap * 0.5;
          }
          // simple elastic-ish exchange along normal (Newton 2nd / collision_response)
          const avn = a.velocity[0] * nx + a.velocity[1] * ny + a.velocity[2] * nz;
          const bvn = b.velocity[0] * nx + b.velocity[1] * ny + b.velocity[2] * nz;
          const ma = a.fixed ? Infinity : a.mass;
          const mb = b.fixed ? Infinity : b.mass;
          const newAvn = (avn * (ma - mb) + 2 * mb * bvn) / (ma + mb);
          const newBvn = (bvn * (mb - ma) + 2 * ma * avn) / (ma + mb);
          if (!a.fixed) {
            a.velocity[0] += (newAvn - avn) * nx;
            a.velocity[1] += (newAvn - avn) * ny;
            a.velocity[2] += (newAvn - avn) * nz;
          }
          if (!b.fixed) {
            b.velocity[0] += (newBvn - bvn) * nx;
            b.velocity[1] += (newBvn - bvn) * ny;
            b.velocity[2] += (newBvn - bvn) * nz;
          }
        }
      }
    }
  }
}
