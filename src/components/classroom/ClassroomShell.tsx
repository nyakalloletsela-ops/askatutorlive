import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Video, Loader2, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { useClassroomRTC } from "@/hooks/useClassroomRTC";
import { Whiteboard } from "@/components/whiteboard";
import { ClassroomHeader } from "./ClassroomHeader";
import { AnimatedVideoLayout, VideoLayout, type LayoutMode, type VideoSlot } from "./VideoLayout";
import { ActionBar, type PanelKey } from "./ActionBar";
import { ClassroomSidePanel } from "./SidePanel";
import { DeviceSettingsDialog } from "./DeviceSettingsDialog";

interface Props {
  roomId: string;
  userId: string;
  displayName: string;
  isTutor: boolean;
  isAdmin: boolean;
  tutorName?: string;
  studentName?: string;
}

export function ClassroomShell({ roomId, userId, displayName, isTutor, isAdmin, tutorName, studentName }: Props) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [panel, setPanel] = useState<PanelKey>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(isMobile ? "TOP_STRIP" : "DOCKED");
  const [stripCollapsed, setStripCollapsed] = useState(false);
  const [stripHidden, setStripHidden] = useState(false);
  const rtc = useClassroomRTC({ roomId, userId, displayName });

  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, []);

  const togglePanel = (p: Exclude<PanelKey, null>) => setPanel((cur) => (cur === p ? null : p));

  const onLeave = async () => {
    await rtc.leave();
    void navigate({ to: "/dashboard" });
  };

  const participants = 1 + (rtc.remote ? 1 : 0);

  const localSlot: VideoSlot = {
    stream: rtc.localStream,
    name: displayName,
    isLocal: true,
    micOn: rtc.micOn,
    cameraOn: rtc.cameraOn,
    screenSharing: rtc.screenSharing,
    quality: rtc.stats.quality,
    placeholder: rtc.joined ? "Camera off" : "Tap join to start",
  };
  const remoteSlot: VideoSlot = {
    stream: rtc.remoteStream,
    name: rtc.remote?.displayName ?? "Waiting for guest…",
    isLocal: false,
    micOn: true,
    cameraOn: !!rtc.remoteStream,
    screenSharing: rtc.remote?.isScreenSharing,
    quality: rtc.stats.quality,
    placeholder: "Waiting…",
  };
  const tutorSlot = isTutor ? localSlot : remoteSlot;
  const studentSlot = isTutor ? remoteSlot : localSlot;

  // Mobile collapses DOCKED to TOP_STRIP (no room for a 280px sidebar).
  const effectiveMode: LayoutMode = isMobile && layoutMode === "DOCKED" ? "TOP_STRIP" : layoutMode;
  const isTopStrip = effectiveMode === "TOP_STRIP";

  return (
    <div className="flex h-screen flex-col bg-muted/30 text-foreground">
      <ClassroomHeader
        roomId={roomId}
        tutorName={tutorName}
        studentName={studentName}
        participantsCount={participants}
        quality={rtc.stats.quality}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="relative flex min-h-0 flex-1 gap-2 p-2">
        {/* Docked sidebar (left) — only when DOCKED on desktop */}
        {effectiveMode === "DOCKED" && (
          <motion.aside
            layout
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="shrink-0 overflow-hidden rounded-2xl border bg-card shadow-sm"
          >
            <AnimatedVideoLayout tutor={tutorSlot} student={studentSlot} mode="DOCKED" />
          </motion.aside>
        )}

        {/* Center column: [optional top-strip video] + whiteboard + action bar */}
        <section className="flex min-w-0 flex-1 flex-col gap-2">
          {/* In-flow top strip video — does NOT overlap the whiteboard */}
          <AnimatePresence initial={false}>
            {rtc.joined && isTopStrip && !stripHidden && (
              <VideoLayout
                key="top-strip"
                tutor={tutorSlot}
                student={studentSlot}
                mode="TOP_STRIP"
                collapsed={stripCollapsed}
                onCollapseToggle={() => setStripCollapsed((v) => !v)}
                onHide={() => setStripHidden(true)}
              />
            )}
          </AnimatePresence>

          {/* Floating "show video" pill — only visible when user hid the strip */}
          {rtc.joined && isTopStrip && stripHidden && (
            <button
              onClick={() => { setStripHidden(false); setStripCollapsed(false); }}
              className="absolute right-3 top-16 z-40 flex items-center gap-1 rounded-full bg-zinc-900/90 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur hover:bg-zinc-900"
              title="Show video"
            >
              <Eye className="h-3.5 w-3.5" /> Show video
            </button>
          )}

          <motion.div
            layout
            transition={{ duration: 0.25 }}
            className="relative z-0 min-h-0 flex-1 overflow-hidden rounded-2xl border bg-card shadow-sm"
          >
            <Whiteboard roomId={roomId} userId={userId} userName={displayName} isTeacher={isTutor || isAdmin} />
          </motion.div>

          {/* Action bar */}
          <div className="pointer-events-none sticky bottom-2 z-30 flex justify-center px-2">
            <ActionBar
              micOn={rtc.micOn}
              cameraOn={rtc.cameraOn}
              screenSharing={rtc.screenSharing}
              panel={panel}
              layoutMode={layoutMode}
              onSetLayout={setLayoutMode}
              onToggleMic={() => void rtc.service.toggleMic()}
              onToggleCamera={() => void rtc.service.toggleCamera()}
              onToggleScreen={() =>
                rtc.screenSharing ? void rtc.service.stopScreenShare() : void rtc.service.startScreenShare()
              }
              onTogglePanel={togglePanel}
              onOpenSettings={() => setSettingsOpen(true)}
              onLeave={onLeave}
            />
          </div>
        </section>

        {/* Desktop right side panel (chat / files / notes / AI) */}
        {!isMobile && panel && (
          <aside className="w-[360px] shrink-0 overflow-hidden rounded-2xl border bg-card shadow-sm">
            <ClassroomSidePanel
              open={panel}
              onChange={(p) => setPanel(p)}
              roomId={roomId}
              userId={userId}
              displayName={displayName}
            />
          </aside>
        )}

        {/* Focus mode overlay — only when joined */}
        {rtc.joined && effectiveMode === "FOCUS" && (
          <AnimatedVideoLayout tutor={tutorSlot} student={studentSlot} mode={effectiveMode} />
        )}

        {/* Mobile bottom sheet for side panels */}
        <Sheet open={isMobile && !!panel} onOpenChange={(o) => !o && setPanel(null)}>
          <SheetContent side="bottom" className="h-[80vh] p-0">
            {panel && (
              <ClassroomSidePanel
                open={panel}
                onChange={(p) => setPanel(p)}
                roomId={roomId}
                userId={userId}
                displayName={displayName}
              />
            )}
          </SheetContent>
        </Sheet>

        {/* Pre-join overlay */}
        {!rtc.joined && (
          <div className="absolute inset-0 z-50 grid place-items-center bg-background/85 backdrop-blur-sm">
            <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center shadow-xl">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Video className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold">Ready to join the classroom?</h2>
              <p className="text-xs text-muted-foreground">
                Your browser will ask for camera and microphone access. You can change devices any time from the settings cog.
              </p>
              {rtc.error && <p className="text-xs text-destructive">{rtc.error}</p>}
              <Button size="lg" onClick={() => void rtc.join()} disabled={rtc.joining} className="w-full">
                {rtc.joining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}
                {rtc.joining ? "Joining…" : "Join classroom"}
              </Button>
              <button onClick={onLeave} className="text-xs text-muted-foreground hover:text-foreground">
                Cancel and go back
              </button>
            </div>
          </div>
        )}
      </main>

      <DeviceSettingsDialog service={rtc.service} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
