import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/whiteboard-review/$sessionId")({
  component: ReviewPage,
});

function ReviewPage() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <Button asChild size="sm" variant="ghost">
          <Link to="/dashboard">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Link>
        </Button>
        <p className="text-sm font-semibold">Recording review</p>
        <span className="w-16" />
      </header>
      <main className="grid min-h-0 flex-1 place-items-center p-8 text-center">
        <div className="max-w-md space-y-3">
          <p className="text-sm font-medium">Recording playback is being upgraded</p>
          <p className="text-xs text-muted-foreground">
            The whiteboard recording format is being migrated to the new canvas engine.
            Existing recordings from the legacy whiteboard are not available for replay.
            Future sessions will be replayable here.
          </p>
        </div>
      </main>
    </div>
  );
}
