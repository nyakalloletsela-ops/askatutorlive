import { Link } from "@tanstack/react-router";
import { ArrowLeft, Circle, Signal, SignalLow, SignalMedium, SignalZero, Users, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtTimer, useSessionTimer } from "./useSessionTimer";
import type { ConnectionQuality } from "@/lib/classroom-rtc";

interface Props {
  roomId: string;
  title?: string;
  tutorName?: string;
  studentName?: string;
  participantsCount: number;
  quality: ConnectionQuality;
  recording?: boolean;
  onOpenSettings: () => void;
}

function QualityChip({ q }: { q: ConnectionQuality }) {
  const map: Record<ConnectionQuality, { Icon: typeof Signal; label: string; cls: string }> = {
    good: { Icon: Signal, label: "Stable", cls: "text-emerald-500" },
    fair: { Icon: SignalMedium, label: "Fair", cls: "text-amber-500" },
    poor: { Icon: SignalLow, label: "Poor", cls: "text-rose-500" },
    unknown: { Icon: SignalZero, label: "—", cls: "text-muted-foreground" },
  };
  const { Icon, label, cls } = map[q];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px] font-medium">
      <Icon className={`h-3.5 w-3.5 ${cls}`} /> {label}
    </span>
  );
}

export function ClassroomHeader({
  roomId, title = "Live Classroom", tutorName, studentName, participantsCount,
  quality, recording, onOpenSettings,
}: Props) {
  const elapsed = useSessionTimer();
  void roomId;
  const subtitle = [tutorName && `Tutor: ${tutorName}`, studentName && `Student: ${studentName}`].filter(Boolean).join(" · ");

  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/95 px-3 py-2 backdrop-blur sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Button asChild size="icon" variant="ghost" className="shrink-0">
          <Link to="/dashboard" aria-label="Back to dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>
          {subtitle && <p className="hidden truncate text-[11px] text-muted-foreground sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="hidden items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px] font-medium sm:inline-flex">
          <Users className="h-3.5 w-3.5" /> {participantsCount}
        </span>
        <span className="hidden items-center gap-1 rounded-full border bg-card px-2 py-0.5 font-mono text-[11px] sm:inline-flex">
          {fmtTimer(elapsed)}
        </span>
        <span className={`hidden items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium sm:inline-flex ${recording ? "border-rose-500/40 bg-rose-500/10 text-rose-600" : "bg-card text-muted-foreground"}`}>
          <Circle className={`h-2 w-2 fill-current ${recording ? "animate-pulse text-rose-500" : ""}`} />
          {recording ? "Recording" : "Not recording"}
        </span>
        <div className="hidden sm:block"><QualityChip q={quality} /></div>
        <Button size="icon" variant="ghost" onClick={onOpenSettings} aria-label="Settings">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
