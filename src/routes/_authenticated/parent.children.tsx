import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/parent/children")({
  component: ManageChildren,
});

type Link = { id: string; child_id: string; relationship: string | null; status: string };
type Invite = {
  id: string;
  child_email: string;
  token: string;
  status: string;
  expires_at: string;
};

function ManageChildren() {
  const { user } = useAuth();
  const [links, setLinks] = useState<Link[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("parent");
  const [loading, setLoading] = useState(false);
  const [acceptToken, setAcceptToken] = useState("");

  const load = async () => {
    const { data: ls } = await supabase
      .from("parent_child_links")
      .select("id, child_id, relationship, status")
      .eq("parent_id", user!.id);
    setLinks((ls as Link[]) ?? []);
    if (ls?.length) {
      const { data: pr } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ls.map((l) => l.child_id));
      const map: Record<string, string> = {};
      (pr ?? []).forEach((p: any) => (map[p.id] = p.full_name ?? p.id));
      setProfiles(map);
    }
    const { data: iv } = await supabase
      .from("child_invites")
      .select("id, child_email, token, status, expires_at")
      .eq("parent_id", user!.id)
      .order("created_at", { ascending: false });
    setInvites((iv as Invite[]) ?? []);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const invite = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("child_invites").insert({
        parent_id: user!.id,
        child_email: email.trim().toLowerCase(),
      });
      if (error) throw error;
      toast.success("Invite created. Copy the link and send it to your child.");
      setEmail("");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const unlink = async (id: string) => {
    if (!confirm("Unlink this child?")) return;
    const { error } = await supabase.from("parent_child_links").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Unlinked");
    load();
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/parent/children?accept=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  };

  // Auto-fill accept token from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("accept");
    if (t) setAcceptToken(t);
  }, []);

  const accept = async () => {
    if (!acceptToken.trim()) return;
    const { error } = await supabase.rpc("accept_child_invite", { _token: acceptToken.trim() });
    if (error) return toast.error(error.message);
    toast.success("Linked to parent");
    setAcceptToken("");
    load();
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">Manage children</h1>
        <p className="text-sm text-muted-foreground">Invite your child to link their account.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite a child</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
            <div>
              <Label>Child's email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="child@example.com" />
            </div>
            <div>
              <Label>Relationship</Label>
              <Input value={relationship} onChange={(e) => setRelationship(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={invite} disabled={loading} className="w-full">
                Create invite
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invites</CardTitle>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invites yet.</p>
          ) : (
            <ul className="divide-y">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{i.child_email}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.status} · expires {new Date(i.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copyLink(i.token)}>
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copy link
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linked children</CardTitle>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked children.</p>
          ) : (
            <ul className="divide-y">
              {links.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{profiles[l.child_id] ?? "Child"}</p>
                    <p className="text-xs text-muted-foreground">{l.relationship} · {l.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{l.status}</Badge>
                    <Button size="icon" variant="ghost" onClick={() => unlink(l.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Have an invite link?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            If a parent sent you a link, paste the token here to accept the link to their account.
          </p>
          <div className="flex gap-2">
            <Input
              value={acceptToken}
              onChange={(e) => setAcceptToken(e.target.value)}
              placeholder="Invite token"
            />
            <Button onClick={accept}>Accept</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
