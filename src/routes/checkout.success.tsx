import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/success")({
  component: () => (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <CheckCircle2 className="h-12 w-12 text-emerald-500" />
      <h1 className="text-2xl font-semibold">Payment received</h1>
      <p className="text-sm text-muted-foreground">
        Thanks — your booking is confirmed and the tutor has been notified.
      </p>
      <Button asChild>
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  ),
});
