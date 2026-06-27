// Minimal column-major mat4 helpers — no dependencies.
export type Mat4 = Float32Array;
export type Vec3 = [number, number, number];

export const m4 = {
  identity(): Mat4 {
    const o = new Float32Array(16);
    o[0] = o[5] = o[10] = o[15] = 1;
    return o;
  },
  perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    const o = new Float32Array(16);
    o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf;
    o[11] = -1; o[14] = 2 * far * near * nf;
    return o;
  },
  lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
    const [ex, ey, ez] = eye;
    let zx = ex - target[0], zy = ey - target[1], zz = ez - target[2];
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    const o = new Float32Array(16);
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * ex + xy * ey + xz * ez);
    o[13] = -(yx * ex + yy * ey + yz * ez);
    o[14] = -(zx * ex + zy * ey + zz * ez);
    o[15] = 1;
    return o;
  },
  multiply(a: Mat4, b: Mat4): Mat4 {
    const o = new Float32Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      o[i * 4 + j] = s;
    }
    return o;
  },
  translate(m: Mat4, t: Vec3): Mat4 {
    const o = new Float32Array(m);
    o[12] += m[0] * t[0] + m[4] * t[1] + m[8] * t[2];
    o[13] += m[1] * t[0] + m[5] * t[1] + m[9] * t[2];
    o[14] += m[2] * t[0] + m[6] * t[1] + m[10] * t[2];
    return o;
  },
  scale(m: Mat4, s: Vec3): Mat4 {
    const o = new Float32Array(m);
    o[0] *= s[0]; o[1] *= s[0]; o[2] *= s[0];
    o[4] *= s[1]; o[5] *= s[1]; o[6] *= s[1];
    o[8] *= s[2]; o[9] *= s[2]; o[10] *= s[2];
    return o;
  },
  rotateY(m: Mat4, a: number): Mat4 {
    const c = Math.cos(a), s = Math.sin(a);
    const o = new Float32Array(m);
    const m0 = m[0], m1 = m[1], m2 = m[2];
    const m8 = m[8], m9 = m[9], m10 = m[10];
    o[0] = m0 * c - m8 * s; o[1] = m1 * c - m9 * s; o[2] = m2 * c - m10 * s;
    o[8] = m0 * s + m8 * c; o[9] = m1 * s + m9 * c; o[10] = m2 * s + m10 * c;
    return o;
  },
  rotateX(m: Mat4, a: number): Mat4 {
    const c = Math.cos(a), s = Math.sin(a);
    const o = new Float32Array(m);
    const m4_ = m[4], m5 = m[5], m6 = m[6];
    const m8 = m[8], m9 = m[9], m10 = m[10];
    o[4] = m4_ * c + m8 * s; o[5] = m5 * c + m9 * s; o[6] = m6 * c + m10 * s;
    o[8] = m8 * c - m4_ * s; o[9] = m9 * c - m5 * s; o[10] = m10 * c - m6 * s;
    return o;
  },
};
