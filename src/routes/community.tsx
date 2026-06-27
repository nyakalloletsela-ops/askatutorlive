import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { MessageSquare, Plus, Send, Users, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/community")({
  component: CommunityPage,
  head: () => ({
    meta: [
      { title: "Community Forum — Ask A Tutor Live" },
      { name: "description", content: "Join study groups, ask questions, and share answers with students and tutors across Africa." },
      { property: "og:title", content: "Community Forum — Ask A Tutor Live" },
      { property: "og:description", content: "A friendly place to ask, answer, and study together." },
    ],
  }),
});

type Post = {
  id: string;
  parent_id: string | null;
  title: string | null;
  body: string;
  subject: string | null;
  created_at: string;
  author_name: string;
};


function CommunityPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("forum_posts_public" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setPosts((data as Post[] | null) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const threads = posts.filter((p) => !p.parent_id);
  const replies = (parentId: string) => posts.filter((p) => p.parent_id === parentId).reverse();

  const create = async () => {
    if (!user) return toast.error("Please sign in to post");
    if (!body.trim() || !title.trim()) return;
    const { error } = await supabase.from("forum_posts").insert({
      user_id: user.id, title: title.trim(), body: body.trim(), subject: subject.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Posted");
    setTitle(""); setBody(""); setSubject("");
    load();
  };

  const reply = async (parentId: string, text: string) => {
    if (!user) return toast.error("Please sign in to reply");
    if (!text.trim()) return;
    const { error } = await supabase.from("forum_posts").insert({
      user_id: user.id, parent_id: parentId, body: text.trim(),
    });
    if (error) return toast.error(error.message);
    load();
  };

  const openThread = openId ? threads.find((t) => t.id === openId) : null;

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aurora text-white shadow-glow">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Community Forum</h1>
            <p className="text-sm text-muted-foreground">Ask, answer, study together.</p>
          </div>
        </div>

        {openThread ? (
          <div className="space-y-3">
            <Button variant="ghost" size="sm" onClick={() => setOpenId(null)}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to all threads
            </Button>
            <Card>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">{openThread.title}</h2>
                  {openThread.subject && <Badge variant="secondary">{openThread.subject}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  by {openThread.author_name} · {new Date(openThread.created_at).toLocaleString()}
                </p>
                <p className="whitespace-pre-wrap pt-2 text-sm">{openThread.body}</p>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {replies(openThread.id).map((r) => (
                <Card key={r.id} className="border-l-4 border-l-primary/40">
                  <CardContent className="space-y-1 p-3">
                    <p className="text-xs text-muted-foreground">
                      {r.author_name} · {new Date(r.created_at).toLocaleString()}
                    </p>
                    <p className="whitespace-pre-wrap text-sm">{r.body}</p>
                  </CardContent>
                </Card>
              ))}
              {replies(openThread.id).length === 0 && (
                <p className="px-2 text-sm text-muted-foreground">Be the first to reply.</p>
              )}
            </div>

            <ReplyBox onSend={(text) => reply(openThread.id, text)} disabled={!user} />
          </div>
        ) : (
          <>
            {user ? (
              <Card className="mb-4 border-primary/30">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Start a new thread</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Help with quadratics)" />
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" />
                  </div>
                  <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What's on your mind?" />
                  <div className="flex justify-end">
                    <Button onClick={create} disabled={!title.trim() || !body.trim()} className="bg-aurora text-white hover:opacity-90">
                      <Send className="mr-2 h-4 w-4" /> Post
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="mb-4">
                <CardContent className="flex items-center justify-between p-4">
                  <p className="text-sm text-muted-foreground">Sign in to start a thread or reply.</p>
                  <Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : threads.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No threads yet — be the first!</CardContent></Card>
            ) : (
              <ul className="space-y-2">
                {threads.map((t, i) => (
                  <motion.li
                    key={t.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.2) }}
                  >
                    <button
                      onClick={() => setOpenId(t.id)}
                      className="block w-full text-left"
                    >
                      <Card className="transition-colors hover:border-primary/50">
                        <CardContent className="space-y-1 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="truncate font-semibold">{t.title ?? "(no title)"}</h3>
                            {t.subject && <Badge variant="secondary" className="shrink-0">{t.subject}</Badge>}
                          </div>
                          <p className="line-clamp-2 text-sm text-muted-foreground">{t.body}</p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span>{t.author_name}</span>
                            <span>·</span>
                            <span>{new Date(t.created_at).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" /> {replies(t.id).length}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ReplyBox({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState("");
  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <Textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? "Sign in to reply" : "Write a reply…"}
          disabled={disabled}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={disabled || !text.trim()}
            onClick={() => { onSend(text); setText(""); }}
          >
            <Send className="mr-1 h-3.5 w-3.5" /> Reply
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
