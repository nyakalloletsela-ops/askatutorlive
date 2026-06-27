// Stroke simplification + smoothing utilities.

/** Ramer–Douglas–Peucker simplification on a flat [x,y,x,y,...] points array. */
export function simplifyPoints(points: number[], tolerance = 0.75): number[] {
  if (points.length <= 6) return points.slice();
  const n = points.length / 2;
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[n - 1] = 1;
  const stack: Array<[number, number]> = [[0, n - 1]];
  const sq = tolerance * tolerance;
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let maxD = 0; let idx = -1;
    const ax = points[i * 2], ay = points[i * 2 + 1];
    const bx = points[j * 2], by = points[j * 2 + 1];
    for (let k = i + 1; k < j; k++) {
      const d = sqSegDist(points[k * 2], points[k * 2 + 1], ax, ay, bx, by);
      if (d > maxD) { maxD = d; idx = k; }
    }
    if (idx !== -1 && maxD > sq) {
      keep[idx] = 1;
      stack.push([i, idx], [idx, j]);
    }
  }
  const out: number[] = [];
  for (let k = 0; k < n; k++) if (keep[k]) out.push(points[k * 2], points[k * 2 + 1]);
  return out;
}

function sqSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  let x = ax, y = ay;
  let dx = bx - ax, dy = by - ay;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = bx; y = by; }
    else if (t > 0) { x = ax + dx * t; y = ay + dy * t; }
  }
  dx = px - x; dy = py - y;
  return dx * dx + dy * dy;
}
