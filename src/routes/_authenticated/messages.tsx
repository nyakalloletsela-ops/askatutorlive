import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Send, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

type Contact = { id: string; name: string; lastAt?: string };
type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

function MessagesPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [active, setActive] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Build contact list from shared sessions
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: ss } = await supabase
        .from("sessions")
        .select("tutor_id, student_id, scheduled_at")
        .or(`tutor_id.eq.${user.id},student_id.eq.${user.id}`);
      const otherIds = Array.from(
        new Set((ss ?? []).map((s) => (s.tutor_id === user.id ? s.student_id : s.tutor_id))),
      );
      if (otherIds.length === 0) {
        setContacts([]);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", otherIds);
      setContacts(
        (profs ?? []).map((p) => ({ id: p.id, name: p.full_name ?? "User" })),
      );
    })();
  }, [user]);

  // Load thread + subscribe to realtime
  useEffect(() => {
    if (!user || !active) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${active.id}),and(sender_id.eq.${active.id},recipient_id.eq.${user.id})`,
        )
        .order("created_at", { ascending: true })
        .limit(500);
      if (!cancelled) setMessages((data as Message[]) ?? []);
      // mark unread as read
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("sender_id", active.id)
        .eq("recipient_id", user.id)
        .is("read_at", null);
    })();

    const ch = supabase
      .channel(`messages-${user.id}-${active.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          if (
            (m.sender_id === user.id && m.recipient_id === active.id) ||
            (m.sender_id === active.id && m.recipient_id === user.id)
          ) {
            setMessages((prev) => [...prev, m]);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user, active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!user || !active || !text.trim()) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      recipient_id: active.id,
      body,
    });
    if (error) {
      toast.error(error.message);
      setText(body);
    }
  };

  const sorted = useMemo(() => contacts, [contacts]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-12">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Messages</h1>
        <Card className="overflow-hidden">
          <div className="grid h-[70vh] grid-cols-1 md:grid-cols-[260px_1fr]">
            <aside className="overflow-y-auto border-b md:border-b-0 md:border-r">
              {sorted.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
                  <MessageSquare className="h-6 w-6" />
                  <p className="text-sm">No conversations yet. Book or schedule a session to start chatting.</p>
                </div>
              ) : (
                <ul className="divide-y">
                  {sorted.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setActive(c)}
                        className={`w-full px-4 py-3 text-left text-sm hover:bg-muted/60 ${
                          active?.id === c.id ? "bg-muted" : ""
                        }`}
                      >
                        <p className="font-medium">{c.name}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
            <section className="flex min-h-0 flex-col">
              {!active ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Select a conversation
                </div>
              ) : (
                <>
                  <header className="border-b px-4 py-3">
                    <p className="font-semibold">{active.name}</p>
                  </header>
                  <div className="flex-1 space-y-2 overflow-y-auto p-4">
                    {messages.map((m) => {
                      const mine = m.sender_id === user.id;
                      return (
                        <div
                          key={m.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                              mine
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                            <p className={`mt-1 text-[10px] opacity-70`}>
                              {new Date(m.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                  <CardContent className="border-t p-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        send();
                      }}
                      className="flex gap-2"
                    >
                      <Input
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Type a message…"
                      />
                      <Button type="submit" disabled={!text.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </CardContent>
                </>
              )}
            </section>
          </div>
        </Card>
      </main>
    </div>
  );
}
