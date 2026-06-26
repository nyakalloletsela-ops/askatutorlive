import { useEffect, useRef, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

let mermaidPromise: Promise<typeof import("mermaid")["default"]> | null = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        fontFamily: "inherit",
      });
      return m.default;
    });
  }
  return mermaidPromise;
}

let counter = 0;

interface Props {
  spec: string;
  onRendered?: (svg: string) => void;
}

export function DiagramBlock({ spec, onRendered }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadMermaid()
      .then(async (mermaid) => {
        const id = `mermaid-${++counter}`;
        try {
          const { svg } = await mermaid.render(id, spec);
          if (cancelled || !ref.current) return;
          ref.current.innerHTML = svg;
          onRendered?.(svg);
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Diagram failed to render");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [spec, nonce, onRendered]);

  if (error) {
    return (
      <div className="my-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
        <div className="mb-2 flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Diagram failed to render</span>
          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-destructive/10"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-muted-foreground">{spec}</pre>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="my-3 flex justify-center overflow-x-auto rounded-md border bg-card/40 p-3 [&_svg]:max-w-full [&_svg]:h-auto"
      aria-label="Diagram"
    />
  );
}
