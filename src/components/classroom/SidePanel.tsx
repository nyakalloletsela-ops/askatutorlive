import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClassroomChat } from "./ClassroomChat";
import { AIAssistantPanel } from "./AIAssistantPanel";
import { ClassroomFiles } from "@/components/ClassroomFiles";
import { useEffect, useState } from "react";

export type SidePanelKey = "chat" | "files" | "notes" | "ai" | "lab";

interface Props {
  open: SidePanelKey;
  onChange: (open: SidePanelKey | null) => void;
  roomId: string;
  userId: string;
  displayName: string;
}

export function ClassroomSidePanel({ open, onChange, roomId, userId, displayName }: Props) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col border-l bg-card">
      <Tabs value={open} onValueChange={(v) => onChange(v as SidePanelKey)} className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b px-2 py-2">
          <TabsList className="grid flex-1 grid-cols-5">
            <TabsTrigger value="chat" className="text-xs">Chat</TabsTrigger>
            <TabsTrigger value="files" className="text-xs">Files</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs">AI</TabsTrigger>
            <TabsTrigger value="lab" className="text-xs">Lab</TabsTrigger>
          </TabsList>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => onChange(null)} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <TabsContent value="chat" className="m-0 min-h-0 flex-1">
          <ClassroomChat roomId={roomId} userId={userId} displayName={displayName} />
        </TabsContent>
        <TabsContent value="files" className="m-0 min-h-0 flex-1 overflow-auto">
          <ClassroomFiles roomId={roomId} />
        </TabsContent>
        <TabsContent value="notes" className="m-0 min-h-0 flex-1">
          <NotesTab roomId={roomId} />
        </TabsContent>
        <TabsContent value="ai" className="m-0 min-h-0 flex-1">
          <AIAssistantPanel />
        </TabsContent>
        <TabsContent value="lab" className="m-0 min-h-0 flex-1">
          <LabTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LabTab() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs">
        <span className="font-semibold">Simulation Lab</span>
        <a href="/labs/simulation-lab" target="_blank" rel="noreferrer" className="text-primary hover:underline">Open full screen</a>
      </div>
      <iframe
        src="/labs/simulation-lab"
        title="Simulation Lab"
        className="min-h-0 w-full flex-1 border-0"
        allow="fullscreen; clipboard-read; clipboard-write"
      />
    </div>
  );
}

function NotesTab({ roomId }: { roomId: string }) {
  const key = `classroom-notes:${roomId}`;
  const [value, setValue] = useState("");
  useEffect(() => {
    try { setValue(localStorage.getItem(key) ?? ""); } catch { /* */ }
  }, [key]);
  useEffect(() => {
    const id = setTimeout(() => { try { localStorage.setItem(key, value); } catch { /* */ } }, 300);
    return () => clearTimeout(id);
  }, [key, value]);
  return (
    <div className="flex h-full flex-col p-3">
      <p className="mb-2 text-xs text-muted-foreground">Private notes — auto-saved on this device.</p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Take notes during the lesson…"
        className="min-h-0 flex-1 resize-none rounded-xl border bg-background p-3 font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}
