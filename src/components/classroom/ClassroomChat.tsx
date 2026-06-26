import { useEffect, useRef, useState } from "react";
import { Send, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ChatRow {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  body: string;
  created_at: string;
}

interface Props {
  roomId: string;
  userId: string;
  displayName: string;
}

export function ClassroomChat({ roomId, userId, displayName }: Props) {
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("classroom_chat")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!cancelled && !error && data) setMessages(data as ChatRow[]);
    })();

    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "classroom_chat", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as ChatRow).id) ? prev : [...prev, payload.new as ChatRow],
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    const { error } = await supabase.from("classroom_chat").insert({
      room_id: roomId,
      user_id: userId,
      display_name: displayName,
      body,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setInput("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2.5 text-sm font-semibold">
        <MessageSquare className="h-4 w-4" /> Classroom chat
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">No messages yet — start the conversation.</p>
        )}
        {messages.map((m) => {
          const mine = m.user_id === userId;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <span className="px-1 text-[10px] text-muted-foreground">{m.display_name}</span>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm shadow-sm ${
                  mine
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-muted text-foreground"
                }`}
              >
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-center gap-2 border-t bg-background/50 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="h-9"
          disabled={sending}
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={sending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
