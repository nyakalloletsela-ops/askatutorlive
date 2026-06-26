import { Volume2 } from "lucide-react";
import type { SimulationSchemaT } from "@/lib/sim-lab.functions";

type Props = { schema: SimulationSchemaT };

function speak(text: string, lang?: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    if (lang) u.lang = lang === "fr" ? "fr-FR" : lang === "es" ? "es-ES" : lang === "de" ? "de-DE" : lang === "it" ? "it-IT" : lang === "ja" ? "ja-JP" : lang === "zh" ? "zh-CN" : lang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

export function LanguageView({ schema }: Props) {
  const lang = schema.language;
  if (!lang) return <div className="flex h-full items-center justify-center text-white/50">No language scene</div>;

  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-b from-[#0b1020] to-[#1a0b2e] p-4 text-white">
      <div className="mb-2 text-sm font-semibold">{schema.title}</div>
      <div className="mb-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70">📍 {lang.setting}</div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {lang.dialogue.map((line, i) => {
          const c = lang.characters[line.speaker] ?? lang.characters[0];
          const isMe = line.speaker === 0;
          return (
            <div key={i} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xl"
                style={{ background: c?.color ?? "#22d3ee" }}
              >{c?.emoji ?? "🧑"}</div>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMe ? "bg-violet-500/30 border border-violet-400/40" : "bg-white/10 border border-white/10"}`}>
                <div className="mb-1 text-[10px] uppercase tracking-wide text-white/50">{c?.name ?? "Speaker"}</div>
                <div className="flex items-center gap-2 text-base">
                  <span>{line.original}</span>
                  <button onClick={() => speak(line.original, line.lang)} className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Speak"><Volume2 className="h-3.5 w-3.5" /></button>
                </div>
                {line.translation && <div className="mt-1 text-xs italic text-white/60">{line.translation}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {lang.vocabulary && lang.vocabulary.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">Vocabulary</div>
          <div className="flex flex-wrap gap-2">
            {lang.vocabulary.map((v, i) => (
              <div key={i} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
                <span className="font-semibold text-cyan-300">{v.term}</span>
                <span className="text-white/50"> — {v.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
