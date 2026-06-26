import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, MessageSquare, FileText, StickyNote, Sparkles, PhoneOff, Settings, PanelLeft, Focus, MoreHorizontal, LayoutPanelTop, FlaskConical, Atom } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LayoutMode } from "./VideoLayout";

export type PanelKey = "chat" | "files" | "notes" | "ai" | "lab" | null;

interface Props {
  micOn: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  panel: PanelKey;
  layoutMode: LayoutMode;
  onSetLayout: (mode: LayoutMode) => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onTogglePanel: (panel: Exclude<PanelKey, null>) => void;
  onOpenSettings: () => void;
  onLeave: () => void;
}

export function ActionBar(props: Props) {
  const {
    micOn, cameraOn, screenSharing, panel, layoutMode,
    onSetLayout, onToggleMic, onToggleCamera, onToggleScreen, onTogglePanel, onOpenSettings, onLeave,
  } = props;
  const isMobile = useIsMobile();

  // ---- Mobile: essentials inline (mic / camera / chat / more / leave) ----
  if (isMobile) {
    return (
      <div className="pointer-events-auto mx-auto flex w-full max-w-md items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-zinc-900/90 px-2 py-1.5 shadow-2xl backdrop-blur">
        <CircleButton active={micOn} onClick={onToggleMic} title={micOn ? "Mute" : "Unmute"} danger={!micOn}>
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </CircleButton>
        <CircleButton active={cameraOn} onClick={onToggleCamera} title={cameraOn ? "Stop camera" : "Start camera"} danger={!cameraOn}>
          {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </CircleButton>
        <CircleButton active={panel === "chat"} onClick={() => onTogglePanel("chat")} title="Chat">
          <MessageSquare className="h-4 w-4" />
        </CircleButton>

        <Popover>
          <PopoverTrigger asChild>
            <button title="More" aria-label="More actions" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-64 rounded-2xl border-white/10 bg-zinc-900/95 p-3 text-white backdrop-blur">
            <Group title="Share">
              <PillButton active={screenSharing} onClick={onToggleScreen} icon={screenSharing ? <MonitorOff className="h-3.5 w-3.5" /> : <MonitorUp className="h-3.5 w-3.5" />} label={screenSharing ? "Stop sharing" : "Share screen"} />
            </Group>
            <Group title="Video layout">
              <PillButton active={layoutMode === "TOP_STRIP"} onClick={() => onSetLayout("TOP_STRIP")} icon={<LayoutPanelTop className="h-3.5 w-3.5" />} label="Top strip" />
              <PillButton active={layoutMode === "DOCKED"} onClick={() => onSetLayout("DOCKED")} icon={<PanelLeft className="h-3.5 w-3.5" />} label="Docked" />
              <PillButton active={layoutMode === "FOCUS"} onClick={() => onSetLayout("FOCUS")} icon={<Focus className="h-3.5 w-3.5" />} label="Focus" />
            </Group>
            <Group title="Panels">
              <PillButton active={panel === "files"} onClick={() => onTogglePanel("files")} icon={<FileText className="h-3.5 w-3.5" />} label="Files" />
              <PillButton active={panel === "notes"} onClick={() => onTogglePanel("notes")} icon={<StickyNote className="h-3.5 w-3.5" />} label="Notes" />
              <PillButton active={panel === "ai"} onClick={() => onTogglePanel("ai")} icon={<Sparkles className="h-3.5 w-3.5" />} label="AI Tutor" />
            </Group>
            <Group title="Labs">
              <LinkPill to="/labs" icon={<FlaskConical className="h-3.5 w-3.5" />} label="PhET Lab" />
              <LinkPill to="/labs/simulation-lab" icon={<Atom className="h-3.5 w-3.5" />} label="Simulation Lab" />
            </Group>
            <Group title="System">
              <PillButton onClick={onOpenSettings} icon={<Settings className="h-3.5 w-3.5" />} label="Devices" />
            </Group>
          </PopoverContent>
        </Popover>

        <Button onClick={onLeave} variant="destructive" size="sm" className="ml-1 h-9 shrink-0 rounded-full px-3">
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // ---- Desktop / tablet: full bar ----
  return (
    <div className="pointer-events-auto mx-auto flex w-full max-w-3xl items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-zinc-900/85 px-2 py-2 shadow-2xl backdrop-blur sm:gap-2">
      <CircleButton active={micOn} onClick={onToggleMic} title={micOn ? "Mute" : "Unmute"} danger={!micOn}>
        {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
      </CircleButton>
      <CircleButton active={cameraOn} onClick={onToggleCamera} title={cameraOn ? "Stop camera" : "Start camera"} danger={!cameraOn}>
        {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
      </CircleButton>
      <CircleButton active={screenSharing} onClick={onToggleScreen} title={screenSharing ? "Stop sharing" : "Share screen"} accent={screenSharing}>
        {screenSharing ? <MonitorOff className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
      </CircleButton>

      <span className="mx-1 h-6 w-px bg-white/15" />

      <CircleButton active={layoutMode === "TOP_STRIP"} onClick={() => onSetLayout("TOP_STRIP")} title="Top strip video">
        <LayoutPanelTop className="h-4 w-4" />
      </CircleButton>
      <CircleButton active={layoutMode === "DOCKED"} onClick={() => onSetLayout("DOCKED")} title="Dock video to sidebar">
        <PanelLeft className="h-4 w-4" />
      </CircleButton>
      <CircleButton active={layoutMode === "FOCUS"} onClick={() => onSetLayout("FOCUS")} title="Focus whiteboard">
        <Focus className="h-4 w-4" />
      </CircleButton>

      <span className="mx-1 h-6 w-px bg-white/15" />

      <CircleButton active={panel === "chat"} onClick={() => onTogglePanel("chat")} title="Chat">
        <MessageSquare className="h-4 w-4" />
      </CircleButton>
      <CircleButton active={panel === "files"} onClick={() => onTogglePanel("files")} title="Files">
        <FileText className="h-4 w-4" />
      </CircleButton>
      <CircleButton active={panel === "notes"} onClick={() => onTogglePanel("notes")} title="Notes">
        <StickyNote className="h-4 w-4" />
      </CircleButton>
      <CircleButton active={panel === "ai"} onClick={() => onTogglePanel("ai")} title="AI Tutor">
        <Sparkles className="h-4 w-4" />
      </CircleButton>

      <span className="mx-1 h-6 w-px bg-white/15" />

      <Link to="/labs" target="_blank" rel="noreferrer" title="PhET Lab" aria-label="PhET Lab" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
        <FlaskConical className="h-4 w-4" />
      </Link>
      <Link to="/labs/simulation-lab" target="_blank" rel="noreferrer" title="Simulation Lab" aria-label="Simulation Lab" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
        <Atom className="h-4 w-4" />
      </Link>

      <span className="mx-1 h-6 w-px bg-white/15" />

      <CircleButton onClick={onOpenSettings} title="Devices">
        <Settings className="h-4 w-4" />
      </CircleButton>
      <Button onClick={onLeave} variant="destructive" size="sm" className="ml-1 h-9 rounded-full px-3">
        <PhoneOff className="mr-1.5 h-4 w-4" /> Leave
      </Button>
    </div>
  );
}

function CircleButton({
  children, onClick, active, danger, accent, title,
}: {
  children: React.ReactNode; onClick: () => void; active?: boolean; danger?: boolean; accent?: boolean; title: string;
}) {
  const base = "grid h-9 w-9 place-items-center rounded-full transition shrink-0";
  const tone = danger
    ? "bg-rose-500/90 text-white hover:bg-rose-500"
    : accent
    ? "bg-sky-500/90 text-white hover:bg-sky-500"
    : active
    ? "bg-white text-zinc-900 hover:bg-zinc-100"
    : "bg-white/10 text-white hover:bg-white/20";
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className={`${base} ${tone}`}>
      {children}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-white/50">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function PillButton({ active, onClick, icon, label }: { active?: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition ${
        active ? "bg-white text-zinc-900" : "bg-white/10 text-white hover:bg-white/20"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function LinkPill({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white transition hover:bg-white/20"
    >
      {icon}
      {label}
    </Link>
  );
}
