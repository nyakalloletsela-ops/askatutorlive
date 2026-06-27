import { m4, type Mat4, type Vec3 } from "./mat4";
import { sphere, cylinder, surface, torus } from "./geometry";
import type { Renderer, DrawCall, MeshHandle } from "./renderer";

export type Scene = {
  id: string;
  label: string;
  subject: string;
  description: string;
  build: (r: Renderer) => SceneInstance;
};

export type SceneInstance = {
  draw: (time: number) => DrawCall[];
  dispose: () => void;
};

function bond(from: Vec3, to: Vec3, cyl: MeshHandle, color: Vec3, thickness = 0.08): DrawCall {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  const len = Math.hypot(dx, dy, dz);
  // Build rotation that maps +Y to bond direction.
  const ux = dx / len, uy = dy / len, uz = dz / len;
  // Use Rodrigues formula vs Y-axis.
  const ax = -uz, ay = 0, az = ux;
  const al = Math.hypot(ax, ay, az);
  let model = m4.identity();
  model[12] = (from[0] + to[0]) / 2;
  model[13] = (from[1] + to[1]) / 2;
  model[14] = (from[2] + to[2]) / 2;
  if (al > 1e-6) {
    const angle = Math.acos(Math.max(-1, Math.min(1, uy)));
    const c = Math.cos(angle), s = Math.sin(angle), C = 1 - c;
    const nx = ax / al, ny = ay / al, nz = az / al;
    const R = new Float32Array(16);
    R[0] = c + nx * nx * C;        R[1] = ny * nx * C + nz * s;  R[2] = nz * nx * C - ny * s;
    R[4] = nx * ny * C - nz * s;   R[5] = c + ny * ny * C;       R[6] = nz * ny * C + nx * s;
    R[8] = nx * nz * C + ny * s;   R[9] = ny * nz * C - nx * s;  R[10] = c + nz * nz * C;
    R[15] = 1;
    R[12] = model[12]; R[13] = model[13]; R[14] = model[14];
    model = R;
  }
  model = m4.scale(model, [thickness, len, thickness]);
  return { mesh: cyl, model, color };
}

export const SCENES: Scene[] = [
  {
    id: "water-molecule",
    label: "H₂O Molecule",
    subject: "Chemistry",
    description: "Bent geometry of water, 104.5° H–O–H bond angle. Drag to rotate, scroll to zoom.",
    build: (r) => {
      const sph = r.upload(sphere(1, 24, 36));
      const cyl = r.upload(cylinder(1, 1, 24));
      const ang = (104.5 * Math.PI) / 180 / 2;
      const O: Vec3 = [0, 0, 0];
      const H1: Vec3 = [Math.sin(ang) * 1.4, -Math.cos(ang) * 1.4, 0];
      const H2: Vec3 = [-Math.sin(ang) * 1.4, -Math.cos(ang) * 1.4, 0];
      return {
        draw: (t) => {
          const spin = m4.rotateY(m4.identity(), t * 0.4);
          const place = (p: Vec3, s: number): Mat4 => m4.scale(m4.translate(spin, p), [s, s, s]);
          const calls: DrawCall[] = [
            { mesh: sph, model: place(O, 0.55), color: [0.85, 0.25, 0.25] },
            { mesh: sph, model: place(H1, 0.32), color: [0.92, 0.92, 0.95] },
            { mesh: sph, model: place(H2, 0.32), color: [0.92, 0.92, 0.95] },
          ];
          const b1 = bond(O, H1, cyl, [0.7, 0.7, 0.8]);
          const b2 = bond(O, H2, cyl, [0.7, 0.7, 0.8]);
          b1.model = m4.multiply(spin, b1.model);
          b2.model = m4.multiply(spin, b2.model);
          calls.push(b1, b2);
          return calls;
        },
        dispose: () => { sph.dispose(); cyl.dispose(); },
      };
    },
  },
  {
    id: "saddle",
    label: "Saddle z = x² − y²",
    subject: "Calculus",
    description: "Classic hyperbolic paraboloid. A saddle point at the origin.",
    build: (r) => {
      const mesh = r.upload(surface((x, y) => 0.5 * (x * x - y * y), 2.5, 90));
      return {
        draw: () => [{ mesh, model: m4.identity(), color: [0.35, 0.65, 0.95] }],
        dispose: () => mesh.dispose(),
      };
    },
  },
  {
    id: "gaussian",
    label: "Gaussian Bump",
    subject: "Statistics",
    description: "Bivariate normal density surface — peaks at the mean.",
    build: (r) => {
      const mesh = r.upload(surface((x, y) => Math.exp(-(x * x + y * y) * 0.6) * 1.6, 2.5, 90));
      return {
        draw: () => [{ mesh, model: m4.identity(), color: [0.55, 0.85, 0.5] }],
        dispose: () => mesh.dispose(),
      };
    },
  },
  {
    id: "ripple",
    label: "Wave Interference",
    subject: "Physics",
    description: "Two-source wave interference pattern, animated in time.",
    build: (r) => {
      // Pre-build flat grid; animate via per-frame upload would be costly,
      // so we build several keyframes and cycle — simple but fluid enough.
      const FRAMES = 24;
      const meshes: MeshHandle[] = [];
      for (let k = 0; k < FRAMES; k++) {
        const t = (k / FRAMES) * Math.PI * 2;
        meshes.push(
          r.upload(
            surface((x, y) => {
              const r1 = Math.hypot(x - 1, y);
              const r2 = Math.hypot(x + 1, y);
              return 0.35 * (Math.cos(3 * r1 - t) / (1 + r1) + Math.cos(3 * r2 - t) / (1 + r2));
            }, 2.5, 70),
          ),
        );
      }
      return {
        draw: (time) => {
          const idx = Math.floor((time * 4) % FRAMES);
          return [{ mesh: meshes[idx], model: m4.identity(), color: [0.45, 0.6, 0.95] }];
        },
        dispose: () => meshes.forEach((m) => m.dispose()),
      };
    },
  },
  {
    id: "torus",
    label: "Torus (Genus 1)",
    subject: "Topology",
    description: "A spinning torus — a fundamental compact orientable surface.",
    build: (r) => {
      const mesh = r.upload(torus(1.2, 0.45, 64, 32));
      return {
        draw: (t) => [
          {
            mesh,
            model: m4.rotateX(m4.rotateY(m4.identity(), t * 0.6), 0.6),
            color: [0.95, 0.65, 0.3],
          },
        ],
        dispose: () => mesh.dispose(),
      };
    },
  },
  {
    id: "methane",
    label: "CH₄ Methane",
    subject: "Chemistry",
    description: "Tetrahedral geometry, 109.5° H–C–H bond angle.",
    build: (r) => {
      const sph = r.upload(sphere(1, 24, 36));
      const cyl = r.upload(cylinder(1, 1, 24));
      const d = 1.3;
      const H: Vec3[] = [
        [d, d, d], [-d, -d, d], [-d, d, -d], [d, -d, -d],
      ].map(([x, y, z]) => {
        const l = Math.hypot(x, y, z); return [x / l * d, y / l * d, z / l * d];
      });
      const C: Vec3 = [0, 0, 0];
      return {
        draw: (t) => {
          const spin = m4.rotateY(m4.identity(), t * 0.35);
          const calls: DrawCall[] = [
            { mesh: sph, model: m4.scale(spin, [0.55, 0.55, 0.55]), color: [0.2, 0.2, 0.2] },
          ];
          for (const h of H) {
            const tr = m4.translate(spin, h);
            calls.push({ mesh: sph, model: m4.scale(tr, [0.32, 0.32, 0.32]), color: [0.92, 0.92, 0.95] });
            const b = bond(C, h, cyl, [0.7, 0.7, 0.8]);
            b.model = m4.multiply(spin, b.model);
            calls.push(b);
          }
          return calls;
        },
        dispose: () => { sph.dispose(); cyl.dispose(); },
      };
    },
  },
];
