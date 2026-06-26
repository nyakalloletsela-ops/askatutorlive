import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Boxes, RotateCw, Lock, Maximize2 } from "lucide-react";
import { Renderer } from "@/lib/webgl/renderer";
import { SCENES, type SceneInstance } from "@/lib/webgl/scenes";
import type { Vec3 } from "@/lib/webgl/mat4";

type Props = {
  enforceLimit: boolean;
  viewedSlugs: string[];
  limit: number;
  onOpen: (slug: string) => void;
};

/**
 * Native WebGL2 3D Lab — no Three.js. Renders a small library of
 * interactive scenes (molecules, surfaces, wave interference, topology)
 * using hand-written GLSL shaders.
 */
export function WebGLLab({ enforceLimit, viewedSlugs, limit, onOpen }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [sceneId, setSceneId] = useState(SCENES[0].id);
  const [unsupported, setUnsupported] = useState<string | null>(null);

  const scene = useMemo(() => SCENES.find((s) => s.id === sceneId)!, [sceneId]);
  const usedCount = viewedSlugs.length;
  const quotaReached = enforceLimit && usedCount >= limit && !viewedSlugs.includes(sceneId);

  // Track scene visits against the free quota.
  useEffect(() => {
    if (!enforceLimit) return;
    if (!viewedSlugs.includes(sceneId) && !quotaReached) onOpen(sceneId);
  }, [sceneId, enforceLimit, viewedSlugs, onOpen, quotaReached]);

  useEffect(() => {
    if (quotaReached) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { antialias: true });
    if (!gl) {
      setUnsupported("WebGL2 is not available in this browser.");
      return;
    }

    let renderer: Renderer;
    try {
      renderer = new Renderer(gl);
    } catch (e) {
      setUnsupported((e as Error).message);
      return;
    }

    let instance: SceneInstance;
    try {
      instance = scene.build(renderer);
    } catch (e) {
      setUnsupported((e as Error).message);
      return;
    }

    // Camera controls.
    let yaw = 0.6, pitch = 0.35, dist = 6;
    let dragging = false;
    let lastX = 0, lastY = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.01;
      pitch = Math.max(-1.4, Math.min(1.4, pitch + (e.clientY - lastY) * 0.01));
      lastX = e.clientX; lastY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      dist = Math.max(2, Math.min(20, dist + e.deltaY * 0.005));
    };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    let raf = 0;
    let running = true;
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
      }
    };

    const frame = () => {
      if (!running) return;
      resize();
      const t = (performance.now() - start) / 1000;
      const cx = Math.cos(pitch) * Math.sin(yaw) * dist;
      const cy = Math.sin(pitch) * dist;
      const cz = Math.cos(pitch) * Math.cos(yaw) * dist;
      const camera: Vec3 = [cx, cy, cz];
      const calls = instance.draw(t);
      renderer.render(canvas.width, canvas.height, camera, [0, 0, 0], calls);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      instance.dispose();
      const ext = gl.getExtension("WEBGL_lose_context");
      ext?.loseContext();
    };
  }, [scene, quotaReached]);

  const goFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <div ref={wrapRef} className="flex h-full flex-col bg-[#0a0c18]">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 bg-muted/40 p-2">
        <Boxes className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Native WebGL 3D Lab</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Hand-shaded GLSL · interactive scenes
        </span>
        {enforceLimit && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {usedCount}/{limit} scenes opened
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={sceneId}
            onChange={(e) => setSceneId(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
            aria-label="Choose scene"
          >
            {SCENES.map((s) => (
              <option key={s.id} value={s.id}>{s.subject} · {s.label}</option>
            ))}
          </select>
          <Button size="icon" variant="outline" onClick={() => setSceneId((s) => s)} aria-label="Reload">
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={goFullscreen} aria-label="Fullscreen">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {quotaReached ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Lock className="h-10 w-10 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Free lab quota reached</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            You've opened {limit} scenes. Book a tutor session to keep exploring the full WebGL library.
          </p>
        </div>
      ) : unsupported ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
          <p>{unsupported}</p>
          <p>Try the latest Chrome, Edge, Firefox, or Safari.</p>
        </div>
      ) : (
        <div className="relative flex-1">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
          />
          <div className="pointer-events-none absolute bottom-2 left-2 max-w-md rounded-md bg-background/70 px-3 py-2 text-xs text-foreground backdrop-blur">
            <div className="font-semibold">{scene.subject} · {scene.label}</div>
            <div className="text-muted-foreground">{scene.description}</div>
          </div>
        </div>
      )}
    </div>
  );
}
