import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Star, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
  head: () => ({
    meta: [
      { title: "Top Tutors Leaderboard — Ask A Tutor Live" },
      { name: "description", content: "See the highest-rated and most-active tutors on Ask A Tutor Live." },
      { property: "og:title", content: "Top Tutors Leaderboard — Ask A Tutor Live" },
      { property: "og:description", content: "Lesotho's top-rated tutors, ranked by student reviews." },
    ],
  }),
});

type Tutor = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_featured: boolean;
  subjects: string[] | null;
  avg_rating: number;
  review_count: number;
};

function LeaderboardPage() {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("list_public_tutors");
      const sorted = (data ?? [])
        .filter((t: Tutor) => t.review_count > 0)
        .sort((a: Tutor, b: Tutor) => {
          if (b.avg_rating !== a.avg_rating) return Number(b.avg_rating) - Number(a.avg_rating);
          return b.review_count - a.review_count;
        });
      setTutors(sorted);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-primary text-white shadow-glow">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Top tutors leaderboard</h1>
            <p className="text-sm text-muted-foreground">Ranked by student ratings.</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tutors.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No reviewed tutors yet — be the first to leave a review.</CardContent></Card>
        ) : (
          <ol className="space-y-2">
            {tutors.map((t, i) => (
              <li key={t.id}>
                <Card className={i < 3 ? "border-gold/60" : ""}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      i === 0 ? "bg-gold text-gold-foreground" :
                      i === 1 ? "bg-muted-foreground/30 text-foreground" :
                      i === 2 ? "bg-amber-700/40 text-amber-100" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      #{i + 1}
                    </div>
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {t.avatar_url ? (
                        <img src={t.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-aurora text-sm font-bold text-white">
                          {(t.full_name ?? "T").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-semibold">{t.full_name ?? "Tutor"}</p>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {(t.subjects ?? []).slice(0, 3).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1 text-sm font-semibold">
                        <Star className="h-4 w-4 fill-gold text-gold" />
                        {Number(t.avg_rating).toFixed(1)}
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{t.review_count} reviews</Badge>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
