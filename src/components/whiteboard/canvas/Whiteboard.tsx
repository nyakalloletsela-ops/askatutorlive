/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import {
  MousePointer2, Pencil, Highlighter, Eraser, Minus, ArrowUpRight,
  Square, Circle, Triangle, Type, StickyNote, ImagePlus, Hand,
  Undo2, Redo2, Trash2, Download, Lock, Unlock, Maximize2, Grid3x3, CircleDot, Eye,
  Copy, ChevronUp, ChevronDown, MoreHorizontal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import {
  type Shape, type ToolId, type Camera, nextId, tick, observeTs, hitTest, translateShape, shapeBounds,
} from "./engine";
import { render } from "./renderer";
import { simplifyPoints } from "./smooth";
import { useWhiteboardRealtime, type CursorMsg } from "./realtime";
import { exportPNG, exportJPG, exportPDF, exportJSON } from "./exporter";
import { ConvertButton } from "../ai/ConvertButton";
import { LiveCursors } from "../collaboration/cursors";

export interface WhiteboardHandle {
  /** Export only the given shapes (or all if undefined) as a PNG data URL. */
  exportPng(opts?: { onlyHandwriting?: boolean; padding?: number }): Promise<string>;
  getShapes(): Shape[];
  setShapes(next: Shape[]): void;
  deleteShapes(ids: string[]): void;
  addShapes(shapes: Shape[]): void;
}

interface Props {
  roomId: string;
  userId: string;
  userName: string;
  /** Tutor / admin enables teacher controls. */
  isTeacher?: boolean;
}

const COLORS = ["#0f172a", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff"];
const SIZES = [2, 4, 6, 10, 16];

export const Whiteboard = forwardRef<WhiteboardHandle, Props>(function Whiteboard(
  { roomId, userId, userName, isTeacher = false }, ref,
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ----- state refs (mutable, no re-render) -----
  const shapesRef = useRef<Shape[]>([]);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, z: 1 });
  const dprRef = useRef<number>(1);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const drawingRef = useRef<Shape | null>(null);
  type Drag =
    | { kind: "pan"; sx: number; sy: number; camX: number; camY: number }
    | { kind: "translate"; lastPage: { x: number; y: number } }
    | { kind: "draw" }
    | { kind: "marquee"; sx: number; sy: number }
    | { kind: "resize"; corner: "nw" | "ne" | "sw" | "se"; shapeId: string; start: { x: number; y: number; w: number; h: number } }
    | { kind: "endpoint"; which: 1 | 2; shapeId: string };
  const dragRef = useRef<Drag | null>(null);
  const marqueeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const peersRef = useRef<Map<string, CursorMsg & { lastSeen: number }>>(new Map());
  const historyRef = useRef<{ past: Shape[][]; future: Shape[][] }>({ past: [], future: [] });
  const lastSaveRef = useRef<number>(0);

  // ----- reactive UI state -----
  const isMobile = useIsMobile();
  const [tool, setTool] = useState<ToolId>("pencil");
  const [color, setColor] = useState<string>(COLORS[0]);
  const [size, setSize] = useState<number>(4);
  const [filled, setFilled] = useState<boolean>(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [grid, setGrid] = useState<"off" | "grid" | "dots">("off");
  const [locked, setLocked] = useState<boolean>(false);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [textEdit, setTextEdit] = useState<{ shapeId: string; screenX: number; screenY: number; w: number; h: number; value: string } | null>(null);
  const [, force] = useState(0);
  const repaint = useCallback(() => force((n) => n + 1), []);

  const isReadOnly = locked && !isTeacher;

  // ----- realtime -----
  const { sendOp, sendCursor } = useWhiteboardRealtime({
    roomId, selfId: userId,
    onOp: (op) => {
      if (op.kind === "upsert") {
        observeTs(op.shape.ts);
        const arr = shapesRef.current;
        const idx = arr.findIndex((s) => s.id === op.shape.id);
        if (idx >= 0) {
          if (arr[idx].ts > op.shape.ts) return; // older
          arr[idx] = op.shape;
        } else arr.push(op.shape);
        scheduleRender();
      } else if (op.kind === "delete") {
        shapesRef.current = shapesRef.current.filter((s) => !op.ids.includes(s.id));
        scheduleRender();
      } else if (op.kind === "clear") {
        shapesRef.current = [];
        scheduleRender();
      } else if (op.kind === "lock") {
        setLocked(op.locked);
      }
    },
    onCursor: (c) => {
      peersRef.current.set(c.senderId, { ...c, lastSeen: Date.now() });
      repaint();
    },
    onPeerLeave: (id) => { peersRef.current.delete(id); repaint(); },
  });

  // ----- load snapshot -----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: wbId } = await supabase.rpc("ensure_whiteboard", { _room_id: roomId });
        if (!wbId || cancelled) return;
        const { data: snap } = await supabase
          .from("whiteboard_snapshots")
          .select("snapshot_data, created_at")
          .eq("whiteboard_id", wbId as string)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled || !snap) return;
        const d = snap.snapshot_data as { version?: number; shapes?: Shape[]; locked?: boolean } | null;
        if (d && d.version === 1 && Array.isArray(d.shapes)) {
          shapesRef.current = d.shapes;
          d.shapes.forEach((s) => observeTs(s.ts));
          d.shapes.forEach((s) => { if (s.type === "image") cacheImage(s.src); });
          if (typeof d.locked === "boolean") setLocked(d.locked);
          scheduleRender();
        }
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  // ----- autosave -----
  useEffect(() => {
    const id = window.setInterval(async () => {
      const now = Date.now();
      if (now - lastSaveRef.current < 4000) return;
      lastSaveRef.current = now;
      // Ensure whiteboard exists via RPC and save snapshot
      try {
        const { data: wbId } = await supabase.rpc("ensure_whiteboard", { _room_id: roomId });
        if (!wbId) return;
        await supabase.from("whiteboard_snapshots").insert({
          whiteboard_id: wbId as string,
          snapshot_data: JSON.parse(JSON.stringify({ version: 1, room: roomId, shapes: shapesRef.current, locked })),
        });
      } catch { /* noop */ }
    }, 8000);
    return () => clearInterval(id);
  }, [roomId, locked]);

  // ----- HiDPI + resize -----
  const scheduleRenderRef = useRef<number | null>(null);
  const scheduleRender = useCallback(() => {
    if (scheduleRenderRef.current !== null) return;
    scheduleRenderRef.current = requestAnimationFrame(() => {
      scheduleRenderRef.current = null;
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      render({
        ctx, shapes: shapesRef.current.concat(drawingRef.current ? [drawingRef.current] : []),
        camera: cameraRef.current, width: sizeRef.current.w, height: sizeRef.current.h,
        dpr: dprRef.current, grid, selection, marquee: marqueeRef.current, imageCache: imageCacheRef.current,
      });
    });
  }, [grid, selection]);

  useEffect(() => {
    const wrap = wrapperRef.current!;
    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current!;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      sizeRef.current = { w: rect.width, h: rect.height };
      dprRef.current = dpr;
      scheduleRender();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [scheduleRender]);

  useEffect(() => { scheduleRender(); }, [grid, selection, scheduleRender]);

  // ----- coordinate helpers -----
  const screenToPage = (sx: number, sy: number) => {
    const cam = cameraRef.current;
    return { x: (sx - cam.x) / cam.z, y: (sy - cam.y) / cam.z };
  };
  const pageToScreen = (px: number, py: number) => {
    const cam = cameraRef.current;
    return { x: px * cam.z + cam.x, y: py * cam.z + cam.y };
  };

  // ----- history -----
  const pushHistory = () => {
    historyRef.current.past.push(shapesRef.current.map((s) => ({ ...s })));
    if (historyRef.current.past.length > 60) historyRef.current.past.shift();
    historyRef.current.future = [];
  };
  const undo = () => {
    const h = historyRef.current; const prev = h.past.pop(); if (!prev) return;
    h.future.push(shapesRef.current);
    shapesRef.current = prev;
    setSelection(new Set());
    scheduleRender();
  };
  const redo = () => {
    const h = historyRef.current; const nxt = h.future.pop(); if (!nxt) return;
    h.past.push(shapesRef.current);
    shapesRef.current = nxt;
    setSelection(new Set());
    scheduleRender();
  };

  // ----- shape ops with broadcast -----
  const upsertShape = (s: Shape, broadcast = true) => {
    const arr = shapesRef.current; const idx = arr.findIndex((x) => x.id === s.id);
    if (idx >= 0) arr[idx] = s; else arr.push(s);
    if (broadcast) sendOp({ kind: "upsert", shape: s });
    scheduleRender();
  };
  const deleteShapes = (ids: string[]) => {
    if (!ids.length) return;
    pushHistory();
    shapesRef.current = shapesRef.current.filter((s) => !ids.includes(s.id));
    setSelection(new Set());
    sendOp({ kind: "delete", ids });
    scheduleRender();
  };
  const clearBoard = () => {
    if (!confirm("Clear the whole board for everyone?")) return;
    pushHistory();
    shapesRef.current = [];
    setSelection(new Set());
    sendOp({ kind: "clear" });
    scheduleRender();
  };
  const setLockBroadcast = (next: boolean) => {
    setLocked(next);
    sendOp({ kind: "lock", locked: next });
    // Persist immediately so late-joining students see the lock state.
    (async () => {
      try {
        const { data: wbId } = await supabase.rpc("ensure_whiteboard", { _room_id: roomId });
        if (!wbId) return;
        await supabase.from("whiteboard_snapshots").insert({
          whiteboard_id: wbId as string,
          snapshot_data: JSON.parse(JSON.stringify({ version: 1, room: roomId, shapes: shapesRef.current, locked: next })),
        });
      } catch { /* noop */ }
    })();
  };

  // ----- image cache -----
  const cacheImage = (src: string) => {
    if (imageCacheRef.current.has(src)) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => scheduleRender();
    img.onerror = () => { /* noop */ };
    img.src = src;
    imageCacheRef.current.set(src, img);
  };

  // ----- pointer handlers -----
  const onPointerDown = (e: React.PointerEvent) => {
    if (textEdit) return;
    const rect = wrapperRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const pg = screenToPage(sx, sy);

    // Pan: middle button, space, or hand tool.
    if (e.button === 1 || spaceDownRef.current || tool === "hand") {
      dragRef.current = { kind: "pan", sx, sy, camX: cameraRef.current.x, camY: cameraRef.current.y };
      return;
    }
    if (isReadOnly) return;

    if (tool === "select") {
      // Hit shape?
      const sorted = [...shapesRef.current].sort((a, b) => b.z - a.z);
      const hit = sorted.find((s) => hitTest(s, pg.x, pg.y));
      if (hit) {
        if (!selection.has(hit.id)) {
          if (!(e.shiftKey || e.metaKey)) setSelection(new Set([hit.id]));
          else setSelection(new Set([...selection, hit.id]));
        }
        pushHistory();
        dragRef.current = { kind: "translate", lastPage: pg };
      } else {
        if (!(e.shiftKey || e.metaKey)) setSelection(new Set());
        marqueeRef.current = { x: sx, y: sy, w: 0, h: 0 };
        dragRef.current = { kind: "marquee", sx, sy };
      }
      return;
    }

    if (tool === "eraser") {
      const sorted = [...shapesRef.current].sort((a, b) => b.z - a.z);
      const hit = sorted.find((s) => hitTest(s, pg.x, pg.y));
      if (hit) deleteShapes([hit.id]);
      dragRef.current = { kind: "draw" };
      return;
    }

    if (tool === "text" || tool === "sticky") {
      pushHistory();
      const id = nextId();
      const w = 220, h = tool === "sticky" ? 140 : 60;
      const shape: Shape = tool === "sticky"
        ? { id, type: "sticky", x: pg.x, y: pg.y, w, h, text: "", bg: "#fde68a", color: "#1f2937", z: topZ() + 1, page: 1, ts: tick() }
        : { id, type: "text", x: pg.x, y: pg.y, w, h, text: "", color, size: Math.max(14, size * 4), z: topZ() + 1, page: 1, ts: tick() };
      upsertShape(shape);
      const s = pageToScreen(pg.x, pg.y);
      setTextEdit({ shapeId: id, screenX: s.x, screenY: s.y, w: w * cameraRef.current.z, h: h * cameraRef.current.z, value: "" });
      setTimeout(() => textareaRef.current?.focus(), 0);
      return;
    }

    if (tool === "image") {
      // Trigger file picker
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "image/*";
      inp.onchange = () => {
        const f = inp.files?.[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          const src = r.result as string;
          const img = new Image();
          img.onload = () => {
            const max = 360;
            const ratio = img.width / img.height;
            const w = ratio >= 1 ? max : max * ratio;
            const h = ratio >= 1 ? max / ratio : max;
            cacheImage(src);
            pushHistory();
            upsertShape({ id: nextId(), type: "image", x: pg.x, y: pg.y, w, h, src, z: topZ() + 1, page: 1, ts: tick() });
          };
          img.src = src;
        };
        r.readAsDataURL(f);
      };
      inp.click();
      return;
    }

    // Drawing tools
    pushHistory();
    const id = nextId();
    let shape: Shape;
    if (tool === "pencil") shape = { id, type: "pencil", points: [pg.x, pg.y], color, size, z: topZ() + 1, page: 1, ts: tick() };
    else if (tool === "highlighter") shape = { id, type: "highlighter", points: [pg.x, pg.y], color, size, z: topZ() + 1, page: 1, ts: tick() };
    else if (tool === "line") shape = { id, type: "line", x1: pg.x, y1: pg.y, x2: pg.x, y2: pg.y, color, size, z: topZ() + 1, page: 1, ts: tick() };
    else if (tool === "arrow") shape = { id, type: "arrow", x1: pg.x, y1: pg.y, x2: pg.x, y2: pg.y, color, size, z: topZ() + 1, page: 1, ts: tick() };
    else if (tool === "rect") shape = { id, type: "rect", x: pg.x, y: pg.y, w: 0, h: 0, color, size, fill: filled ? color + "33" : null, z: topZ() + 1, page: 1, ts: tick() };
    else if (tool === "ellipse") shape = { id, type: "ellipse", x: pg.x, y: pg.y, w: 0, h: 0, color, size, fill: filled ? color + "33" : null, z: topZ() + 1, page: 1, ts: tick() };
    else if (tool === "triangle") shape = { id, type: "triangle", x: pg.x, y: pg.y, w: 0, h: 0, color, size, fill: filled ? color + "33" : null, z: topZ() + 1, page: 1, ts: tick() };
    else return;
    drawingRef.current = shape;
    dragRef.current = { kind: "draw" };
    scheduleRender();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = wrapperRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const pg = screenToPage(sx, sy);

    // Broadcast cursor (throttled)
    cursorThrottle(() => sendCursor({ name: userName, color: userColor, x: pg.x, y: pg.y }));

    const d = dragRef.current;
    if (!d) return;

    if (d.kind === "pan") {
      cameraRef.current.x = d.camX + (sx - d.sx);
      cameraRef.current.y = d.camY + (sy - d.sy);
      scheduleRender();
      return;
    }
    if (d.kind === "translate") {
      const dx = pg.x - d.lastPage.x, dy = pg.y - d.lastPage.y;
      d.lastPage = pg;
      const sel = selection;
      const arr = shapesRef.current;
      for (let i = 0; i < arr.length; i++) {
        if (sel.has(arr[i].id)) {
          arr[i] = { ...translateShape(arr[i], dx, dy), ts: tick() };
        }
      }
      scheduleRender();
      return;
    }
    if (d.kind === "marquee") {
      marqueeRef.current = { x: Math.min(d.sx, sx), y: Math.min(d.sy, sy), w: Math.abs(sx - d.sx), h: Math.abs(sy - d.sy) };
      scheduleRender();
      return;
    }
    if (d.kind === "resize") {
      const arr = shapesRef.current; const idx = arr.findIndex((s) => s.id === d.shapeId);
      if (idx < 0) return;
      const s = arr[idx] as any;
      const st = d.start;
      let nx = st.x, ny = st.y, nw = st.w, nh = st.h;
      if (d.corner.includes("e")) nw = Math.max(8, pg.x - st.x);
      if (d.corner.includes("s")) nh = Math.max(8, pg.y - st.y);
      if (d.corner.includes("w")) { nw = Math.max(8, st.x + st.w - pg.x); nx = st.x + st.w - nw; }
      if (d.corner.includes("n")) { nh = Math.max(8, st.y + st.h - pg.y); ny = st.y + st.h - nh; }
      arr[idx] = { ...s, x: nx, y: ny, w: nw, h: nh, ts: tick() };
      scheduleRender();
      return;
    }
    if (d.kind === "endpoint") {
      const arr = shapesRef.current; const idx = arr.findIndex((s) => s.id === d.shapeId);
      if (idx < 0) return;
      const s = arr[idx] as any;
      if (d.which === 1) { s.x1 = pg.x; s.y1 = pg.y; } else { s.x2 = pg.x; s.y2 = pg.y; }
      s.ts = tick();
      scheduleRender();
      return;
    }
    if (d.kind === "draw") {
      if (tool === "eraser") {
        const sorted = [...shapesRef.current].sort((a, b) => b.z - a.z);
        const hit = sorted.find((s) => hitTest(s, pg.x, pg.y));
        if (hit) deleteShapes([hit.id]);
        return;
      }
      const cur = drawingRef.current; if (!cur) return;
      if (cur.type === "pencil" || cur.type === "highlighter") {
        cur.points.push(pg.x, pg.y);
      } else if (cur.type === "line" || cur.type === "arrow") {
        cur.x2 = pg.x; cur.y2 = pg.y;
      } else if (cur.type === "rect" || cur.type === "ellipse" || cur.type === "triangle") {
        cur.w = pg.x - cur.x; cur.h = pg.y - cur.y;
      }
      cur.ts = tick();
      scheduleRender();
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.kind === "marquee" && marqueeRef.current) {
      const m = marqueeRef.current;
      const tl = screenToPage(m.x, m.y);
      const br = screenToPage(m.x + m.w, m.y + m.h);
      const sel = new Set<string>(selection);
      for (const s of shapesRef.current) {
        const b = shapeBounds(s);
        if (b.x >= tl.x && b.y >= tl.y && b.x + b.w <= br.x && b.y + b.h <= br.y) sel.add(s.id);
      }
      setSelection(sel);
      marqueeRef.current = null;
      scheduleRender();
      return;
    }
    if (d.kind === "translate") {
      for (const s of shapesRef.current) {
        if (selection.has(s.id)) sendOp({ kind: "upsert", shape: s });
      }
      return;
    }
    if (d.kind === "draw") {
      const cur = drawingRef.current;
      if (cur) {
        // Normalise negative w/h for rectangles etc.
        if ((cur.type === "rect" || cur.type === "ellipse" || cur.type === "triangle") && (cur.w < 0 || cur.h < 0)) {
          const x = Math.min(cur.x, cur.x + cur.w), y = Math.min(cur.y, cur.y + cur.h);
          (cur as any).w = Math.abs(cur.w); (cur as any).h = Math.abs(cur.h);
          (cur as any).x = x; (cur as any).y = y;
        }
        // Smooth freehand strokes by removing redundant points (RDP).
        if (cur.type === "pencil" || cur.type === "highlighter") {
          cur.points = simplifyPoints(cur.points, Math.max(0.5, cur.size * 0.25));
        }
        shapesRef.current.push(cur);
        sendOp({ kind: "upsert", shape: cur });
        drawingRef.current = null;
        scheduleRender();
      }
    }
    if (d.kind === "resize" || d.kind === "endpoint") {
      const s = shapesRef.current.find((x) => x.id === d.shapeId);
      if (s) sendOp({ kind: "upsert", shape: s });
    }
  };

  // ----- wheel zoom -----
  useEffect(() => {
    const wrap = wrapperRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const cam = cameraRef.current;
      if (e.ctrlKey || e.metaKey) {
        // pinch-zoom
        const factor = Math.exp(-e.deltaY * 0.01);
        zoomAt(sx, sy, factor);
      } else {
        cam.x -= e.deltaX; cam.y -= e.deltaY;
        scheduleRender();
      }
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [scheduleRender]);

  const zoomAt = (sx: number, sy: number, factor: number) => {
    const cam = cameraRef.current;
    const newZ = Math.min(8, Math.max(0.1, cam.z * factor));
    const k = newZ / cam.z;
    cam.x = sx - (sx - cam.x) * k;
    cam.y = sy - (sy - cam.y) * k;
    cam.z = newZ;
    scheduleRender();
  };

  // ----- keyboard -----
  const spaceDownRef = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (textEdit || (e.target as Element)?.tagName === "TEXTAREA" || (e.target as Element)?.tagName === "INPUT") return;
      const meta = e.ctrlKey || e.metaKey;
      // Non-mutating shortcuts always available
      if (meta && e.key.toLowerCase() === "c") { e.preventDefault(); copySel(); return; }
      if (e.key === " " && !spaceDownRef.current) { spaceDownRef.current = true; e.preventDefault(); return; }
      if (e.key === "+") { zoomAt(sizeRef.current.w / 2, sizeRef.current.h / 2, 1.2); return; }
      if (e.key === "-") { zoomAt(sizeRef.current.w / 2, sizeRef.current.h / 2, 0.8); return; }
      // Block all mutating shortcuts when the board is locked for this user
      if (isReadOnly) {
        if (e.key.toLowerCase() === "v") setTool("select");
        return;
      }
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (meta && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); return; }
      if (meta && e.key.toLowerCase() === "v") { e.preventDefault(); pasteSel(); return; }
      if (meta && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSel(); return; }
      if (meta && e.key === "]") { e.preventDefault(); bringForward(); return; }
      if (meta && e.key === "[") { e.preventDefault(); sendBackward(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { if (selection.size) { e.preventDefault(); deleteShapes([...selection]); } return; }
      const map: Record<string, ToolId> = {
        v: "select", p: "pencil", h: "highlighter", e: "eraser", l: "line", a: "arrow",
        r: "rect", o: "ellipse", t: "text", s: "sticky",
      };
      if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
    };
    const onUp = (e: KeyboardEvent) => { if (e.key === " ") spaceDownRef.current = false; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onUp); };
  }, [selection, textEdit, isReadOnly]);

  // ----- clipboard ops -----
  const clipRef = useRef<Shape[]>([]);
  const copySel = () => { clipRef.current = shapesRef.current.filter((s) => selection.has(s.id)).map((s) => ({ ...s })); };
  const pasteSel = () => {
    if (!clipRef.current.length) return;
    pushHistory();
    const cam = cameraRef.current;
    const ids = new Set<string>();
    for (const s of clipRef.current) {
      const ns = { ...translateShape(s, 24 / cam.z, 24 / cam.z), id: nextId(), z: topZ() + 1, ts: tick() } as Shape;
      shapesRef.current.push(ns); ids.add(ns.id);
      sendOp({ kind: "upsert", shape: ns });
    }
    setSelection(ids);
    scheduleRender();
  };
  const duplicateSel = () => { copySel(); pasteSel(); };

  const topZ = () => shapesRef.current.reduce((m, s) => Math.max(m, s.z), 0);
  const bringForward = () => {
    pushHistory();
    const max = topZ();
    for (const s of shapesRef.current) if (selection.has(s.id)) { s.z = max + 1; s.ts = tick(); sendOp({ kind: "upsert", shape: s }); }
    scheduleRender();
  };
  const sendBackward = () => {
    pushHistory();
    const min = shapesRef.current.reduce((m, s) => Math.min(m, s.z), 0);
    for (const s of shapesRef.current) if (selection.has(s.id)) { s.z = min - 1; s.ts = tick(); sendOp({ kind: "upsert", shape: s }); }
    scheduleRender();
  };

  // ----- text-edit commit -----
  const commitTextEdit = () => {
    if (!textEdit) return;
    const arr = shapesRef.current; const idx = arr.findIndex((s) => s.id === textEdit.shapeId);
    if (idx >= 0) {
      const s = arr[idx];
      if (s.type === "text" || s.type === "sticky") {
        const next = { ...s, text: textEdit.value, ts: tick() } as Shape;
        arr[idx] = next; sendOp({ kind: "upsert", shape: next });
      }
    }
    setTextEdit(null);
    scheduleRender();
  };

  // ----- cursor throttle -----
  const cursorLast = useRef(0);
  const cursorThrottle = (fn: () => void) => {
    const now = performance.now();
    if (now - cursorLast.current > 40) { cursorLast.current = now; fn(); }
  };
  const userColor = useMemo(() => hashColor(userId), [userId]);

  // ----- fullscreen -----
  const toggleFullscreen = async () => {
    const el = wrapperRef.current; if (!el) return;
    try {
      if (!document.fullscreenElement) { await el.requestFullscreen(); setFullscreen(true); }
      else { await document.exitFullscreen(); setFullscreen(false); }
    } catch { /* noop */ }
  };

  // ----- imperative handle (also exposed locally for in-component children like ConvertButton) -----
  const handle = useMemo<WhiteboardHandle>(() => ({
    async exportPng(opts) {
      const list = opts?.onlyHandwriting
        ? shapesRef.current.filter((s) => s.type === "pencil" || s.type === "highlighter")
        : shapesRef.current;
      if (!list.length) return "";
      let xmn = Infinity, ymn = Infinity, xmx = -Infinity, ymx = -Infinity;
      for (const s of list) {
        const b = shapeBounds(s);
        if (b.x < xmn) xmn = b.x; if (b.y < ymn) ymn = b.y;
        if (b.x + b.w > xmx) xmx = b.x + b.w; if (b.y + b.h > ymx) ymx = b.y + b.h;
      }
      if (!isFinite(xmn)) return "";
      const pad = opts?.padding ?? 24;
      const scale = 1.5;
      const w = Math.ceil((xmx - xmn + pad * 2) * scale), h = Math.ceil((ymx - ymn + pad * 2) * scale);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const cx = c.getContext("2d")!;
      cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h);
      render({
        ctx: cx, shapes: list,
        camera: { x: (-xmn + pad) * scale, y: (-ymn + pad) * scale, z: scale },
        width: w, height: h, dpr: 1, grid: "off", imageCache: imageCacheRef.current,
      });
      return c.toDataURL("image/png");
    },
    getShapes: () => shapesRef.current.slice(),
    setShapes: (next) => { shapesRef.current = next.map((s) => ({ ...s })); scheduleRender(); },
    deleteShapes,
    addShapes: (shapes) => {
      pushHistory();
      for (const s of shapes) {
        if (s.type === "image") cacheImage(s.src);
        shapesRef.current.push(s);
        sendOp({ kind: "upsert", shape: s });
      }
      scheduleRender();
    },
  }), []);
  useImperativeHandle(ref, () => handle, [handle]);

  // ----- toolbar -----
  const ToolBtn = ({ id, icon: Icon, label, shortcut }: { id: ToolId; icon: typeof Pencil; label: string; shortcut?: string }) => (
    <Button
      size="icon" variant={tool === id ? "default" : "ghost"}
      className="h-9 w-9 shrink-0"
      onClick={() => setTool(id)}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      disabled={isReadOnly && id !== "select" && id !== "hand"}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
  const IconTile = ({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex flex-col items-center gap-0.5 rounded-md px-1.5 py-1.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
      <span>{label}</span>
    </button>
  );

  const peers = Array.from(peersRef.current.values()).filter((p) => Date.now() - p.lastSeen < 8000);

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full min-h-[400px] overflow-hidden rounded-xl border bg-white shadow-sm"
      style={{ touchAction: "none" }}
      tabIndex={0}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        style={{ cursor: cursorFor(tool, spaceDownRef.current) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
          if (isReadOnly) return;
          const rect = wrapperRef.current!.getBoundingClientRect();
          const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
          const pg = screenToPage(sx, sy);
          const sorted = [...shapesRef.current].sort((a, b) => b.z - a.z);
          const hit = sorted.find((s) => hitTest(s, pg.x, pg.y));
          if (hit && (hit.type === "text" || hit.type === "sticky")) {
            const sc = pageToScreen(hit.x, hit.y);
            setSelection(new Set([hit.id]));
            setTextEdit({ shapeId: hit.id, screenX: sc.x, screenY: sc.y, w: hit.w * cameraRef.current.z, h: hit.h * cameraRef.current.z, value: hit.text });
            setTimeout(() => textareaRef.current?.focus(), 0);
          }
        }}
      />

      {/* Resize / endpoint handles for single selection */}
      {(() => {
        if (selection.size !== 1 || textEdit) return null;
        const s = shapesRef.current.find((x) => selection.has(x.id));
        if (!s) return null;
        const startResize = (corner: "nw" | "ne" | "sw" | "se", e: React.PointerEvent) => {
          e.stopPropagation();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          pushHistory();
          const b = shapeBounds(s);
          dragRef.current = { kind: "resize", corner, shapeId: s.id, start: { x: b.x, y: b.y, w: b.w, h: b.h } };
        };
        const startEndpoint = (which: 1 | 2, e: React.PointerEvent) => {
          e.stopPropagation();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          pushHistory();
          dragRef.current = { kind: "endpoint", which, shapeId: s.id };
        };
        const handleProps = {
          onPointerMove: onPointerMove as unknown as React.PointerEventHandler,
          onPointerUp: onPointerUp as unknown as React.PointerEventHandler,
        };
        if (s.type === "line" || s.type === "arrow") {
          const a = pageToScreen(s.x1, s.y1), b = pageToScreen(s.x2, s.y2);
          return (
            <>
              <div {...handleProps} onPointerDown={(e) => startEndpoint(1, e)} style={handleStyle(a.x, a.y, "move")} />
              <div {...handleProps} onPointerDown={(e) => startEndpoint(2, e)} style={handleStyle(b.x, b.y, "move")} />
            </>
          );
        }
        if (["rect", "ellipse", "triangle", "text", "sticky", "image"].includes(s.type)) {
          const b = shapeBounds(s);
          const tl = pageToScreen(b.x, b.y), br = pageToScreen(b.x + b.w, b.y + b.h);
          const tr = { x: br.x, y: tl.y }, bl = { x: tl.x, y: br.y };
          return (
            <>
              <div {...handleProps} onPointerDown={(e) => startResize("nw", e)} style={handleStyle(tl.x, tl.y, "nwse-resize")} />
              <div {...handleProps} onPointerDown={(e) => startResize("ne", e)} style={handleStyle(tr.x, tr.y, "nesw-resize")} />
              <div {...handleProps} onPointerDown={(e) => startResize("sw", e)} style={handleStyle(bl.x, bl.y, "nesw-resize")} />
              <div {...handleProps} onPointerDown={(e) => startResize("se", e)} style={handleStyle(br.x, br.y, "nwse-resize")} />
            </>
          );
        }
        return null;
      })()}


      {/* Live cursors */}
      <LiveCursors peers={peers} project={pageToScreen} />

      {/* Top-right utility bar — compact on mobile */}
      <div className="absolute right-2 top-14 z-30 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full border bg-background/95 px-1.5 py-1 shadow-md backdrop-blur sm:top-2">
        <ConvertButton handle={handle} />
        {!isMobile && (
          <>
            <span className="h-4 w-px shrink-0 bg-border" />
            <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={() => setGrid((g) => g === "off" ? "grid" : g === "grid" ? "dots" : "off")} title={`Grid: ${grid}`}>
              {grid === "dots" ? <CircleDot className="h-3.5 w-3.5" /> : grid === "grid" ? <Grid3x3 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <span className="h-4 w-px shrink-0 bg-border" />
            <ExportMenu shapesRef={shapesRef} imageCacheRef={imageCacheRef} />
            <Button size="sm" variant="ghost" className="h-7 w-7 shrink-0 p-0" onClick={toggleFullscreen} title="Fullscreen">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            {isTeacher && (
              <>
                <span className="h-4 w-px shrink-0 bg-border" />
                <Button size="sm" variant={locked ? "destructive" : "ghost"} className="h-7 w-7 shrink-0 p-0" onClick={() => setLockBroadcast(!locked)} title="Lock board for students">
                  {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 shrink-0 p-0" onClick={clearBoard} title="Clear board">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </>
            )}
          </>
        )}
        {isMobile && (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 shrink-0 p-0" title="More" aria-label="More board options">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-56 p-2">
              <div className="grid grid-cols-3 gap-1">
                <IconTile onClick={() => setGrid((g) => g === "off" ? "grid" : g === "grid" ? "dots" : "off")} label={`Grid`}>
                  {grid === "dots" ? <CircleDot className="h-4 w-4" /> : grid === "grid" ? <Grid3x3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </IconTile>
                <IconTile onClick={toggleFullscreen} label="Full"><Maximize2 className="h-4 w-4" /></IconTile>
                {isTeacher && (
                  <IconTile onClick={() => setLockBroadcast(!locked)} label={locked ? "Locked" : "Lock"}>
                    {locked ? <Lock className="h-4 w-4 text-destructive" /> : <Unlock className="h-4 w-4" />}
                  </IconTile>
                )}
                {isTeacher && (
                  <IconTile onClick={clearBoard} label="Clear"><Trash2 className="h-4 w-4 text-destructive" /></IconTile>
                )}
              </div>
              <div className="mt-2 border-t pt-2">
                <ExportMenu shapesRef={shapesRef} imageCacheRef={imageCacheRef} />
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Main toolbar — essentials inline, rest grouped behind "More" on mobile */}
      <div className="pointer-events-auto absolute left-1/2 top-2 z-30 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 rounded-2xl border bg-background/95 px-2 py-1.5 shadow-lg backdrop-blur">
        {isMobile ? (
          <>
            <ToolBtn id="select" icon={MousePointer2} label="Select" shortcut="V" />
            <ToolBtn id="pencil" icon={Pencil} label="Pencil" shortcut="P" />
            <ToolBtn id="eraser" icon={Eraser} label="Eraser" shortcut="E" />
            <span className="mx-0.5 h-6 w-px shrink-0 bg-border" />
            {/* Current color swatch — opens picker */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="h-7 w-7 shrink-0 rounded-full border-2 border-border"
                  style={{ backgroundColor: color }}
                  aria-label="Color"
                  title="Color"
                />
              </PopoverTrigger>
              <PopoverContent side="bottom" align="center" className="w-auto p-2">
                <div className="flex items-center gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`h-6 w-6 rounded-full border ${color === c ? "ring-2 ring-primary ring-offset-1" : ""}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Colour ${c}`}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1 border-t pt-2">
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`grid h-7 w-7 place-items-center rounded-md hover:bg-muted ${size === s ? "bg-muted" : ""}`}
                      title={`Size ${s}`}
                    >
                      <span className="rounded-full bg-foreground" style={{ width: Math.max(3, s / 1.5), height: Math.max(3, s / 1.5) }} />
                    </button>
                  ))}
                  <button
                    onClick={() => setFilled((f) => !f)}
                    className={`ml-1 grid h-7 w-7 place-items-center rounded-md hover:bg-muted ${filled ? "bg-muted" : ""}`}
                    title="Toggle fill"
                  >
                    <span className={`block h-3.5 w-3.5 rounded-sm border-2 ${filled ? "bg-foreground/30" : ""}`} style={{ borderColor: "currentColor" }} />
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <span className="mx-0.5 h-6 w-px shrink-0 bg-border" />
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={undo} title="Undo"><Undo2 className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={redo} title="Redo"><Redo2 className="h-4 w-4" /></Button>

            {/* Overflow: shapes, text, sticky, image, pan, highlighter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="More tools" aria-label="More tools">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="center" className="w-60 p-2">
                <div className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Draw</div>
                <div className="grid grid-cols-5 gap-1">
                  <ToolBtn id="hand" icon={Hand} label="Pan" />
                  <ToolBtn id="highlighter" icon={Highlighter} label="Highlighter" />
                  <ToolBtn id="text" icon={Type} label="Text" />
                  <ToolBtn id="sticky" icon={StickyNote} label="Sticky" />
                  <ToolBtn id="image" icon={ImagePlus} label="Image" />
                </div>
                <div className="mb-1 mt-2 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Shapes</div>
                <div className="grid grid-cols-5 gap-1">
                  <ToolBtn id="line" icon={Minus} label="Line" />
                  <ToolBtn id="arrow" icon={ArrowUpRight} label="Arrow" />
                  <ToolBtn id="rect" icon={Square} label="Rect" />
                  <ToolBtn id="ellipse" icon={Circle} label="Ellipse" />
                  <ToolBtn id="triangle" icon={Triangle} label="Triangle" />
                </div>
                {selection.size > 0 && (
                  <>
                    <div className="mb-1 mt-2 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Selection</div>
                    <div className="grid grid-cols-4 gap-1">
                      <IconTile onClick={duplicateSel} label="Copy"><Copy className="h-4 w-4" /></IconTile>
                      <IconTile onClick={bringForward} label="Up"><ChevronUp className="h-4 w-4" /></IconTile>
                      <IconTile onClick={sendBackward} label="Down"><ChevronDown className="h-4 w-4" /></IconTile>
                      <IconTile onClick={() => deleteShapes([...selection])} label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></IconTile>
                    </div>
                  </>
                )}
              </PopoverContent>
            </Popover>
          </>
        ) : (
          <>
            <ToolBtn id="select" icon={MousePointer2} label="Select" shortcut="V" />
            <ToolBtn id="hand" icon={Hand} label="Pan" />
            <span className="mx-1 h-6 w-px shrink-0 bg-border" />
            <ToolBtn id="pencil" icon={Pencil} label="Pencil" shortcut="P" />
            <ToolBtn id="highlighter" icon={Highlighter} label="Highlighter" shortcut="H" />
            <ToolBtn id="eraser" icon={Eraser} label="Eraser" shortcut="E" />
            <span className="mx-1 h-6 w-px shrink-0 bg-border" />
            <ToolBtn id="line" icon={Minus} label="Line" shortcut="L" />
            <ToolBtn id="arrow" icon={ArrowUpRight} label="Arrow" shortcut="A" />
            <ToolBtn id="rect" icon={Square} label="Rectangle" shortcut="R" />
            <ToolBtn id="ellipse" icon={Circle} label="Ellipse" shortcut="O" />
            <ToolBtn id="triangle" icon={Triangle} label="Triangle" />
            <span className="mx-1 h-6 w-px shrink-0 bg-border" />
            <ToolBtn id="text" icon={Type} label="Text" shortcut="T" />
            <ToolBtn id="sticky" icon={StickyNote} label="Sticky" shortcut="S" />
            <ToolBtn id="image" icon={ImagePlus} label="Image" />
            <span className="mx-1 h-6 w-px shrink-0 bg-border" />
            <div className="flex shrink-0 items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-5 w-5 rounded-full border ${color === c ? "ring-2 ring-primary ring-offset-1" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Colour ${c}`}
                />
              ))}
            </div>
            <span className="mx-1 h-6 w-px shrink-0 bg-border" />
            <div className="flex shrink-0 items-center gap-1">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`grid h-7 w-7 place-items-center rounded-md hover:bg-muted ${size === s ? "bg-muted" : ""}`}
                  title={`Size ${s}`}
                >
                  <span className="rounded-full bg-foreground" style={{ width: Math.max(3, s / 1.5), height: Math.max(3, s / 1.5) }} />
                </button>
              ))}
            </div>
            <button
              onClick={() => setFilled((f) => !f)}
              className={`ml-1 grid h-7 w-7 place-items-center rounded-md hover:bg-muted ${filled ? "bg-muted" : ""}`}
              title="Toggle fill for shapes"
            >
              <span className={`block h-3.5 w-3.5 rounded-sm border-2 ${filled ? "bg-foreground/30" : ""}`} style={{ borderColor: "currentColor" }} />
            </button>
            <span className="mx-1 h-6 w-px shrink-0 bg-border" />
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={undo} title="Undo (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={redo} title="Redo (Ctrl+Y)"><Redo2 className="h-4 w-4" /></Button>
            {selection.size > 0 && (
              <>
                <span className="mx-1 h-6 w-px shrink-0 bg-border" />
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={duplicateSel} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={bringForward} title="Bring forward"><ChevronUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={sendBackward} title="Send backward"><ChevronDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => deleteShapes([...selection])} title="Delete"><Trash2 className="h-4 w-4" /></Button>
              </>
            )}
          </>
        )}
      </div>


      {/* Inline text edit overlay */}
      {textEdit && (
        <textarea
          ref={textareaRef}
          value={textEdit.value}
          onChange={(e) => setTextEdit({ ...textEdit, value: e.target.value })}
          onBlur={commitTextEdit}
          onKeyDown={(e) => { if (e.key === "Escape") commitTextEdit(); }}
          style={{
            position: "absolute", left: textEdit.screenX, top: textEdit.screenY,
            width: textEdit.w, height: textEdit.h,
            border: "1px dashed #3b82f6", background: "rgba(255,255,255,0.95)",
            padding: 6, font: `${Math.max(14, size * 4) * cameraRef.current.z}px ui-sans-serif, system-ui, sans-serif`,
            outline: "none", resize: "both", zIndex: 40,
          }}
          placeholder="Type here…"
        />
      )}

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 rounded-full bg-amber-500/95 px-3 py-1 text-xs font-medium text-white shadow">
          <Lock className="mr-1 inline h-3 w-3" /> Board locked by teacher
        </div>
      )}

      {/* Empty state */}
      {shapesRef.current.length === 0 && !drawingRef.current && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center text-sm text-muted-foreground">
          Pick a tool below and start drawing.
        </div>
      )}
    </div>
  );
});

function ExportMenu({ shapesRef, imageCacheRef }: { shapesRef: React.MutableRefObject<Shape[]>; imageCacheRef: React.MutableRefObject<Map<string, HTMLImageElement>> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpen((o) => !o)} title="Export">
        <Download className="mr-1 h-3.5 w-3.5" /> Export
      </Button>
      {open && (
        <div className="absolute right-0 top-9 z-40 w-40 overflow-hidden rounded-lg border bg-popover py-1 text-xs shadow-lg">
          <button className="block w-full px-3 py-1.5 text-left hover:bg-muted" onClick={async () => { setOpen(false); await exportPNG(shapesRef.current, imageCacheRef.current); toast.success("PNG exported"); }}>PNG image</button>
          <button className="block w-full px-3 py-1.5 text-left hover:bg-muted" onClick={async () => { setOpen(false); await exportJPG(shapesRef.current, imageCacheRef.current); toast.success("JPG exported"); }}>JPG image</button>
          <button className="block w-full px-3 py-1.5 text-left hover:bg-muted" onClick={async () => { setOpen(false); await exportPDF(shapesRef.current, imageCacheRef.current); toast.success("PDF exported"); }}>PDF document</button>
          <button className="block w-full px-3 py-1.5 text-left hover:bg-muted" onClick={() => { setOpen(false); exportJSON(shapesRef.current); }}>JSON file</button>
        </div>
      )}
    </div>
  );
}

function cursorFor(tool: ToolId, spaceDown: boolean): string {
  if (spaceDown || tool === "hand") return "grab";
  if (tool === "select") return "default";
  if (tool === "eraser") return "crosshair";
  return "crosshair";
}

export function hashColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360} 70% 50%)`;
}

function handleStyle(x: number, y: number, cursor: string): React.CSSProperties {
  return {
    position: "absolute", left: x - 6, top: y - 6, width: 12, height: 12,
    background: "#ffffff", border: "1.5px solid #3b82f6", borderRadius: 3,
    cursor, zIndex: 35, touchAction: "none", boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
  };
}
