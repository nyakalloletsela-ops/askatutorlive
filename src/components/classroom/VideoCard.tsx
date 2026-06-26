import { useEffect, useRef } from "react";
import { MicOff, MonitorUp, Maximize2, PictureInPicture2, VideoOff, Signal, SignalLow, SignalMedium, SignalZero } from "lucide-react";
import type { ConnectionQuality } from "@/lib/classroom-rtc";

interface Props {
  stream: MediaStream | null;
  name: string;
  isLocal?: boolean;
  micOn?: boolean;
  cameraOn?: boolean;
  screenSharing?: boolean;
  quality?: ConnectionQuality;
  speaking?: boolean;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

function QualityIcon({ q }: { q: ConnectionQuality }) {
  const cls = "h-3.5 w-3.5";
  if (q === "good") return <Signal className={`${cls} text-emerald-400`} />;
  if (q === "fair") return <SignalMedium className={`${cls} text-amber-400`} />;
  if (q === "poor") return <SignalLow className={`${cls} text-rose-400`} />;
  return <SignalZero className={`${cls} text-muted-foreground`} />;
}

export function VideoCard({
  stream, name, isLocal, micOn = true, cameraOn = true, screenSharing, quality = "unknown",
  speaking, placeholder = "Waiting…", className = "", compact,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  const toggleFullscreen = async () => {
    const el = videoRef.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await el.requestFullscreen?.();
  };

  const togglePiP = async () => {
    const v = videoRef.current as HTMLVideoElement & { requestPictureInPicture?: () => Promise<PictureInPictureWindow> };
    if (!v) return;
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await v.requestPictureInPicture?.();
  };

  return (
    <div
      className={`group relative isolate overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg ring-1 ring-black/40 ${speaking ? "ring-2 ring-primary" : ""} ${className}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`h-full w-full object-cover ${!stream || !cameraOn ? "opacity-0" : "opacity-100"}`}
      />
      {(!stream || !cameraOn) && (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-zinc-900 to-zinc-800 text-zinc-300">
          <div className="flex flex-col items-center gap-2">
            <div className={`grid ${compact ? "h-10 w-10 text-sm" : "h-16 w-16 text-xl"} place-items-center rounded-full bg-zinc-700 font-semibold`}>
              {initials}
            </div>
            {!compact && <p className="text-xs text-zinc-400">{stream ? "Camera off" : placeholder}</p>}
          </div>
        </div>
      )}

      {/* Top-right badges */}
      <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
        <QualityIcon q={quality} />
        {screenSharing && <MonitorUp className="h-3 w-3 text-sky-300" />}
      </div>

      {/* Bottom-left name + states */}
      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 truncate rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
          <span className={`h-1.5 w-1.5 rounded-full ${speaking ? "bg-emerald-400 animate-pulse" : "bg-zinc-400"}`} />
          <span className="truncate">{name}{isLocal ? " (You)" : ""}</span>
          {!micOn && <MicOff className="h-3 w-3 text-rose-300" />}
          {!cameraOn && <VideoOff className="h-3 w-3 text-rose-300" />}
        </div>
        {!compact && stream && (
          <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button onClick={togglePiP} title="Picture in picture" className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80">
              <PictureInPicture2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={toggleFullscreen} title="Full screen" className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80">
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
