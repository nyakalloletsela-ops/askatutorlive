import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Shape } from "./engine";

export type WbOp =
  | { kind: "upsert"; senderId: string; shape: Shape }
  | { kind: "delete"; senderId: string; ids: string[] }
  | { kind: "clear"; senderId: string }
  | { kind: "lock"; senderId: string; locked: boolean };

export type WbOpInput =
  | { kind: "upsert"; shape: Shape }
  | { kind: "delete"; ids: string[] }
  | { kind: "clear" }
  | { kind: "lock"; locked: boolean };

export interface CursorMsg {
  senderId: string;
  name: string;
  color: string;
  x: number; y: number;
}

interface UseRealtimeOpts {
  roomId: string;
  selfId: string;
  onOp: (op: WbOp) => void;
  onCursor: (c: CursorMsg) => void;
  onPeerLeave: (id: string) => void;
}

export function useWhiteboardRealtime({ roomId, selfId, onOp, onCursor, onPeerLeave }: UseRealtimeOpts) {
  const chanRef = useRef<RealtimeChannel | null>(null);
  const handlersRef = useRef({ onOp, onCursor, onPeerLeave });
  handlersRef.current = { onOp, onCursor, onPeerLeave };

  useEffect(() => {
    const channel = supabase.channel(`wb:${roomId}`, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "op" }, (payload) => {
        const op = payload.payload as WbOp;
        if (op.senderId !== selfId) handlersRef.current.onOp(op);
      })
      .on("broadcast", { event: "cursor" }, (payload) => {
        const c = payload.payload as CursorMsg;
        if (c.senderId !== selfId) handlersRef.current.onCursor(c);
      })
      .on("broadcast", { event: "leave" }, (payload) => {
        handlersRef.current.onPeerLeave((payload.payload as { senderId: string }).senderId);
      })
      .subscribe();
    chanRef.current = channel;
    return () => {
      try { channel.send({ type: "broadcast", event: "leave", payload: { senderId: selfId } }); } catch { /* noop */ }
      supabase.removeChannel(channel);
      chanRef.current = null;
    };
  }, [roomId, selfId]);

  const sendOp = (op: WbOpInput) => {
    const chan = chanRef.current; if (!chan) return;
    chan.send({ type: "broadcast", event: "op", payload: { ...op, senderId: selfId } });
  };
  const sendCursor = (msg: Omit<CursorMsg, "senderId">) => {
    const chan = chanRef.current; if (!chan) return;
    chan.send({ type: "broadcast", event: "cursor", payload: { ...msg, senderId: selfId } });
  };
  return { sendOp, sendCursor };
}
