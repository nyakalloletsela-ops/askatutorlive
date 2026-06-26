import { Sparkles, Atom, BookOpen, Globe2, MessageSquare, LineChart, Workflow } from "lucide-react";

const samples = [
  { icon: Atom, label: "Physics", text: "Show projectile motion at 45°" },
  { icon: LineChart, label: "Math", text: "Plot y = sin(x) and its derivative" },
  { icon: Workflow, label: "Process", text: "How does photosynthesis work?" },
  { icon: Globe2, label: "Geography", text: "Plate tectonics over time" },
  { icon: BookOpen, label: "History", text: "Timeline of WWII key events" },
  { icon: MessageSquare, label: "Language", text: "French restaurant dialogue" },
];

export function AmbientEmpty({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* ambient gradient + grid + particles */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.18),transparent_60%),radial-gradient(circle_at_70%_80%,rgba(34,211,238,0.15),transparent_60%)]" />
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
      <div className="absolute inset-0">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="absolute block h-1 w-1 rounded-full bg-white/40 animate-pulse"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              animationDelay: `${(i % 7) * 0.3}s`,
              animationDuration: `${2 + (i % 4)}s`,
            }}
          />
        ))}
      </div>

      <div className="pointer-events-auto relative z-10 flex h-full items-center justify-center px-4">
        <div className="w-full max-w-xl animate-fade-in rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h2 className="bg-gradient-to-r from-white via-violet-100 to-cyan-200 bg-clip-text text-2xl font-bold text-transparent">
            Universal AI Simulation Lab
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Turn any question, scenario, or concept — from any subject — into a live, interactive visualization.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {samples.map((s) => (
              <button
                key={s.label}
                onClick={() => onPick(s.text)}
                className="group flex flex-col items-start gap-1 rounded-xl border border-white/10 bg-black/30 p-2.5 text-left transition hover:border-violet-400/50 hover:bg-violet-500/10"
              >
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40">
                  <s.icon className="h-3 w-3" /> {s.label}
                </div>
                <div className="text-xs leading-snug text-white/80 group-hover:text-white">{s.text}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
