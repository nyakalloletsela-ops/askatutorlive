
# Universal AI Simulation Lab — Build Plan

This is a large spec. To ship it production-ready (not as a buggy half-build), I'll deliver in tight phases. Each phase is independently testable; you approve, I move on.

## Current state (already exists)
- Route: `/labs/simulation-lab` (lazy 3D scene, prompt → AI schema → save to library)
- DB: `simulations`, `simulation_versions`, `simulation_assets` (+ embeddings, tags)
- AI gateway helpers, similarity search, thumbnail capture
- Subject-aware schema (physics/bio/chem/math/economics primitives + connections)
- Classroom action bar links to PhET + Simulation Lab

Gap vs your spec: not truly universal (no history/geography/language/process modes), no per-object click-to-explain, no AI side-chat, no auto-quiz, no 4 learning modes, no live classroom sync, no tutor/student role split, empty-state not premium, mobile UX thin.

## Phase A — Universal Schema + Renderer Upgrade (foundation)
Rewrite the AI schema + renderer to be truly multi-modal. One unified `SimulationDoc` with a `visualization` discriminator:
- `scene3d` (current) — physics/bio/chem/astronomy/engineering
- `scene2d` — math graphs, economics curves, statistics (Recharts + framer-motion overlays)
- `process` — step-by-step animated flow (photosynthesis, CPU, water cycle)
- `timeline` — historical events with scrub bar + map pins
- `geo` — world/region map with animated layers (tectonics, climate)
- `language` — illustrated dialogue scene with speakable lines

AI system prompt rewritten to pick the right `visualization` automatically and emit labels + per-object `explain` text.

## Phase B — Premium UX shell + Empty state + Controls
- Glassmorphism dark shell, ambient particles + grid in empty state
- Full control bar: play/pause/restart/replay, speed 0.25/0.5/1/2/4, zoom/pan/rotate hints, fullscreen, step-forward/back for process/timeline modes
- Mobile-first prompt bar that doesn't fight the canvas
- Object click → right-side **Explain panel** (name, definition, purpose, key facts, misconceptions)

## Phase C — AI Side Chat + Auto Quiz
- Persistent right-side AI chat (AI Elements) with current simulation as context: "Explain", "Simplify", "Harder example", "Quiz me"
- One-tap **Generate Quiz** → MCQ / T-F / short-answer at Beginner/Intermediate/Advanced, scored inline

## Phase D — Learning Modes
Mode switcher: Guided (AI narrates step-by-step) · Explore (free) · Tutor (locked playback) · Assessment (quiz-only)

## Phase E — Classroom integration + Realtime sync
- Mount Simulation Lab as a classroom tab (alongside Video / Whiteboard / PhET / Notes)
- New table `classroom_sim_state(room_id, schema, playing, t, controller_user_id, mode)` + Realtime
- Tutor = controller; students view/interact within mode permissions
- Tutor tools: highlight object, freeze, draw-over (reuse whiteboard overlay)

## Phase F — Polish & perf
- Scene caching, lazy primitives, 60fps audit on mobile
- SEO/meta, accessibility pass, error boundaries, credit-exhaustion + rate-limit toasts

---

## What I need from you before starting

This is a 2–4 hour build at minimum. To avoid another round of "not what I wanted", confirm:

1. **Start with Phase A (universal schema + renderer)?** That's the foundation everything else stands on. Without it, classroom sync / quiz / modes are decorating a renderer that can't handle history or language.
2. **Classroom sync scope** — should every classroom participant truly see the same frame in realtime (full sync, more complex), or is "tutor generates, students see the result + can explore on their own copy" acceptable for v1?
3. **Quiz storage** — save quiz attempts to DB (analytics later), or just in-memory for the session?

Once you answer, I'll execute Phase A end-to-end and report back before touching B.
