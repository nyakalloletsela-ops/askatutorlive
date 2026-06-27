import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/cancelled")({
  component: () => (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertCircle className="h-12 w-12 text-amber-500" />
      <h1 className="text-2xl font-semibold">Payment cancelled</h1>
      <p className="text-sm text-muted-foreground">
        No charge was made. You can pick another time or tutor whenever you're ready.
      </p>
      <Button asChild>
        <Link to="/tutors">Browse tutors</Link>
      </Button>
    </div>
  ),
});
