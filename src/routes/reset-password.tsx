import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });

    const init = async () => {
      try {
        const url = new URL(window.location.href);

        // 1. PKCE flow — Supabase appends ?code=...
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          // Clean the code out of the address bar so a refresh doesn't retry it.
          url.searchParams.delete("code");
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
          if (!cancelled) setReady(true);
          return;
        }

        // 2. Legacy hash-token flow (#access_token=...&type=recovery)
        const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const errDesc = hashParams.get("error_description") ?? url.searchParams.get("error_description");
        if (errDesc) throw new Error(errDesc);
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
          window.history.replaceState({}, "", url.pathname + url.search);
          if (!cancelled) setReady(true);
          return;
        }

        // 3. Already signed in via an existing recovery session
        const { data } = await supabase.auth.getSession();
        if (data.session && !cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setLinkError((e as Error).message);
      }
    };

    void init();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);


  const handleSubmit = async () => {
    if (password.length < 6) return toast.error("Password must be at least 6 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4 py-10">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto mb-2 flex items-center gap-2 text-navy">
            <GraduationCap className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold">Ask A Tutor</span>
          </Link>
          <CardTitle>Set a new password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {linkError ? (
            <div className="space-y-2 text-center">
              <p className="text-sm text-destructive">{linkError}</p>
              <p className="text-xs text-muted-foreground">
                The link may be expired or already used. Request a new one from the sign-in page.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth">Back to sign in</Link>
              </Button>
            </div>
          ) : !ready ? (
            <p className="text-center text-sm text-muted-foreground">
              Open this page from the password-reset link in your email.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>New password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm password</Label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={loading}>
                Update password
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
