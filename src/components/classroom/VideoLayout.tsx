import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GripVertical, Maximize2, Minimize2, ChevronUp, ChevronDown, EyeOff } from "lucide-react";
import { VideoCard } from "./VideoCard";
import type { ConnectionQuality } from "@/lib/classroom-rtc";

export type LayoutMode = "FLOATING" | "DOCKED" | "FOCUS" | "TOP_STRIP";

export interface VideoSlot {
  stream: MediaStream | null;
  name: string;
  isLocal?: boolean;
  micOn?: boolean;
  cameraOn?: boolean;
  screenSharing?: boolean;
  quality?: ConnectionQuality;
  placeholder?: string;
}

interface Props {
  tutor: VideoSlot;
  student: VideoSlot;
  mode: LayoutMode;
  /** TOP_STRIP only: collapsed = thin status bar, false = full strip */
  collapsed?: boolean;
  onCollapseToggle?: () => void;
  onHide?: () => void;
}

/**
 * Single layout engine for the classroom video panel.
 * - FLOATING:  draggable PiP tiles that snap to nearest corner, hover above the whiteboard.
 * - DOCKED:    left sidebar stack (Teams-style split view). Sized by ClassroomShell via grid.
 * - FOCUS:     collapsed bubble in the bottom-right; click to expand back to a tile.
 * - TOP_STRIP: in-flow horizontal strip at the top (mobile-first). Never overlaps the whiteboard.
 */
export function VideoLayout({ tutor, student, mode, collapsed, onCollapseToggle, onHide }: Props) {
  if (mode === "TOP_STRIP") {
    return <TopStrip tutor={tutor} student={student} collapsed={!!collapsed} onCollapseToggle={onCollapseToggle} onHide={onHide} />;
  }
  if (mode === "DOCKED") {
    return (
      <div className="flex h-full w-full flex-col gap-2 p-2">
        <VideoCard {...tutor} className="min-h-0 flex-1" />
        <VideoCard {...student} className="min-h-0 flex-1" />
      </div>
    );
  }
  if (mode === "FOCUS") {
    return (
      <FocusBubble tutor={tutor} student={student} />
    );
  }
  return (
    <>
      <FloatingTile slot={tutor} initial={{ corner: "tl", x: 16, y: 80 }} label="tutor" />
      <FloatingTile slot={student} initial={{ corner: "tl", x: 16, y: 240 }} label="student" />
    </>
  );
}

/* ---------- Mobile/top horizontal strip (in-flow, never covers whiteboard) ---------- */
function TopStrip({
  tutor, student, collapsed, onCollapseToggle, onHide,
}: { tutor: VideoSlot; student: VideoSlot; collapsed: boolean; onCollapseToggle?: () => void; onHide?: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: collapsed ? 32 : 112 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22 }}
      className="relative w-full shrink-0 overflow-hidden rounded-2xl border bg-zinc-900/90 text-white shadow-sm"
    >
      {collapsed ? (
        <div className="flex h-full w-full items-center justify-between gap-2 px-3 text-xs">
          <span className="truncate opacity-80">📹 {tutor.name} · {student.name}</span>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={onCollapseToggle} className="grid h-6 w-6 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Expand video">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {onHide && (
              <button onClick={onHide} className="grid h-6 w-6 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Hide video">
                <EyeOff className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full gap-1.5 p-1.5">
          <VideoCard {...tutor} compact className="min-w-0 flex-1" />
          <VideoCard {...student} compact className="min-w-0 flex-1" />
          <div className="absolute right-1.5 top-1.5 z-10 flex gap-1">
            <button onClick={onCollapseToggle} className="grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white hover:bg-black" aria-label="Collapse video">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            {onHide && (
              <button onClick={onHide} className="grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white hover:bg-black" aria-label="Hide video">
                <EyeOff className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ---------- Floating draggable + snap-to-corner ---------- */
type Corner = "tl" | "tr" | "bl" | "br";
const TILE_W = 168;
const TILE_H = 120;

function FloatingTile({
  slot,
  initial,
  label,
}: {
  slot: VideoSlot;
  initial: { corner: Corner; x: number; y: number };
  label: string;
}) {
  const [pos, setPos] = useState({ x: initial.x, y: initial.y });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: Math.max(8, Math.min(window.innerWidth - TILE_W - 8, e.clientX - dragRef.current.dx)),
        y: Math.max(64, Math.min(window.innerHeight - TILE_H - 8, e.clientY - dragRef.current.dy)),
      });
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setPos((p) => {
        const W = window.innerWidth, H = window.innerHeight;
        const nearLeft = p.x + TILE_W / 2 < W / 2;
        const nearTop = p.y + TILE_H / 2 < H / 2;
        return {
          x: nearLeft ? 16 : W - TILE_W - 16,
          y: nearTop ? 80 : H - TILE_H - 96,
        };
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <motion.div
      key={`float-${label}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1, left: pos.x, top: pos.y }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="fixed z-40 touch-none select-none rounded-2xl shadow-2xl ring-1 ring-black/20"
      style={{ width: TILE_W, height: TILE_H, left: pos.x, top: pos.y }}
    >
      <VideoCard {...slot} compact className="h-full w-full" />
      <button
        aria-label="Drag video"
        className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 cursor-grab rounded-full bg-black/80 p-1 text-white active:cursor-grabbing"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
        }}
      >
        <GripVertical className="h-3 w-3" />
      </button>
    </motion.div>
  );
}

/* ---------- Focus mode: collapsible bubble in the corner ---------- */
function FocusBubble({ tutor, student }: { tutor: VideoSlot; student: VideoSlot }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="fixed bottom-24 right-4 z-40 overflow-hidden rounded-2xl bg-black/70 shadow-2xl ring-1 ring-white/10 backdrop-blur"
      style={{ width: expanded ? 240 : 96, height: expanded ? 320 : 96 }}
    >
      {expanded ? (
        <div className="flex h-full w-full flex-col gap-1 p-1">
          <VideoCard {...tutor} compact className="min-h-0 flex-1" />
          <VideoCard {...student} compact className="min-h-0 flex-1" />
          <button
            onClick={() => setExpanded(false)}
            className="absolute right-1 top-1 z-10 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white hover:bg-black"
            aria-label="Collapse"
          >
            <Minimize2 className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className="grid h-full w-full place-items-center"
          aria-label="Expand video"
        >
          <VideoCard {...tutor} compact className="h-full w-full" />
          <Maximize2 className="absolute right-1 top-1 h-3 w-3 text-white" />
        </button>
      )}
    </motion.div>
  );
}

/* Animated wrapper so mode changes between modes are smooth */
export function AnimatedVideoLayout(props: Props) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={props.mode}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        className="contents"
      >
        <VideoLayout {...props} />
      </motion.div>
    </AnimatePresence>
  );
}
