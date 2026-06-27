import jsPDF from "jspdf";
import type { Shape } from "./engine";
import { render } from "./renderer";

function bounds(shapes: Shape[]) {
  if (!shapes.length) return { x: 0, y: 0, w: 1024, h: 768 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) {
    let b: { x: number; y: number; w: number; h: number };
    if (s.type === "pencil" || s.type === "highlighter") {
      let xmn = Infinity, ymn = Infinity, xmx = -Infinity, ymx = -Infinity;
      for (let i = 0; i < s.points.length; i += 2) {
        const x = s.points[i], y = s.points[i + 1];
        if (x < xmn) xmn = x; if (x > xmx) xmx = x;
        if (y < ymn) ymn = y; if (y > ymx) ymx = y;
      }
      const p = s.size;
      b = { x: xmn - p, y: ymn - p, w: xmx - xmn + p * 2, h: ymx - ymn + p * 2 };
    } else if (s.type === "line" || s.type === "arrow") {
      const xmn = Math.min(s.x1, s.x2), xmx = Math.max(s.x1, s.x2);
      const ymn = Math.min(s.y1, s.y2), ymx = Math.max(s.y1, s.y2);
      const p = s.size + 8;
      b = { x: xmn - p, y: ymn - p, w: xmx - xmn + p * 2, h: ymx - ymn + p * 2 };
    } else {
      b = { x: s.x, y: s.y, w: s.w, h: s.h };
    }
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  }
  return { x: minX - 24, y: minY - 24, w: maxX - minX + 48, h: maxY - minY + 48 };
}

async function renderToCanvas(shapes: Shape[], imageCache: Map<string, HTMLImageElement>, scale = 2): Promise<HTMLCanvasElement> {
  const b = bounds(shapes);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(b.w * scale));
  canvas.height = Math.max(1, Math.ceil(b.h * scale));
  const ctx = canvas.getContext("2d")!;
  render({
    ctx, shapes, camera: { x: -b.x * scale, y: -b.y * scale, z: scale },
    width: canvas.width, height: canvas.height, dpr: 1, grid: "off",
    imageCache,
  });
  return canvas;
}

export async function exportPNG(shapes: Shape[], imageCache: Map<string, HTMLImageElement>, filename = "whiteboard.png") {
  const canvas = await renderToCanvas(shapes, imageCache);
  canvas.toBlob((blob) => { if (blob) downloadBlob(blob, filename); }, "image/png");
}
export async function exportJPG(shapes: Shape[], imageCache: Map<string, HTMLImageElement>, filename = "whiteboard.jpg") {
  const canvas = await renderToCanvas(shapes, imageCache);
  canvas.toBlob((blob) => { if (blob) downloadBlob(blob, filename); }, "image/jpeg", 0.92);
}
export async function exportPDF(shapes: Shape[], imageCache: Map<string, HTMLImageElement>, filename = "whiteboard.pdf") {
  const canvas = await renderToCanvas(shapes, imageCache);
  const w = canvas.width, h = canvas.height;
  const orient = w >= h ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation: orient, unit: "pt", format: [w, h] });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
  pdf.save(filename);
}

export function exportJSON(shapes: Shape[], filename = "whiteboard.json") {
  const blob = new Blob([JSON.stringify({ version: 1, shapes }, null, 2)], { type: "application/json" });
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
