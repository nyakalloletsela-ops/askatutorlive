import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Boxes, RotateCw, ExternalLink, Lock } from "lucide-react";

type Props = {
  enforceLimit: boolean;
  viewedSlugs: string[];
  limit: number;
  onOpen: (slug: string) => void;
};

const LAB_URL = "https://3dlab.bolt.host";

/**
 * 3D Virtual Lab — embeds the Lordda 3D Discovery Lab (70 interactive
 * modules across Math, Physics, Chemistry, Biology, Engineering).
 * Hosted externally at 3dlab.bolt.host.
 */
export function ThreeDLab({ enforceLimit, viewedSlugs, limit, onOpen }: Props) {
  const [key, setKey] = useState(0);
  const usedCount = viewedSlugs.length;
  const quotaReached = enforceLimit && usedCount >= limit;

  // Count one "experiment view" per session load for quota purposes.
  // (The external lab manages its own module selection.)
  const trackVisit = () => {
    if (!enforceLimit) return;
    const slug = `lordda-3dlab-${Date.now()}`;
    if (!viewedSlugs.includes(slug)) onOpen(slug);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 p-2">
        <Boxes className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Lordda 3D Discovery Lab</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          70 interactive modules · Math · Physics · Chemistry · Biology · Engineering
        </span>
        {enforceLimit && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {usedCount}/{limit} sessions used
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => { setKey((k) => k + 1); trackVisit(); }}
            aria-label="Reload"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button asChild size="icon" variant="outline" aria-label="Open in new tab">
            <a href={LAB_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
      {quotaReached ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-muted/20 p-8 text-center">
          <Lock className="h-10 w-10 text-primary" />
          <h3 className="text-lg font-semibold">Free lab quota reached</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            You've used your {limit} free experiments. Book a tutor session to keep exploring all 70 3D modules.
          </p>
        </div>
      ) : (
        <iframe
          key={key}
          src={LAB_URL}
          title="Lordda 3D Discovery Lab"
          loading="lazy"
          allow="fullscreen; autoplay; xr-spatial-tracking; accelerometer; gyroscope"
          className="flex-1 w-full border-0 bg-[#0a0a1a]"
          onLoad={trackVisit}
        />
      )}
    </div>
  );
}
