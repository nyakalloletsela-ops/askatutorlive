import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlaskConical, RotateCw, ExternalLink, Search, Lock, Users } from "lucide-react";
import {
  LAB_MODULES,
  LAB_SUBJECTS,
  LAB_LEVELS,
  phetUrl,
  type LabModule,
  type LabSubject,
  type LabLevel,
} from "@/lib/lab-modules";

type Props = {
  /** When true, student-tier limits apply. */
  enforceLimit: boolean;
  /** Already-viewed slugs (for student quota). */
  viewedSlugs: string[];
  /** Maximum unique experiments a student may access. */
  limit: number;
  /** Called when a new experiment is opened so the parent can update quota. */
  onOpen: (slug: string) => void;
  /** When provided, the selected experiment is synchronized between participants of the classroom. */
  roomId?: string;
};

export function LorddaLab({ enforceLimit, viewedSlugs, limit, onOpen, roomId }: Props) {
  const [selected, setSelected] = useState<LabModule | null>(LAB_MODULES[0]);
  const [key, setKey] = useState(0);
  const [filter, setFilter] = useState<LabSubject | "All">("All");
  const [levelFilter, setLevelFilter] = useState<LabLevel | "All">("All");
  const [query, setQuery] = useState("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const remoteApplyRef = useRef(false);

  // Sync the active experiment between classroom participants.
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`lab:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "select" }, ({ payload }) => {
        const slug = (payload as { slug?: string })?.slug;
        if (!slug) return;
        const m = LAB_MODULES.find((x) => x.slug === slug);
        if (!m) return;
        remoteApplyRef.current = true;
        setSelected(m);
        setKey((k) => k + 1);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomId]);

  const visible = useMemo(
    () =>
      LAB_MODULES.filter((m) => filter === "All" || m.subject === filter)
        .filter((m) => levelFilter === "All" || (m.level ?? "Secondary") === levelFilter)
        .filter(
          (m) =>
            !query.trim() ||
            m.name.toLowerCase().includes(query.toLowerCase()) ||
            m.description.toLowerCase().includes(query.toLowerCase()),
        ),
    [filter, levelFilter, query],
  );

  const grouped = useMemo(() => {
    const g: Record<string, LabModule[]> = {};
    for (const m of visible) (g[m.subject] ||= []).push(m);
    return g;
  }, [visible]);

  const usedCount = viewedSlugs.length;
  const quotaReached =
    enforceLimit && selected != null && !viewedSlugs.includes(selected.slug) && usedCount >= limit;

  const tryOpen = (m: LabModule) => {
    if (enforceLimit && !viewedSlugs.includes(m.slug) && usedCount >= limit) {
      setSelected(m);
      return;
    }
    setSelected(m);
    setKey((k) => k + 1);
    onOpen(m.slug);
    if (roomId && !remoteApplyRef.current) {
      channelRef.current?.send({
        type: "broadcast",
        event: "select",
        payload: { slug: m.slug },
      });
    }
    remoteApplyRef.current = false;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 p-2">
        <FlaskConical className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-navy">PhET Virtual Lab</span>
        {enforceLimit && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {usedCount}/{limit} experiments used
          </span>
        )}
        {roomId && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
            <Users className="h-3 w-3" /> Synced with classroom
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search experiments"
              className="h-9 w-[180px] pl-7 text-sm"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as LabSubject | "All")}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All subjects</SelectItem>
              {LAB_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as LabLevel | "All")}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All levels</SelectItem>
              {LAB_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={selected?.id ?? ""}
            onValueChange={(v) => {
              const m = LAB_MODULES.find((m) => m.id === v) ?? null;
              if (m) tryOpen(m);
            }}
          >
            <SelectTrigger className="h-9 w-[260px]"><SelectValue placeholder="Choose an experiment" /></SelectTrigger>
            <SelectContent className="max-h-[60vh]">
              {Object.entries(grouped).map(([subject, mods]) => (
                <SelectGroup key={subject}>
                  <SelectLabel>{subject}</SelectLabel>
                  {mods.map((m) => {
                    const locked = enforceLimit && !viewedSlugs.includes(m.slug) && usedCount >= limit;
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        {locked && <Lock className="mr-1 inline h-3 w-3" />}
                        {m.name}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              ))}
              {visible.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">No matches.</div>
              )}
            </SelectContent>
          </Select>
          <Button size="icon" variant="outline" onClick={() => setKey((k) => k + 1)} aria-label="Reload">
            <RotateCw className="h-4 w-4" />
          </Button>
          {selected && (
            <Button asChild size="icon" variant="outline" aria-label="Open in new tab">
              <a href={phetUrl(selected.slug)} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
            </Button>
          )}
        </div>
      </div>

      {quotaReached ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-muted/20 p-8 text-center">
          <Lock className="h-10 w-10 text-primary" />
          <h3 className="text-lg font-semibold">Free lab quota reached</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            You've opened {limit} experiments on the free student tier. Book a session with a
            tutor to unlock unlimited access to all {LAB_MODULES.length}+ simulations.
          </p>
        </div>
      ) : selected ? (
        <iframe
          key={key}
          src={phetUrl(selected.slug)}
          title={selected.name}
          loading="lazy"
          allow="fullscreen; autoplay; xr-spatial-tracking"
          className="flex-1 w-full border-0 bg-white"
        />
      ) : (
        <div className="flex-1 p-6 text-sm text-muted-foreground">Select an experiment.</div>
      )}
      {selected && !quotaReached && (
        <p className="border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{selected.subject} · {selected.name}</span> — {selected.description}
        </p>
      )}
    </div>
  );
}
