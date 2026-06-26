import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import type { SimulationSchemaT } from "@/lib/sim-lab.functions";
import { Scene2D } from "./Scene2D";
import { ProcessView } from "./ProcessView";
import { TimelineView } from "./TimelineView";
import { GeoView } from "./GeoView";
import { LanguageView } from "./LanguageView";
import type * as THREE from "three";

const SimScene = lazy(() => import("./SimScene").then((m) => ({ default: m.SimScene })));

type Props = {
  schema: SimulationSchemaT | null;
  playing: boolean;
  resetKey: number;
  timeScale: number;
  onCanvasReady?: (gl: THREE.WebGLRenderer) => void;
  onSelectObject?: (i: number) => void;
};

export function SimDispatch({ schema, playing, resetKey, timeScale, onCanvasReady, onSelectObject }: Props) {
  if (!schema) {
    return (
      <Suspense fallback={<div className="flex h-full items-center justify-center text-white/60"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
        <SimScene schema={null} playing={playing} resetKey={resetKey} timeScale={timeScale} onCanvasReady={onCanvasReady} onSelectObject={onSelectObject} />
      </Suspense>
    );
  }
  switch (schema.visualization) {
    case "scene2d":
      return <Scene2D schema={schema} playing={playing} resetKey={resetKey} timeScale={timeScale} />;
    case "process":
      return <ProcessView schema={schema} playing={playing} resetKey={resetKey} timeScale={timeScale} onSelectObject={onSelectObject} />;
    case "timeline":
      return <TimelineView schema={schema} playing={playing} resetKey={resetKey} timeScale={timeScale} />;
    case "geo":
      return <GeoView schema={schema} />;
    case "language":
      return <LanguageView schema={schema} />;
    case "scene3d":
    default:
      return (
        <Suspense fallback={<div className="flex h-full items-center justify-center text-white/60"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
          <SimScene schema={schema} playing={playing} resetKey={resetKey} timeScale={timeScale} onCanvasReady={onCanvasReady} onSelectObject={onSelectObject} />
        </Suspense>
      );
  }
}
