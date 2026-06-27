// Procedural geometry generators — interleaved position(3) + normal(3).
export type Mesh = { vertices: Float32Array; indices: Uint32Array };

export function sphere(radius = 1, lat = 24, lon = 36): Mesh {
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= lat; i++) {
    const theta = (i / lat) * Math.PI;
    const st = Math.sin(theta), ct = Math.cos(theta);
    for (let j = 0; j <= lon; j++) {
      const phi = (j / lon) * Math.PI * 2;
      const sp = Math.sin(phi), cp = Math.cos(phi);
      const x = cp * st, y = ct, z = sp * st;
      verts.push(x * radius, y * radius, z * radius, x, y, z);
    }
  }
  for (let i = 0; i < lat; i++) {
    for (let j = 0; j < lon; j++) {
      const a = i * (lon + 1) + j;
      const b = a + lon + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { vertices: new Float32Array(verts), indices: new Uint32Array(idx) };
}

export function cylinder(radius = 1, height = 1, seg = 24): Mesh {
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const x = Math.cos(a), z = Math.sin(a);
    verts.push(x * radius, height / 2, z * radius, x, 0, z);
    verts.push(x * radius, -height / 2, z * radius, x, 0, z);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, c, b, d);
  }
  return { vertices: new Float32Array(verts), indices: new Uint32Array(idx) };
}

// z = f(x,y) on grid in [-range, range].
export function surface(f: (x: number, y: number) => number, range = 2, n = 80): Mesh {
  const verts: number[] = [];
  const idx: number[] = [];
  const h = 1e-3;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const x = -range + (2 * range * i) / n;
      const y = -range + (2 * range * j) / n;
      const z = f(x, y);
      // Normal from gradient: n = normalize(-df/dx, -df/dy, 1)
      const nx = -(f(x + h, y) - z) / h;
      const ny = -(f(x, y + h) - z) / h;
      const nz = 1;
      const l = Math.hypot(nx, ny, nz) || 1;
      verts.push(x, z, y, nx / l, nz / l, ny / l);
    }
  }
  const stride = n + 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * stride + j;
      const b = a + stride;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { vertices: new Float32Array(verts), indices: new Uint32Array(idx) };
}

export function torus(R = 1, r = 0.35, segU = 48, segV = 24): Mesh {
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segU; i++) {
    const u = (i / segU) * Math.PI * 2;
    const cu = Math.cos(u), su = Math.sin(u);
    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * Math.PI * 2;
      const cv = Math.cos(v), sv = Math.sin(v);
      const x = (R + r * cv) * cu;
      const y = r * sv;
      const z = (R + r * cv) * su;
      const nx = cv * cu, ny = sv, nz = cv * su;
      verts.push(x, y, z, nx, ny, nz);
    }
  }
  const s = segV + 1;
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * s + j, b = a + s;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { vertices: new Float32Array(verts), indices: new Uint32Array(idx) };
}
