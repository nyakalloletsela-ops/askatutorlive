import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/dashboard/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { User, Bell, CreditCard, Shield, Palette, LogOut, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — AskATutorLive" },
      { name: "description", content: "Profile, notifications, appearance, security and billing." },
    ],
  }),
  component: SettingsPage,
});

type ProfileRow = {
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  phone: string | null;
};

function SettingsPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account and preferences.</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-5">
          <TabsList className="flex w-full flex-wrap gap-1 sm:w-auto">
            <TabsTrigger value="profile"><User className="mr-1.5 h-4 w-4" />Profile</TabsTrigger>
            <TabsTrigger value="appearance"><Palette className="mr-1.5 h-4 w-4" />Appearance</TabsTrigger>
            <TabsTrigger value="notifications"><Bell className="mr-1.5 h-4 w-4" />Notifications</TabsTrigger>
            <TabsTrigger value="security"><Shield className="mr-1.5 h-4 w-4" />Security</TabsTrigger>
            <TabsTrigger value="billing"><CreditCard className="mr-1.5 h-4 w-4" />Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="profile"><ProfileSection /></TabsContent>
          <TabsContent value="appearance"><AppearanceSection /></TabsContent>
          <TabsContent value="notifications"><NotificationsSection /></TabsContent>
          <TabsContent value="security"><SecuritySection /></TabsContent>
          <TabsContent value="billing"><BillingSection /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

/* ===================== PROFILE ===================== */

function ProfileSection() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileRow>({
    full_name: "",
    bio: "",
    avatar_url: "",
    phone: "",
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, bio, avatar_url, phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        if (data) setProfile(data as ProfileRow);
        setLoading(false);
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name?.trim() || null,
        bio: profile.bio?.trim() || null,
        avatar_url: profile.avatar_url?.trim() || null,
        phone: profile.phone?.trim() || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>How you appear across AskATutorLive.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-muted">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                {(profile.full_name ?? user?.email ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="avatar_url">Avatar URL</Label>
            <Input
              id="avatar_url"
              placeholder="https://…"
              value={profile.avatar_url ?? ""}
              onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={profile.full_name ?? ""}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} disabled />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone (private)</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+1 555…"
            value={profile.phone ?? ""}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Only visible to you and admins.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            rows={4}
            placeholder="A short intro shown on your profile."
            value={profile.bio ?? ""}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={loading || saving} className="bg-aurora text-white">
            <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ===================== APPEARANCE ===================== */

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Light or dark — your call.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border p-4">
          <div>
            <div className="font-medium">Dark mode</div>
            <div className="text-xs text-muted-foreground">Easier on the eyes at night.</div>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ===================== NOTIFICATIONS ===================== */

function NotificationsSection() {
  const [emailBookings, setEmailBookings] = useState(true);
  const [emailReminders, setEmailReminders] = useState(true);
  const [productUpdates, setProductUpdates] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Pick what lands in your inbox.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ToggleRow
          label="Booking confirmations"
          desc="When a session is booked, rescheduled or cancelled."
          checked={emailBookings}
          onChange={setEmailBookings}
        />
        <ToggleRow
          label="Session reminders"
          desc="A nudge before your session starts."
          checked={emailReminders}
          onChange={setEmailReminders}
        />
        <ToggleRow
          label="Product updates"
          desc="Occasional emails about new features."
          checked={productUpdates}
          onChange={setProductUpdates}
        />
        <Separator />
        <Button asChild variant="outline" size="sm">
          <Link to="/notifications">Open notification inbox</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label, desc, checked, onChange,
}: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-4">
      <div className="pr-4">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/* ===================== SECURITY ===================== */

function SecuritySection() {
  const { signOut, user } = useAuth();
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const changePassword = async () => {
    if (pwd.length < 8) { toast.error("Use at least 8 characters"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); setPwd(""); }
  };

  const sendReset = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) toast.error(error.message);
    else toast.success("Reset email sent");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
        <CardDescription>Password and sessions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-pwd">New password</Label>
          <div className="flex gap-2">
            <Input
              id="new-pwd"
              type="password"
              placeholder="At least 8 characters"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
            />
            <Button onClick={changePassword} disabled={busy || pwd.length < 8} className="bg-aurora text-white">
              Update
            </Button>
          </div>
        </div>
        <Separator />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={sendReset}>Email me a reset link</Button>
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ===================== BILLING ===================== */

function BillingSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing & Payments</CardTitle>
        <CardDescription>Wallet, plans, and payment history.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button asChild variant="outline"><Link to="/wallet">Open wallet</Link></Button>
        <Button asChild variant="outline"><Link to="/dashboard">View sessions</Link></Button>
      </CardContent>
    </Card>
  );
}
