import { useEffect, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Search = { token?: string };

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const [state, setState] = useState<
    "loading" | "ready" | "already" | "invalid" | "done" | "error"
  >("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
        if (r.status === 404) return setState("invalid");
        const j = await r.json();
        if (j.valid) setState("ready");
        else if (j.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json();
      if (j.success) setState("done");
      else if (j.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && <p className="text-sm text-muted-foreground">Checking your link…</p>}
          {state === "invalid" && (
            <p className="text-sm text-muted-foreground">This unsubscribe link is invalid or expired.</p>
          )}
          {state === "already" && (
            <p className="text-sm text-muted-foreground">You're already unsubscribed.</p>
          )}
          {state === "ready" && (
            <>
              <p className="text-sm">
                Click the button below to stop receiving emails from Ask A Tutor Live at this address.
              </p>
              <Button onClick={confirm} disabled={busy}>
                {busy ? "Working…" : "Confirm unsubscribe"}
              </Button>
            </>
          )}
          {state === "done" && (
            <p className="text-sm text-muted-foreground">
              You've been unsubscribed. We're sorry to see you go.
            </p>
          )}
          {state === "error" && (
            <p className="text-sm text-destructive">Something went wrong. Please try again later.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
