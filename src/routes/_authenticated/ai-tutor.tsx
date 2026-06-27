import { SmartMarkdown } from "@/components/ai/SmartMarkdown";
import { SaveToNotes } from "@/components/ai/SaveToNotes";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { aiTutorChat } from "@/lib/ai-tutor.functions";
import { ScopeGate } from "@/components/ScopeGate";


export const Route = createFileRoute("/_authenticated/ai-tutor")({
  component: () => (<ScopeGate scope="ai"><AiTutorPage /></ScopeGate>),
  head: () => ({
    meta: [
      { title: "AI Study Coach — Ask A Tutor" },
      {
        name: "description",
        content:
          "Premium AI study coach that guides you to the answer with hints and concepts — never the full solution.",
      },
    ],
  }),
});

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type MsgContent = string | Array<TextPart | ImagePart>;
type Msg = { role: "user" | "assistant"; content: MsgContent };

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function AiTutorPage() {
  const send = useServerFn(aiTutorChat);
  const [mode, setMode] = useState<"tutor" | "student" | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your AI Study Coach. Tell me the subject and the problem you're stuck on — I'll guide you with hints and concepts, not full answers. When you've understood the idea, I'll ask you to try the solution yourself and upload a photo or file of your working using the paperclip button. What are you working on?",
    },
  ]);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<{ dataUrl: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please upload an image of your working (PNG, JPG, HEIC, etc.).");
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      toast.error("Image is too large. Please keep it under 4 MB.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(f);
      setAttachment({ dataUrl, name: f.name });
    } catch {
      toast.error("Could not read that file.");
    }
  };

  const submit = async () => {
    const text = input.trim();
    if ((!text && !attachment) || loading) return;

    const userContent: MsgContent = attachment
      ? [
          { type: "text", text: text || "Here is my attempt — please comment but don't solve it for me." },
          { type: "image_url", image_url: { url: attachment.dataUrl } },
        ]
      : text;

    const next: Msg[] = [...messages, { role: "user", content: userContent }];
    setMessages(next);
    setInput("");
    setAttachment(null);
    setLoading(true);
    try {
      const { reply, mode: serverMode } = await send({ data: { messages: next } });
      if (serverMode) setMode(serverMode);
      setMessages([...next, { role: "assistant", content: reply || "…" }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(msg);
      setMessages(next.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">AI Study Coach</h1>
        {mode && (
          <span className="ml-auto rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {mode === "tutor" ? "Tutor mode · full solutions" : "Student mode · guided hints"}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {mode === "tutor"
          ? "You are signed in as a tutor — the assistant will provide full worked solutions, marking schemes, and teaching notes."
          : "I guide — I don't solve. Expect questions back, hints, and concept explanations."}
      </p>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m, i) => {
            const prev = i > 0 ? messages[i - 1] : null;
            const promptForTitle =
              m.role === "assistant" && prev?.role === "user"
                ? (typeof prev.content === "string"
                    ? prev.content
                    : (prev.content.find((p) => p.type === "text") as TextPart | undefined)?.text ?? "AI Coach response")
                : "AI Coach response";
            const parts = typeof m.content === "string"
              ? [{ type: "text", text: m.content } as TextPart]
              : m.content;
            const assistantText = m.role === "assistant"
              ? (typeof m.content === "string"
                  ? m.content
                  : parts.filter((p): p is TextPart => p.type === "text").map((p) => p.text).join("\n\n"))
              : "";
            return (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {m.role === "user" ? (
                    <div className="space-y-2">
                      {parts.map((p, idx) =>
                        p.type === "text" ? (
                          <p key={idx} className="whitespace-pre-wrap">{p.text}</p>
                        ) : (
                          <img
                            key={idx}
                            src={p.image_url.url}
                            alt="Student attempt"
                            className="max-h-72 w-auto rounded-lg border border-white/20"
                          />
                        ),
                      )}
                    </div>
                  ) : (
                    <SmartMarkdown>{assistantText}</SmartMarkdown>
                  )}
                  {m.role === "assistant" && i > 0 && (
                    <div className="mt-1 flex justify-end">
                      <SaveToNotes content={assistantText} title={promptForTitle} kind="ai-coach" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="inline h-4 w-4 animate-spin" /> thinking…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="border-t p-2">
          {attachment && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/40 px-2 py-1.5">
              <img src={attachment.dataUrl} alt="Attachment preview" className="h-10 w-10 rounded object-cover" />
              <span className="flex-1 truncate text-xs text-muted-foreground">{attachment.name}</span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                aria-label="Remove attachment"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Upload your attempted solution (photo or screenshot)"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={attachment ? "Add a note about your attempt (optional)…" : "Describe what you're stuck on…"}
              rows={2}
              className="min-h-[44px] resize-none"
              disabled={loading}
            />
            <Button onClick={submit} disabled={loading || (!input.trim() && !attachment)}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
