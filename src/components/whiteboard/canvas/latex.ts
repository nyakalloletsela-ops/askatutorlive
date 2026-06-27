// Render LaTeX to a self-contained SVG data URL using KaTeX + foreignObject.
// Produces crisp, native-looking math output with no external network calls.
import katex from "katex";
import katexCss from "katex/dist/katex.min.css?inline";

export interface RenderedLatex {
  dataUrl: string;
  width: number;
  height: number;
}

const CSS = katexCss as unknown as string;

function measure(html: string, displayMode: boolean): { w: number; h: number } {
  if (typeof document === "undefined") {
    // SSR fallback estimate
    return { w: 320, h: displayMode ? 80 : 40 };
  }
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:-99999px;top:0;visibility:hidden;padding:8px;font-size:22px;line-height:1.4;";
  host.innerHTML = html;
  document.body.appendChild(host);
  const rect = host.getBoundingClientRect();
  const w = Math.ceil(rect.width) + 4;
  const h = Math.ceil(rect.height) + 4;
  document.body.removeChild(host);
  return { w: Math.max(48, w), h: Math.max(28, h) };
}

export function renderLatexToSvgDataUrl(latex_: string, opts?: { displayMode?: boolean; color?: string }): RenderedLatex {
  const displayMode = opts?.displayMode ?? true;
  const color = opts?.color ?? "#0f172a";
  let html: string;
  try {
    html = katex.renderToString(latex_, {
      displayMode,
      throwOnError: false,
      output: "html",
      strict: "ignore",
      trust: true,
    });
  } catch {
    html = `<span style="font-family:monospace;color:#b91c1c">${escapeHtml(latex_)}</span>`;
  }

  // Measure rendered size with the real KaTeX CSS applied.
  const styled = `<style>${CSS}</style><div style="display:inline-block;color:${color};font-size:22px;line-height:1.4;padding:6px 8px;">${html}</div>`;
  const { w, h } = measure(styled, displayMode);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml">` +
    `<style>${CSS}</style>` +
    `<div style="display:inline-block;color:${color};font-size:22px;line-height:1.4;padding:6px 8px;background:transparent;">${html}</div>` +
    `</div></foreignObject></svg>`;

  const b64 = typeof window === "undefined"
    ? Buffer.from(svg, "utf8").toString("base64")
    : btoa(unescape(encodeURIComponent(svg)));
  return { dataUrl: `data:image/svg+xml;base64,${b64}`, width: w, height: h };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
