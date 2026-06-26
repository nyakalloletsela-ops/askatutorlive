import { Hand, Users, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Participant } from "@/lib/classroom-rtc/types";

interface Props {
  participants: Participant[];
  roomId: string;
  selfId: string;
  selfName: string;
  isTutor: boolean;
}

export function ParticipantsPanel({ participants, roomId, selfId, selfName, isTutor }: Props) {
  const [raised, setRaised] = useState(false);
  const [hands, setHands] = useState<Set<string>>(new Set());
  const [chanRef, setChanRef] = useState<RealtimeChannel | null>(null);

  // Lightweight Supabase Realtime broadcast for raised hands.
  useEffect(() => {
    const channel = supabase.channel(`hands:${roomId}`, { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "hand" }, (payload) => {
      const { senderId, raised: r } = payload.payload as { senderId: string; raised: boolean };
      setHands((prev) => {
        const next = new Set(prev);
        if (r) next.add(senderId); else next.delete(senderId);
        return next;
      });
    });
    channel.subscribe();
    setChanRef(channel);
    return () => { supabase.removeChannel(channel); setChanRef(null); };
  }, [roomId]);

  const toggleHand = () => {
    const next = !raised;
    setRaised(next);
    chanRef?.send({ type: "broadcast", event: "hand", payload: { senderId: selfId, raised: next } });
  };

  return (
    <aside className="flex h-full w-full flex-col bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" /> Participants
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {participants.length + 1}
          </span>
        </div>
      </div>

      <Button
        size="sm"
        variant={raised ? "default" : "outline"}
        className="m-3 h-9 justify-start gap-2"
        onClick={toggleHand}
      >
        <Hand className={`h-4 w-4 ${raised ? "animate-pulse" : ""}`} />
        {raised ? "Hand raised — lower" : "Raise hand"}
      </Button>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        <ParticipantRow
          name={`${selfName}${isTutor ? " (Tutor)" : ""} · You`}
          status="joined"
          raised={raised}
          highlight={isTutor}
        />
        {participants.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">Waiting for others to join…</p>
        ) : (
          participants.map((p) => (
            <ParticipantRow
              key={p.id}
              name={p.displayName ?? "Guest"}
              status={p.status}
              raised={hands.has(p.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function ParticipantRow({
  name,
  status,
  raised,
  highlight,
}: {
  name: string;
  status: string;
  raised?: boolean;
  highlight?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
        highlight ? "bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/50"
      }`}
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
        {initials || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{name}</p>
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Circle
            className={`h-2 w-2 fill-current ${status === "joined" ? "text-emerald-500" : "text-amber-500"}`}
          />
          {status === "joined" ? "Online" : "Connecting"}
        </p>
      </div>
      {raised && <Hand className="h-3.5 w-3.5 text-amber-500" />}
    </div>
  );
}
