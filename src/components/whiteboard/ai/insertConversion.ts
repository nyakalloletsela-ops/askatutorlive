import { type Shape, nextId, tick } from "../canvas/engine";
import { renderLatexToSvgDataUrl } from "../canvas/latex";

export type ConvertedBlock =
  | { kind: "svg"; svg: string; w: number; h: number }
  | { kind: "math"; latex: string }
  | { kind: "text"; text: string };

const SVG_RE = /<svg[\s\S]*?<\/svg>/gi;
const MATH_RE = /\$\$([\s\S]+?)\$\$/g;
const LATEX_HINT_RE = /\\(?:int|iint|iiint|oint|frac|sqrt|sum|prod|lim|begin|partial|nabla|vec|sin|cos|tan|log|ln|alpha|beta|gamma|theta|pi|infty|leq|geq|neq|rightarrow)|\b(?:int|iint|iiint|sqrt|sum|prod|lim|frac|partial)(?=_|\b)|[∫∬∭∮∑∏√∞≈≤≥≠±∂∇πθΔ]/i;

function readSvgDims(svg: string): { w: number; h: number } {
  const vb = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (vb) {
    const p = vb[1].trim().split(/\s+/).map(Number);
    if (p.length === 4 && p[2] > 0 && p[3] > 0) return { w: p[2], h: p[3] };
  }
  const w = svg.match(/\swidth\s*=\s*"(\d+(?:\.\d+)?)/i);
  const h = svg.match(/\sheight\s*=\s*"(\d+(?:\.\d+)?)/i);
  return { w: w ? +w[1] : 320, h: h ? +h[1] : 240 };
}

export function parseConversion(raw: string): ConvertedBlock[] {
  const out: ConvertedBlock[] = [];
  const cleanRaw = raw
    .replace(/\\\[/g, () => "$$")
    .replace(/\\\]/g, () => "$$")
    .replace(/```(?:latex|tex|math|svg)?/gi, "")
    .replace(/```/g, "")
    .trim();

  const svgMatches: { idx: number; len: number; svg: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = SVG_RE.exec(cleanRaw)) !== null) {
    svgMatches.push({ idx: m.index, len: m[0].length, svg: m[0] });
  }

  let cursor = 0;
  const pushTextual = (chunk: string) => {
    let last = 0;
    let mm: RegExpExecArray | null;
    const re = new RegExp(MATH_RE.source, "g");
    while ((mm = re.exec(chunk)) !== null) {
      const before = chunk.slice(last, mm.index).trim();
      if (before) splitParagraphs(before).forEach((t) => out.push(classifyTextualBlock(t)));
      out.push({ kind: "math", latex: normalizeLatex(mm[1].trim()) });
      last = mm.index + mm[0].length;
    }
    const tail = chunk.slice(last).trim();
    if (tail) splitParagraphs(tail).forEach((t) => out.push(classifyTextualBlock(t)));
  };

  for (const s of svgMatches) {
    if (s.idx > cursor) pushTextual(cleanRaw.slice(cursor, s.idx));
    const { w, h } = readSvgDims(s.svg);
    out.push({ kind: "svg", svg: s.svg, w, h });
    cursor = s.idx + s.len;
  }
  if (cursor < cleanRaw.length) pushTextual(cleanRaw.slice(cursor));
  if (out.length === 0 && cleanRaw.length > 0) {
    out.push({ kind: "text", text: cleanRaw });
  }
  return out;
}

function classifyTextualBlock(text: string): ConvertedBlock {
  const cleaned = text.replace(/^\s*(?:LaTeX|Math|Equation|Formula)\s*:\s*/i, "").trim();
  if (cleaned.includes("\n")) {
    const lines = cleaned.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length > 0 && lines.every((line) => looksLikeMathLine(line))) {
      return { kind: "math", latex: lines.map(normalizeLatex).join("\\\\") };
    }
  }
  const singleLine = !cleaned.includes("\n");
  if (singleLine && looksLikeMathLine(cleaned)) return { kind: "math", latex: normalizeLatex(cleaned) };
  return { kind: "text", text: cleaned };
}

function looksLikeMathLine(value: string): boolean {
  return LATEX_HINT_RE.test(value) || (/=/.test(value) && /[0-9a-zA-Z)][+\-*/^_=]/.test(value));
}

function normalizeLatex(input: string): string {
  return input
    .replace(/^\$\$|\$\$$/g, "")
    .replace(/∭/g, "\\iiint ").replace(/∬/g, "\\iint ").replace(/∮/g, "\\oint ").replace(/∫/g, "\\int ")
    .replace(/∑/g, "\\sum ").replace(/∏/g, "\\prod ")
    .replace(/√\s*\(?([^\n()]+)\)?/g, "\\sqrt{$1}")
    .replace(/∞/g, "\\infty").replace(/≤/g, "\\leq").replace(/≥/g, "\\geq").replace(/≠/g, "\\neq")
    .replace(/≈/g, "\\approx").replace(/±/g, "\\pm").replace(/∂/g, "\\partial").replace(/∇/g, "\\nabla")
    .replace(/π/g, "\\pi").replace(/θ/g, "\\theta").replace(/Δ/g, "\\Delta")
    .trim();
}

function splitParagraphs(s: string): string[] {
  return s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

function svgToDataUrl(svg: string): string {
  const fixed = /xmlns=/.test(svg) ? svg : svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  const b64 = typeof window === "undefined"
    ? Buffer.from(fixed, "utf8").toString("base64")
    : btoa(unescape(encodeURIComponent(fixed)));
  return `data:image/svg+xml;base64,${b64}`;
}

type ExtractedLabel = { x: number; y: number; w: number; h: number; text: string; color: string; size: number };

/** Pull <text> nodes out of an SVG so each label becomes an independent, editable text shape.
 *  Returns the SVG with text nodes removed plus the labels in the SVG's own coordinate space. */
function extractSvgLabels(svg: string): { cleanedSvg: string; labels: ExtractedLabel[] } {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return { cleanedSvg: svg, labels: [] };
  }
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (doc.getElementsByTagName("parsererror").length > 0) return { cleanedSvg: svg, labels: [] };
    const root = doc.documentElement;
    const labels: ExtractedLabel[] = [];
    const nodes = Array.from(root.getElementsByTagName("text"));
    for (const node of nodes) {
      const raw = (node.textContent ?? "").trim();
      if (!raw) { node.parentNode?.removeChild(node); continue; }
      const x = parseFloat(node.getAttribute("x") ?? "0") || 0;
      const y = parseFloat(node.getAttribute("y") ?? "0") || 0;
      const fontSizeAttr = node.getAttribute("font-size") ?? node.getAttribute("fontSize") ?? "";
      const size = parseFloat(fontSizeAttr) || 16;
      const color = node.getAttribute("fill") || node.getAttribute("color") || "#0f172a";
      const approxW = Math.max(40, Math.round(raw.length * size * 0.6));
      const approxH = Math.max(size + 6, Math.round(size * 1.4));
      labels.push({
        x: Math.round(x - approxW / 2),
        y: Math.round(y - size),
        w: approxW,
        h: approxH,
        text: raw,
        color,
        size: Math.round(size),
      });
      node.parentNode?.removeChild(node);
    }
    const cleanedSvg = new XMLSerializer().serializeToString(root);
    return { cleanedSvg, labels };
  } catch {
    return { cleanedSvg: svg, labels: [] };
  }
}

/** Convert AI-parsed blocks into laid-out Shape objects to be inserted into the whiteboard.
 *  LaTeX math is rendered locally with KaTeX to a self-contained SVG data URL — no network.
 *  Diagram labels (<text> in SVG) are extracted as independent text shapes so they can be
 *  edited, moved, or deleted without touching the underlying diagram. */
export function blocksToShapes(blocks: ConvertedBlock[], origin?: { x: number; y: number }): Shape[] {
  const shapes: Shape[] = [];
  let x = origin?.x ?? 80, y = origin?.y ?? 80; const colWidth = 560; const gap = 18;
  let z = 1000;
  for (const b of blocks) {
    if (b.kind === "svg") {
      const { cleanedSvg, labels } = extractSvgLabels(b.svg);
      const scale = Math.min(1, colWidth / b.w);
      const w = Math.round(b.w * scale), h = Math.round(b.h * scale);
      shapes.push({ id: nextId(), type: "image", x, y, w, h, src: svgToDataUrl(cleanedSvg), z: z++, page: 1, ts: tick() });
      for (const lb of labels) {
        const lx = x + Math.round(lb.x * scale);
        const ly = y + Math.round(lb.y * scale);
        const lw = Math.max(24, Math.round(lb.w * scale));
        const lh = Math.max(20, Math.round(lb.h * scale));
        shapes.push({
          id: nextId(), type: "text", x: lx, y: ly, w: lw, h: lh,
          text: lb.text, color: lb.color, size: Math.max(10, Math.round(lb.size * scale)),
          z: z++, page: 1, ts: tick(),
        });
      }
      y += h + gap;
    } else if (b.kind === "math") {
      const rendered = renderLatexToSvgDataUrl(b.latex, { displayMode: true });
      const scale = Math.min(1, colWidth / rendered.width);
      const w = Math.round(rendered.width * scale);
      const h = Math.round(rendered.height * scale);
      shapes.push({ id: nextId(), type: "image", x, y, w, h, src: rendered.dataUrl, z: z++, page: 1, ts: tick() });
      y += h + gap;
    } else {
      const lines = Math.max(1, Math.ceil(b.text.length / 60));
      const h = Math.max(40, lines * 24);
      shapes.push({ id: nextId(), type: "text", x, y, w: colWidth, h, text: b.text, color: "#0f172a", size: 18, z: z++, page: 1, ts: tick() });
      y += h + gap;
    }
  }
  return shapes;
}
