// Custom whiteboard engine — shape model, camera, history.
// No external SDK. All shapes are plain serialisable objects.

export type ShapeBase = {
  id: string;
  z: number;
  page: number;
  /** Lamport-style clock for last-writer-wins conflict resolution. */
  ts: number;
};

export interface PencilShape extends ShapeBase {
  type: "pencil";
  points: number[]; // flat x,y pairs in page coords
  color: string;
  size: number;
}
export interface HighlighterShape extends ShapeBase {
  type: "highlighter";
  points: number[];
  color: string;
  size: number;
}
export interface LineShape extends ShapeBase {
  type: "line";
  x1: number; y1: number; x2: number; y2: number;
  color: string; size: number;
}
export interface ArrowShape extends ShapeBase {
  type: "arrow";
  x1: number; y1: number; x2: number; y2: number;
  color: string; size: number;
}
export interface RectShape extends ShapeBase {
  type: "rect";
  x: number; y: number; w: number; h: number;
  color: string; size: number; fill: string | null;
}
export interface EllipseShape extends ShapeBase {
  type: "ellipse";
  x: number; y: number; w: number; h: number;
  color: string; size: number; fill: string | null;
}
export interface TriangleShape extends ShapeBase {
  type: "triangle";
  x: number; y: number; w: number; h: number;
  color: string; size: number; fill: string | null;
}
export interface TextShape extends ShapeBase {
  type: "text";
  x: number; y: number; w: number; h: number;
  text: string; color: string; size: number;
}
export interface StickyShape extends ShapeBase {
  type: "sticky";
  x: number; y: number; w: number; h: number;
  text: string; bg: string; color: string;
}
export interface ImageShape extends ShapeBase {
  type: "image";
  x: number; y: number; w: number; h: number;
  /** data URL or http URL */
  src: string;
}

export type Shape =
  | PencilShape | HighlighterShape | LineShape | ArrowShape
  | RectShape | EllipseShape | TriangleShape
  | TextShape | StickyShape | ImageShape;

export type ToolId =
  | "select" | "pencil" | "highlighter" | "eraser"
  | "line" | "arrow" | "rect" | "ellipse" | "triangle"
  | "text" | "sticky" | "image" | "hand";

export interface Camera { x: number; y: number; z: number; }

export interface SceneDoc {
  version: 1;
  shapes: Shape[];
  pages: number; // 1-based
}

let _idCounter = 0;
export function nextId(): string {
  _idCounter++;
  return `s_${Date.now().toString(36)}_${_idCounter.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

let _lamport = 0;
export function tick(): number {
  _lamport = Math.max(_lamport + 1, Date.now());
  return _lamport;
}
export function observeTs(ts: number) {
  _lamport = Math.max(_lamport, ts);
}

// ---------- geometry ----------

export function shapeBounds(s: Shape): { x: number; y: number; w: number; h: number } {
  switch (s.type) {
    case "pencil":
    case "highlighter": {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < s.points.length; i += 2) {
        const x = s.points[i], y = s.points[i + 1];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
      const pad = s.size;
      return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
    }
    case "line":
    case "arrow": {
      const minX = Math.min(s.x1, s.x2), maxX = Math.max(s.x1, s.x2);
      const minY = Math.min(s.y1, s.y2), maxY = Math.max(s.y1, s.y2);
      const pad = s.size + 8;
      return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
    }
    default:
      return { x: s.x, y: s.y, w: s.w, h: s.h };
  }
}

export function hitTest(s: Shape, px: number, py: number): boolean {
  const b = shapeBounds(s);
  if (px < b.x || py < b.y || px > b.x + b.w || py > b.y + b.h) return false;
  // Bounding box hit is enough for selection in v1.
  return true;
}

export function translateShape(s: Shape, dx: number, dy: number): Shape {
  switch (s.type) {
    case "pencil":
    case "highlighter": {
      const pts = s.points.slice();
      for (let i = 0; i < pts.length; i += 2) { pts[i] += dx; pts[i + 1] += dy; }
      return { ...s, points: pts };
    }
    case "line":
    case "arrow":
      return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy };
    default:
      return { ...s, x: s.x + dx, y: s.y + dy };
  }
}
