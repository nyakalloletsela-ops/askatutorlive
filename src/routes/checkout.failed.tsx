import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/failed")({
  validateSearch: (s: Record<string, unknown>) => ({
    reason: typeof s.reason === "string" ? s.reason : undefined,
  }),
  component: FailedPage,
});

function FailedPage() {
  const { reason } = useSearch({ from: "/checkout/failed" });
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <XCircle className="h-12 w-12 text-destructive" />
      <h1 className="text-2xl font-semibold">Payment didn't go through</h1>
      <p className="text-sm text-muted-foreground">
        We couldn't complete your payment. You haven't been charged.
      </p>
      {reason ? <p className="text-xs text-muted-foreground">Reason: {reason}</p> : null}
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
        <Button asChild>
          <Link to="/tutors">Try again</Link>
        </Button>
      </div>
    </div>
  );
}
