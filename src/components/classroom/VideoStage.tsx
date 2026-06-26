import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { VideoCard } from "./VideoCard";
import type { ConnectionQuality } from "@/lib/classroom-rtc";

interface VideoSlot {
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
  /** mobile = floating draggable PiPs, desktop = side-by-side strip */
  variant: "strip" | "floating";
}

export function VideoStage({ tutor, student, variant }: Props) {
  if (variant === "strip") {
    return (
      <div className="grid h-full grid-cols-2 gap-2">
        <VideoCard {...tutor} className="h-full min-h-[120px]" />
        <VideoCard {...student} className="h-full min-h-[120px]" />
      </div>
    );
  }
  return (
    <>
      <FloatingTile slot={tutor} initial={{ x: 12, y: 80 }} />
      <FloatingTile slot={student} initial={{ x: 12, y: 220 }} />
    </>
  );
}

function FloatingTile({ slot, initial }: { slot: VideoSlot; initial: { x: number; y: number } }) {
  const [pos, setPos] = useState(initial);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: Math.max(4, Math.min(window.innerWidth - 124, e.clientX - dragRef.current.dx)),
        y: Math.max(56, Math.min(window.innerHeight - 124, e.clientY - dragRef.current.dy)),
      });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div
      className="fixed z-40 h-32 w-24 touch-none select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="absolute inset-0">
        <VideoCard {...slot} compact className="h-full" />
      </div>
      <button
        aria-label="Drag video"
        className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 p-1 text-white"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
        }}
      >
        <GripVertical className="h-3 w-3" />
      </button>
    </div>
  );
}
